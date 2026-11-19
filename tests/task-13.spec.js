// TASK-13: Publish photo pairs (master + display copy) and remove unused old photos, in the same single commit
// as data/events.json. Uses the strict in-memory fake repo from tests/github-mock.js and the fake token only:
// any unhandled api.github.com call, an unreleased hold() or a leaked token fails the test.
const fs = require('fs');
const path = require('path');
const { test, expect, BRANCH, FAKE_TOKEN, FakeRepo, gitBlobSha } = require('./github-mock');

const BIG = path.join(__dirname, 'fixtures', 'flat-2400x1600.png');
const SMALL = path.join(__dirname, 'fixtures', 'flat-800x600.png');
const REPO = '/repos/jiayangwong/MyCosplayWebsite';
const REF_GET = `GET ${REPO}/git/ref/heads/${BRANCH}`;
const BLOB_POST = `POST ${REPO}/git/blobs`;
const TREE_POST = `POST ${REPO}/git/trees`;
const COMMIT_POST = `POST ${REPO}/git/commits`;
const REF_PATCH = `PATCH ${REPO}/git/refs/heads/${BRANCH}`;
const SUCCESS = 'Published. The site updates in about 1-2 minutes.';
const CANCELLED = 'Publish cancelled. Nothing was changed.';
const STALE = 'The site changed since you started editing (maybe from another device). Export a backup, then reload this page.';
const HELP = 'Publish also removes photo files that no event uses any more. Old versions stay in the GitHub history.';
// A publish is many mocked round trips plus image encoding; every wait on a result uses this timeout.
const expectResult = expect.configure({ timeout: 15000 });
test.describe.configure({ timeout: 90000 });

const X = '2026-03-14-cf';
const Y = '2025-08-09-omt';
const ev = (id, extra = {}) => {
  const [date, short] = [id.slice(0, 10), id.slice(11).toUpperCase()];
  return { id, date, short, name: `${short} Test Con`, ...extra };
};
const OLD = { photo: `media/events/${X}/old.webp`, photoFull: `media/events/${X}/old-full.webp` };
const webp = (tag) => Buffer.concat([Buffer.from('RIFF\x10\x00\x00\x00WEBP', 'latin1'), Buffer.from(tag)]);

/**
 * Puts `events` (and extra files) in the fake repo and serves the same bytes as the site copy of
 * data/events.json, opens /admin/ and saves the fake token.
 */
async function setup(page, github, { events, files = {}, truncated = false }) {
  const text = `${JSON.stringify({ version: 1, events }, null, 2)}\n`;
  github.repo = new FakeRepo({ files: { 'data/events.json': text, ...files } });
  github.treeTruncated = truncated;
  await page.route('**/data/events.json', (route) => route.fulfill({ contentType: 'application/json', body: text }));
  page.on('dialog', (d) => d.accept()); // window.confirm of "Delete event" (the remove dialog is a <dialog>, not this)
  await page.goto('admin/index.html');
  for (const flag of ['manager', 'uploader', 'github', 'publish']) {
    await expectResult(page.locator('html')).toHaveAttribute(`data-${flag}-ready`, 'true');
  }
  await page.fill('#gh-token', FAKE_TOKEN);
  await page.press('#gh-token', 'Enter'); // keyboard, not a click: no lost clicks on the phone layout
  await expectResult(page.locator('#gh-saved')).toHaveText(`Token saved, ends in ...${FAKE_TOKEN.slice(-4)}`);
}

const card = (page, i) => page.locator('.wm-card').nth(i);
const row = (page, id) => page.locator(`.event-row[data-id="${id}"]`);

/** Opens an event in the form with the keyboard (Enter on its Edit button). */
async function edit(page, id) {
  await row(page, id).getByRole('button', { name: /^Edit/ }).press('Enter');
  await expect(page.locator('#wm-event-id')).toHaveText(id);
}

/** Uploads a fixture through the TASK-7 pipeline and attaches the new card to event `id`. */
async function attach(page, id, file = SMALL) {
  const i = await page.locator('.wm-card').count();
  await page.setInputFiles('#wm-files', file);
  await expectResult(card(page, i)).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
  await edit(page, id);
  await card(page, i).getByRole('button', { name: 'Attach to selected event' }).press('Enter');
  await expectResult(page.locator('#f-photo')).toHaveValue(new RegExp(`^media/events/${id}/`));
  return i;
}

async function deleteEvent(page, id) {
  await row(page, id).getByRole('button', { name: /^Delete/ }).press('Enter');
  await expectResult(row(page, id)).toHaveCount(0);
}

/** Renames an event in the form and saves it (Enter in the name field), so events.json changes. */
async function rename(page, id, name) {
  await edit(page, id);
  await page.fill('#f-name', name);
  await page.press('#f-name', 'Enter');
  await expectResult(page.locator('#save-status')).toContainText('Saved');
}

const calls = (github) => github.calls();
const writes = (github) => github.calls().filter((c) => !c.startsWith('GET '));
const newCommits = (github) => github.repo.commits.size - 1;
const treeBody = (github) => github.requests.filter((r) => `${r.method} ${r.path}` === TREE_POST).pop().body;
const imageBlobs = (github) => github.requests.filter((r) => `${r.method} ${r.path}` === BLOB_POST && r.body.encoding === 'base64');
const pendingPairs = (page) => page.evaluate(async () => (await import('/js/admin/pending.js')).pendingPairs().map((p) => [p.photo, p.photoFull]));
const isImageBlob = (req) => req.method === 'POST' && req.path === `${REPO}/git/blobs` && req.body && req.body.encoding === 'base64';

