// TASK-33: chart kit (plain SVG + numbers table) and the Overview tab (IDEA-17), against the fake Worker.
const { test, expect, seedPasscode, gotoAdmin, openAnalytics } = require('./analytics-mock');
const { noHorizontalScroll } = require('./helpers');

const ov = (page) => page.locator('#an-tp-overview');
const loaded = (page) => expect(page.locator('html')).toHaveAttribute('data-analytics-view', 'data');

async function openOverview(page, analytics, fixture) {
  if (fixture) analytics.setFixture('overview', 30, fixture);
  await seedPasscode(page);
  await gotoAdmin(page);
  await openAnalytics(page);
  await loaded(page);
}

test.describe('chart kit helpers (pure)', () => {
  test('nice steps, label thinning, number formats', async ({ page }) => {
    await page.goto('admin/index.html');
    const r = await page.evaluate(async () => {
      const m = await import('/js/admin/charts.js');
      const gap = (idx, w, n) => idx.map((i, k) => (k ? ((i - idx[k - 1]) * w) / (n - 1) : Infinity));
      return {
        n14: m.niceScale(14).ticks, n3: m.niceScale(3).ticks, n100: m.niceScale(100).ticks, n1234: m.niceScale(1234).ticks, n0: m.niceScale(0).ticks,
        t7: m.thinLabels(7, 800), t30: m.thinLabels(30, 700), t90: m.thinLabels(90, 700),
        p7: m.thinLabels(7, 255), p30: m.thinLabels(30, 304), p90: m.thinLabels(90, 304),
        g30: gap(m.thinLabels(30, 700), 700, 30), g90: gap(m.thinLabels(90, 700), 700, 90),
        one: m.thinLabels(1, 300), none: m.thinLabels(0, 300),
        fmt: [m.formatNumber(1234567), m.axisNumber(9999), m.axisNumber(12000), m.axisNumber(15500)],
      };
    });
    expect(r.n14).toEqual([0, 5, 10, 15]);
    expect(r.n3).toEqual([0, 1, 2, 3]);
    expect(r.n100).toEqual([0, 50, 100]);
    expect(r.n1234).toEqual([0, 500, 1000, 1500]);
    expect(r.n0).toEqual([0, 1]);
    expect(r.t7).toEqual([0, 1, 2, 3, 4, 5, 6]); // 7 days on PC: every day
    expect(r.t30[0]).toBe(0);
    expect(r.t30[r.t30.length - 1]).toBe(29);
    expect(r.t30.length).toBeLessThanOrEqual(12);
    expect(r.t90.length).toBeLessThanOrEqual(13);
    for (const g of [...r.g30.slice(1), ...r.g90.slice(1)]) expect(g).toBeGreaterThanOrEqual(56);
    expect(r.p7).toEqual([0, 2, 4, 6]); // 7 days on a phone: every 2nd
    expect(r.p30.length).toBeLessThanOrEqual(6);
    expect(r.p90.length).toBeLessThanOrEqual(6);
    expect(r.one).toEqual([0]);
    expect(r.none).toEqual([]);
    expect(r.fmt).toEqual(['1,234,567', '9,999', '12k', '16k']);
  });

  test('dates are plain strings: day labels and the range line ignore the browser time zone', async ({ page }) => {
    await page.goto('admin/index.html');
    const r = await page.evaluate(async () => {
      const c = await import('/js/admin/analytics-client.js');
      return [c.dayLabel('2026-10-27'), c.fullDayLabel('2026-11-03'), c.rangeLine('2026-10-27', '2026-11-25'), c.rangeLine('2026-12-20', '2027-01-18')];
    });
    expect(r).toEqual(['27 Oct', 'Tue 3 Nov', '27 Oct - 25 Nov 2026 (Malaysia time)', '20 Dec 2026 - 18 Jan 2027 (Malaysia time)']);
  });
});

