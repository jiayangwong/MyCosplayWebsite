// TASK-12: Publish events.json to GitHub in one atomic commit (Git Data API, stale checks).
// Uses the in-memory fake repo from tests/github-mock.js and the fake token only. The `github` fixture fails
// a test on any unhandled api.github.com call, and if the token shows up anywhere except the Authorization
// header of a request to https://api.github.com.
const fs = require('fs');
const { test, expect, API, gitBlobSha, saveFakeToken } = require('./github-mock');

const REPO = '/repos/jiayangwong/MyCosplayWebsite';
const REF_GET = `GET ${REPO}/git/ref/heads/main`;
const BLOB_POST = `POST ${REPO}/git/blobs`;
const TREE_POST = `POST ${REPO}/git/trees`;
const COMMIT_POST = `POST ${REPO}/git/commits`;
const REF_PATCH = `PATCH ${REPO}/git/refs/heads/main`;
const STALE = 'The site changed since you started editing (maybe from another device). Export a backup, then reload this page.';
const SUCCESS = 'Published. The site updates in about 1-2 minutes.';

test.beforeEach(async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('admin/index.html');
  await expect(page.locator('html')).toHaveAttribute('data-manager-ready', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-github-ready', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-publish-ready', 'true');
});

/** The 7 calls of one publish, in order, for a given head commit. */
const sevenCalls = (head) => [
  REF_GET,
  `GET ${REPO}/git/commits/${head}`,
  `GET ${REPO}/contents/data/events.json`,
  BLOB_POST,
  TREE_POST,
  COMMIT_POST,
  REF_PATCH,
];

/** Adds an event through the form, so the draft differs from the published file. */
async function addEvent(page, short = 'PUB', name = 'Publish Test Con') {
  await page.click('#new-event');
  await page.fill('#f-date', '2026-12-20');
  await page.fill('#f-short', short);
  await page.fill('#f-name', name);
  await page.click('#save-event');
  await expect(page.locator('#save-status')).toContainText(`Saved ${short}`);
}

async function exportedText(page) {
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#export-events')]);
  return fs.readFileSync(await download.path(), 'utf8');
}

const writes = (github) => github.calls().filter((c) => !c.startsWith('GET '));
const newCommits = (github) => github.repo.commits.size - 1;

test('panel: no token -> disabled with hint; token + no changes -> "Nothing to publish"; new help text', async ({ page, github }) => {
  await expect(page.locator('.help-box')).toContainText('Changes stay on this browser until you press Publish to GitHub. Export events.json is a backup you can commit by hand.');
  await expect(page.locator('#pub-title')).toHaveText('Publish');
  await expect(page.locator('#publish-btn')).toBeDisabled();
  await expect(page.locator('#publish-hint')).toHaveText('Add a GitHub token to publish');
  await saveFakeToken(page);
  await expect(page.locator('#publish-btn')).toBeDisabled();
  await expect(page.locator('#publish-btn')).toHaveText('Nothing to publish');
  await expect(page.locator('#pub-pending')).toHaveText('No pending changes.');
  await addEvent(page);
  await expect(page.locator('#pub-pending li')).toHaveText('~ data/events.json changed');
  await expect(page.locator('#publish-btn')).toBeEnabled();
  await expect(page.locator('#publish-btn')).toHaveText('Publish to GitHub');
  expect(github.calls()).toEqual([]); // nothing is sent until Publish is pressed
});

test('happy path: exactly 7 calls in order, one-file tree, blob = Export, parents [head], force:false', async ({ page, github }) => {
  await saveFakeToken(page);
  await addEvent(page);
  const expected = await exportedText(page);
  const head = github.repo.head;

  await page.click('#publish-btn');
  await expect(page.locator('#pub-ok')).toBeVisible();
  await expect(page.locator('#pub-ok')).toContainText(SUCCESS);

  expect(github.calls()).toEqual(sevenCalls(head));
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
  await expect(page.locator('#pub-commit')).toHaveAttribute('href', `https://github.com/jiayangwong/MyCosplayWebsite/commit/${github.repo.head}`);
  await expect(page.locator('#pub-commit')).toHaveAttribute('target', '_blank');
  await expect(page.locator('#publish-btn')).toHaveText('Nothing to publish');
  await expect(page.locator('#pub-progress')).toBeHidden();
  // Every request that carried the token went to the GitHub API (the fixture also checks for leaks).
  for (const r of github.requests) expect(r.headers.authorization).toMatch(/^Bearer /);
  expect(github.requests.length).toBe(7);
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
  await expect(page.locator('#pub-ok')).toBeVisible();
  const first = github.repo.head;
  const draft = await page.evaluate(() => JSON.parse(localStorage.getItem('puzzkezz.events.draft')));
  expect(draft.baseEventsSha).toBe(github.repo.filesAt().get('data/events.json').sha);

  await addEvent(page, 'TWO', 'Second Publish');
  await page.click('#publish-btn');
  await expect(page.locator('#pub-stale')).toBeHidden();
  await expect(page.locator('#pub-ok')).toBeVisible();
  await expect(page.locator('#publish-btn')).toHaveText('Nothing to publish');
  expect(newCommits(github)).toBe(2);
  expect(github.repo.commits.get(github.repo.head).parents).toEqual([first]);
  expect(github.repo.read('data/events.json')).toContain('Second Publish');
  expect(github.calls().slice(7)).toEqual(sevenCalls(first));
});