/** Fails the n-th (1-based) image blob upload with `response`, or runs `response(req, route)`. */
function onImageBlob(github, n, response) {
  let seen = 0;
  github.respond((req) => isImageBlob(req) && ++seen === n, response);
}

// Every tree ever posted: each `sha: null` path is under media/events/, ends in .webp, and is not used by
// any event in the events.json blob of that same tree.
test.afterEach(async ({ github }) => {
  for (const r of github.requests.filter((q) => `${q.method} ${q.path}` === TREE_POST)) {
    const entries = r.body.tree;
    const eventsEntry = entries.find((e) => e.path === 'data/events.json');
    expect(eventsEntry, 'every publish tree carries data/events.json').toBeTruthy();
    const committed = JSON.parse(github.repo.blobs.get(eventsEntry.sha).toString('utf8'));
    const used = new Set(committed.events.flatMap((e) => [e.photo, e.photoFull]).filter(Boolean));
    for (const e of entries.filter((x) => x.sha === null)) {
      expect(e.path.startsWith('media/events/'), e.path).toBe(true);
      expect(e.path.endsWith('.webp'), e.path).toBe(true);
      expect(used.has(e.path), `${e.path} is used by an event`).toBe(false);
      expect(e).toEqual({ path: e.path, mode: '100644', type: 'blob', sha: null });
    }
  }
});

test('fixture -> one commit with both images and events.json, progress "Uploading file 3 of 3", pending cleared', async ({ page, github }) => {
  await setup(page, github, { events: [ev(X), ev(Y)] });
  await expect(page.locator('#pub-help')).toHaveText(HELP);
  const i = await attach(page, X, BIG);
  const display = `media/events/${X}/flat-2400x1600.webp`;
  const master = `media/events/${X}/flat-2400x1600-full.webp`;

  // The pending list shows both paths with their sizes, events.json, and the total.
  const pairRow = page.locator('#pub-pending .pend-pair');
  await expectResult(pairRow).toHaveCount(1);
  await expect(pairRow).toContainText(`+ ${display} (`);
  await expect(pairRow).toContainText(`+ ${master} (`);
  await expect(page.locator('#pub-pending')).toContainText('~ data/events.json changed');
  await expect(page.locator('#pub-total')).toHaveText(/^Adds 1 photo, 2 files, \d+(\.\d)? (KB|MB)$/);
  await expect(page.locator('#publish-btn')).toBeEnabled();
  expect(calls(github)).toEqual([]);

  const head = github.repo.head;
  const baseTree = github.repo.commits.get(head).tree;
  // Hold the last blob (events.json) to see the progress text without timing.
  const last = github.hold((req) => req.method === 'POST' && req.path === `${REPO}/git/blobs` && req.body && req.body.encoding === 'utf-8');
  await page.click('#publish-btn');
  await last.arrived;
  await expect(page.locator('#pub-step')).toHaveText('Step 5 of 8: Uploading file 3 of 3');
  await expect(page.locator('#pub-bar')).toHaveAttribute('role', 'progressbar');
  await expect(page.locator('#publish-btn')).toHaveText('Publishing...');
  await expect(page.locator('#pub-pending .pend-remove')).toBeDisabled();
  last.release();
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  await expect(page.locator('#pub-ok')).toContainText(SUCCESS);
  await expect(page.locator('#pub-confirm')).toBeHidden(); // nothing unused: no removal dialog

  expect(calls(github)).toEqual([
    REF_GET, `GET ${REPO}/git/commits/${head}`, `GET ${REPO}/contents/data/events.json`, `GET ${REPO}/git/trees/${baseTree}`,
    BLOB_POST, BLOB_POST, BLOB_POST, TREE_POST, COMMIT_POST, REF_PATCH,
  ]);
  expect(github.requests[3].query.recursive).toBe('1');
  const tree = treeBody(github);
  expect(tree.base_tree).toBe(baseTree);
  expect(tree.tree.map((e) => e.path).sort()).toEqual(['data/events.json', master, display].sort());
  expect(tree.tree.every((e) => e.mode === '100644' && e.type === 'blob' && typeof e.sha === 'string')).toBe(true);
  expect(calls(github).filter((c) => c === REF_PATCH)).toHaveLength(1);
  expect(newCommits(github)).toBe(1);
  expect(github.repo.commits.get(github.repo.head).message).toBe('Update events from /admin/ (2 events, 1 photos)');

  // The image blobs are WebP, equal to the Download buttons' files, and are not the original PNG.
  const fixture = fs.readFileSync(BIG);
  const live = github.repo.filesAt();
  for (const [name, p] of [['Download display', display], ['Download full size', master]]) {
    const [download] = await Promise.all([page.waitForEvent('download'), card(page, i).getByRole('button', { name }).click()]);
    const want = fs.readFileSync(await download.path());
    const got = github.repo.blobs.get(live.get(p).sha);
    expect(got.subarray(0, 4).toString('latin1')).toBe('RIFF');
    expect(got.subarray(8, 12).toString('latin1')).toBe('WEBP');
    expect(got.equals(want)).toBe(true);
    expect(got.equals(fixture)).toBe(false);
  }
  for (const b of imageBlobs(github)) expect(Buffer.from(b.body.content, 'base64').equals(fixture)).toBe(false);

  // Pending pairs are cleared, the unsaved-files warning stops, and there is nothing left to publish.
  expect(await pendingPairs(page)).toEqual([]);
  expect(await page.evaluate(async () => (await import('/js/admin/pending.js')).hasUnsavedFiles())).toBe(false);
  await expect(page.locator('#pub-pending .pend-pair')).toHaveCount(0);
  await expect(page.locator('#pub-total')).toBeHidden();
  await expectResult(page.locator('#publish-btn')).toHaveText('Nothing to publish');
});

