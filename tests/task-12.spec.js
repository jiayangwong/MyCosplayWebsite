// TASK-12: Publish events.json to GitHub in one atomic commit (Git Data API, stale checks).
// Uses the in-memory fake repo from tests/github-mock.js and the fake token only. The `github` fixture fails
// a test on any unhandled api.github.com call, and if the token shows up anywhere except the Authorization
// header of a request to https://api.github.com.
const fs = require('fs');
const { test, expect, BRANCH, API, FAKE_TOKEN, gitBlobSha, openFold } = require('./github-mock');

const REPO = '/repos/jiayangwong/MyCosplayWebsite';
const REF_GET = `GET ${REPO}/git/ref/heads/${BRANCH}`;
const BLOB_POST = `POST ${REPO}/git/blobs`;
const TREE_POST = `POST ${REPO}/git/trees`;
const COMMIT_POST = `POST ${REPO}/git/commits`;
const REF_PATCH = `PATCH ${REPO}/git/refs/heads/${BRANCH}`;
const STALE = 'The site changed since you started editing (maybe from another device). Export a backup, then reload this page.';
const SUCCESS = 'Published. The site updates in about 1-2 minutes.';
const UNSURE = 'The connection dropped while the site was being updated.';
const UNSURE_NEXT = 'It is not clear if the change went live. Try again: it checks GitHub first and never publishes twice.';
const JP_NAME = 'コミックフィエスタ 冬 ✨ Puzz';
// A publish is 8 mocked round trips; on the phone project under full-suite load it can take just over the
// default 5s. Every wait on a publish result (and on Discard reading GitHub) uses this longer timeout.
const RESULT_TIMEOUT = 15000;
const expectResult = expect.configure({ timeout: RESULT_TIMEOUT });
// Some tests publish twice (or Discard + Publish); give the whole test room for two slow publishes.
test.describe.configure({ timeout: 60000 });

test.beforeEach(async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('admin/index.html');
  await expectResult(page.locator('html')).toHaveAttribute('data-manager-ready', 'true');
  await expectResult(page.locator('html')).toHaveAttribute('data-github-ready', 'true');
  await expectResult(page.locator('html')).toHaveAttribute('data-publish-ready', 'true');
});

/** Saves the fake token and waits until it is stored. Uses Enter in the field (keyboard focus, not a
 *  mouse click) because on the phone layout a click on Save token could land mid layout shift and be lost. */
async function saveFakeToken(page) {
  await openFold(page, 'gh');
  await page.fill('#gh-token', FAKE_TOKEN);
  await page.press('#gh-token', 'Enter');
  await expectResult(page.locator('#gh-saved')).toHaveText(`Token saved, ends in ...${FAKE_TOKEN.slice(-4)}`);
}

/** The 8 calls of one publish, in order, for a given head commit (TASK-13 added the recursive tree read). */
const eightCalls = (github, head) => [
  REF_GET,
  `GET ${REPO}/git/commits/${head}`,
  `GET ${REPO}/contents/data/events.json`,
  `GET ${REPO}/git/trees/${github.repo.commits.get(head).tree}`,
  BLOB_POST,
  TREE_POST,
  COMMIT_POST,
  REF_PATCH,
];

/** Adds an event through the form, so the draft differs from the published file. Uses the keyboard
 *  (Enter on New event, Enter in the name field to submit), not mouse clicks: on the phone layout Save
 *  event is far down a smooth-scrolling page, and under load the mouse-up of a click could land after the
 *  scroll moved the button, so the click was lost (BUG-3). task-6 and task-10 still click Save event. */
async function addEvent(page, short = 'PUB', name = 'Publish Test Con') {
  await page.press('#new-event', 'Enter');
  await expect(page.locator('#form-title')).toHaveText('New event');
  await page.fill('#f-date', '2026-12-20');
  await page.fill('#f-short', short);
  await page.fill('#f-name', name);
  await page.press('#f-name', 'Enter');
  await expectResult(page.locator('#save-status')).toContainText(`Saved ${short}`);
}

