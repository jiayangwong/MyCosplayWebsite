// TASK-35: Audience and Performance tabs (IDEA-17), against the fake Worker.
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
const bars = (loc) => loc.locator('.an-bar').evaluateAll((els) => els.map((e) => ({ name: e.querySelector('.nm').childNodes[0].textContent, value: e.querySelector('.vl').textContent })));
const tableRows = (loc) => loc.locator('details.an-det tbody tr').evaluateAll((trs) => trs.map((tr) => [...tr.children].map((c) => c.textContent)));
const pct = (v, total) => Math.round((v / total) * 100);

test.describe('rating helpers (pure)', () => {
  test('Google boundaries: equal to the limit is the better rating', async ({ page }) => {
    await page.goto('admin/index.html');
    const r = await page.evaluate(async () => {
      const m = await import('/js/admin/vitals.js');
      const rate = (k, vals) => vals.map((v) => m.rateVital(k, v));
      return {
        lcp: rate('lcp', [2500, 2501, 4000, 4001, 0]),
        inp: rate('inp', [200, 201, 500, 501]),
        cls: rate('cls', [0.1, 0.11, 0.25, 0.26, 0]),
        na: rate('lcp', [null, undefined, 'x', NaN]),
        ms: [m.formatMs(950), m.formatMs(1000), m.formatMs(2300), m.formatMs(2549), m.formatMs(null)],
        cls2: [m.formatCls(0.04), m.formatCls(0.1), m.formatCls(null)],
        few: [m.isFewSamples(19), m.isFewSamples(20), m.isFewSamples(0), m.isFewSamples(null)],
        th: [m.thresholdText('lcp'), m.thresholdText('inp'), m.thresholdText('cls')],
      };
    });
    expect(r.lcp).toEqual(['good', 'mid', 'mid', 'poor', 'good']);
    expect(r.inp).toEqual(['good', 'mid', 'mid', 'poor']);
    expect(r.cls).toEqual(['good', 'mid', 'mid', 'poor', 'good']);
    expect(r.na).toEqual(['na', 'na', 'na', 'na']);
    expect(r.ms).toEqual(['950 ms', '1.0 s', '2.3 s', '2.5 s', 'n/a']);
    expect(r.cls2).toEqual(['0.04', '0.10', 'n/a']);
    expect(r.few).toEqual([true, false, true, true]);
    expect(r.th).toEqual(['Good up to 2.5 s, poor above 4 s', 'Good up to 200 ms, poor above 500 ms', 'Good up to 0.1, poor above 0.25']);
  });
});