test('replace: the dialog lists the 2 old files; "Remove and publish" makes one commit with adds + deletes', async ({ page, github }) => {
  await setup(page, github, {
    events: [ev(X, OLD), ev(Y)],
    files: { [OLD.photo]: webp('old'), [OLD.photoFull]: webp('old-full') },
  });
  await attach(page, X);
  const display = `media/events/${X}/flat-800x600.webp`;
  const master = `media/events/${X}/flat-800x600-full.webp`;
  // The pending list already shows which old files the draft no longer uses.
  await expectResult(page.locator('#pub-pending')).toContainText(`- ${OLD.photo} (no event uses it)`);
  await expect(page.locator('#pub-pending')).toContainText(`- ${OLD.photoFull} (no event uses it)`);
  const head = github.repo.head;

  await page.click('#publish-btn');
  const dialog = page.locator('#pub-confirm');
  await expectResult(dialog).toBeVisible();
  await expect(page.locator('#pub-confirm-title')).toHaveText('These 2 old files will be removed');
  await expect(dialog).toContainText('Old versions stay in the GitHub history.');
  await expect(page.locator('#pub-confirm-list li')).toHaveText([`− ${OLD.photoFull}`, `− ${OLD.photo}`]);
  await expect(page.locator('#pub-confirm-no')).toBeFocused(); // Cancel is the default
  await expect(page.locator('#pub-confirm-yes')).toHaveText('Remove and publish');
  expect(writes(github)).toEqual([]); // the dialog shows before any write

  await page.locator('#pub-confirm-yes').press('Enter');
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  await expect(page.locator('#pub-ok-note')).toHaveText('Removed 2 old files.');
  await expect(dialog).toBeHidden();

  const tree = treeBody(github).tree;
  expect(tree.map((e) => e.path)).toEqual(['data/events.json', display, master, OLD.photoFull, OLD.photo]);
  expect(tree.filter((e) => e.sha === null).map((e) => e.path).sort()).toEqual([OLD.photo, OLD.photoFull].sort());
  expect(calls(github).filter((c) => c === TREE_POST)).toHaveLength(1);
  expect(calls(github).filter((c) => c === REF_PATCH)).toHaveLength(1);
  expect(newCommits(github)).toBe(1);
  expect(github.repo.commits.get(github.repo.head).parents).toEqual([head]);
  expect(github.repo.commits.get(github.repo.head).message).toBe('Update events from /admin/ (2 events, 1 photos, 2 old files removed)');
  const files = github.repo.filesAt();
  expect(files.has(OLD.photo)).toBe(false);
  expect(files.has(OLD.photoFull)).toBe(false);
  expect(files.has(display)).toBe(true);
  expect(files.has(master)).toBe(true);
  expect(await pendingPairs(page)).toEqual([]);
});

test('Cancel (button and Esc): no write at all, repo unchanged, pending pair kept, "Publish cancelled" shows', async ({ page, github }) => {
  await setup(page, github, {
    events: [ev(X, OLD), ev(Y)],
    files: { [OLD.photo]: webp('old'), [OLD.photoFull]: webp('old-full') },
  });
  await attach(page, X);
  const head = github.repo.head;
  const before = [...github.repo.filesAt().keys()];

  // 1. The Cancel button (it has focus, so Enter presses it).
  await page.click('#publish-btn');
  await expectResult(page.locator('#pub-confirm')).toBeVisible();
  await expect(page.locator('#pub-confirm-no')).toBeFocused();
  await page.keyboard.press('Enter');
  await expectResult(page.locator('#pub-cancel')).toBeVisible();
  await expect(page.locator('#pub-cancel .msg-text')).toHaveText(CANCELLED);
  await expect(page.locator('#pub-confirm')).toBeHidden();

  // 2. Esc is Cancel too.
  await page.click('#publish-btn');
  await expectResult(page.locator('#pub-confirm')).toBeVisible();
  await page.keyboard.press('Escape');
  await expectResult(page.locator('#pub-cancel')).toBeVisible();
  await expect(page.locator('#pub-confirm')).toBeHidden();

  expect(writes(github)).toEqual([]);
  expect(github.repo.head).toBe(head);
  expect([...github.repo.filesAt().keys()]).toEqual(before);
  await expect(page.locator('#pub-pending .pend-pair')).toHaveCount(1);
  expect(await pendingPairs(page)).toHaveLength(1);
  await expect(page.locator('#publish-btn')).toBeEnabled();
  await expect(page.locator('#pub-ok')).toBeHidden();
  await expect(page.locator('#pub-err')).toBeHidden();
});

