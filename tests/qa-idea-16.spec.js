// QA checks for IDEA-16 (TASK-27 to TASK-29) that the task specs do not cover: put-back and publish after slot
// changes in the admin, a tab press while the photo is flipped, and live PC / phone switching in the hall.
const path = require('path');
const { test, expect, BRANCH, FakeRepo, openFold, saveFakeToken } = require('./github-mock');
const { showEvent, mockEvents } = require('./helpers');

const SMALL = path.join(__dirname, 'fixtures', 'flat-800x600.png');
const REPO = '/repos/jiayangwong/MyCosplayWebsite';
const TREE_POST = `POST ${REPO}/git/trees`;
const REF_PATCH = `PATCH ${REPO}/git/refs/heads/${BRANCH}`;
const expectResult = expect.configure({ timeout: 15000 });
test.describe.configure({ timeout: 90000 });

const X = '2026-03-14-cf';
const Y = '2025-08-09-omt';
const ev = (id, extra = {}) => ({ id, date: id.slice(0, 10), short: id.slice(11).toUpperCase(), name: `${id.slice(11).toUpperCase()} Test Con`, ...extra });
const webp = (tag) => Buffer.concat([Buffer.from('RIFF\x10\x00\x00\x00WEBP', 'latin1'), Buffer.from(tag)]);
/** A published photo entry: media/events/<id>/<name>.webp + -full.webp. */
const pic = (id, name) => ({ photo: `media/events/${id}/${name}.webp`, photoFull: `media/events/${id}/${name}-full.webp` });
const files = (...pics) => Object.fromEntries(pics.flatMap((p) => [[p.photo, webp(p.photo)], [p.photoFull, webp(p.photoFull)]]));
/** Event with these photos as the admin writes them (E2 / E3). */
const withPhotos = (id, list, extra = {}) => ev(id, {
  photo: list[0].photo, photoFull: list[0].photoFull, ...(list.length > 1 ? { photos: list } : {}), ...extra,
});
const NAMES = ['flat-800x600', 'flat-800x600-2', 'flat-800x600-3'];
const mine = (id) => NAMES.map((n) => pic(id, n));

const card = (page, i) => page.locator('.wm-card').nth(i);
const row = (page, id) => page.locator(`.event-row[data-id="${id}"]`);
const writes = (github) => github.calls().filter((c) => !c.startsWith('GET '));
const newCommits = (github) => github.repo.commits.size - 1;
const treeBody = (github) => github.requests.filter((r) => `${r.method} ${r.path}` === TREE_POST).pop().body;
const committed = (github, p) => JSON.parse(github.repo.read(p));
const draftEvent = (page, id) => page.evaluate(async (eid) => {
  const m = await import('/js/admin/manager.js');
  return JSON.parse(m.draftText()).events.find((e) => e.id === eid) || null;
}, id);
const slotValues = (page) => page.evaluate(() => ['f-photo', 'f-photo-2', 'f-photo-3'].map((x) => document.getElementById(x).value));
const fullValues = (page) => page.evaluate(() => ['f-photo-full', 'f-photo-full-2', 'f-photo-full-3'].map((x) => document.getElementById(x).value));

async function ready(page) {
  for (const flag of ['manager', 'uploader', 'github', 'publish']) {
    await expectResult(page.locator('html')).toHaveAttribute(`data-${flag}-ready`, 'true');
  }
}

async function setup(page, github, { events = [ev(X), ev(Y)], repoFiles = {} } = {}) {
  const text = `${JSON.stringify({ version: 1, events }, null, 2)}\n`;
  github.repo = new FakeRepo({ files: { 'data/events.json': text, ...repoFiles } });
  await page.route('**/data/events.json', (route) => route.fulfill({ contentType: 'application/json', body: text }));
  page.on('dialog', (d) => d.accept());
  await page.goto('admin/index.html');
  await ready(page);
  await openFold(page, 'form-panel');
  await openFold(page, 'wm-panel');
  await saveFakeToken(page);
}

async function edit(page, id) {
  await showEvent(page, id);
  await row(page, id).getByRole('button', { name: /^Edit/ }).press('Enter');
  await expect(page.locator('#wm-event-id')).toHaveText(id);
}

