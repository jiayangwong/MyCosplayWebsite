// TASK-21: Admin Moments panel (list, add, edit, delete, reorder) and Publish of data/moments.json.
// Uses the strict in-memory fake repo from tests/github-mock.js and the fake token only: any unhandled
// api.github.com call, an unreleased hold() or a leaked token fails the test.
const fs = require('fs');
const path = require('path');
const { test, expect, BRANCH, FAKE_TOKEN, FakeRepo, openFold, openBackup } = require('./github-mock');

const ROOT = path.join(__dirname, '..');
const REPO = '/repos/jiayangwong/MyCosplayWebsite';
const REF_PATCH = `PATCH ${REPO}/git/refs/heads/${BRANCH}`;
const SUCCESS = 'Published. The site updates in about 1-2 minutes.';
const expectResult = expect.configure({ timeout: 15000 });
test.describe.configure({ timeout: 60000 });

const EVENTS_TEXT = `${JSON.stringify({ version: 1, events: [{ id: '2026-03-14-cf', date: '2026-03-14', short: 'CF', name: 'CF Test Con' }] }, null, 2)}\n`;
// The published file, written by hand (one line per moment, not the admin's layout, as a real hand edit would be).
const PUBLISHED = [
  { id: '2024-old', year: 2024, caption: 'Old one', link: 'https://www.youtube.com/watch?v=abc' },
  { id: '2025-a', year: 2025, caption: 'First of 2025', link: 'https://www.instagram.com/reel/AAA/' },
  { id: 'x-no-year', caption: 'No year at all', link: 'https://example.com/x' },
  { id: '2025-b', year: 2025, caption: 'Second of 2025', link: 'https://www.tiktok.com/@a/video/123' },
];
const MOMENTS_TEXT = `{ "version": 1, "moments": [\n${PUBLISHED.map((m) => `  ${JSON.stringify(m)}`).join(',\n')}\n] }\n`;

/** The text the admin writes: A8 order, keys id/year/caption/alt/photo/link, 2-space indent, trailing newline. */
function expectedText(moments) {
  const key = (m) => (Number.isInteger(m.year) ? m.year : -Infinity);
  const order = ['id', 'year', 'caption', 'alt', 'photo', 'link'];
  const sorted = moments.map((m, i) => ({ m, i })).sort((a, b) => (key(b.m) - key(a.m)) || (a.i - b.i)).map(({ m }) => m);
  const tidy = sorted.map((m) => Object.fromEntries(order.filter((k) => m[k] !== undefined).map((k) => [k, m[k]])));
  return `${JSON.stringify({ version: 1, moments: tidy }, null, 2)}\n`;
}

async function open(page) {
  await page.goto('admin/index.html');
  for (const flag of ['manager', 'github', 'publish', 'moments']) {
    await expectResult(page.locator('html')).toHaveAttribute(`data-${flag}-ready`, 'true');
  }
  await openFold(page, 'moments-panel'); // TASK-24: Moments starts collapsed
}

/** /admin/ with a fake repo and a site that both hold EVENTS_TEXT and MOMENTS_TEXT; saves the fake token. */
async function setup(page, github, { moments = MOMENTS_TEXT, token = true } = {}) {
  page.on('dialog', (d) => d.accept());
  github.repo = new FakeRepo({ files: { 'data/events.json': EVENTS_TEXT, 'data/moments.json': moments } });
  await page.route('**/data/events.json', (route) => route.fulfill({ contentType: 'application/json', body: EVENTS_TEXT }));
  await page.route('**/data/moments.json', (route) => route.fulfill({ contentType: 'application/json', body: moments }));
  await open(page);
  if (!token) return;
  await openFold(page, 'gh');
  await page.fill('#gh-token', FAKE_TOKEN);
  await page.press('#gh-token', 'Enter');
  await expectResult(page.locator('#gh-saved')).toHaveText(`Token saved, ends in ...${FAKE_TOKEN.slice(-4)}`);
}