test('delete an event with a photo pair: dialog lists its 2 files, tree = events.json + 2 deletes, no image blobs', async ({ page, github }) => {
  await setup(page, github, {
    events: [ev(X, OLD), ev(Y)],
    files: { [OLD.photo]: webp('old'), [OLD.photoFull]: webp('old-full') },
  });
  await deleteEvent(page, X);
  await page.click('#publish-btn');
  await expectResult(page.locator('#pub-confirm-title')).toHaveText('These 2 old files will be removed');
  await page.click('#pub-confirm-yes');
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  const tree = treeBody(github).tree;
  expect(tree.map((e) => e.path)).toEqual(['data/events.json', OLD.photoFull, OLD.photo]);
  expect(tree.filter((e) => e.sha === null)).toHaveLength(2);
  expect(imageBlobs(github)).toEqual([]);
  expect(calls(github).filter((c) => c === BLOB_POST)).toHaveLength(1);
  expect(github.repo.commits.get(github.repo.head).message).toBe('Update events from /admin/ (1 events, 0 photos, 2 old files removed)');
});

test('a file still used by another event is never removed (shared file)', async ({ page, github }) => {
  const shared = { photo: `media/events/${X}/shared.webp`, photoFull: `media/events/${X}/shared-full.webp` };
  await setup(page, github, {
    events: [ev(X, shared), ev(Y, shared)],
    files: { [shared.photo]: webp('s'), [shared.photoFull]: webp('sf') },
  });
  await attach(page, X);
  await expect(page.locator('#pub-pending')).not.toContainText('shared');
  await page.click('#publish-btn');
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  await expect(page.locator('#pub-confirm')).toBeHidden();
  const tree = treeBody(github).tree;
  expect(tree.filter((e) => e.sha === null)).toEqual([]);
  expect(tree.map((e) => e.path)).not.toContain(shared.photo);
  expect(github.repo.filesAt().has(shared.photo)).toBe(true);
  expect(github.repo.filesAt().has(shared.photoFull)).toBe(true);
});

test('nothing outside media/events/*.webp is ever listed or removed; only the unused stray.webp is', async ({ page, github }) => {
  const untouchable = [
    `media/events/${X}/notes.txt`,
    `media/events/${X}/photo.jpg`,
    `media/events/${X}/caps.WEBP`,
    `media/events/${X}/photo.webp.png`,
    'media/other/a.webp',
    'media/eventsx/a.webp',
    'media/events.webp',
    'img/logo.webp',
    'favicon.svg',
  ];
  const stray = `media/events/${X}/stray.webp`;
  const files = Object.fromEntries([...untouchable, stray].map((p) => [p, webp(p)]));
  await setup(page, github, { events: [ev(X), ev(Y)], files });
  await rename(page, X, 'Renamed Con');
  await page.click('#publish-btn');
  await expectResult(page.locator('#pub-confirm-title')).toHaveText('This 1 old file will be removed');
  await expect(page.locator('#pub-confirm-list li')).toHaveText([`− ${stray}`]);
  await page.click('#pub-confirm-yes');
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  await expect(page.locator('#pub-ok-note')).toHaveText('Removed 1 old file.');
  const tree = treeBody(github).tree;
  expect(tree.filter((e) => e.sha === null).map((e) => e.path)).toEqual([stray]);
  const live = github.repo.filesAt();
  for (const p of untouchable) expect(live.has(p), p).toBe(true);
  expect(live.has(stray)).toBe(false);
  expect(live.has('data/events.json')).toBe(true);
  expect(github.repo.commits.get(github.repo.head).message).toBe('Update events from /admin/ (2 events, 0 photos, 1 old files removed)');
});

test('nothing unused: plain events.json publish shows no dialog and has no deletes', async ({ page, github }) => {
  await setup(page, github, { events: [ev(X, OLD), ev(Y)], files: { [OLD.photo]: webp('o'), [OLD.photoFull]: webp('of') } });
  await rename(page, Y, 'Only A Rename');
  await page.click('#publish-btn');
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  await expect(page.locator('#pub-confirm')).toBeHidden();
  await expect(page.locator('#pub-ok-note')).toBeHidden();
  expect(treeBody(github).tree.map((e) => e.path)).toEqual(['data/events.json']);
  expect(github.repo.commits.get(github.repo.head).message).toBe('Update events from /admin/ (2 events, 0 photos)');
});

// TASK-16: with a truncated listing, events that reference existing photos can't be checked, so the publish
// stops before any write. With no media/events/ reference (below) it still works as in TASK-13.
test('truncated tree, events reference existing photos: "can\'t be checked" stop, no dialog, no write (TASK-16)', async ({ page, github }) => {
  const stray = `media/events/${X}/stray.webp`;
  await setup(page, github, {
    events: [ev(X, OLD), ev(Y)],
    files: { [OLD.photo]: webp('old'), [OLD.photoFull]: webp('old-full'), [stray]: webp('s') },
    truncated: true,
  });
  await rename(page, Y, 'Truncated Con');
  const head = github.repo.head;
  await page.click('#publish-btn');
  await expectResult(page.locator('#pub-err-text')).toHaveText("Could not list all files on GitHub, so the photo links can't be checked.");
  await expect(page.locator('#pub-err-next')).toHaveText('Nothing was changed.');
  await expect(page.locator('#pub-confirm')).toBeHidden();
  expect(writes(github)).toEqual([]);
  expect(github.repo.head).toBe(head);
  for (const p of [OLD.photo, OLD.photoFull, stray]) expect(github.repo.filesAt().has(p), p).toBe(true);
});