async function exportedText(page) {
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#export-events')]);
  return fs.readFileSync(await download.path(), 'utf8');
}

const writes = (github) => github.calls().filter((c) => !c.startsWith('GET '));
const newCommits = (github) => github.repo.commits.size - 1;

test('panel: no token -> disabled with hint; token + no changes -> "Nothing to publish"; new help text', async ({ page, github }) => {
  await expect(page.locator('.help-box')).toContainText('Changes stay on this browser until you press Publish to GitHub. Export events.json is a backup you can commit by hand.');
  await expectResult(page.locator('#pub-title')).toHaveText('Publish');
  await expect(page.locator('#publish-btn')).toBeDisabled();
  await expect(page.locator('#publish-hint')).toHaveText('Add a GitHub token to publish');
  await saveFakeToken(page);
  await expect(page.locator('#publish-btn')).toBeDisabled();
  await expectResult(page.locator('#publish-btn')).toHaveText('Nothing to publish');
  await expectResult(page.locator('#pub-pending')).toHaveText('No pending changes.');
  await addEvent(page);
  await expectResult(page.locator('#pub-pending li')).toHaveText('~ data/events.json changed');
  await expect(page.locator('#publish-btn')).toBeEnabled();
  await expect(page.locator('#publish-btn')).toHaveText('Publish to GitHub');
  expect(github.calls()).toEqual([]); // nothing is sent until Publish is pressed
});

test('happy path: exactly 8 calls in order, one-file tree, blob = Export, parents [head], force:false', async ({ page, github }) => {
  await saveFakeToken(page);
  await addEvent(page, 'CFW', JP_NAME); // Japanese + emoji: the blob must keep non-ASCII text byte for byte
  const expected = await exportedText(page);
  expect(expected).toContain(JP_NAME);
  const head = github.repo.head;

  await page.click('#publish-btn');
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  await expectResult(page.locator('#pub-ok')).toContainText(SUCCESS);

  expect(github.calls()).toEqual(eightCalls(github, head));
  const reqs = github.requests;
  expect(reqs[2].query.ref).toBe(head);
  const blob = reqs.find((r) => `${r.method} ${r.path}` === BLOB_POST).body;
  const decoded = blob.encoding === 'base64' ? Buffer.from(blob.content, 'base64').toString('utf8') : blob.content;
  expect(decoded).toBe(expected);
  const tree = reqs.find((r) => `${r.method} ${r.path}` === TREE_POST).body;
  const baseTree = github.repo.commits.get(head).tree;
  expect(tree.base_tree).toBe(baseTree);
  expect(tree.tree).toEqual([{ path: 'data/events.json', mode: '100644', type: 'blob', sha: gitBlobSha(expected) }]);
  const commit = reqs.find((r) => `${r.method} ${r.path}` === COMMIT_POST).body;
  expect(commit.parents).toEqual([head]);
  expect(commit.message).toBe(`Update events from /admin/ (${JSON.parse(expected).events.length} events, 0 photos)`);
  const patch = reqs.find((r) => `${r.method} ${r.path}` === REF_PATCH).body;
  expect(patch.force).toBe(false);

  // The fake repo moved by exactly one commit and now holds the exported text.
  expect(newCommits(github)).toBe(1);
  expect(github.repo.head).toBe(patch.sha);
  expect(github.repo.commits.get(github.repo.head).parents).toEqual([head]);
  expect(github.repo.read('data/events.json')).toBe(expected);
  // The stored base is the fake repo's SHA of the committed file.
  const draft = await page.evaluate(() => JSON.parse(localStorage.getItem('puzzkezz.events.draft')));
  expect(draft.baseEventsSha).toBe(github.repo.filesAt().get('data/events.json').sha);
  expect(draft.baseEventsSha).toBe(gitBlobSha(expected));
  await expectResult(page.locator('#pub-commit')).toHaveAttribute('href', `https://github.com/jiayangwong/MyCosplayWebsite/commit/${github.repo.head}`);
  await expectResult(page.locator('#pub-commit')).toHaveAttribute('target', '_blank');
  await expectResult(page.locator('#publish-btn')).toHaveText('Nothing to publish');
  await expectResult(page.locator('#pub-progress')).toBeHidden();
  // Every request that carried the token went to the GitHub API (the fixture also checks for leaks).
  for (const r of github.requests) expect(r.headers.authorization).toMatch(/^Bearer /);
  expect(github.requests.length).toBe(8);
  expect(reqs[3].query.recursive).toBe('1');
});