const rows = (page) => page.locator('#moment-list .event-row');
const rowIds = (page) => rows(page).evaluateAll((els) => els.map((el) => el.dataset.id));
const draft = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('puzzkezz.moments.draft') || 'null'));
const writes = (github) => github.calls().filter((c) => c.startsWith('POST ') || c.startsWith('PATCH '));

/** Fills the moment form and saves with Enter in the caption field (keyboard: no lost clicks on phones). */
async function fillMoment(page, { year = '', caption = '', alt = '', link = '', photo = '' }) {
  await page.fill('#m-year', String(year));
  await page.fill('#m-caption', caption);
  await page.fill('#m-alt', alt);
  await page.fill('#m-link', link);
  await page.fill('#m-photo', photo);
  await page.press('#m-caption', 'Enter');
}

async function addMoment(page, data) {
  await page.press('#new-moment', 'Enter');
  await expect(page.locator('#mo-form-title')).toHaveText('New moment');
  await fillMoment(page, data);
}

/* ---------- Panel ---------- */

test('lists the moments in album order (A8) with labelled form fields; move only within the same year', async ({ page, github }) => {
  await setup(page, github, { token: false });
  await expect(page.locator('#mo-title')).toContainText('Moments');
  await expect(page.locator('#mo-count')).toHaveText('4 moments');
  expect(await rowIds(page)).toEqual(['2025-a', '2025-b', '2024-old', 'x-no-year']);
  for (const label of ['Year (optional)', 'Caption (optional, max 140)', 'Alt text (describes the photo)', 'Link (video or post)', 'Photo path']) {
    await expect(page.getByLabel(label, { exact: true })).toBeVisible();
  }
  const btn = (name) => page.getByRole('button', { name, exact: true });
  for (const id of ['2025-a', '2025-b', '2024-old', 'x-no-year']) {
    await expect(btn(`Edit moment ${id}`)).toBeVisible();
    await expect(btn(`Delete moment ${id}`)).toBeVisible();
  }
  await expect(btn('Move moment 2025-a up')).toBeDisabled();
  await expect(btn('Move moment 2025-a down')).toBeEnabled();
  await expect(btn('Move moment 2025-b down')).toBeDisabled(); // next one is 2024
  await expect(btn('Move moment 2024-old up')).toBeDisabled();
  await expect(btn('Move moment 2024-old down')).toBeDisabled(); // next one has no year
  // Nothing changed yet: nothing to publish, no data/moments.json row.
  await expect(page.locator('#pub-pending')).toHaveText('No pending changes.');
  expect(await draft(page)).toBeNull();
  expect(github.calls()).toEqual([]);
});