test.describe('Audience', () => {
  test('Phone / PC / Tablet in one stacked bar with percent and counts (never mobile / desktop)', async ({ page, analytics }) => {
    await open(page, 'audience');
    const f = analytics.fixture('audience', 30);
    const tp = page.locator('#an-tp-audience');
    await expect(tp.locator('h3').first()).toHaveText('Phone, PC and tablet');
    await expect(tp.locator('.an-stack svg')).toHaveAttribute('role', 'img');
    const title = await tp.locator('.an-stack svg title').textContent();
    expect(title).toContain('Visits by device');
    const total = f.data.devices.reduce((t, d) => t + d.visits, 0);
    const v = Object.fromEntries(f.data.devices.map((d) => [d.type, d.visits]));
    const items = await tp.locator('.an-split li').evaluateAll((els) => els.map((e) => [...e.querySelectorAll(':scope > span')].map((s) => s.textContent)));
    expect(items).toEqual([
      ['Phone', `${pct(v.mobile, total)}%`, `${v.mobile} visits`],
      ['PC', `${pct(v.desktop, total)}%`, `${v.desktop} visits`],
      ['Tablet', `${pct(v.tablet, total)}%`, `${v.tablet} visits`],
    ]);
    const sum = [v.mobile, v.desktop, v.tablet].reduce((a, b) => a + pct(b, total), 0);
    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(1);
    expect((await tp.textContent())).not.toMatch(/mobile|desktop/i);
    // segments carry patterns as well as colours: dots for Phone, hatch for PC
    const fills = await tp.locator('.an-stack svg g[clip-path] rect').evaluateAll((els) => els.map((e) => e.getAttribute('style')));
    expect(fills.some((s) => s.includes('-dots)'))).toBe(true);
    expect(fills.some((s) => s.includes('-hatch)'))).toBe(true);
    await expect(tp.locator('.an-range-line')).toHaveText('28 Oct - 26 Nov 2026 (Malaysia time)');
  });

  test('countries: top 10 + Other last, largest first; browsers: top 6 + Other last, even when the Worker sends Other first', async ({ page, analytics }) => {
    const f = analytics.fixture('audience', 30);
    f.data.countries.unshift(f.data.countries.pop()); // Other first
    f.data.countries.reverse();
    f.data.browsers.unshift(f.data.browsers.pop());
    analytics.setFixture('audience', 30, f);
    await open(page, 'audience');
    const tp = page.locator('#an-tp-audience');
    const c = await bars(tp.locator('.an-block', { hasText: 'Countries' }).first());
    expect(c).toHaveLength(11);
    expect(c[10].name).toBe('Other');
    const nums = c.slice(0, 10).map((x) => Number(x.value.split(' ')[0]));
    expect(nums).toEqual([...nums].sort((a, b) => b - a));
    const b = await bars(tp.locator('.an-block', { hasText: 'Browsers' }).first());
    expect(b).toHaveLength(7);
    expect(b[6].name).toBe('Other');
    expect(b[0].name).toBe('Chrome');
  });

  test('tables under the split, Countries and Browsers hold the exact numbers', async ({ page, analytics }) => {
    await open(page, 'audience');
    const f = analytics.fixture('audience', 30);
    const tp = page.locator('#an-tp-audience');
    await expect(tp.locator('details.an-det')).toHaveCount(3);
    const split = await tableRows(tp.locator('.an-block').first());
    expect(split.map((r) => r[0])).toEqual(['Phone', 'PC', 'Tablet']);
    expect(split.map((r) => r[1])).toEqual(f.data.devices.map((d) => String(d.visits)));
    const countries = await tableRows(tp.locator('.an-block', { hasText: 'Countries' }).first());
    expect(countries.find((r) => r[0] === 'Malaysia')[1]).toBe(String(f.data.countries.find((x) => x.name === 'Malaysia').visits));
    expect(await tp.locator('details.an-det thead').nth(1).locator('th').allTextContents()).toEqual(['Country', 'Visits', 'Share']);
    expect(await tp.locator('details.an-det thead').nth(2).locator('th').allTextContents()).toEqual(['Browser', 'Visits', 'Share']);
  });

  test('an Other device only shows when it has visits; empty state when all zeros', async ({ page, analytics }) => {
    const f = analytics.fixture('audience', 30);
    f.data.devices.push({ type: 'other', visits: 4 });
    analytics.setFixture('audience', 30, f);
    await open(page, 'audience');
    expect(await page.locator('#an-tp-audience .an-split li .nm').allTextContents()).toEqual(['Phone', 'PC', 'Tablet', 'Other']);
  });

  test('all zeros: empty state', async ({ page, analytics }) => {
    const f = analytics.fixture('audience', 30);
    f.data.devices.forEach((d) => { d.visits = 0; });
    f.data.countries.forEach((d) => { d.visits = 0; });
    f.data.browsers.forEach((d) => { d.visits = 0; });
    analytics.setFixture('audience', 30, f);
    await open(page, 'audience');
    await expect(page.locator('#an-tp-audience [role="status"]')).toContainText('No visits in this period yet.');
  });

  test('360px: no sideways scroll, the split bar fits the panel', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 900 });
    await open(page, 'audience');
    await noHorizontalScroll(page);
    const r = await page.evaluate(() => {
      const panel = document.getElementById('an-panel').getBoundingClientRect();
      const svg = document.querySelector('#an-tp-audience .an-stack svg').getBoundingClientRect();
      return svg.right <= panel.right && svg.left >= panel.left;
    });
    expect(r).toBe(true);
  });
});