test('the draft remembers the base blob SHA of the events.json it started from', async ({ page, github }) => {
  await addEvent(page);
  const draft = await page.evaluate(() => JSON.parse(localStorage.getItem('puzzkezz.events.draft')));
  expect(draft.baseEventsSha).toBe(github.repo.filesAt().get('data/events.json').sha);
  expect(draft.baseEventsSha).toMatch(/^[0-9a-f]{40}$/);
});

test('a second publish right after a success works without a reload', async ({ page, github }) => {
  await saveFakeToken(page);
  await addEvent(page, 'ONE', 'First Publish');
  await page.click('#publish-btn');
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  const first = github.repo.head;
  const draft = await page.evaluate(() => JSON.parse(localStorage.getItem('puzzkezz.events.draft')));
  expect(draft.baseEventsSha).toBe(github.repo.filesAt().get('data/events.json').sha);

  await addEvent(page, 'TWO', 'Second Publish');
  await page.click('#publish-btn');
  await expectResult(page.locator('#pub-stale')).toBeHidden();
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  await expectResult(page.locator('#publish-btn')).toHaveText('Nothing to publish');
  expect(newCommits(github)).toBe(2);
  expect(github.repo.commits.get(github.repo.head).parents).toEqual([first]);
  expect(github.repo.read('data/events.json')).toContain('Second Publish');
  expect(github.calls().slice(8)).toEqual(eightCalls(github, first));
});

test('stale (blob): repo events.json changed elsewhere -> stale message, no POST/PATCH, Export backup works', async ({ page, github }) => {
  await saveFakeToken(page);
  await addEvent(page);
  const outside = github.repo.pushOutside({ 'data/events.json': '{"version":1,"events":[]}\n' });
  await page.click('#publish-btn');
  await expectResult(page.locator('#pub-stale')).toBeVisible();
  await expectResult(page.locator('#pub-stale')).toContainText(STALE);
  await expectResult(page.locator('#pub-stale')).toContainText('Nothing was changed on GitHub.');
  await expectResult(page.locator('#pub-ok')).toBeHidden();
  await expectResult(page.locator('#pub-err')).toBeHidden();
  expect(github.calls()).toEqual(eightCalls(github, outside).slice(0, 3));
  expect(writes(github)).toEqual([]);
  expect(github.repo.head).toBe(outside);
  // The draft is kept and can be saved as a backup.
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#pub-export')]);
  expect(download.suggestedFilename()).toBe('events.json');
  expect(fs.readFileSync(await download.path(), 'utf8')).toContain('Publish Test Con');
  await expectResult(page.locator('#pub-reload')).toBeVisible();
});