test('truncated tree, no photo references: no dialog, no deletes, the "Could not list all old photos" note, publish still works', async ({ page, github }) => {
  const stray = `media/events/${X}/stray.webp`;
  await setup(page, github, { events: [ev(X), ev(Y)], files: { [stray]: webp('s') }, truncated: true });
  await rename(page, X, 'Truncated Con');
  await page.click('#publish-btn');
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  await expect(page.locator('#pub-confirm')).toBeHidden();
  await expect(page.locator('#pub-ok-note')).toHaveText('Could not list all old photos, so none were removed this time.');
  expect(treeBody(github).tree.filter((e) => e.sha === null)).toEqual([]);
  expect(github.repo.filesAt().has(stray)).toBe(true);
  expect(newCommits(github)).toBe(1);
});

test('500 on the second image blob after confirming: ref unmoved, old files kept, pair kept; Try again -> dialog -> one commit', async ({ page, github }) => {
  await setup(page, github, {
    events: [ev(X, OLD), ev(Y)],
    files: { [OLD.photo]: webp('old'), [OLD.photoFull]: webp('old-full') },
  });
  await attach(page, X);
  const head = github.repo.head;
  onImageBlob(github, 2, { status: 500, body: { message: 'Server Error' } });
  await page.click('#publish-btn');
  await expectResult(page.locator('#pub-confirm')).toBeVisible();
  await page.click('#pub-confirm-yes');
  await expectResult(page.locator('#pub-err')).toBeVisible();
  await expect(page.locator('#pub-err-text')).toHaveText('GitHub said no (500).');
  await expect(page.locator('#pub-err-next')).toContainText('Nothing was changed on GitHub.');
  expect(github.repo.head).toBe(head);
  expect(calls(github)).not.toContain(TREE_POST);
  expect(calls(github)).not.toContain(REF_PATCH);
  expect(github.repo.filesAt().has(OLD.photo)).toBe(true);
  expect(github.repo.filesAt().has(OLD.photoFull)).toBe(true);
  await expect(page.locator('#pub-pending .pend-pair')).toHaveCount(1);
  expect(await pendingPairs(page)).toHaveLength(1);

  await page.click('#pub-retry');
  await expectResult(page.locator('#pub-confirm')).toBeVisible(); // asks again
  await page.click('#pub-confirm-yes');
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  expect(newCommits(github)).toBe(1);
  expect(calls(github).filter((c) => c === REF_PATCH)).toHaveLength(1);
  expect(github.repo.commits.get(github.repo.head).parents).toEqual([head]);
  expect(github.repo.filesAt().has(OLD.photo)).toBe(false);
  expect(await pendingPairs(page)).toEqual([]);
});

test('stale mid-upload: the branch moves during an image upload -> stale message, nothing goes live', async ({ page, github }) => {
  await setup(page, github, {
    events: [ev(X, OLD), ev(Y)],
    files: { [OLD.photo]: webp('old'), [OLD.photoFull]: webp('old-full') },
  });
  await attach(page, X);
  onImageBlob(github, 2, (req, route) => {
    github.repo.pushOutside({ 'README.md': 'pushed from another device\n' });
    return github.route(route, req);
  });
  await page.click('#publish-btn');
  await expectResult(page.locator('#pub-confirm')).toBeVisible();
  await page.click('#pub-confirm-yes');
  await expectResult(page.locator('#pub-stale')).toBeVisible();
  await expect(page.locator('#pub-stale')).toContainText(STALE);
  const moved = github.repo.head;
  expect(github.repo.commits.get(moved).message).toBe('Outside change');
  const live = github.repo.filesAt();
  expect(live.has(OLD.photo)).toBe(true);
  expect(live.has(`media/events/${X}/flat-800x600.webp`)).toBe(false);
  expect(await pendingPairs(page)).toHaveLength(1);
});

test('network drop on the first image blob: clear message, ref unmoved, Try again works', async ({ page, github }) => {
  await setup(page, github, { events: [ev(X), ev(Y)] });
  await attach(page, X);
  const head = github.repo.head;
  onImageBlob(github, 1, { abort: true });
  await page.click('#publish-btn');
  await expectResult(page.locator('#pub-err-text')).toHaveText("Can't reach GitHub. Check your internet connection.");
  expect(github.repo.head).toBe(head);
  expect(writes(github)).toEqual([BLOB_POST]);
  await page.click('#pub-retry');
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  expect(newCommits(github)).toBe(1);
});

test('guard: an injected removal path that breaks the rules stops the publish before any write', async ({ page, github }) => {
  await setup(page, github, { events: [ev(X, OLD), ev(Y)], files: { [OLD.photo]: webp('o'), [OLD.photoFull]: webp('of') } });
  await rename(page, Y, 'Guard Con');
  const bad = ['data/events.json', `media/events/${X}/a.jpg`, OLD.photo, 'img/logo.webp', `media/events/${X}/../../img/x.webp`, 'media/events/.webp'];
  for (const path of bad) {
    await page.evaluate(async (p) => {
      (await import('/js/admin/publish.js')).publishHooks.editRemovals = (list) => [...list, p];
    }, path);
    await page.click('#publish-btn');
    await expectResult(page.locator('#pub-err-text')).toHaveText(`Refused to remove ${path}: only unused .webp files under media/events/ can be removed.`);
    await expect(page.locator('#pub-confirm')).toBeHidden();
    expect(writes(github), path).toEqual([]);
  }
  await page.evaluate(async () => { (await import('/js/admin/publish.js')).publishHooks.editRemovals = null; });
});

