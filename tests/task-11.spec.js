// TASK-11: GitHub connection panel in /admin/ (token save / test / forget).
// Uses the fake GitHub from tests/github-mock.js: every test fails on an unhandled api.github.com call
// or if the fake token shows up anywhere except the Authorization header to api.github.com.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { test, expect, BRANCH, FAKE_TOKEN, saveFakeToken } = require('./github-mock');

const TOKEN_KEY = 'puzzkezz.github.token';
const REPO_PATH = '/repos/jiayangwong/MyCosplayWebsite';
const CLASSIC = 'This is a classic token that can reach all your repos. Please make a fine-grained token for this repo only.';
const TAIL = FAKE_TOKEN.slice(-4);

test.beforeEach(async ({ page }) => {
  // Fonts don't matter here, and a slow Google Fonts load can hold up the page.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  page.on('dialog', (d) => d.accept());
  await page.goto('admin/index.html');
  await expect(page.locator('html')).toHaveAttribute('data-manager-ready', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-github-ready', 'true');
});

const stored = (page) => page.evaluate((k) => localStorage.getItem(k), TOKEN_KEY);

test('panel layout: help, password field, buttons, not-connected state', async ({ page }) => {
  const panel = page.locator('#gh-panel');
  await expect(panel.locator('h2')).toHaveText('GitHub');
  await expect(panel).toContainText('The token stays in this browser only.');
  await panel.locator('summary').click();
  await expect(panel.locator('.gh-help')).toContainText('fine-grained');
  await expect(panel.locator('.gh-help')).toContainText('Contents: Read and write');
  await expect(panel.locator('.gh-help')).toContainText('expiry date');
  await expect(panel.locator('.gh-help')).toContainText('jiayangwong/MyCosplayWebsite');
  const input = page.getByLabel('Token', { exact: true });
  await expect(input).toHaveAttribute('type', 'password');
  await expect(input).toHaveAttribute('autocomplete', 'off');
  await expect(page.locator('#gh-save')).toHaveText('Save token');
  await expect(page.locator('#gh-test')).toBeDisabled();
  await expect(page.locator('#gh-forget')).toBeDisabled();
  await expect(page.locator('#gh-status')).toHaveText(/No token saved\. Paste one above\./);
  await expect(page.locator('#publish-btn')).toBeDisabled();
  await expect(page.locator('#publish-hint')).toHaveText('Add a GitHub token to publish');
});

test('Save stores the fake token, clears the input, shows the last 4; survives reload', async ({ page }) => {
  await saveFakeToken(page);
  expect(await stored(page)).toBe(FAKE_TOKEN);
  await expect(page.locator('#gh-token')).toHaveValue('');
  await expect(page.locator('#gh-saved')).toHaveText(`Token saved, ends in ...${TAIL}`);
  await expect(page.locator('#gh-panel')).not.toContainText(FAKE_TOKEN);
  await expect(page.locator('#gh-test')).toBeEnabled();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-github-ready', 'true');
  expect(await stored(page)).toBe(FAKE_TOKEN);
  await expect(page.locator('#gh-saved')).toHaveText(`Token saved, ends in ...${TAIL}`);
  await expect(page.locator('#gh-token')).toHaveValue('');
});

test('classic ghp_ token and empty input are refused and not stored', async ({ page }) => {
  await page.fill('#gh-token', 'ghp_TESTONLY');
  await page.click('#gh-save');
  await expect(page.locator('#gh-token-error')).toHaveText(CLASSIC);
  expect(await stored(page)).toBeNull();
  await page.fill('#gh-token', '   ');
  await page.click('#gh-save');
  await expect(page.locator('#gh-token-error')).toBeVisible();
  expect(await stored(page)).toBeNull();
  await expect(page.locator('#gh-saved')).toBeHidden();
});

test('Test connection: 200 / 401 / 404 / network abort show their messages', async ({ page, github }) => {
  await saveFakeToken(page);

  // Hold the request open, so "Testing..." stays on screen until the test has checked it.
  const check = github.hold(`GET ${REPO_PATH}`);
  await page.click('#gh-test');
  await check.arrived;
  await expect(page.locator('#gh-status')).toContainText('Testing...');
  await expect(page.locator('#gh-status .ibar')).toBeVisible();
  check.release();
  await expect(page.locator('#gh-status')).toContainText(`Connected to jiayangwong/MyCosplayWebsite (${BRANCH}). Write access is checked when you publish.`);
  await expect(page.locator('#gh-status')).toHaveAttribute('data-state', 'ok');

  github.respond(`GET ${REPO_PATH}`, { status: 401 });
  await page.click('#gh-test');
  await expect(page.locator('#gh-alert')).toHaveText(/This token is wrong or has expired\./);
  await expect(page.locator('#gh-alert')).toHaveAttribute('role', 'alert');
  await expect(page.locator('#gh-status')).toBeHidden();

  github.respond(`GET ${REPO_PATH}`, { status: 404 });
  await page.click('#gh-test');
  await expect(page.locator('#gh-alert')).toHaveText(/This token can't see the repo\. Check that it is for jiayangwong\/MyCosplayWebsite\./);

  github.respond(`GET ${REPO_PATH}`, { status: 403 });
  await page.click('#gh-test');
  await expect(page.locator('#gh-alert')).toHaveText(/can't see the repo/);

  github.respond(`GET ${REPO_PATH}`, { abort: true });
  await page.click('#gh-test');
  await expect(page.locator('#gh-alert')).toHaveText(/Can't reach GitHub\. Check your internet connection\./);

  const calls = github.requests.filter((r) => r.method === 'GET' && r.path === REPO_PATH);
  expect(calls).toHaveLength(5);
  for (const r of calls) {
    expect(r.headers.authorization).toBe(`Bearer ${FAKE_TOKEN}`);
    expect(r.headers.accept).toBe('application/vnd.github+json');
    expect(r.headers['x-github-api-version']).toBeTruthy();
  }
});

test('Forget token removes the key and disables Publish', async ({ page }) => {
  await saveFakeToken(page);
  await expect(page.locator('#publish-hint')).not.toHaveText('Add a GitHub token to publish');
  let asked = false;
  page.on('dialog', () => { asked = true; });
  await page.click('#gh-forget');
  expect(asked).toBe(true);
  expect(await stored(page)).toBeNull();
  await expect(page.locator('#gh-status')).toHaveText(/No token saved\. Paste one above\./);
  await expect(page.locator('#gh-saved')).toBeHidden();
  await expect(page.locator('#gh-forget')).toBeDisabled();
  await expect(page.locator('#gh-test')).toBeDisabled();
  await expect(page.locator('#publish-btn')).toBeDisabled();
  await expect(page.locator('#publish-hint')).toHaveText('Add a GitHub token to publish');
});

test('Forget token: cancelling the confirmation keeps the token', async ({ page }) => {
  await saveFakeToken(page);
  page.removeAllListeners('dialog');
  page.once('dialog', (d) => d.dismiss());
  await page.click('#gh-forget');
  expect(await stored(page)).toBe(FAKE_TOKEN);
});

test('the token never reaches the draft or an exported events.json', async ({ page, github }) => {
  await saveFakeToken(page);
  await page.click('#gh-test');
  await expect(page.locator('#gh-status')).toHaveAttribute('data-state', 'ok');
  // Make a draft.
  await page.fill('#f-date', '2026-12-12');
  await page.fill('#f-short', 'TT');
  await page.fill('#f-name', 'Token Test Con');
  await page.click('#save-event');
  await expect(page.locator('.event-row')).toHaveCount(9);
  const others = await page.evaluate((k) => Object.keys(localStorage).filter((key) => key !== k).map((key) => localStorage.getItem(key)), TOKEN_KEY);
  expect(others.length).toBeGreaterThan(0);
  for (const value of others) expect(value).not.toContain(FAKE_TOKEN);
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#export-events')]);
  const text = fs.readFileSync(await download.path(), 'utf8');
  expect(text).toContain('Token Test Con');
  expect(text).not.toContain(FAKE_TOKEN);
  expect(github.calls()).toEqual([`GET ${REPO_PATH}`]);
});

test('CSP allows only self + api.github.com for fetch, referrer is off', async ({ page }) => {
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  const connect = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('connect-src'));
  expect(connect).toBe("connect-src 'self' https://api.github.com");
  const directives = csp.split(';').map((d) => d.trim()).filter(Boolean);
  for (const d of ["object-src 'none'", "base-uri 'none'", "form-action 'self'"]) expect(directives).toContain(d);
  // Nothing else may widen what the page can connect to.
  expect(directives.filter((d) => /^(default-src|connect-src)\b/.test(d))).toEqual([connect]);
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer');
  // If CSP did not block it, this fake answer would make the fetch succeed and the test fail.
  await page.route('https://example.com/**', (route) => route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body: 'ok' }));
  const result = await page.evaluate(async () => {
    try {
      await fetch('https://example.com/steal');
      return 'reached';
    } catch {
      return 'blocked';
    }
  });
  expect(result).toBe('blocked');
});

test('a full session leaks the token nowhere (checked by the github fixture)', async ({ page, github }) => {
  await saveFakeToken(page);
  await page.click('#gh-test');
  await expect(page.locator('#gh-status')).toHaveAttribute('data-state', 'ok');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-github-ready', 'true');
  github.respond(`GET ${REPO_PATH}`, { status: 401 });
  await page.click('#gh-test');
  await expect(page.locator('#gh-alert')).toBeVisible();
  await page.click('#gh-forget');
  expect(github.requests.length).toBe(2);
  expect(page.url()).not.toContain(FAKE_TOKEN);
});

test('repo scan: no real-looking GitHub token in any non-test file', async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'file scan runs once');
  const root = path.resolve(__dirname, '..');
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter((f) => /\.(html|js|json)$/.test(f))
    .filter((f) => !f.startsWith('node_modules/') && !f.endsWith('/') && fs.existsSync(path.join(root, f)));
  expect(files.length).toBeGreaterThan(20);
  const pattern = /ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/g;
  const hits = [];
  for (const f of files) {
    const text = fs.readFileSync(path.join(root, f), 'utf8');
    for (const m of text.matchAll(pattern)) {
      // Test files may contain only the one obviously fake token.
      if (f.startsWith('tests/') && m[0] === FAKE_TOKEN) continue;
      hits.push(`${f}: ${m[0].slice(0, 14)}...`);
    }
  }
  expect(hits).toEqual([]);
});

