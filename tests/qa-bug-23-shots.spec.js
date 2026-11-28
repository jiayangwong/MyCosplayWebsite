// QA screenshots for BUG-23 (counts 0, 1, 2) at 390 and 1280px. Writes /tmp/qa-shots/bug23-*.png
const { test, expect, seedPasscode, gotoAdmin, openAnalytics } = require('./analytics-mock');
const loaded = (page) => expect(page.locator('html')).toHaveAttribute('data-analytics-view', 'data');
for (const w of [390, 1280]) for (const n of [0, 1, 2]) {
  test(`shots ${w} count ${n}`, async ({ page, analytics }) => {
    await page.setViewportSize({ width: w, height: 900 });
    const s = analytics.fixture('sources', 30);
    s.data.groups = s.data.groups.map((g, i) => ({ ...g, visits: i === 0 ? n : 5 }));
    s.data.otherHosts = [{ host: 't.co', visits: n }];
    analytics.setFixture('sources', 30, s);
    const p = analytics.fixture('pages', 30);
    p.data.pages = p.data.pages.map((x, i) => ({ ...x, pageViews: i === 0 ? n : 7 }));
    analytics.setFixture('pages', 30, p);
    const f = analytics.fixture('performance', 30);
    f.data.byDevice.mobile.samples = n;
    f.data.vitals.cls = { good: n, needsImprovement: n, poor: n };
    analytics.setFixture('performance', 30, f);
    const o = analytics.fixture('overview', 30);
    o.data.totals = { visits: n, pageViews: n };
    o.data.daily = o.data.daily.map((d, i) => ({ ...d, visits: i === 0 ? n : 0, pageViews: i === 0 ? n : 0 }));
    analytics.setFixture('overview', 30, o);
    await seedPasscode(page); await gotoAdmin(page); await openAnalytics(page); await loaded(page);
    for (const tab of ['overview', 'sources', 'pages', 'performance']) {
      await page.click(`#an-tab-${tab}`); await loaded(page);
      await page.locator(`#an-tp-${tab}`).screenshot({ path: `/tmp/qa-shots/bug23-${tab}-${w}-n${n}.png` });
      const txt = await page.locator(`#an-tp-${tab}`).innerText();
      expect(txt).not.toMatch(/\b1 (visits|page views|page loads|samples)\b/);
      if (n === 1 && tab !== 'overview') expect(txt).toMatch(/\b1 (visit|page view|page load|sample)\b/);
    }
  });
}