test('stale (blob): repo events.json changed elsewhere -> stale message, no POST/PATCH, Export backup works', async ({ page, github }) => {
  await saveFakeToken(page);
  await addEvent(page);
  const outside = github.repo.pushOutside({ 'data/events.json': '{"version":1,"events":[]}\n' });
  await page.click('#publish-btn');
  await expect(page.locator('#pub-stale')).toBeVisible();
  await expect(page.locator('#pub-stale')).toContainText(STALE);
  await expect(page.locator('#pub-stale')).toContainText('Nothing was changed on GitHub.');
  await expect(page.locator('#pub-ok')).toBeHidden();
  await expect(page.locator('#pub-err')).toBeHidden();
  expect(github.calls()).toEqual(sevenCalls(outside).slice(0, 3));
  expect(writes(github)).toEqual([]);
  expect(github.repo.head).toBe(outside);
  // The draft is kept and can be saved as a backup.
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#pub-export')]);
  expect(download.suggestedFilename()).toBe('events.json');
  expect(fs.readFileSync(await download.path(), 'utf8')).toContain('Publish Test Con');
  await expect(page.locator('#pub-reload')).toBeVisible();
});

test('stale (ref): PATCH returns 422 -> stale message, fake repo head unchanged', async ({ page, github }) => {
  await saveFakeToken(page);
  await addEvent(page);
  const head = github.repo.head;
  github.respond(REF_PATCH, { status: 422, body: { message: 'Update is not a fast forward' } });
  await page.click('#publish-btn');
  await expect(page.locator('#pub-stale')).toBeVisible();
  await expect(page.locator('#pub-stale')).toContainText(STALE);
  expect(github.repo.head).toBe(head);
  expect(github.calls()).toEqual(sevenCalls(head));
  await expect(page.locator('#publish-btn')).toBeEnabled(); // draft kept, still pending
});

test('stale (ref): PATCH returns 409 -> stale message too', async ({ page, github }) => {
  await saveFakeToken(page);
  await addEvent(page);
  const head = github.repo.head;
  github.respond(REF_PATCH, { status: 409, body: { message: 'Conflict' } });
  await page.click('#publish-btn');
  await expect(page.locator('#pub-stale')).toContainText(STALE);
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
  await expect(page.locator('#pub-stale')).toBeVisible();
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
    await expect(page.locator('#pub-err')).toBeVisible();
    await expect(page.locator('#pub-err-text')).toHaveText(f.text);
    await expect(page.locator('#pub-err-next')).toContainText('Nothing was changed on GitHub.');
    await expect(page.locator('#pub-ok')).toBeHidden();
    expect(github.repo.head).toBe(head);
    expect(github.calls()).not.toContain(REF_PATCH);
    expect(newCommits(github)).toBe(0);
    // The draft is still there.
    const draft = await page.evaluate(() => localStorage.getItem('puzzkezz.events.draft'));
    expect(draft).toContain('Publish Test Con');

    // Try again repeats the whole publish from step 1 and now succeeds with one ref update.
    const before = github.calls().length;
    await page.click('#pub-retry');
    await expect(page.locator('#pub-ok')).toBeVisible();
    await expect(page.locator('#pub-err')).toBeHidden();
    expect(github.calls().slice(before)).toEqual(sevenCalls(head));
    expect(github.calls().filter((c) => c === REF_PATCH)).toHaveLength(1);
    expect(github.repo.commits.get(github.repo.head).parents).toEqual([head]);
  });
}

test('PATCH connection drops but GitHub did not move the ref -> network message, head unchanged', async ({ page, github }) => {
  await saveFakeToken(page);
  await addEvent(page);
  const head = github.repo.head;
  github.respond(REF_PATCH, { abort: true });
  await page.click('#publish-btn');
  await expect(page.locator('#pub-err-text')).toHaveText("Can't reach GitHub. Check your internet connection.");
  expect(github.repo.head).toBe(head);
  // Steps 1-7 plus one read of the ref to check whether the update happened.
  expect(github.calls()).toEqual([...sevenCalls(head), REF_GET]);
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
  await expect(page.locator('#pub-ok')).toBeVisible();
  expect(github.repo.commits.get(github.repo.head).parents).toEqual([head]);
  await expect(page.locator('#publish-btn')).toHaveText('Nothing to publish');
});

test('double-clicking Publish makes only one commit; buttons are locked while publishing', async ({ page, github }) => {
  await saveFakeToken(page);
  await addEvent(page);
  github.respond(REF_GET, { delay: 600 }); // slow first call so the lock can be observed
  await page.locator('#publish-btn').dblclick();
  await expect(page.locator('#publish-btn')).toHaveText('Publishing...');
  await expect(page.locator('#publish-btn')).toBeDisabled();
  await expect(page.locator('#discard-draft')).toBeDisabled();
  await expect(page.locator('#import-file')).toBeDisabled();
  await expect(page.locator('label[for="import-file"]')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('#gh-forget')).toBeDisabled();
  await expect(page.locator('#pub-progress')).toBeVisible();
  await expect(page.locator('#pub-bar')).toHaveAttribute('role', 'progressbar');
  await expect(page.locator('#pub-step')).toContainText('Step 1 of 7');
  // A click forced through the disabled state still cannot start a second publish.
  await page.evaluate(() => document.getElementById('publish-btn').click());
  await expect(page.locator('#pub-ok')).toBeVisible();
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
  await expect(page.locator('#pub-ok')).toBeVisible();
  expect(github.repo.read('data/events.json')).toBe(text);
  for (const r of github.requests) expect(`${API}${r.path}`.startsWith(`${API}/repos/jiayangwong/MyCosplayWebsite/`)).toBe(true);
});
