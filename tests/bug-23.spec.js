// BUG-23: every count in the Analytics panel uses the right singular / plural ("1 page load", "2 page loads").
const { test, expect, seedPasscode, gotoAdmin, openAnalytics } = require('./analytics-mock');

const loaded = (page) => expect(page.locator('html')).toHaveAttribute('data-analytics-view', 'data');
async function open(page, tab) {
  await seedPasscode(page);
  await gotoAdmin(page);
  await openAnalytics(page);
  await loaded(page);
  await page.click(`#an-tab-${tab}`);
  await loaded(page);
  await expect(page.locator(`#an-tp-${tab}`)).toBeVisible();
}

test('countWord helper: 0, 1 and 2 for every count word', async ({ page }) => {
  await page.goto('admin/index.html');
  const r = await page.evaluate(async () => {
    const m = await import('/js/admin/charts.js');
    return ['visits', 'page views', 'page loads', 'samples'].map((w) => [0, 1, 2].map((n) => m.countWord(n, w)));
  });
  expect(r).toEqual([
    ['0 visits', '1 visit', '2 visits'],
    ['0 page views', '1 page view', '2 page views'],
    ['0 page loads', '1 page load', '2 page loads'],
    ['0 samples', '1 sample', '2 samples'],
  ]);
});

test('Performance: sample line and rating counts for 0, 1 and 2', async ({ page, analytics }) => {
  const f = analytics.fixture('performance', 30);
  f.data.byDevice.mobile.samples = 1;
  f.data.byDevice.desktop.samples = 2;
  f.data.vitals.cls = { good: 2, needsImprovement: 0, poor: 1 };
  analytics.setFixture('performance', 30, f);
  await open(page, 'performance');
  const tp = page.locator('#an-tp-performance');
  await expect(tp.locator('.an-vcol').nth(0).locator('.an-samp').first()).toHaveText('from 1 page load');
  await expect(tp.locator('.an-vcol').nth(1).locator('.an-samp').first()).toHaveText('from 2 page loads');
  const cls = tp.locator('.an-vshare').nth(2).locator('.an-split li .sm:last-child');
  await expect(cls).toHaveText(['2 page loads', '0 page loads', '1 page load']);
  // the table header stays plural
  await expect(tp.locator('.an-vshare').nth(2).locator('thead th').nth(1)).toHaveText('Page loads');
});

test('Sources and Pages: bars and other sites say "1 visit" / "1 page view"', async ({ page, analytics }) => {
  const s = analytics.fixture('sources', 30);
  s.data.groups = s.data.groups.map((g, i) => ({ ...g, visits: i === 0 ? 1 : i === 1 ? 2 : 0 }));
  s.data.otherHosts = [{ host: 't.co', visits: 1 }, { host: 'bing.com', visits: 2 }];
  analytics.setFixture('sources', 30, s);
  const p = analytics.fixture('pages', 30);
  p.data.pages = [{ path: '/', label: 'Home', pageViews: 1 }, { path: '/gallery.html', label: 'Gallery', pageViews: 2 }];
  analytics.setFixture('pages', 30, p);
  await open(page, 'sources');
  const src = page.locator('#an-tp-sources');
  const vals = await src.locator('.an-bar .vl').allTextContents();
  expect(vals.some((v) => v.startsWith('1 visit -'))).toBe(true);
  expect(vals.some((v) => v.startsWith('2 visits -'))).toBe(true);
  await expect(src.locator('li', { hasText: 't.co' })).toHaveText('t.co - 1 visit');
  await expect(src.locator('li', { hasText: 'bing.com' })).toHaveText('bing.com - 2 visits');
  await page.click('#an-tab-pages');
  await loaded(page);
  const pv = await page.locator('#an-tp-pages .an-bar .vl').allTextContents();
  expect(pv.some((v) => v.startsWith('1 page view -'))).toBe(true);
  expect(pv.some((v) => v.startsWith('2 page views -'))).toBe(true);
});
