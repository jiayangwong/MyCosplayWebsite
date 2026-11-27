// TASK-34: Sources and Pages tabs (IDEA-17), against the fake Worker.
const { test, expect, seedPasscode, gotoAdmin, openAnalytics } = require('./analytics-mock');
const { noHorizontalScroll } = require('./helpers');

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
const bars = (loc) => loc.locator('.an-bar').evaluateAll((els) => els.map((e) => ({ name: e.querySelector('.nm').childNodes[0].textContent, sub: e.querySelector('.nm small') && e.querySelector('.nm small').textContent, value: e.querySelector('.vl').textContent })));
const tableRows = (loc) => loc.locator('details.an-det tbody tr').evaluateAll((trs) => trs.map((tr) => [...tr.children].map((c) => c.textContent)));

test.describe('Sources', () => {
  test('bars in the fixed order with visits and percent that add up to 100 (within 1)', async ({ page, analytics }) => {
    await open(page, 'sources');
    const f = analytics.fixture('sources', 30);
    const tp = page.locator('#an-tp-sources');
    const rows = await bars(tp);
    expect(rows.map((r) => r.name)).toEqual(['Instagram', 'Facebook', 'Google', 'Direct / unknown', 'Other']);
    const total = f.data.groups.reduce((t, g) => t + g.visits, 0);
    const pcts = [];
    f.data.groups.forEach((g, i) => {
      const pct = Math.round((g.visits / total) * 100);
      pcts.push(pct);
      expect(rows[i].value).toBe(`${g.visits} visits - ${pct}%`);
    });
    expect(Math.abs(pcts.reduce((a, b) => a + b, 0) - 100)).toBeLessThanOrEqual(1);
    await expect(tp.locator('.an-range-line')).toHaveText('28 Oct - 26 Nov 2026 (Malaysia time)');
    await expect(tp.locator('h3').first()).toHaveText('Where visits came from');
  });

  test('the order is fixed even when the Worker sends the groups in another order, and missing groups show 0', async ({ page, analytics }) => {
    const f = analytics.fixture('sources', 30);
    f.data.groups = [f.data.groups[3], f.data.groups[0]]; // only Direct and Instagram, shuffled
    analytics.setFixture('sources', 30, f);
    await open(page, 'sources');
    const rows = await bars(page.locator('#an-tp-sources'));
    expect(rows.map((r) => r.name)).toEqual(['Instagram', 'Facebook', 'Google', 'Direct / unknown', 'Other']);
    expect(rows.map((r) => r.value.startsWith('0'))).toEqual([false, true, true, false, true]);
  });

  test('other sites (top 5) are plain text and the Instagram note is shown', async ({ page, analytics }) => {
    await open(page, 'sources');
    const f = analytics.fixture('sources', 30);
    const tp = page.locator('#an-tp-sources');
    const hosts = await tp.locator('.an-hosts li').allTextContents();
    expect(hosts).toEqual(f.data.otherHosts.map((h) => `${h.host} - ${h.visits} visits`));
    expect(hosts).toHaveLength(5);
    await expect(tp.locator('h3').nth(1)).toHaveText('Other sites');
    await expect(tp.locator('.an-ig-note')).toHaveText('Visits from inside the Instagram app often show as Direct / unknown.');
  });

  test('the table has every number', async ({ page, analytics }) => {
    await open(page, 'sources');
    const f = analytics.fixture('sources', 30);
    const tp = page.locator('#an-tp-sources');
    expect(await tp.locator('details.an-det thead th').allTextContents()).toEqual(['Source', 'Visits', 'Share']);
    const rows = await tableRows(tp);
    expect(rows.map((r) => [r[0], r[1]])).toEqual(f.data.groups.map((g) => [g.label, String(g.visits)]));
    await expect(tp.locator('details.an-det caption')).toContainText('Visits by source');
    await expect(tp.locator('ul.an-bars')).toHaveAttribute('role', 'img');
    expect(await tp.locator('ul.an-bars').getAttribute('aria-label')).toContain('Instagram');
  });

  test('a 60-character host stays inside the panel at 360px, and host text with <b> is literal', async ({ page, analytics }) => {
    await page.setViewportSize({ width: 360, height: 900 });
    const f = analytics.fixture('sources', 30);
    const long = `${'a'.repeat(30)}-${'b'.repeat(29)}.example.com`;
    f.data.otherHosts[0] = { host: long, visits: 123456 };
    f.data.otherHosts[1] = { host: '<b>bold.example</b>', visits: 2 };
    analytics.setFixture('sources', 30, f);
    await open(page, 'sources');
    const tp = page.locator('#an-tp-sources');
    await expect(tp.locator('.an-hosts li').first()).toContainText(long);
    await expect(tp.locator('.an-hosts li').nth(1)).toHaveText('<b>bold.example</b> - 2 visits');
    expect(await tp.locator('.an-hosts b').count()).toBe(0);
    await noHorizontalScroll(page);
    const r = await page.evaluate(() => {
      const panel = document.getElementById('an-panel').getBoundingClientRect();
      return [...document.querySelectorAll('#an-tp-sources *')].filter((e) => e.getBoundingClientRect().width > 0).every((e) => e.getBoundingClientRect().right <= panel.right + 1);
    });
    expect(r).toBe(true);
    await tp.locator('details.an-det > summary').click();
    await noHorizontalScroll(page);
  });

  test('all zeros: empty state, no chart', async ({ page, analytics }) => {
    const f = analytics.fixture('sources', 30);
    f.data.groups.forEach((g) => { g.visits = 0; });
    f.data.otherHosts = [];
    analytics.setFixture('sources', 30, f);
    await open(page, 'sources');
    await expect(page.locator('#an-tp-sources [role="status"]')).toContainText('No visits in this period yet.');
    await expect(page.locator('#an-tp-sources .an-bars')).toHaveCount(0);
  });
});