test('add / edit / delete / reorder are kept in puzzkezz.moments.draft across a reload', async ({ page, github }) => {
  await setup(page, github, { token: false });
  // Add: id <year>-<slug(caption)>, then -2 for the same caption, x-... without a year.
  await addMoment(page, { year: 2025, caption: 'Wig fell off on the escalator!', alt: 'Puzz holding a pink wig', link: 'https://www.instagram.com/reel/XYZ/' });
  await expect(page.locator('#mo-status')).toHaveText('Saved moment 2025-wig-fell-off-on-the-escalator to the draft.');
  await addMoment(page, { year: 2025, caption: 'Wig fell off on the escalator!', link: 'https://example.com/again' });
  await expect(page.locator('#mo-status')).toHaveText('Saved moment 2025-wig-fell-off-on-the-escalator-2 to the draft.');
  await addMoment(page, { caption: '(>///<)', link: 'https://example.com/shy' });
  await expect(page.locator('#mo-status')).toHaveText('Saved moment x-moment to the draft.');
  expect(await rowIds(page)).toEqual(['2025-a', '2025-b', '2025-wig-fell-off-on-the-escalator', '2025-wig-fell-off-on-the-escalator-2', '2024-old', 'x-no-year', 'x-moment']);

  // Edit: the id stays, the year moves it to its new place.
  await page.getByRole('button', { name: 'Edit moment 2025-b', exact: true }).press('Enter');
  await expect(page.locator('#mo-form-title')).toHaveText('Edit moment 2025-b');
  await expect(page.locator('#m-caption')).toHaveValue('Second of 2025');
  await page.fill('#m-year', '2026');
  await page.fill('#m-caption', 'Now from 2026');
  await page.press('#m-caption', 'Enter');
  await expect(page.locator('#mo-status')).toHaveText('Saved moment 2025-b to the draft.');
  // Reorder inside 2025: move 2025-wig...-2 up twice (it is now right after 2025-wig...).
  await page.getByRole('button', { name: 'Move moment 2025-wig-fell-off-on-the-escalator-2 up', exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Move moment 2025-wig-fell-off-on-the-escalator-2 up', exact: true }).press('Enter');
  // Delete (asks with window.confirm; the test accepts).
  await page.getByRole('button', { name: 'Delete moment 2024-old', exact: true }).press('Enter');
  const want = ['2025-b', '2025-wig-fell-off-on-the-escalator-2', '2025-a', '2025-wig-fell-off-on-the-escalator', 'x-no-year', 'x-moment'];
  expect(await rowIds(page)).toEqual(want);
  await expect(page.locator('#pub-pending')).toContainText('data/moments.json changed');

  await page.reload();
  await open(page);
  expect(await rowIds(page)).toEqual(want);
  const saved = await draft(page);
  expect(saved.moments.map((m) => m.id)).toEqual(want);
  expect(saved.moments[0]).toEqual({ id: '2025-b', year: 2026, caption: 'Now from 2026', link: 'https://www.tiktok.com/@a/video/123' });
  expect(saved.base.sha).toBe(github.repo.filesAt().get('data/moments.json').sha);
  await expect(page.locator('#pub-pending')).toContainText('data/moments.json changed');
  expect(github.calls()).toEqual([]);
});

test('validation: errors show next to the field and nothing is saved', async ({ page, github }) => {
  await setup(page, github, { token: false });
  const before = await rowIds(page);
  const errorOf = (f) => page.locator(`#err-m-${f}`);

  await addMoment(page, { year: 2025, caption: 'No photo, no link' });
  await expect(errorOf('link')).toHaveText('Add a link or a photo: a moment needs at least one.');
  await expect(page.locator('#m-link')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#mo-status')).toHaveText('Not saved: please fix the fields marked with !');

  await fillMoment(page, { year: 'abc', caption: 'Bad year', link: 'https://example.com/' });
  await expect(errorOf('year')).toHaveText('Year must be a whole number from 2000 to 2100.');
  await expect(errorOf('link')).toBeHidden();
  await fillMoment(page, { year: 1999, caption: 'Too old', link: 'https://example.com/' });
  await expect(errorOf('year')).toHaveText('Year must be a whole number from 2000 to 2100.');

  await fillMoment(page, { caption: 'Script link', link: 'javascript:alert(1)' });
  await expect(errorOf('link')).toHaveText('Link must be an http or https address.');
  await fillMoment(page, { caption: 'Absolute photo', photo: '/media/moments/a.webp' });
  await expect(errorOf('photo')).toHaveText('Photo must be a relative path (no leading /).');
  await expect(page.locator('#m-photo')).toHaveAttribute('aria-invalid', 'true');

  // Caption over 140 (typed past maxlength by a script): refused too.
  await page.locator('#m-caption').evaluate((el) => { el.removeAttribute('maxlength'); });
  await fillMoment(page, { caption: 'x'.repeat(141), link: 'https://example.com/' });
  await expect(errorOf('caption')).toHaveText('Caption must be text of 1-140 characters.');

  expect(await rowIds(page)).toEqual(before);
  expect(await draft(page)).toBeNull();
  await expect(page.locator('#pub-pending')).toHaveText('No pending changes.');
});

test('moment text is shown with textContent only (no HTML from a caption)', async ({ page, github }) => {
  await setup(page, github, { token: false });
  const evil = '<img src=x onerror="window.__pwned=1"><b>bold</b>';
  await addMoment(page, { year: 2025, caption: evil, link: 'https://example.com/' });
  const row = rows(page).filter({ hasText: '<b>bold</b>' });
  await expect(row).toHaveCount(1);
  await expect(page.locator('#moment-list img, #moment-list b')).toHaveCount(0);
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  const source = ['moments.js', 'moments-draft.js'].map((f) => fs.readFileSync(path.join(ROOT, 'js', 'admin', f), 'utf8')).join('\n')
    .replace(/^\s*\/\/.*$/gm, ''); // code only, not comments
  expect(source).not.toMatch(/innerHTML|insertAdjacentHTML|outerHTML/);
});

/* ---------- Publish ---------- */

test('Publish: data/moments.json in one tree and one commit, with the expected text; second publish needs no reload', async ({ page, github }) => {
  await setup(page, github);
  const head = github.repo.head;
  await addMoment(page, { year: 2025, caption: 'Wig fell off', alt: 'Puzz with a wig', link: 'https://www.instagram.com/reel/XYZ/' });
  await expect(page.locator('#publish-btn')).toBeEnabled();
  await page.locator('#publish-btn').press('Enter');
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  await expect(page.locator('#pub-ok')).toContainText(SUCCESS);

  const want = expectedText([...PUBLISHED, { id: '2025-wig-fell-off', year: 2025, caption: 'Wig fell off', alt: 'Puzz with a wig', link: 'https://www.instagram.com/reel/XYZ/' }]);
  const trees = github.requests.filter((r) => r.method === 'POST' && r.path === `${REPO}/git/trees`);
  expect(trees).toHaveLength(1);
  expect(trees[0].body.tree.map((e) => e.path)).toEqual(['data/moments.json']);
  expect(trees[0].body.tree.every((e) => e.mode === '100644' && e.type === 'blob' && typeof e.sha === 'string')).toBe(true);
  expect(github.repo.read('data/moments.json')).toBe(want);
  expect(github.repo.read('data/events.json')).toBe(EVENTS_TEXT);
  expect(github.calls().filter((c) => c === REF_PATCH)).toHaveLength(1);
  const commit = github.repo.commits.get(github.repo.head);
  expect(commit.parents).toEqual([head]);
  expect(commit.message).toBe('Update moments from /admin/ (5 moments, 0 photos)');
  expect(github.calls()).toContain(`GET ${REPO}/contents/data/moments.json`);
  await expect(page.locator('#pub-pending')).toHaveText('No pending changes.');
  expect((await draft(page)).base.sha).toBe(github.repo.filesAt().get('data/moments.json').sha);

  // Second publish right away (new base, no reload).
  await page.getByRole('button', { name: 'Delete moment 2024-old', exact: true }).press('Enter');
  await page.locator('#publish-btn').press('Enter');
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  expect(github.calls().filter((c) => c === REF_PATCH)).toHaveLength(2);
  expect(JSON.parse(github.repo.read('data/moments.json')).moments.map((m) => m.id)).not.toContain('2024-old');
});

test('Publish events + moments together: both files in the same single tree and commit', async ({ page, github }) => {
  await setup(page, github);
  await page.press('#new-event', 'Enter');
  await page.fill('#f-date', '2026-12-20');
  await page.fill('#f-short', 'PUB');
  await page.fill('#f-name', 'Publish Test Con');
  await page.press('#f-name', 'Enter');
  await expectResult(page.locator('#save-status')).toContainText('Saved PUB');
  await addMoment(page, { caption: 'Both', link: 'https://example.com/both' });
  await expect(page.locator('#pub-pending')).toContainText('data/events.json changed');
  await expect(page.locator('#pub-pending')).toContainText('data/moments.json changed');
  await page.locator('#publish-btn').press('Enter');
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  const trees = github.requests.filter((r) => r.method === 'POST' && r.path === `${REPO}/git/trees`);
  expect(trees).toHaveLength(1);
  expect(trees[0].body.tree.map((e) => e.path).sort()).toEqual(['data/events.json', 'data/moments.json']);
  expect(github.calls().filter((c) => c === REF_PATCH)).toHaveLength(1);
  expect(github.repo.read('data/moments.json')).toContain('"id": "x-both"');
});

test('Stale: data/moments.json changed on GitHub since the draft started -> stale message, no POST or PATCH', async ({ page, github }) => {
  await setup(page, github);
  await addMoment(page, { year: 2025, caption: 'Mine', link: 'https://example.com/mine' });
  const head = github.repo.pushOutside({ 'data/moments.json': MOMENTS_TEXT.replace('Old one', 'Edited elsewhere') });
  await page.locator('#publish-btn').press('Enter');
  await expectResult(page.locator('#pub-stale')).toBeVisible();
  expect(writes(github)).toEqual([]);
  expect(github.calls()).toContain(`GET ${REPO}/contents/data/moments.json`);
  expect(github.repo.head).toBe(head);
  expect(github.repo.read('data/moments.json')).toContain('Edited elsewhere');
});

test('Publishing events only does not touch data/moments.json', async ({ page, github }) => {
  await setup(page, github);
  await page.press('#new-event', 'Enter');
  await page.fill('#f-date', '2026-12-20');
  await page.fill('#f-short', 'EVT');
  await page.fill('#f-name', 'Events Only Con');
  await page.press('#f-name', 'Enter');
  await expectResult(page.locator('#save-status')).toContainText('Saved EVT');
  await expect(page.locator('#pub-pending')).not.toContainText('data/moments.json');
  const before = github.repo.filesAt().get('data/moments.json').sha;
  await page.locator('#publish-btn').press('Enter');
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  const trees = github.requests.filter((r) => r.method === 'POST' && r.path === `${REPO}/git/trees`);
  expect(trees[0].body.tree.map((e) => e.path)).toEqual(['data/events.json']);
  expect(github.calls()).not.toContain(`GET ${REPO}/contents/data/moments.json`);
  expect(github.repo.filesAt().get('data/moments.json').sha).toBe(before);
  expect(github.repo.commits.get(github.repo.head).message).toMatch(/^Update events from \/admin\//);
});

test('Discard draft also restarts the moments draft (from GitHub with a token)', async ({ page, github }) => {
  await setup(page, github);
  await addMoment(page, { year: 2025, caption: 'To be discarded', link: 'https://example.com/d' });
  await expect(page.locator('#mo-count')).toHaveText('5 moments');
  github.repo.pushOutside({ 'data/moments.json': `${JSON.stringify({ version: 1, moments: [PUBLISHED[0]] })}\n` });
  await openBackup(page);
  await page.locator('#discard-draft').press('Enter');
  await expectResult(page.locator('#mo-count')).toHaveText('1 moment');
  expect(await rowIds(page)).toEqual(['2024-old']);
  expect(await draft(page)).toBeNull();
  await expect(page.locator('#pub-pending')).toHaveText('No pending changes.');
  await expect(page.locator('#publish-btn')).toHaveText('Nothing to publish');
  expect(writes(github)).toEqual([]);
});

test('the shipped data/moments.json (empty) loads with nothing pending', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await open(page);
  await expect(page.locator('#mo-count')).toHaveText('No moments');
  await expect(page.locator('#moment-list')).toHaveText('No moments yet. Use "New moment".');
  await expect(page.locator('#pub-pending')).not.toContainText('data/moments.json');
});