test('fake GitHub behaves like GitHub: unknown refs 404, bad tree entries and missing parents 422', async ({ page, github }) => {
  const head = github.repo.head;
  const results = await page.evaluate(async ({ token, head, branch }) => {
    const base = 'https://api.github.com/repos/jiayangwong/MyCosplayWebsite';
    const call = async (method, p, body) => {
      const r = await fetch(base + p, {
        method,
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: r.status, body: await r.json() };
    };
    const out = {};
    out.noRef = await call('GET', '/contents/data/events.json');
    out.branch = await call('GET', `/contents/data/events.json?ref=${branch}`);
    out.sha = await call('GET', `/contents/data/events.json?ref=${head}`);
    out.undef = await call('GET', '/contents/data/events.json?ref=undefined');
    out.unknownSha = await call('GET', `/contents/data/events.json?ref=${'0'.repeat(40)}`);
    out.encoded = await call('GET', '/contents/data%2Fevents.json');
    const blob = await call('POST', '/git/blobs', { content: 'x', encoding: 'utf-8' });
    const commit = await call('GET', `/git/commits/${head}`);
    const tree = commit.body.tree.sha;
    out.badMode = await call('POST', '/git/trees', { base_tree: tree, tree: [{ path: 'a.txt', mode: '100666', type: 'blob', sha: blob.body.sha }] });
    out.badType = await call('POST', '/git/trees', { base_tree: tree, tree: [{ path: 'a.txt', mode: '100644', type: 'file', sha: blob.body.sha }] });
    out.goodTree = await call('POST', '/git/trees', { base_tree: tree, tree: [{ path: 'a.txt', mode: '100644', type: 'blob', sha: blob.body.sha }] });
    out.badParent = await call('POST', '/git/commits', { message: 'm', tree: out.goodTree.body.sha, parents: ['f'.repeat(40)] });
    out.goodCommit = await call('POST', '/git/commits', { message: 'm', tree: out.goodTree.body.sha, parents: [head] });
    return out;
  }, { token: FAKE_TOKEN, head, branch: BRANCH });
  for (const k of ['noRef', 'branch', 'sha']) {
    expect(results[k].status, k).toBe(200);
    expect(results[k].body.path).toBe('data/events.json');
  }
  expect(results.undef.status).toBe(404);
  expect(results.unknownSha.status).toBe(404);
  expect(results.encoded.status).toBe(200);
  expect(results.encoded.body.path).toBe('data/events.json');
  expect(results.badMode.status).toBe(422);
  expect(results.badType.status).toBe(422);
  expect(results.goodTree.status).toBe(201);
  expect(results.badParent.status).toBe(422);
  expect(results.goodCommit.status).toBe(201);
  expect(github.repo.head).toBe(head); // nothing moved the branch
  expect(github.repo.read('data/events.json')).toBe(fs.readFileSync(path.join(__dirname, '..', 'data', 'events.json'), 'utf8'));
});