test('a pair whose event was deleted is dropped from the publish list and not uploaded', async ({ page, github }) => {
  await setup(page, github, { events: [ev(X), ev(Y)] });
  await attach(page, X);
  await expectResult(page.locator('#pub-pending .pend-pair')).toHaveCount(1);
  await deleteEvent(page, X);
  await expectResult(page.locator('#pub-pending .pend-pair')).toHaveCount(0);
  await expect(page.locator('#pub-total')).toBeHidden();
  await page.click('#publish-btn');
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  expect(imageBlobs(github)).toEqual([]);
  expect(treeBody(github).tree.map((e) => e.path)).toEqual(['data/events.json']);
});

test('"Remove from publish" takes a pair out of the list', async ({ page, github }) => {
  await setup(page, github, { events: [ev(X), ev(Y)] });
  await attach(page, X);
  await page.locator('#pub-pending .pend-remove').press('Enter');
  await expectResult(page.locator('#pub-pending .pend-pair')).toHaveCount(0);
  expect(await pendingPairs(page)).toEqual([]);
});

test('21 pending photos -> "Publish at most 20 photos at a time" and the button is disabled until one is removed', async ({ page, github }) => {
  test.setTimeout(180000);
  const events = Array.from({ length: 21 }, (_, n) => ev(`2026-01-${String(n + 1).padStart(2, '0')}-e${n + 1}`));
  await setup(page, github, { events });
  const small = fs.readFileSync(SMALL);
  await page.setInputFiles('#wm-files', events.map((_, n) => ({ name: `p${n + 1}.png`, mimeType: 'image/png', buffer: small })));
  for (let n = 0; n < events.length; n += 1) {
    await expectResult(card(page, n)).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
  }
  for (let n = 0; n < events.length; n += 1) {
    await edit(page, events[n].id);
    await card(page, n).getByRole('button', { name: 'Attach to selected event' }).press('Enter');
    await expectResult(page.locator('#f-photo')).toHaveValue(`media/events/${events[n].id}/p${n + 1}.webp`);
  }
  await expectResult(page.locator('#pub-pending .pend-pair')).toHaveCount(21);
  await expect(page.locator('#pub-total')).toContainText('Adds 21 photos, 42 files');
  await expect(page.locator('#publish-btn')).toBeDisabled();
  await expect(page.locator('#pub-limit')).toBeVisible();
  await expect(page.locator('#pub-limit .msg-text')).toHaveText('Publish at most 20 photos at a time');
  await expect(page.locator('#publish-hint')).toContainText('Publish at most 20 photos at a time');
  await page.evaluate(() => document.getElementById('publish-btn').click()); // a forced click sends nothing
  await expect(page.locator('#pub-err')).toBeHidden();

  await page.locator('#pub-pending .pend-remove').first().press('Enter');
  await expectResult(page.locator('#pub-pending .pend-pair')).toHaveCount(20);
  await expect(page.locator('#pub-limit')).toBeHidden();
  await expect(page.locator('#publish-btn')).toBeEnabled();
  expect(calls(github)).toEqual([]);
});

test('25 MB: a file over the limit is refused before upload, with a clear message', async ({ page, github }) => {
  await setup(page, github, { events: [ev(X), ev(Y)] });
  await attach(page, X);
  // Make the pending master 26 MB (marked as an uploader file, so only the size rule can stop it).
  await page.evaluate(async () => {
    const pending = await import('/js/admin/pending.js');
    const pair = pending.pendingPairs()[0];
    const big = pending.markPipelineFile(new Blob([new Uint8Array(26 * 1024 * 1024)], { type: 'image/webp' }));
    pair.item.master = { blob: big, width: 1, height: 1 };
    pending.addPendingPair(pair); // re-adds the same pair, which re-renders the list
  });
  const master = `media/events/${X}/flat-800x600-full.webp`;
  await expectResult(page.locator('#pub-limit .msg-text')).toHaveText(`This file is too big to publish (over 25 MB): ${master}`);
  await expect(page.locator('#pub-pending .pend-pair')).toHaveClass(/is-err/);
  await expect(page.locator('#pub-pending .pend-pair')).toContainText('(26.0 MB)');
  await expect(page.locator('#publish-btn')).toBeDisabled();
  await page.evaluate(() => document.getElementById('publish-btn').click());
  await expect(page.locator('#pub-err')).toBeHidden();
  expect(calls(github)).toEqual([]);
});

test('only uploader files are sent: an unmarked blob, a failing extra check (TASK-15 hook) or a bad path is refused with no request', async ({ page, github }) => {
  await setup(page, github, { events: [ev(X), ev(Y)] });
  await attach(page, X);
  const display = `media/events/${X}/flat-800x600.webp`;

  // 1. A blob that did not come out of the watermark pipeline.
  await page.evaluate(async () => {
    const pending = await import('/js/admin/pending.js');
    const pair = pending.pendingPairs()[0];
    pair.item.realDisplay = pair.item.display;
    pair.item.display = { blob: new Blob([new Uint8Array(64)], { type: 'image/webp' }), width: 1, height: 1 };
  });
  await page.click('#publish-btn');
  await expectResult(page.locator('#pub-err-text')).toHaveText(`This file did not come from the uploader: ${display}`);
  expect(calls(github)).toEqual([]);

  // 2. The extra file check hook (TASK-15 adds the watermark-marker check here).
  await page.evaluate(async () => {
    const pending = await import('/js/admin/pending.js');
    const pair = pending.pendingPairs()[0];
    pair.item.display = pair.item.realDisplay;
    (await import('/js/admin/publish.js')).addFileCheck(async (p) => (p.endsWith('-full.webp') ? `Check failed: ${p}` : null));
  });
  await page.click('#pub-retry');
  await expectResult(page.locator('#pub-err-text')).toHaveText(`Check failed: media/events/${X}/flat-800x600-full.webp`);
  expect(calls(github)).toEqual([]);
});

