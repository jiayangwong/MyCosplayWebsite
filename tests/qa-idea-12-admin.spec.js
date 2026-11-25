// QA exploratory checks for the admin Moments panel (TASK-21 / TASK-22): double publish, bad published file, token.
const { test, expect, BRANCH, FAKE_TOKEN, FakeRepo, openFold } = require('./github-mock');
const EV = `${JSON.stringify({ version: 1, events: [{ id: '2026-03-14-cf', date: '2026-03-14', short: 'CF', name: 'CF Test Con' }] }, null, 2)}\n`;
const ok = expect.configure({ timeout: 15000 });
test.describe.configure({ timeout: 60000 });

async function setup(page, github, moments) {
  page.on('dialog', (d) => d.accept());
  github.repo = new FakeRepo({ files: { 'data/events.json': EV, 'data/moments.json': moments } });
  await page.route('**/data/events.json', (r) => r.fulfill({ contentType: 'application/json', body: EV }));
  await page.route('**/data/moments.json', (r) => r.fulfill({ contentType: 'application/json', body: moments }));
  await page.goto('admin/index.html');
  for (const f of ['manager', 'github', 'publish', 'moments']) await ok(page.locator('html')).toHaveAttribute(`data-${f}-ready`, 'true');
  await openFold(page, 'gh');
  await page.fill('#gh-token', FAKE_TOKEN);
  await page.press('#gh-token', 'Enter');
  await ok(page.locator('#gh-saved')).toContainText('Token saved');
  await openFold(page, 'moments-panel');
}
const add = async (page, caption, link) => {
  await page.press('#new-moment', 'Enter');
  await page.fill('#m-year', '2025'); await page.fill('#m-caption', caption); await page.fill('#m-link', link);
  await page.press('#m-caption', 'Enter');
};

test('double click on Publish makes exactly one commit', async ({ page, github }) => {
  await setup(page, github, '{ "version": 1, "moments": [] }\n');
  await add(page, 'Double', 'https://example.com/d');
  await page.locator('#publish-btn').dblclick();
  await ok(page.locator('#pub-ok')).toBeVisible();
  await page.waitForTimeout(500);
  const commits = github.requests.filter((r) => r.method === 'POST' && r.path.endsWith('/git/commits'));
  expect(commits).toHaveLength(1);
});

test('garbage data/moments.json on the site: panel loads without crash, can still add', async ({ page, github }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await setup(page, github, 'not json {{');
  await expect(page.locator('#moment-list .event-row')).toHaveCount(0);
  await add(page, 'After garbage', 'https://example.com/g');
  await expect(page.locator('#moment-list .event-row')).toHaveCount(1);
  expect(errs).toEqual([]);
});

test('token never appears in the moments draft, page text or storage after a publish', async ({ page, github }) => {
  await setup(page, github, '{ "version": 1, "moments": [] }\n');
  await add(page, 'Token check', 'https://example.com/t');
  await page.locator('#publish-btn').press('Enter');
  await ok(page.locator('#pub-ok')).toBeVisible();
  const dump = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k]) => k !== 'puzzkezz.github.token'))) + JSON.stringify(sessionStorage) + document.body.innerText + document.documentElement.outerHTML.replace(/<input[^>]*>/g, ''));
  expect(dump).not.toContain(FAKE_TOKEN);
  expect(github.requests.every((r) => !JSON.stringify(r.body || '').includes(FAKE_TOKEN))).toBe(true);
});

test('Delete: Cancel keeps the moment', async ({ page, github }) => {
  await setup(page, github, '{ "version": 1, "moments": [] }\n');
  page.removeAllListeners('dialog');
  page.on('dialog', (d) => d.dismiss());
  await add(page, 'Keep me', 'https://example.com/k');
  await page.locator('#moment-list .event-row').first().getByRole('button', { name: /delete/i }).click();
  await expect(page.locator('#moment-list .event-row')).toHaveCount(1);
});