test('stale recovery: Export backup -> Discard draft -> Import backup -> Publish makes exactly one commit', async ({ page, github }) => {
  await saveFakeToken(page);
  await addEvent(page, 'BAK', 'Backup Con');
  // Another device publishes first: GitHub's events.json now has one event the site copy doesn't show yet.
  const other = { version: 1, events: [{ id: '2026-01-10-oth', date: '2026-01-10', short: 'OTH', name: 'Other Device Con' }] };
  const outside = github.repo.pushOutside({ 'data/events.json': `${JSON.stringify(other, null, 2)}\n` });
  await page.click('#publish-btn');
  await expectResult(page.locator('#pub-stale')).toBeVisible();
  await expectResult(page.locator('#pub-stale')).toContainText('Discard draft');
  await expectResult(page.locator('#pub-stale')).toContainText('Import your backup');

  // 1. Export backup
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#pub-export')]);
  const backup = fs.readFileSync(await download.path(), 'utf8');
  expect(backup).toContain('Backup Con');
  // 2. Discard draft: loads the newest events.json from GitHub (not the older site copy) and takes its SHA as base.
  await page.click('#discard-draft');
  await expectResult(page.locator('#source-banner')).toContainText('newest copy from GitHub');
  await expect(page.locator('.event-row')).toHaveCount(1);
  await expect(page.locator('.event-row')).toContainText('Other Device Con');
  const draftBase = await page.evaluate(() => localStorage.getItem('puzzkezz.events.draft'));
  expect(draftBase).toBeNull(); // nothing saved until an edit
  // 3. Import the backup, merge the other device's event back in by hand.
  await page.setInputFiles('#import-file', { name: 'events.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await expectResult(page.locator('#save-status')).toContainText('Imported');
  await page.click('#new-event');
  await page.fill('#f-date', '2026-01-10');
  await page.fill('#f-short', 'OTH');
  await page.fill('#f-name', 'Other Device Con');
  await page.click('#save-event');
  const draft = await page.evaluate(() => JSON.parse(localStorage.getItem('puzzkezz.events.draft')));
  expect(draft.baseEventsSha).toBe(github.repo.filesAt(outside).get('data/events.json').sha);
  // 4. Publish
  const before = github.calls().length;
  await page.click('#publish-btn');
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  await expectResult(page.locator('#pub-stale')).toBeHidden();
  expect(github.calls().filter((c) => c === REF_PATCH)).toHaveLength(1);
  expect(github.calls().slice(before)).toEqual(eightCalls(github, outside));
  expect(github.repo.commits.get(github.repo.head).parents).toEqual([outside]);
  expect(newCommits(github)).toBe(2); // the outside push + exactly one publish
  const live = github.repo.read('data/events.json');
  expect(live).toContain('Backup Con');
  expect(live).toContain('Other Device Con');
});

test('Discard draft locks Publish, Import and Discard while it reads GitHub, and unlocks after', async ({ page, github }) => {
  await saveFakeToken(page);
  await addEvent(page);
  await expect(page.locator('#publish-btn')).toBeEnabled();
  // Hold the GitHub read open, so the locked state stays on screen until the test has checked it.
  const read = github.hold(`GET ${REPO}/contents/data/events.json`);
  await page.click('#discard-draft');
  await read.arrived;
  await expect(page.locator('#publish-btn')).toBeDisabled();
  await expect(page.locator('#publish-hint')).toHaveText('Loading the published events.json...');
  await expect(page.locator('#import-file')).toBeDisabled();
  await expect(page.locator('label[for="import-file"]')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('#discard-draft')).toBeDisabled();
  await page.evaluate(() => document.getElementById('publish-btn').click()); // forced click does nothing
  read.release();
  await expectResult(page.locator('#source-banner')).toContainText('newest copy from GitHub');
  await expect(page.locator('#import-file')).toBeEnabled();
  await expect(page.locator('#discard-draft')).toBeEnabled();
  await expect(page.locator('#publish-btn')).toHaveText('Nothing to publish');
  expect(writes(github)).toEqual([]);
});

test('Discard draft unlocks again when GitHub cannot be reached (falls back to the site copy)', async ({ page, github }) => {
  await saveFakeToken(page);
  await addEvent(page);
  github.respond(`GET ${REPO}/contents/data/events.json`, { abort: true });
  await page.click('#discard-draft');
  await expectResult(page.locator('#source-banner')).toHaveText('Source: published data/events.json');
  await expect(page.locator('#import-file')).toBeEnabled();
  await expect(page.locator('#discard-draft')).toBeEnabled();
  await expect(page.locator('#publish-btn')).toHaveText('Nothing to publish');
  await addEvent(page, 'AGN', 'Again Con');
  await expect(page.locator('#publish-btn')).toBeEnabled();
});

test('Reload alone does not re-base the draft: Publish is still stale', async ({ page, github }) => {
  await saveFakeToken(page);
  await addEvent(page);
  github.repo.pushOutside({ 'data/events.json': '{"version":1,"events":[]}\n' });
  await page.click('#publish-btn');
  await expectResult(page.locator('#pub-stale')).toBeVisible();
  // The old page already has data-publish-ready="true": wait for the reloaded page to load first,
  // or the ready check passes on the old page and the next click races the reload (BUG-8).
  await Promise.all([page.waitForEvent('load'), page.click('#pub-reload')]);
  await expectResult(page.locator('html')).toHaveAttribute('data-publish-ready', 'true');
  await page.click('#publish-btn');
  await expectResult(page.locator('#pub-stale')).toBeVisible();
  expect(writes(github)).toEqual([]);
});

test('a draft saved before Publish existed (no base) stops as stale instead of guessing', async ({ page, github }) => {
  await saveFakeToken(page);
  await page.evaluate(() => localStorage.setItem('puzzkezz.events.draft', JSON.stringify({
    version: 1, events: [{ id: '2026-12-20-old', date: '2026-12-20', short: 'OLD', name: 'Old Draft Con' }],
  })));
  await page.reload();
  await expectResult(page.locator('html')).toHaveAttribute('data-publish-ready', 'true');
  await page.click('#publish-btn');
  await expectResult(page.locator('#pub-stale')).toBeVisible();
  expect(writes(github)).toEqual([]);
});

test('stale (ref): PATCH returns 422 -> stale message, fake repo head unchanged', async ({ page, github }) => {
  await saveFakeToken(page);
  await addEvent(page);
  const head = github.repo.head;
  github.respond(REF_PATCH, { status: 422, body: { message: 'Update is not a fast forward' } });
  await page.click('#publish-btn');
  await expectResult(page.locator('#pub-stale')).toBeVisible();
  await expectResult(page.locator('#pub-stale')).toContainText(STALE);
  expect(github.repo.head).toBe(head);
  expect(github.calls()).toEqual(eightCalls(github, head));
  await expect(page.locator('#publish-btn')).toBeEnabled(); // draft kept, still pending
});

test('stale (ref): PATCH returns 409 -> stale message too', async ({ page, github }) => {
  await saveFakeToken(page);
  await addEvent(page);
  const head = github.repo.head;
  github.respond(REF_PATCH, { status: 409, body: { message: 'Conflict' } });
  await page.click('#publish-btn');
  await expectResult(page.locator('#pub-stale')).toContainText(STALE);
  expect(github.repo.head).toBe(head);
});

test('stale (ref) for real: branch moves between reading and the PATCH -> nothing goes live', async ({ page, github }) => {
  await saveFakeToken(page);
  await addEvent(page);
  // Someone pushes a different file while this publish is uploading its blob.
  github.respond(BLOB_POST, (req, route) => {
    github.repo.pushOutside({ 'README.md': 'pushed from another device\n' });
    return github.route(route, req);
  });
  await page.click('#publish-btn');
  await expectResult(page.locator('#pub-stale')).toBeVisible();
  const moved = github.repo.head;
  expect(github.repo.commits.get(moved).message).toBe('Outside change');
  expect(github.repo.read('data/events.json')).not.toContain('Publish Test Con');
});

const FAILURES = [
  {
    name: '401 (token expired)',
    match: REF_GET,
    response: { status: 401, body: { message: 'Bad credentials' } },
    text: 'Your GitHub token is wrong or has expired.',
  },
  {
    name: '403 on the blob write',
    match: BLOB_POST,
    response: { status: 403, body: { message: 'Resource not accessible by personal access token' } },
    text: "This token can't write to the repo. It needs Contents: Read and write.",
  },
  {
    name: '404 on the tree write',
    match: TREE_POST,
    response: { status: 404, body: { message: 'Not Found' } },
    text: "This token can't write to the repo. It needs Contents: Read and write.",
  },
  {
    name: '429 with retry-after',
    match: REF_GET,
    response: { status: 429, body: { message: 'rate limited' }, headers: { 'retry-after': '120' } },
    text: 'GitHub is busy. Wait 2 minutes and try again.',
  },
  {
    name: '403 rate limit (x-ratelimit-remaining: 0)',
    match: COMMIT_POST,
    response: { status: 403, body: { message: 'API rate limit exceeded' }, headers: { 'x-ratelimit-remaining': '0', 'retry-after': '30' } },
    text: 'GitHub is busy. Wait 1 minute and try again.',
  },
  {
    name: 'network abort',
    match: REF_GET,
    response: { abort: true },
    text: "Can't reach GitHub. Check your internet connection.",
  },
  {
    name: 'server error on the commit',
    match: COMMIT_POST,
    response: { status: 500, body: { message: 'Server Error' } },
    text: 'GitHub said no (500).',
  },
];

for (const f of FAILURES) {
  test(`failure: ${f.name} -> clear message, head unchanged, draft kept, Try again works`, async ({ page, github }) => {
    await saveFakeToken(page);
    await addEvent(page);
    const head = github.repo.head;
    github.respond(f.match, f.response);
    await page.click('#publish-btn');
    await expectResult(page.locator('#pub-err')).toBeVisible();
    await expectResult(page.locator('#pub-err-text')).toHaveText(f.text);
    await expectResult(page.locator('#pub-err-next')).toContainText('Nothing was changed on GitHub.');
    await expectResult(page.locator('#pub-ok')).toBeHidden();
    expect(github.repo.head).toBe(head);
    expect(github.calls()).not.toContain(REF_PATCH);
    expect(newCommits(github)).toBe(0);
    // The draft is still there.
    const draft = await page.evaluate(() => localStorage.getItem('puzzkezz.events.draft'));
    expect(draft).toContain('Publish Test Con');

    // Try again repeats the whole publish from step 1 and now succeeds with one ref update.
    const before = github.calls().length;
    await page.click('#pub-retry');
    await expectResult(page.locator('#pub-ok')).toBeVisible();
    await expectResult(page.locator('#pub-err')).toBeHidden();
    expect(github.calls().slice(before)).toEqual(eightCalls(github, head));
    expect(github.calls().filter((c) => c === REF_PATCH)).toHaveLength(1);
    expect(github.repo.commits.get(github.repo.head).parents).toEqual([head]);
  });
}

test('PATCH connection drops and the ref did not move (yet) -> "not clear" message, never "Nothing was changed"', async ({ page, github }) => {
  await saveFakeToken(page);
  await addEvent(page);
  const head = github.repo.head;
  github.respond(REF_PATCH, { abort: true });
  await page.click('#publish-btn');
  await expectResult(page.locator('#pub-err-text')).toHaveText(UNSURE);
  await expectResult(page.locator('#pub-err-next')).toHaveText(UNSURE_NEXT);
  await expectResult(page.locator('#pub-err-next')).not.toContainText('Nothing was changed');
  expect(github.repo.head).toBe(head);
  // Steps 1-8 plus one read of the ref to check whether the update happened.
  expect(github.calls()).toEqual([...eightCalls(github, head), REF_GET]);
  // It really did not go live: Try again publishes once.
  await page.click('#pub-retry');
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  expect(newCommits(github)).toBe(2); // the orphan commit from the first try + the live one
  expect(github.repo.commits.get(github.repo.head).parents).toEqual([head]);
});

test('500 on the PATCH and the ref re-read does not show the commit -> "not clear" message', async ({ page, github }) => {
  await saveFakeToken(page);
  await addEvent(page);
  const head = github.repo.head;
  github.respond(REF_PATCH, { status: 500, body: { message: 'Server Error' } });
  await page.click('#publish-btn');
  await expectResult(page.locator('#pub-err-text')).toHaveText(UNSURE);
  expect(github.repo.head).toBe(head);
});

test('unsure, but the PATCH was applied later -> Try again finds the text on GitHub and shows success with no writes', async ({ page, github }) => {
  await saveFakeToken(page);
  await addEvent(page);
  const head = github.repo.head;
  github.respond(REF_PATCH, async (req, route) => {
    // The re-read still sees the old head (lag)...
    github.respond(REF_GET, { status: 200, body: { ref: `refs/heads/${BRANCH}`, object: { sha: head, type: 'commit' } } });
    // ...but GitHub applies the update a moment later.
    github.repo.head = req.body.sha;
    return route.abort('failed');
  });
  await page.click('#publish-btn');
  await expectResult(page.locator('#pub-err-text')).toHaveText(UNSURE);
  const live = github.repo.head;
  const before = github.calls().length;
  await page.click('#pub-retry');
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  await expectResult(page.locator('#pub-stale')).toBeHidden();
  expect(github.calls().slice(before)).toEqual(eightCalls(github, live).slice(0, 3)); // reads only
  expect(github.repo.head).toBe(live);
  expect(newCommits(github)).toBe(1);
  await expectResult(page.locator('#publish-btn')).toHaveText('Nothing to publish');
});

test('PATCH went through but the answer was lost -> confirmed by reading the ref, shown as published', async ({ page, github }) => {
  await saveFakeToken(page);
  await addEvent(page);
  const head = github.repo.head;
  github.respond(REF_PATCH, async (req, route) => {
    github.repo.head = req.body.sha; // GitHub applied it...
    return route.abort('failed'); // ...but the reply never arrived
  });
  await page.click('#publish-btn');
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  expect(github.repo.commits.get(github.repo.head).parents).toEqual([head]);
  await expectResult(page.locator('#publish-btn')).toHaveText('Nothing to publish');
});

test('double-clicking Publish makes only one commit; buttons are locked while publishing', async ({ page, github }) => {
  await saveFakeToken(page);
  await addEvent(page);
  // Hold the first GitHub read open, so the busy state stays on screen until the test has checked it.
  const firstRead = github.hold(REF_GET);
  await page.locator('#publish-btn').dblclick();
  await firstRead.arrived;
  await expect(page.locator('#publish-btn')).toHaveText('Publishing...');
  await expect(page.locator('#publish-btn')).toBeDisabled();
  await expect(page.locator('#discard-draft')).toBeDisabled();
  await expect(page.locator('#import-file')).toBeDisabled();
  await expect(page.locator('label[for="import-file"]')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('#gh-forget')).toBeDisabled();
  await expectResult(page.locator('#pub-progress')).toBeVisible();
  await expectResult(page.locator('#pub-bar')).toHaveAttribute('role', 'progressbar');
  await expectResult(page.locator('#pub-step')).toContainText('Step 1 of 8');
  // A click forced through the disabled state still cannot start a second publish.
  await page.evaluate(() => document.getElementById('publish-btn').click());
  firstRead.release();
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  expect(github.calls().filter((c) => c === COMMIT_POST)).toHaveLength(1);
  expect(github.calls().filter((c) => c === REF_PATCH)).toHaveLength(1);
  expect(newCommits(github)).toBe(1);
  // Unlocked again afterwards.
  await expect(page.locator('#discard-draft')).toBeEnabled();
  await expect(page.locator('#import-file')).toBeEnabled();
  await expect(page.locator('#gh-forget')).toBeEnabled();
});

test('Export / Import still work next to Publish; the token is never in the published file', async ({ page, github }) => {
  await saveFakeToken(page);
  const good = { version: 1, events: [{ id: '2023-12-01-cf', date: '2023-12-01', short: 'CF', name: 'Comic Fiesta' }] };
  await page.setInputFiles('#import-file', { name: 'good.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(good)) });
  await expect(page.locator('.event-row')).toHaveCount(1);
  const text = await exportedText(page);
  expect(JSON.parse(text).events).toHaveLength(1);
  await page.click('#publish-btn');
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  expect(github.repo.read('data/events.json')).toBe(text);
  for (const r of github.requests) expect(`${API}${r.path}`.startsWith(`${API}/repos/jiayangwong/MyCosplayWebsite/`)).toBe(true);
});