test('a path outside the allowed patterns (injected into the draft) is refused with no network call', async ({ page, github }) => {
  await setup(page, github, { events: [ev(X), ev(Y)] });
  await attach(page, X);
  // The draft and the pending pair both point outside media/events/<event-id>/.
  const evil = { photo: 'img/evil.webp', photoFull: 'img/evil-full.webp' };
  const draft = { version: 1, events: [ev(X, evil), ev(Y)] };
  await page.setInputFiles('#import-file', { name: 'events.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(draft)) });
  await expectResult(page.locator('#save-status')).toContainText('Imported');
  await page.evaluate(async (paths) => {
    const pending = await import('/js/admin/pending.js');
    const pair = pending.pendingPairs()[0];
    Object.assign(pair, paths);
    pending.addPendingPair(pair);
  }, evil);
  await expectResult(page.locator('#pub-pending .pend-pair')).toContainText('img/evil.webp');
  await page.click('#publish-btn');
  await expectResult(page.locator('#pub-err-text')).toHaveText('This path is not allowed in a publish: img/evil.webp');
  await expect(page.locator('#pub-err-next')).toHaveText('Nothing was sent to GitHub.');
  expect(calls(github)).toEqual([]);
});

test('remove dialog layout: Cancel is focused; phone stacks full-width buttons with Cancel last', async ({ page, github }) => {
  await setup(page, github, { events: [ev(X, OLD), ev(Y)], files: { [OLD.photo]: webp('o'), [OLD.photoFull]: webp('of') } });
  await deleteEvent(page, X);
  await page.click('#publish-btn');
  const dialog = page.locator('#pub-confirm');
  await expectResult(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  const box = await dialog.boundingBox();
  const vw = page.viewportSize().width;
  const yes = await page.locator('#pub-confirm-yes').boundingBox();
  const no = await page.locator('#pub-confirm-no').boundingBox();
  if (vw < 768) {
    expect(Math.round(box.x)).toBe(16);
    expect(no.y).toBeGreaterThan(yes.y); // Cancel last
    expect(Math.abs(no.width - yes.width)).toBeLessThan(2);
  } else {
    expect(box.width).toBeLessThanOrEqual(520);
    expect(no.x).toBeLessThan(yes.x); // right-aligned row: Cancel, then Remove and publish
    expect(Math.abs(no.y - yes.y)).toBeLessThan(2);
  }
  await page.keyboard.press('Escape');
  await expectResult(page.locator('#pub-cancel')).toBeVisible();
  expect(writes(github)).toEqual([]);
});

test('the content hash of each uploaded image equals its tree entry (blobs are the bytes, base64 encoded)', async ({ page, github }) => {
  await setup(page, github, { events: [ev(X), ev(Y)] });
  await attach(page, X);
  await page.click('#publish-btn');
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  const tree = treeBody(github).tree;
  for (const b of imageBlobs(github)) {
    const sha = gitBlobSha(Buffer.from(b.body.content, 'base64'));
    expect(tree.some((e) => e.sha === sha)).toBe(true);
  }
});

// Review rounds 1-2 (must-fix): other ways of writing a used path must never let that file be removed.
// SAME_FILE: forms a browser resolves to media/events/X/old.webp itself. OTHER_FORMS: forms a server might
// map to it (collapsing "//", dropping ";params", Unicode look-alikes...). Every one is non-canonical, so
// Publish removes nothing at all while any event uses one.
const SAME_FILE = [
  `./media/events/${X}/old.webp`,
  `media/events/${X}/./old.webp`,
  `media/events/${X}/old.webp?v=2`,
  `media/events/${X}/old.webp#x`,
  `media/events/${X}%2Fold.webp`,
  `media/events/${X}/old%2Ewebp`,
  `media/events/${X}/%2e%2e/${X}/old.webp`,
  ` media/events/${X}/old.webp`,
  `media/events/${X}/old.webp `,
  `media/events/${X}/old.we\tbp`,
  `media\\events\\${X}\\old.webp`,
];
const OTHER_FORMS = [
  `media//events/${X}/old.webp`,
  `media/events/${X}//old.webp`,
  `media/events/${X}/old.webp/`,
  `media/events/${X}/old.webp;v=2`,
  `media/events/${X}/old\u2024webp`,
  `media/events/${X}/old\uFF0Ewebp`,
  `media/events/${X}/old .webp`,
];
const UNUSUAL = [...SAME_FILE, ...OTHER_FORMS];
// Plain forms that name a genuinely different file on GitHub Pages (case-sensitive, no trailing-dot trim).
const DIFFERENT_FILE = [`media/events/${X}/OLD.webp`, `media/events/${X}/old.WEBP`, `media/events/${X}/old.webp.`];

test('used paths are also matched as the site resolves them; every unusual form is non-canonical', async ({ page, github }) => {
  await setup(page, github, { events: [ev(X), ev(Y)] });
  const out = await page.evaluate(async ({ same, unusual, different, old, full, stray }) => {
    const m = await import('/js/admin/publish.js');
    const text = (photo) => JSON.stringify({ version: 1, events: [{ id: 'x', photo, photoFull: full }] });
    const entries = [old, full, stray].map((path) => ({ path, type: 'blob' }));
    return {
      same: same.map((f) => ({ f, used: m.usedPathsIn(text(f)).has(old), removals: m.removalCandidates(entries, m.usedPathsIn(text(f)), new Set()) })),
      unusual: unusual.map((f) => ({ f, canonical: m.isCanonicalPath(f), all: m.allPathsCanonical(text(f)) })),
      different: different.map((f) => ({ f, canonical: m.isCanonicalPath(f) })),
      plain: { canonical: m.allPathsCanonical(text(old)), removals: m.removalCandidates(entries, m.usedPathsIn(text(old)), new Set()) },
    };
  }, { same: SAME_FILE, unusual: UNUSUAL, different: DIFFERENT_FILE, old: OLD.photo, full: OLD.photoFull, stray: `media/events/${X}/stray.webp` });
  for (const r of out.same) {
    expect(r.used, r.f).toBe(true); // (a) the resolved form is in the used set
    expect(r.removals, r.f).toEqual([`media/events/${X}/stray.webp`]); // even without (b), old.webp is never a candidate
  }
  for (const r of out.unusual) expect([r.f, r.canonical, r.all]).toEqual([r.f, false, false]); // (b) fail safe
  for (const r of out.different) expect([r.f, r.canonical]).toEqual([r.f, true]);
  expect(out.plain).toEqual({ canonical: true, removals: [`media/events/${X}/stray.webp`] });
});

for (const form of UNUSUAL) {
  // TASK-16: a non-plain path now stops the publish before any write (it used to publish with a note).
  test(`unusual path ${JSON.stringify(form)}: Publish stops with "not in the usual form", lists and removes nothing, no write`, async ({ page, github }) => {
    const stray = `media/events/${X}/stray.webp`;
    await setup(page, github, {
      events: [ev(X, { photo: form, photoFull: OLD.photoFull }), ev(Y)],
      files: { [OLD.photo]: webp('old'), [OLD.photoFull]: webp('old-full'), [stray]: webp('s') },
    });
    await rename(page, Y, 'Unusual Path Con');
    await expect(page.locator('#pub-pending')).not.toContainText('- ');
    const head = github.repo.head;
    await page.click('#publish-btn');
    await expectResult(page.locator('#pub-err')).toBeVisible();
    await expect(page.locator('#pub-err-text')).toHaveText(`Event "CF 2026" (${X}) has a photo path that is not in the usual form: ${form}.`);
    await expect(page.locator('#pub-err-next')).toHaveText('Attach the photo again or fix the path, then publish. Nothing was changed.');
    await expect(page.locator('#pub-confirm')).toBeHidden();
    await expect(page.locator('#pub-ok')).toBeHidden();
    expect(writes(github)).toEqual([]);
    expect(github.repo.head).toBe(head);
    const live = github.repo.filesAt();
    for (const p of [OLD.photo, OLD.photoFull, stray]) expect(live.has(p), p).toBe(true);
    expect(newCommits(github)).toBe(0);
  });
}

test('the remove dialog closed without a cancel event (close()) counts as Cancel; Publish is not stuck', async ({ page, github }) => {
  await setup(page, github, { events: [ev(X, OLD), ev(Y)], files: { [OLD.photo]: webp('o'), [OLD.photoFull]: webp('of') } });
  await deleteEvent(page, X);
  await page.click('#publish-btn');
  await expectResult(page.locator('#pub-confirm')).toBeVisible();
  await page.evaluate(() => document.getElementById('pub-confirm').close());
  await expectResult(page.locator('#pub-cancel')).toBeVisible();
  await expect(page.locator('#publish-btn')).toHaveText('Publish to GitHub');
  await expect(page.locator('#publish-btn')).toBeEnabled();
  await expect(page.locator('#pub-progress')).toBeHidden();
  expect(writes(github)).toEqual([]);
  // A normal publish still works afterwards (the old dialog listeners are gone).
  await page.click('#publish-btn');
  await expectResult(page.locator('#pub-confirm')).toBeVisible();
  await page.click('#pub-confirm-yes');
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  expect(newCommits(github)).toBe(1);
});

test('"already published" with photos: Try again after an unsure result finds events.json and both images, no writes', async ({ page, github }) => {
  await setup(page, github, { events: [ev(X), ev(Y)] });
  await attach(page, X);
  const head = github.repo.head;
  github.respond(`PATCH ${REPO}/git/refs/heads/${BRANCH}`, async (req, route) => {
    // The re-read still sees the old head (lag), but GitHub applies the update a moment later.
    github.respond(REF_GET, { status: 200, body: { ref: `refs/heads/${BRANCH}`, object: { sha: head, type: 'commit' } } });
    github.repo.head = req.body.sha;
    return route.abort('failed');
  });
  await page.click('#publish-btn');
  await expectResult(page.locator('#pub-err-text')).toHaveText('The connection dropped while the site was being updated.');
  expect(await pendingPairs(page)).toHaveLength(1); // kept until it is clear the photos are live
  const live = github.repo.head;
  const before = calls(github).length;
  await page.click('#pub-retry');
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  expect(calls(github).slice(before)).toEqual([
    REF_GET, `GET ${REPO}/git/commits/${live}`, `GET ${REPO}/contents/data/events.json`,
    `GET ${REPO}/git/trees/${github.repo.commits.get(live).tree}`,
  ]);
  expect(github.repo.head).toBe(live);
  expect(newCommits(github)).toBe(1);
  expect(await pendingPairs(page)).toEqual([]);
  await expectResult(page.locator('#publish-btn')).toHaveText('Nothing to publish');
});