test.describe('Performance', () => {
  test('Phone and PC columns: values, units, rating words, thresholds, sample counts', async ({ page, analytics }) => {
    await open(page, 'performance');
    const tp = page.locator('#an-tp-performance');
    const cols = tp.locator('.an-vcol');
    await expect(cols).toHaveCount(2);
    await expect(cols.nth(0).locator('.an-vhead')).toHaveText('Phone');
    await expect(cols.nth(1).locator('.an-vhead')).toHaveText('PC');
    const rows = async (i) => cols.nth(i).locator('.an-vrow').evaluateAll((els) => els.map((e) => ({ name: e.querySelector('.nm').textContent.trim(), value: e.querySelector('.vv').textContent, chip: e.querySelector('.an-rate') && e.querySelector('.an-rate').textContent, th: e.querySelector('.th') && e.querySelector('.th').textContent })));
    const phone = await rows(0);
    expect(phone).toEqual([
      { name: 'Page load (median)', value: '1.8 s', chip: null, th: null },
      { name: 'Loading (LCP)', value: '2.3 s', chip: 'Good', th: 'Good up to 2.5 s, poor above 4 s' },
      { name: 'Reacting to taps (INP)', value: '150 ms', chip: 'Good', th: 'Good up to 200 ms, poor above 500 ms' },
      { name: 'Layout jumping (CLS)', value: '0.04', chip: 'Good', th: 'Good up to 0.1, poor above 0.25' },
    ]);
    const pc = await rows(1);
    expect(pc[0]).toMatchObject({ value: '950 ms', chip: null });
    expect(pc[1]).toMatchObject({ value: '1.4 s', chip: 'Good' });
    expect(pc[2]).toMatchObject({ value: '620 ms', chip: 'Poor' }); // INP 620 > 500
    expect(pc[3]).toMatchObject({ value: 'n/a', chip: 'n/a', th: 'Not enough data' }); // null is n/a, never 0
    await expect(cols.nth(0).locator('.an-samp').first()).toHaveText('from 120 page loads');
    await expect(cols.nth(1).locator('.an-samp').first()).toHaveText('from 18 page loads');
    await expect(tp.locator('.an-range-line')).toHaveText('28 Oct - 26 Nov 2026 (Malaysia time)');
    // ratings are never colour only: each chip holds an icon and the word
    const chips = await tp.locator('.an-rate').evaluateAll((els) => els.map((e) => [e.querySelector('svg') !== null, e.textContent.length > 0]));
    expect(chips.length).toBeGreaterThan(0);
    for (const c of chips) expect(c).toEqual([true, true]);
  });

  test('rating boundaries in the UI: 2500 ms LCP = Good, 2501 = Needs improvement, 4001 = Poor (same for INP and CLS)', async ({ page, analytics }) => {
    const f = analytics.fixture('performance', 30);
    f.data.byDevice.mobile.lcpP75Ms = 2500;
    f.data.byDevice.mobile.inpP75Ms = 201;
    f.data.byDevice.mobile.clsP75 = 0.26;
    f.data.byDevice.desktop.lcpP75Ms = 2501;
    f.data.byDevice.desktop.inpP75Ms = 500;
    f.data.byDevice.desktop.clsP75 = 0.1;
    analytics.setFixture('performance', 30, f);
    await open(page, 'performance');
    const chips = (i) => page.locator('#an-tp-performance .an-vcol').nth(i).locator('.an-rate').allTextContents();
    expect(await chips(0)).toEqual(['Good', 'Needs improvement', 'Poor']);
    expect(await chips(1)).toEqual(['Needs improvement', 'Needs improvement', 'Good']);
    f.data.byDevice.mobile.lcpP75Ms = 4001;
    analytics.setFixture('performance', 7, { ...analytics.fixture('performance', 7), data: f.data });
    await page.locator('#an-range label', { hasText: '7 days' }).click();
    await loaded(page);
    expect((await chips(0))[0]).toBe('Poor');
  });

  test('few samples: the note shows at 19 and not at 20', async ({ page, analytics }) => {
    const f = analytics.fixture('performance', 30);
    f.data.byDevice.mobile.samples = 19;
    f.data.byDevice.desktop.samples = 20;
    analytics.setFixture('performance', 30, f);
    await open(page, 'performance');
    const cols = page.locator('#an-tp-performance .an-vcol');
    await expect(cols.nth(0).locator('.an-few')).toHaveText('Few samples, may be unreliable');
    await expect(cols.nth(1).locator('.an-few')).toHaveCount(0);
    await expect(cols.nth(0).locator('.an-samp').first()).toHaveText('from 19 page loads');
  });

  test('side by side at 1280px, stacked at 360px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await open(page, 'performance');
    let b = await page.locator('#an-tp-performance .an-vcol').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => [r.left, r.top, r.right]));
    expect(b[1][0]).toBeGreaterThanOrEqual(b[0][2] - 1);
    expect(Math.abs(b[1][1] - b[0][1])).toBeLessThanOrEqual(2);
    await page.setViewportSize({ width: 360, height: 900 });
    await page.waitForTimeout(150);
    b = await page.locator('#an-tp-performance .an-vcol').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => [r.left, r.top, r.right]));
    expect(b[1][1]).toBeGreaterThan(b[0][1] + 100); // PC under Phone
    expect(Math.abs(b[1][0] - b[0][0])).toBeLessThanOrEqual(1);
    await noHorizontalScroll(page);
  });

  test('a 100% stacked bar per vital with the good / needs-improvement / poor share, and tables', async ({ page, analytics }) => {
    await open(page, 'performance');
    const f = analytics.fixture('performance', 30);
    const tp = page.locator('#an-tp-performance');
    await expect(tp.locator('.an-vshare')).toHaveCount(3);
    await expect(tp.locator('.an-vshare .an-vhead')).toHaveText(['Loading (LCP)', 'Reacting to taps (INP)', 'Layout jumping (CLS)']);
    const lcp = f.data.vitals.lcp;
    const total = lcp.good + lcp.needsImprovement + lcp.poor;
    const items = await tp.locator('.an-vshare').first().locator('.an-split li').evaluateAll((els) => els.map((e) => [...e.querySelectorAll(':scope > span')].map((s) => s.textContent)));
    expect(items.map((i) => i[0])).toEqual(['Good', 'Needs improvement', 'Poor']);
    expect(items.map((i) => i[1])).toEqual([`${pct(lcp.good, total)}%`, `${pct(lcp.needsImprovement, total)}%`, `${pct(lcp.poor, total)}%`]);
    await expect(tp.locator('.an-vshare svg[role="img"]')).toHaveCount(3);
    // tables: one for the device rows (8 rows) and one per vital
    await expect(tp.locator('details.an-det')).toHaveCount(4);
    const dev = await tableRows(tp.locator('.an-block').first());
    expect(dev).toHaveLength(8);
    expect(dev[1]).toEqual(['Phone - Loading (LCP)', '2.3 s', 'Good']);
    expect(dev[3]).toEqual(['Phone - Layout jumping (CLS)', '0.04', 'Good']);
    expect(dev[6]).toEqual(['PC - Reacting to taps (INP)', '620 ms', 'Poor']);
    expect(dev[7]).toEqual(['PC - Layout jumping (CLS)', 'n/a', 'n/a']);
    expect(await tp.locator('details.an-det thead').first().locator('th').allTextContents()).toEqual(['Measure', 'Value', 'Rating']);
  });

  test('a vital with no data says "Not enough data" instead of an empty bar', async ({ page, analytics }) => {
    const f = analytics.fixture('performance', 30);
    f.data.vitals.cls = { good: 0, needsImprovement: 0, poor: 0 };
    analytics.setFixture('performance', 30, f);
    await open(page, 'performance');
    await expect(page.locator('#an-tp-performance .an-vshare').nth(2)).toContainText('Not enough data');
    await expect(page.locator('#an-tp-performance .an-vshare').nth(2).locator('svg[role="img"]')).toHaveCount(0);
  });

  test('missing device and null values show n/a with Not enough data, never 0', async ({ page, analytics }) => {
    const f = analytics.fixture('performance', 30);
    f.data.byDevice = { mobile: f.data.byDevice.mobile }; // no desktop at all
    analytics.setFixture('performance', 30, f);
    await open(page, 'performance');
    const pc = page.locator('#an-tp-performance .an-vcol').nth(1);
    await expect(pc.locator('.an-samp').first()).toHaveText('from 0 page loads');
    expect(await pc.locator('.vv').allTextContents()).toEqual(['n/a', 'n/a', 'n/a', 'n/a']);
    await expect(pc.locator('.th')).toHaveText(['Not enough data', 'Not enough data', 'Not enough data', 'Not enough data']);
  });

  test('all zeros: empty state', async ({ page, analytics }) => {
    const f = analytics.fixture('performance', 30);
    f.data.byDevice.mobile.samples = 0;
    f.data.byDevice.desktop.samples = 0;
    analytics.setFixture('performance', 30, f);
    await open(page, 'performance');
    await expect(page.locator('#an-tp-performance [role="status"]')).toContainText('No visits in this period yet.');
  });

  test('90 days and 7 days also render', async ({ page }) => {
    await open(page, 'performance');
    for (const days of [7, 90]) {
      await page.locator('#an-range label', { hasText: `${days} days` }).click();
      await loaded(page);
      await expect(page.locator('#an-tp-performance .an-vcol')).toHaveCount(2);
    }
  });
});