test.describe('Overview', () => {
  test('tiles show the totals and the change; each tile is label + total + change only', async ({ page, analytics }) => {
    const f = analytics.fixture('overview', 30);
    f.data.totals = { visits: 120, pageViews: 410 };
    f.data.previous = { visits: 90, pageViews: 300 };
    analytics.setFixture('overview', 30, f);
    await openOverview(page, analytics);
    const tiles = ov(page).locator('.an-tile');
    await expect(tiles).toHaveCount(2);
    const texts = await tiles.evaluateAll((els) => els.map((e) => [...e.children].map((c) => c.textContent)));
    expect(texts).toEqual([['Visits', '120', '+33% vs previous 30 days'], ['Page views', '410', '+37% vs previous 30 days']]);
    expect(await ov(page).locator('.an-tile details, .an-tiles details').count()).toBe(0);
    await expect(ov(page).locator('.an-tile .chg svg[aria-hidden="true"]')).toHaveCount(2);
  });

  test('a fall shows a signed percentage, no change shows 0%', async ({ page, analytics }) => {
    const f = analytics.fixture('overview', 30);
    f.data.totals = { visits: 80, pageViews: 300 };
    f.data.previous = { visits: 100, pageViews: 300 };
    analytics.setFixture('overview', 30, f);
    await openOverview(page, analytics);
    const chg = await ov(page).locator('.an-tile .chg span').allTextContents();
    expect(chg).toEqual(['-20% vs previous 30 days', '0% vs previous 30 days']);
  });

  test('previous null and previous 0 both show n/a', async ({ page, analytics }) => {
    await openOverview(page, analytics, 'overview-30-nullprev');
    expect(await ov(page).locator('.an-tile .chg span').allTextContents()).toEqual(['n/a', 'n/a']);
  });

  test('previous 0 shows n/a', async ({ page, analytics }) => {
    await openOverview(page, analytics, 'overview-30-zeroprev');
    expect(await ov(page).locator('.an-tile .chg span').allTextContents()).toEqual(['n/a', 'n/a']);
  });

  test('chart: two solid series, a 2 item legend, a 3 column table with exact numbers', async ({ page, analytics }) => {
    await openOverview(page, analytics);
    const f = analytics.fixture('overview', 30);
    const chart = ov(page).locator('.an-chartwrap');
    expect(await chart.locator('.an-legend span').allTextContents()).toEqual(['Visits', 'Page views']);
    const paths = chart.locator('svg path[data-series]');
    await expect(paths).toHaveCount(2);
    expect(await paths.evaluateAll((els) => els.map((e) => e.getAttribute('style').includes('stroke-dasharray')))).toEqual([false, false]);
    expect(await chart.locator('.an-legend line').evaluateAll((els) => els.map((e) => e.getAttribute('style').includes('stroke-dasharray')))).toEqual([false, false]);
    // one point per day
    expect(await paths.first().evaluate((e) => (e.getAttribute('d').match(/[ML]/g) || []).length)).toBe(30);
    // table
    const table = ov(page).locator('details.an-det table');
    expect(await table.locator('thead th').allTextContents()).toEqual(['Day', 'Visits', 'Page views']);
    await expect(table.locator('tbody tr')).toHaveCount(30);
    const rows = await table.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => [...tr.children].map((c) => c.textContent)));
    expect(rows[0]).toEqual(['28 Oct', String(f.data.daily[0].visits), String(f.data.daily[0].pageViews)]);
    expect(rows[29]).toEqual(['26 Nov', String(f.data.daily[29].visits), String(f.data.daily[29].pageViews)]);
    const sumV = rows.reduce((t, r) => t + Number(r[1].replace(/,/g, '')), 0);
    expect(sumV).toBe(f.data.totals.visits);
    await expect(table.locator('caption')).toContainText('Visits and page views per day');
    await expect(table.locator('thead th[scope="col"]')).toHaveCount(3);
    await expect(table.locator('tbody th[scope="row"]')).toHaveCount(30);
    await expect(ov(page).locator('details.an-det > summary')).toHaveText('Show the numbers');
  });

  test('SVG is an image with a summary title; data marks are hidden from screen readers', async ({ page, analytics }) => {
    await openOverview(page, analytics);
    const svg = ov(page).locator('.an-chart svg');
    await expect(svg).toHaveAttribute('role', 'img');
    const id = await svg.getAttribute('aria-labelledby');
    const title = svg.locator('title');
    await expect(title).toHaveAttribute('id', id);
    const f = analytics.fixture('overview', 30);
    const best = f.data.daily.reduce((b, x) => (x.visits > b.visits ? x : b), f.data.daily[0]);
    const text = await title.textContent();
    expect(text).toContain('Visits and page views per day, last 30 days (Malaysia time).');
    expect(text).toContain(`${f.data.totals.visits} visits and ${f.data.totals.pageViews} page views in total`);
    expect(text).toContain(`with ${best.visits} visits`);
    await expect(svg.locator('> g[aria-hidden="true"]').first()).toHaveCount(1);
    // everything except the title sits in a hidden group (the marks, and the hover layer)
    expect(await svg.evaluate((e) => [...e.children].filter((c) => c.tagName !== 'title' && c.getAttribute('aria-hidden') !== 'true').length)).toBe(0);
  });

  test('range line text for 7 / 30 / 90 days and when the previous period is missing', async ({ page, analytics }) => {
    await openOverview(page, analytics);
    const line = ov(page).locator('.an-range-line');
    await expect(line).toHaveText('28 Oct - 26 Nov 2026 (Malaysia time), compared with the 30 days before');
    await page.locator('#an-range label', { hasText: '7 days' }).click();
    await loaded(page);
    await expect(line).toHaveText('20 Nov - 26 Nov 2026 (Malaysia time), compared with the 7 days before');
    await page.locator('#an-range label', { hasText: '90 days' }).click();
    await loaded(page);
    await expect(line).toHaveText('29 Aug - 26 Nov 2026 (Malaysia time), compared with the 90 days before');
    analytics.setFixture('overview', 7, 'overview-30-nullprev');
    analytics.fixtures.get('overview|7').days = 7;
    await page.locator('#an-range label', { hasText: '7 days' }).click();
    await page.click('#an-refresh');
    await expect(line).toHaveText(/\(Malaysia time\)\. Previous period not available\.$/);
  });

  test('y axis starts at 0 and the baseline is its lowest line', async ({ page, analytics }) => {
    await openOverview(page, analytics);
    const info = await ov(page).locator('.an-chart svg').evaluate((svg) => {
      const ticks = [...svg.querySelectorAll('text.an-tick')].filter((t) => t.getAttribute('text-anchor') === 'end' && Number(t.getAttribute('x')) < 40);
      const base = svg.querySelector('line.an-base');
      const grid = [...svg.querySelectorAll('line.an-grid')].map((l) => Number(l.getAttribute('y1')));
      return { first: ticks[0].textContent, labels: ticks.map((t) => t.textContent), baseY: Number(base.getAttribute('y1')), gridMax: Math.max(...grid), gridCount: grid.length };
    });
    expect(info.first).toBe('0');
    expect(info.baseY).toBeGreaterThanOrEqual(info.gridMax);
    expect(info.gridCount).toBeGreaterThanOrEqual(3);
    expect(info.gridCount).toBeLessThanOrEqual(5);
    expect(Number(info.labels[info.labels.length - 1])).toBeGreaterThanOrEqual(Math.max(...analytics.fixture('overview', 30).data.daily.map((d) => d.pageViews)));
  });

  test('x labels never overlap at 360px and 1280px, at 7, 30 and 90 days', async ({ page, analytics }) => {
    await seedPasscode(page);
    await gotoAdmin(page);
    await openAnalytics(page);
    for (const width of [360, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const days of [7, 30, 90]) {
        await page.locator('#an-range label', { hasText: `${days} days` }).click();
        await loaded(page);
        const boxes = await ov(page).locator('.an-chart svg text.an-tick').evaluateAll((els) => els
          .filter((t) => t.getAttribute('text-anchor') !== 'end' || Number(t.getAttribute('x')) >= 40)
          .map((t) => { const r = t.getBoundingClientRect(); return { l: r.left, r: r.right }; }).sort((a, b) => a.l - b.l));
        for (let i = 1; i < boxes.length; i += 1) expect(boxes[i].l, `${days} days at ${width}px`).toBeGreaterThan(boxes[i - 1].r + 2);
        if (width === 360) expect(boxes.length).toBeLessThanOrEqual(7);
        if (width === 1280 && days === 7) expect(boxes.length).toBe(7);
        const svgBox = await ov(page).locator('.an-chart svg').boundingBox();
        expect(svgBox.width).toBeLessThanOrEqual(width);
      }
      await noHorizontalScroll(page);
    }
  });

  test('hover layer: keyboard arrows read the days in a tooltip', async ({ page, analytics }) => {
    await openOverview(page, analytics);
    const plot = ov(page).locator('.an-plot');
    await plot.focus();
    const tip = ov(page).locator('.an-tip');
    await expect(tip).toBeVisible();
    await expect(tip).toContainText('Thu 26 Nov');
    await page.keyboard.press('ArrowLeft');
    await expect(tip).toContainText('Wed 25 Nov');
    await expect(tip).toContainText('Visits');
    await expect(tip).toContainText('Page views');
    await page.keyboard.press('Escape');
    await expect(tip).toBeHidden();
  });

  test('chart redraws to the new width', async ({ page, analytics }) => {
    await openOverview(page, analytics);
    const width = () => page.evaluate(() => Number(document.querySelector('#an-tp-overview .an-chart svg').getAttribute('width')));
    const w1 = await width();
    const target = page.viewportSize().width > 600 ? 600 : 360;
    await page.setViewportSize({ width: target, height: 900 });
    await expect.poll(width).toBeLessThan(w1);
    expect(await width()).toBeLessThanOrEqual(target);
  });

  test('all zeros: the empty state replaces the chart', async ({ page, analytics }) => {
    await openOverview(page, analytics, 'overview-30-zero');
    await expect(ov(page).locator('[role="status"]')).toContainText('No visits in this period yet.');
    await expect(ov(page).locator('svg')).toHaveCount(0);
    await expect(ov(page).locator('.an-tile')).toHaveCount(0);
  });

  test('reduced motion: no transition or animation on chart elements, and none without it either', async ({ page, analytics }) => {
    for (const reduce of ['reduce', 'no-preference']) {
      await page.emulateMedia({ reducedMotion: reduce });
      await openOverview(page, analytics);
      const res = await ov(page).locator('.an-chartwrap').evaluate((root) => [...root.querySelectorAll('*')].map((e) => {
        const cs = getComputedStyle(e);
        return { tag: e.tagName, t: cs.transitionDuration, a: cs.animationName };
      }).filter((x) => !/^0s(, 0s)*$/.test(x.t) || x.a !== 'none'));
      expect(res, `chart elements animated (${reduce})`).toEqual([]);
      expect(await ov(page).locator('svg animate, svg animateTransform, svg set').count()).toBe(0);
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-analytics-ready', 'true');
    }
  });
});

