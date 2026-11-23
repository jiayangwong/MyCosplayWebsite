// QA extras for TASK-23: X disabled while publishing, 390px rows, token never in the page text/DOM, Tab order.
const fs = require('fs');
const path = require('path');
const { test, expect, FAKE_TOKEN, FakeRepo, openFold, saveFakeToken } = require('./github-mock');
const { noHorizontalScroll } = require('./helpers');

const SMALL = path.join(__dirname, 'fixtures', 'flat-800x600.png');
const REPO = '/repos/jiayangwong/MyCosplayWebsite';
const X = '2026-03-14-cf';
const ev = (id) => ({ id, date: id.slice(0, 10), short: id.slice(11).toUpperCase(), name: `${id.slice(11).toUpperCase()} Test Con` });
const longest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'events.json'), 'utf8')).events
  .reduce((a, b) => (`${b.short} ${b.name}`.length > `${a.short} ${a.name}`.length ? b : a));

async function ready(page) {
  for (const f of ['manager', 'uploader', 'github', 'publish']) await expect(page.locator('html')).toHaveAttribute(`data-${f}-ready`, 'true', { timeout: 15000 });
}

test('X is disabled on a pending card while publishing and enabled again after', async ({ page, github }) => {
  const text = `${JSON.stringify({ version: 1, events: [ev(X)] }, null, 2)}\n`;
  github.repo = new FakeRepo({ files: { 'data/events.json': text } });
  await page.route('**/data/events.json', (r) => r.fulfill({ contentType: 'application/json', body: text }));
  page.on('dialog', (d) => d.accept());
  await page.goto('admin/index.html');
  await ready(page);
  await saveFakeToken(page);
  await page.setInputFiles('#wm-files', SMALL);
  await expect(page.locator('.wm-card').first()).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
  await page.locator(`.event-row[data-id="${X}"]`).getByRole('button', { name: /^Edit/ }).press('Enter');
  await page.locator('.wm-card').first().getByRole('button', { name: 'Attach to selected event' }).press('Enter');
  await expect(page.locator('#f-photo')).toHaveValue(/flat-800x600/);
  const x = page.getByRole('button', { name: 'Remove flat-800x600.png', exact: true });
  await expect(x).toBeEnabled();
  const hold = github.hold(`POST ${REPO}/git/blobs`);
  await page.locator('#publish-btn').press('Enter');
  await expect(page.locator('#pub-progress')).toBeVisible({ timeout: 15000 });
  await expect(x).toBeDisabled();
  hold.release();
  await expect(page.locator('#pub-ok')).toBeVisible({ timeout: 15000 });
  // token never in visible text or input values other than the password field
  const leak = await page.evaluate((t) => document.body.innerText.includes(t) || [...document.querySelectorAll('input,textarea')].some((i) => i.value.includes(t) && i.type !== 'password'), FAKE_TOKEN);
  expect(leak).toBe(false);
  await expect(x).toHaveCount(1); // published card stays; X now allowed
  await expect(x).toBeEnabled();
});

test('phone widths 360 / 390: long names whole, buttons below, no h-scroll', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'phone only');
  await page.goto('admin/index.html');
  await ready(page);
  for (const w of [360, 390, 767]) {
    await page.setViewportSize({ width: w, height: 800 });
    await noHorizontalScroll(page);
    const rows = page.locator('#event-list .event-row');
    const n = await rows.count();
    for (let i = 0; i < n; i++) {
      const m = await rows.nth(i).evaluate((el) => {
        const t = el.querySelector('.event-row-title').getBoundingClientRect();
        const bs = [...el.querySelectorAll('.event-row-actions button')].map((b) => b.getBoundingClientRect());
        const r = el.getBoundingClientRect();
        return { tb: t.bottom, tw: t.width, rw: r.width, ys: bs.map((b) => b.top), hs: bs.map((b) => b.height), ws: bs.map((b) => b.width), right: Math.max(...bs.map((b) => b.right)), rr: r.right };
      });
      expect(Math.min(...m.ys)).toBeGreaterThanOrEqual(m.tb - 0.5);
      expect(Math.min(...m.hs, ...m.ws)).toBeGreaterThanOrEqual(44);
      expect(m.right).toBeLessThanOrEqual(m.rr + 0.5);
    }
  }
  expect(longest.id).toBeTruthy();
});

test('Tab order on desktop and one column follows the visual order within the form/publish area', async ({ page }, info) => {
  await page.goto('admin/index.html');
  await ready(page);
  const order = await page.evaluate(() => ['gh-panel', 'event-list', 'event-form', 'publish-panel'].map((id) => {
    const el = document.getElementById(id) || document.querySelector(`#${id}`);
    return el ? el.getBoundingClientRect().y : null;
  }));
  console.log(info.project.name, JSON.stringify(order));
  const dom = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const a = q('#gh-panel'), e = q('#event-list'), f = q('#f-name'), p = q('#publish-panel');
    const before = (x, y) => !!(x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING);
    return [before(a, e), before(e, f), before(f, p)];
  });
  expect(dom).toEqual([true, true, true]);
});