test.describe('Pages', () => {
  test('page views per page and where visits start: names, paths, numbers', async ({ page, analytics }) => {
    await open(page, 'pages');
    const f = analytics.fixture('pages', 30);
    const tp = page.locator('#an-tp-pages');
    await expect(tp.locator('h3')).toHaveText(['Page views per page', 'Where visits start']);
    const [first, second] = [tp.locator('.an-block').nth(0), tp.locator('.an-block').nth(1)];
    const a = await bars(first);
    expect(a.map((r) => r.name)).toEqual(f.data.pages.map((p) => p.label));
    expect(a.map((r) => r.sub)).toEqual(f.data.pages.map((p) => (p.path.startsWith('/') ? p.path : null)));
    expect(a[0].value).toMatch(/^210 page views - \d+%$/);
    const b = await bars(second);
    expect(b.map((r) => r.name)).toEqual(f.data.entries.map((p) => p.label));
    expect(b.map((r) => r.sub)).toEqual(f.data.entries.map((p) => p.path));
    expect(b[0].value).toMatch(/^96 visits - \d+%$/);
    await expect(tp.locator('.an-range-line')).toHaveText('28 Oct - 26 Nov 2026 (Malaysia time)');
    // the path is shown in mono under each label
    expect(await first.locator('.nm small').first().evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/mono/i);
  });

  test('Not found (404) shows only when it has page views, and always last', async ({ page, analytics }) => {
    const f = analytics.fixture('pages', 30);
    f.data.pages.find((p) => p.label === 'Not found (404)').pageViews = 0;
    analytics.setFixture('pages', 30, f);
    await open(page, 'pages');
    let names = (await bars(page.locator('#an-tp-pages .an-block').nth(0))).map((r) => r.name);
    expect(names).toEqual(['Home', 'Gallery', 'Reels', 'Events', 'About', 'Contact']);
    const rows = await tableRows(page.locator('#an-tp-pages .an-block').nth(0));
    expect(rows.map((r) => r[0].split(' (')[0])).not.toContain('Not found');
    // with views it is the last row, even if the Worker sent it first
    const g = analytics.fixture('pages', 7);
    g.data.pages.unshift(g.data.pages.pop());
    analytics.setFixture('pages', 7, g);
    await page.locator('#an-range label', { hasText: '7 days' }).click();
    await loaded(page);
    names = (await bars(page.locator('#an-tp-pages .an-block').nth(0))).map((r) => r.name);
    expect(names[names.length - 1]).toBe('Not found (404)');
    expect(names).toHaveLength(7);
  });

  test('tables hold the exact numbers; two columns from 900px, one column below', async ({ page, analytics }) => {
    await open(page, 'pages');
    const f = analytics.fixture('pages', 30);
    const tp = page.locator('#an-tp-pages');
    const t1 = await tableRows(tp.locator('.an-block').nth(0));
    expect(t1.map((r) => r[1])).toEqual(f.data.pages.map((p) => String(p.pageViews)));
    const t2 = await tableRows(tp.locator('.an-block').nth(1));
    expect(t2.map((r) => r[1])).toEqual(f.data.entries.map((p) => String(p.visits)));
    expect(await tp.locator('details.an-det thead').first().locator('th').allTextContents()).toEqual(['Page', 'Page views', 'Share']);
    expect(await tp.locator('details.an-det thead').nth(1).locator('th').allTextContents()).toEqual(['Page', 'Visits', 'Share']);
    const x = await tp.locator('.an-block').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => [r.left, r.top]));
    if (page.viewportSize().width >= 900) expect(x[1][0]).toBeGreaterThan(x[0][0] + 100);
    else expect(x[1][1]).toBeGreaterThan(x[0][1]);
  });

  test('no sideways page scroll at 360px with large numbers', async ({ page, analytics }) => {
    await page.setViewportSize({ width: 360, height: 900 });
    const f = analytics.fixture('pages', 30);
    f.data.pages.forEach((p) => { p.pageViews *= 5000; });
    analytics.setFixture('pages', 30, f);
    await open(page, 'pages');
    await noHorizontalScroll(page);
  });

  test('all zeros: empty state', async ({ page, analytics }) => {
    const f = analytics.fixture('pages', 30);
    f.data.pages.forEach((p) => { p.pageViews = 0; });
    f.data.entries.forEach((p) => { p.visits = 0; });
    analytics.setFixture('pages', 30, f);
    await open(page, 'pages');
    await expect(page.locator('#an-tp-pages [role="status"]')).toContainText('No visits in this period yet.');
  });
});