test.describe('Malaysia dates in another browser time zone', () => {
  test.use({ timezoneId: 'America/Los_Angeles' });
  test('first and last x labels, table rows, range line and axis title stay Malaysia days; no UTC', async ({ page, analytics }) => {
    await openOverview(page, analytics);
    const labels = await ov(page).locator('.an-chart svg text.an-tick').evaluateAll((els) => els.filter((t) => t.getAttribute('text-anchor') !== 'end' || Number(t.getAttribute('x')) >= 40).map((t) => t.textContent));
    expect(labels[0]).toBe('28 Oct');
    expect(labels[labels.length - 1]).toBe('26 Nov');
    const rows = await ov(page).locator('details.an-det tbody tr th').allTextContents();
    expect([rows[0], rows[rows.length - 1]]).toEqual(['28 Oct', '26 Nov']);
    await expect(ov(page).locator('.an-range-line')).toContainText('28 Oct - 26 Nov 2026 (Malaysia time)');
    await expect(ov(page).locator('.an-axis-title')).toHaveText('Day (Malaysia time)');
    expect(await page.locator('#an-panel').innerText()).not.toMatch(/UTC/);
    const day = await page.evaluate(() => new Date().getTimezoneOffset());
    expect(day).not.toBe(-480); // the browser really is not on Malaysia time
  });
});