/** Uploads the small fixture n more times (names flat-800x600, -2, -3 ...) and waits until they are ready. */
async function upload(page, n) {
  const first = await page.locator('.wm-card').count();
  for (let i = 0; i < n; i += 1) {
    await page.setInputFiles('#wm-files', SMALL);
    await expectResult(card(page, first + i)).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
  }
}

const attachBtn = (page, i) => card(page, i).getByRole('button', { name: 'Attach to selected event' });

async function attachCards(page, ...indexes) {
  for (const i of indexes) await attachBtn(page, i).press('Enter');
}

async function openPublish(page) {
  await openFold(page, 'pub');
}


test('admin: X on a published D1, attach, "Remove from publish" puts the published photo and Sample tag back', async ({ page, github }) => {
  const old = pic(X, 'old');
  await setup(page, github, { events: [withPhotos(X, [old], { sample: true }), ev(Y)], repoFiles: files(old) });
  await upload(page, 1);
  await edit(page, X);
  await page.getByRole('button', { name: 'Remove photo D1', exact: true }).press('Enter');
  await attachCards(page, 0);
  await openPublish(page);
  await page.locator('#pub-pending .pend-remove').press('Enter');
  await expectResult(page.locator('#pub-note')).toHaveText('Photo for CF 2026 set back to the published photo.');
  expect(await draftEvent(page, X)).toEqual(withPhotos(X, [old], { sample: true }));
  await expect(page.locator('#pub-pending')).toHaveText('No pending changes.');
  expect(writes(github)).toEqual([]);
});

test('admin: reordering published photos publishes only events.json, with the new D1 as the mirror and no removals', async ({ page, github }) => {
  const [a, b, c] = [pic(X, 'a'), pic(X, 'b'), pic(X, 'c')];
  await setup(page, github, { events: [withPhotos(X, [a, b, c]), ev(Y)], repoFiles: files(a, b, c) });
  await edit(page, X);
  await page.getByRole('button', { name: 'Move photo D3 up', exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Move photo D2 up', exact: true }).press('Enter');
  await openPublish(page);
  await page.locator('#publish-btn').press('Enter');
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  await expect(page.locator('#pub-confirm')).toBeHidden();
  expect(treeBody(github).tree.map((e) => e.path)).toEqual(['data/events.json']);
  expect(committed(github, 'data/events.json').events.find((e) => e.id === X)).toEqual(withPhotos(X, [c, a, b]));
});

test('hall: a tab press while flipped shows the other day unflipped; the stop survives a switch to PC and back', async ({ page }) => {
  const id = '2026-08-01-aaa';
  await page.route('**/media/events/**', (r) => r.fulfill({ path: SMALL }));
  await mockEvents(page, [{ id, date: '2026-08-01', short: 'AAA', name: 'Alpha Fest', photos: [1, 2, 3].map((n) => ({ photo: `media/events/aaa/p${n}.webp` })) }]);
  await page.setViewportSize({ width: 375, height: 740 });
  await page.goto('index.html');
  const pile = page.locator(`#hall-${id} .pile`);
  await pile.locator('.pl.on .polaroid').click();
  await expect(pile.locator('.pl.on .flip')).toHaveClass(/is-flipped/);
  await pile.getByRole('tab', { name: 'D2' }).click();
  await expect(pile.locator('.is-flipped')).toHaveCount(0);
  await expect(pile.locator('.pl.on')).toHaveAttribute('data-d', '2');
  await expect(pile).toHaveAttribute('data-story-state', 'stopped');
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(pile.locator('.pile-toggle')).toBeVisible();
  await expect(pile.locator('.dtabs')).toBeHidden();
  await expect(pile.locator('.pl[role="tabpanel"], .pl[aria-hidden]')).toHaveCount(0);
  await page.setViewportSize({ width: 375, height: 740 });
  await expect(pile.locator('.pile-toggle')).toBeHidden();
  await expect(pile).toHaveAttribute('data-story-state', 'stopped');
  await expect(pile.locator('.pl.on')).toHaveAttribute('data-d', '2');
  await expect(pile.getByRole('tab', { name: 'D2' })).toHaveAttribute('aria-selected', 'true');
});
