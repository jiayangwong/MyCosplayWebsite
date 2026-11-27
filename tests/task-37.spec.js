// TASK-37: Analytics panel layout (IDEA-18): placement, controls row, Settings, About, Compare switch, tile column.
// 900px is the one phone / PC switch. Fake Worker from tests/analytics-mock.js; nothing reaches Cloudflare.
const { test, expect, FAKE_PASSCODE, PASSCODE_KEY, seedPasscode, gotoAdmin, openAnalytics, openAnalyticsSettings } = require('./analytics-mock');
const { noHorizontalScroll } = require('./helpers');

const WIDTHS = [360, 412, 899, 900, 1280];
const GAP = (w) => (w >= 900 ? 32 : 24);
const FOUR = ['Page loads only (no clicks).', 'Numbers are sampled by Cloudflare and approximate.', 'Days are Malaysia time (GMT+8), midnight to midnight.', 'Updated about every 10 minutes.'];
const ov = (page) => page.locator('#an-tp-overview');
const loaded = (page) => expect(page.locator('html')).toHaveAttribute('data-analytics-view', 'data');
const box = async (page, sel) => {
  const b = await page.locator(sel).boundingBox();
  expect(b, `${sel} has a box`).not.toBeNull();
  return { ...b, bottom: b.y + b.height, right: b.x + b.width };
};

async function ready(page, width) {
  if (width) await page.setViewportSize({ width, height: 900 });
  await seedPasscode(page);
  await gotoAdmin(page);
  await openAnalytics(page);
  await loaded(page);
}

test.describe('(a) placement', () => {
  test('last block, directly after the Media uploader, with the one admin gap above it', async ({ page }) => {
    for (const w of [360, 899, 900, 1280]) {
      await page.setViewportSize({ width: w, height: 900 });
      await gotoAdmin(page);
      await expect(page.locator('html')).toHaveAttribute('data-manager-ready', 'true');
      const dom = await page.evaluate(() => {
        const r = (id) => document.getElementById(id).getBoundingClientRect();
        const panel = document.getElementById('an-panel');
        return {
          gap: r('an-panel').top - r('wm-panel').bottom,
          belowGrid: r('an-panel').top >= Math.max(document.querySelector('.admin-grid').getBoundingClientRect().bottom, r('moments-panel').bottom),
          prev: panel.previousElementSibling && panel.previousElementSibling.id,
          lastPanel: [...document.querySelectorAll('main > .panel')].pop().id,
          open: document.querySelector('#an-panel .fold-btn').getAttribute('aria-expanded'),
        };
      });
      expect(Math.abs(dom.gap - GAP(w)), `gap above Analytics at ${w}px`).toBeLessThanOrEqual(1);
      expect(dom.belowGrid).toBe(true);
      expect(dom.prev).toBe('wm-panel');
      expect(dom.lastPanel).toBe('an-panel');
      expect(dom.open).toBe('false');
    }
  });
});

test.describe('(b) controls row', () => {
  for (const w of [900, 1280]) {
    test(`from 900px (${w}): tabs left, tools right on one row, 44px targets, no sideways page scroll`, async ({ page }) => {
      await ready(page, w);
      const body = await box(page, '#an-body');
      const tabs = await box(page, '#an-tabs');
      const tools = await box(page, '.an-tools');
      expect(Math.abs(tabs.y - tools.y), 'tops within 4px').toBeLessThanOrEqual(4);
      expect(Math.abs(tabs.x - body.x), 'tablist starts at the content left edge').toBeLessThanOrEqual(2);
      expect(Math.abs(tools.right - body.right), 'tools end at the content right edge').toBeLessThanOrEqual(2);
      expect(tools.x).toBeGreaterThanOrEqual(tabs.right - 1);
      for (const sel of ['#an-tab-overview', '#an-tab-sources', '#an-tab-pages', '#an-tab-audience', '#an-tab-performance', '#an-range label:nth-child(1)', '#an-range label:nth-child(2)', '#an-range label:nth-child(3)', '#an-refresh']) {
        expect((await box(page, sel)).height, sel).toBeGreaterThanOrEqual(44);
      }
      // text Refresh button (the icon is hidden), range legend hidden but still in the DOM
      const refresh = page.getByRole('button', { name: 'Refresh' });
      await expect(refresh).toHaveCount(1);
      await expect(refresh.locator('.rt')).toBeVisible();
      await expect(refresh.locator('svg')).toBeHidden();
      await expect(page.locator('.an-rangeset legend')).toHaveText('Last 7 / 30 / 90 days (Malaysia time)');
      expect((await box(page, '.an-rangeset legend')).width).toBeLessThanOrEqual(2);
      // the whole row is inside the panel and the page does not scroll sideways
      await noHorizontalScroll(page);
      await expect(page.locator('#an-upd')).toBeVisible();
      const upd = await box(page, '#an-upd');
      expect(upd.x).toBeGreaterThanOrEqual(tools.x - 1);
      expect(upd.right).toBeLessThanOrEqual(tools.right + 1);
      // all five tabs can be reached; at 900px the tablist may scroll inside itself, never the page
      const list = await page.locator('#an-tabs').evaluate((e) => ({ sw: e.scrollWidth, cw: e.clientWidth }));
      if (w === 1280) expect(list.sw).toBeLessThanOrEqual(list.cw);
    });
  }

  for (const w of [360, 899]) {
    test(`below 900px (${w}): range + icon Refresh, then Updated, then the tablist`, async ({ page }) => {
      await ready(page, w);
      const range = await box(page, '#an-range');
      const refresh = await box(page, '#an-refresh');
      const upd = await box(page, '#an-upd');
      const tabs = await box(page, '#an-tabs');
      expect(Math.abs(range.y - refresh.y), 'range and Refresh on one row').toBeLessThanOrEqual(20);
      expect(Math.abs(range.bottom - refresh.bottom)).toBeLessThanOrEqual(4);
      expect(upd.y).toBeGreaterThanOrEqual(range.bottom - 1);
      expect(tabs.y).toBeGreaterThanOrEqual(upd.bottom - 1);
      const r = page.locator('#an-refresh');
      await expect(r).toHaveAttribute('aria-label', 'Refresh');
      await expect(r.locator('svg')).toHaveAttribute('aria-hidden', 'true');
      expect(refresh.width).toBeGreaterThanOrEqual(43.5);
      expect(refresh.width).toBeLessThanOrEqual(44.5);
      expect(refresh.height).toBeGreaterThanOrEqual(43.5);
      for (const t of ['overview', 'sources', 'pages', 'audience', 'performance']) expect((await box(page, `#an-tab-${t}`)).height).toBeGreaterThanOrEqual(44);
      await expect(page.locator('.an-rangeset legend')).toBeVisible();
      await noHorizontalScroll(page);
    });
  }

  test('keyboard order follows the DOM: tabs, then the range switch, then Refresh', async ({ page }) => {
    await ready(page);
    const order = await page.evaluate(() => {
      const after = (a, b) => Boolean(document.querySelector(a).compareDocumentPosition(document.querySelector(b)) & Node.DOCUMENT_POSITION_FOLLOWING);
      return [after('#an-tabs', '#an-range'), after('#an-range', '#an-refresh'), after('#an-refresh', '#an-upd')];
    });
    expect(order).toEqual([true, true, true]);
  });

  test('"Updated" shows Malaysia clock time from generatedAt in any browser time zone, per kept tab', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, timezoneId: 'America/Los_Angeles' });
    const page = await ctx.newPage();
    const { FakeWorker } = require('./analytics-mock');
    const worker = new FakeWorker();
    await worker.install(page);
    await page.route('https://api.github.com/**', (route) => route.fulfill({ status: 501, body: '{}' }));
    await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [PASSCODE_KEY, FAKE_PASSCODE]);
    const a = worker.fixture('overview', 30);
    a.generatedAt = '2026-11-26T12:00:00Z';
    worker.setFixture('overview', 30, a);
    const b = worker.fixture('sources', 30);
    b.generatedAt = '2026-11-26T16:30:00Z';
    worker.setFixture('sources', 30, b);
    const hold = worker.hold({ tab: 'overview', days: 30 });
    await page.goto('admin/index.html');
    await expect(page.locator('html')).toHaveAttribute('data-analytics-ready', 'true');
    await page.click('#an-panel .fold-btn');
    await hold.arrivedPromise;
    await expect(page.locator('#an-upd')).toHaveText(''); // empty before the first answer
    hold.release();
    await expect(page.locator('#an-upd')).toHaveText('Updated 20:00 Malaysia time');
    await page.click('#an-tab-sources');
    await expect(page.locator('#an-upd')).toHaveText('Updated 00:30 Malaysia time');
    await page.click('#an-tab-overview');
    await expect(page.locator('#an-upd')).toHaveText('Updated 20:00 Malaysia time');
    const text = await page.locator('#an-panel').textContent();
    expect(text).not.toMatch(/UTC|\(sample\)/);
    expect(worker.count('overview', 30)).toBe(1);
    await ctx.close();
  });

  test('Refresh (text or icon) refetches the shown tab and range', async ({ page, analytics }) => {
    await ready(page);
    expect(analytics.count('overview', 30)).toBe(1);
    await page.getByRole('button', { name: 'Refresh' }).click();
    await expect.poll(() => analytics.count('overview', 30)).toBe(2);
  });
});

test.describe('(c) Settings', () => {
  test('closed on load when a passcode is saved: nothing of the passcode block or opt-out is visible', async ({ page }) => {
    await ready(page);
    const set = page.locator('#an-settings');
    await expect(set).not.toHaveJSProperty('open', true);
    expect((await box(page, '#an-settings > summary')).height).toBeGreaterThanOrEqual(44);
    await expect(set.locator('> summary')).toHaveText('Settings');
    for (const sel of ['#an-pass', '#an-save', '#an-test', '#an-forget', '#an-saved', '#an-optout', '#an-opt-help']) await expect(page.locator(sel)).toBeHidden();
  });

  test('Save / Test / Forget / opt-out work from inside it, and it never re-opens while numbers show', async ({ page, analytics }) => {
    await ready(page);
    await openAnalyticsSettings(page);
    await page.click('#an-test');
    await expect(page.locator('#an-pass-status')).toContainText('Passcode works');
    await page.check('#an-optout');
    await page.click('#an-settings > summary'); // the user closes it
    await expect(page.locator('#an-settings')).not.toHaveJSProperty('open', true);
    await page.click('#an-refresh');
    await expect.poll(() => analytics.count('overview', 30)).toBe(2);
    await loaded(page);
    await expect(page.locator('#an-settings')).not.toHaveJSProperty('open', true);
    await openAnalyticsSettings(page);
    await page.click('#an-forget');
    await page.click('#an-forget-yes');
    await expect(page.locator('#an-settings')).toHaveJSProperty('open', true);
    await expect(page.locator('#an-pass')).toBeVisible();
    await expect(page.locator('#an-npmsg')).toBeVisible();
    await expect(page.locator('#an-npmsg')).toContainText('No passcode saved');
  });

  test('opens by itself when no passcode is saved (first open of the panel)', async ({ page }) => {
    await gotoAdmin(page);
    await openAnalytics(page);
    await expect(page.locator('#an-settings')).toHaveJSProperty('open', true);
    await expect(page.locator('#an-pass')).toBeVisible();
    await expect(page.locator('#an-pass')).not.toBeFocused(); // never steals focus
  });

  test('opens by itself on a 401 answer', async ({ page }) => {
    await seedPasscode(page, 'TESTONLY-wrong-passcode-not-real-9999');
    await gotoAdmin(page);
    await expect(page.locator('#an-settings')).not.toHaveJSProperty('open', true);
    await openAnalytics(page);
    await expect(page.locator('#an-tp-overview [role="alert"]')).toContainText('Passcode is wrong. Paste the current one.');
    await expect(page.locator('#an-settings')).toHaveJSProperty('open', true);
    await expect(page.locator('#an-forget')).toBeVisible();
  });

  test.describe('not set up', () => {
    test.use({ analyticsConfigured: false });
    test('opens by itself, the message stays at the top outside Settings', async ({ page }) => {
      await gotoAdmin(page);
      await openAnalytics(page);
      await expect(page.locator('#an-settings')).toHaveJSProperty('open', true);
      await expect(page.locator('#an-notset')).toBeVisible();
      expect(await page.evaluate(() => document.getElementById('an-settings').contains(document.getElementById('an-notset')))).toBe(false);
      await expect(page.locator('#an-optout')).toBeVisible();
      await expect(page.locator('#an-pass-block')).toBeHidden();
    });
  });
});

test.describe('(d) About these numbers', () => {
  test('closed on load, 44px summary, last in the panel, exactly the four sentences as list items, nowhere else', async ({ page }) => {
    await ready(page);
    const about = page.locator('#an-about');
    await expect(about).not.toHaveJSProperty('open', true);
    await expect(about.locator('> summary')).toHaveText('About these numbers');
    expect((await box(page, '#an-about > summary')).height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.getElementById('an-body').lastElementChild.id)).toBe('an-about');
    await expect(about.locator('li')).toHaveCount(4);
    expect(await about.locator('li').allTextContents()).toEqual(FOUR);
    for (const li of FOUR) await expect(page.locator(`#an-about li:text-is("${li}")`)).toBeHidden();
    await about.locator('> summary').click();
    for (const li of FOUR) await expect(page.locator(`#an-about li:text-is("${li}")`)).toBeVisible();
    const elsewhere = await page.evaluate(() => {
      const clone = document.getElementById('an-panel').cloneNode(true);
      clone.querySelector('#an-about').remove();
      return clone.textContent;
    });
    for (const li of FOUR) expect(elsewhere).not.toContain(li.replace(/\.$/, ''));
    expect(elsewhere).not.toContain('Page loads only');
    expect(elsewhere).not.toContain('sampled by Cloudflare');
    expect(await page.locator('#an-panel').textContent()).not.toMatch(/UTC/);
  });

  test('the Overview has no separate honest-limit line', async ({ page }) => {
    await ready(page);
    const t = await ov(page).textContent();
    expect(t).not.toMatch(/sampled|Page loads only|approximate|no clicks/i);
  });
});

test.describe('(e) Compare switch and tiles', () => {
  test('off on load and after a reload; toggling makes no request; 2 series off, 4 on', async ({ page, analytics }) => {
    await ready(page);
    const sw = page.locator('#an-compare');
    await expect(sw).toHaveAttribute('role', 'switch');
    await expect(sw).not.toBeChecked();
    expect((await box(page, '.an-switch')).height).toBeGreaterThanOrEqual(44);
    await expect(page.locator('.an-switch')).toContainText('Compare with previous period');
    const chart = ov(page).locator('.an-chartwrap');
    expect(await chart.locator('.an-legend span').allTextContents()).toEqual(['Visits', 'Page views']);
    await expect(chart.locator('svg path[data-series]')).toHaveCount(2);
    expect(await ov(page).locator('details.an-det thead th').allTextContents()).toEqual(['Day', 'Visits', 'Page views']);
    const before = analytics.requests.length;
    await sw.check();
    await expect(sw).toBeChecked();
    await expect(sw).toBeFocused();
    expect(analytics.requests.length).toBe(before);
    expect(await chart.locator('.an-legend span').allTextContents()).toEqual(['Visits', 'Page views', 'Visits, previous 30 days', 'Page views, previous 30 days']);
    await expect(chart.locator('svg path[data-series]')).toHaveCount(4);
    const dashed = await chart.locator('svg path[data-series]').evaluateAll((els) => els.map((e) => e.getAttribute('style').includes('stroke-dasharray')));
    expect(dashed).toEqual([false, false, true, true]);
    expect(await chart.locator('.an-legend line').evaluateAll((els) => els.map((e) => e.getAttribute('style').includes('stroke-dasharray')))).toEqual([false, false, true, true]);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-analytics-ready', 'true');
    await openAnalytics(page);
    await loaded(page);
    await expect(page.locator('#an-compare')).not.toBeChecked();
  });

  test('Space toggles it from the keyboard and the focus stays on it', async ({ page }) => {
    await ready(page);
    await page.locator('#an-compare').focus();
    await page.keyboard.press('Space');
    await expect(page.locator('#an-compare')).toBeChecked();
    await expect(page.locator('#an-compare')).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page.locator('#an-compare')).not.toBeChecked();
  });

  test('on: the table gains the previous columns with the fixture numbers, the title names the previous totals, the y axis covers all 4', async ({ page, analytics }) => {
    await ready(page);
    const f = analytics.fixture('overview', 30);
    await page.locator('#an-compare').check();
    const table = ov(page).locator('details.an-det table');
    expect(await table.locator('thead th').allTextContents()).toEqual(['Day', 'Visits', 'Page views', 'Previous day', 'Previous visits', 'Previous page views']);
    const rows = await table.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => [...tr.children].map((c) => c.textContent)));
    expect(rows).toHaveLength(30);
    const p0 = f.data.previousDaily[0];
    const p29 = f.data.previousDaily[29];
    expect(rows[0].slice(3)).toEqual(['28 Sep', String(p0.visits), String(p0.pageViews)]);
    expect(rows[29].slice(3)).toEqual(['27 Oct', String(p29.visits), String(p29.pageViews)]);
    const title = await ov(page).locator('.an-chart svg title').textContent();
    expect(title).toContain(`${f.data.previous.visits} visits and ${f.data.previous.pageViews} page views`);
    expect(title).toContain('previous 30 days');
    const top = await ov(page).locator('.an-chart svg text.an-tick').evaluateAll((els) => Math.max(...els.filter((t) => Number(t.getAttribute('x')) < 40).map((t) => Number(t.textContent.replace(/,/g, '')))));
    const maxAll = Math.max(...f.data.daily.map((d) => d.pageViews), ...f.data.previousDaily.map((d) => d.pageViews));
    expect(top).toBeGreaterThanOrEqual(maxAll);
    // the tiles show the change line with the switch on, and still no details inside them
    expect(await ov(page).locator('.an-tile .chg span').allTextContents()).toEqual([expect.stringMatching(/^[+-]?\d+% vs previous 30 days$/), expect.stringMatching(/^[+-]?\d+% vs previous 30 days$/)]);
    expect(await ov(page).locator('.an-tiles details').count()).toBe(0);
  });

  test('the table stays open when the switch is toggled', async ({ page }) => {
    await ready(page);
    await ov(page).locator('details.an-det > summary').click();
    await page.locator('#an-compare').check();
    await expect(ov(page).locator('details.an-det')).toHaveJSProperty('open', true);
  });

  test('previous null: switch disabled with a note, no dashed lines, n/a change lines', async ({ page, analytics }) => {
    analytics.setFixture('overview', 30, 'overview-30-nullprev');
    await ready(page);
    await expect(page.locator('#an-compare')).toBeDisabled();
    await expect(ov(page).locator('.an-cmp')).toContainText('Previous period not available');
    await expect(ov(page).locator('svg path[data-series]')).toHaveCount(2);
    expect(await ov(page).locator('.an-tile .chg span').allTextContents()).toEqual(['n/a', 'n/a']);
    await expect(ov(page).locator('.an-range-line')).toContainText('Previous period not available.');
  });

  test('a Worker answer without previousDaily (not redeployed yet) also disables the switch', async ({ page, analytics }) => {
    const f = analytics.fixture('overview', 30);
    delete f.data.previousDaily;
    analytics.setFixture('overview', 30, f);
    await ready(page);
    await expect(page.locator('#an-compare')).toBeDisabled();
    await expect(ov(page).locator('svg path[data-series]')).toHaveCount(2);
  });

  test('PC: tiles stacked in a left column 220-260px wide, chart to their right; phone: tiles above the chart', async ({ page }) => {
    for (const w of [900, 1280]) {
      await page.setViewportSize({ width: w, height: 900 });
      await gotoAdmin(page);
      await seedPasscode(page);
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-analytics-ready', 'true');
      await openAnalytics(page);
      await loaded(page);
      const t1 = await box(page, '.an-tile:nth-child(1)');
      const t2 = await box(page, '.an-tile:nth-child(2)');
      const chart = await box(page, '.an-chartwrap');
      expect(t1.width, `tile width at ${w}`).toBeGreaterThanOrEqual(220);
      expect(t1.width).toBeLessThanOrEqual(260);
      expect(Math.abs(t1.x - t2.x)).toBeLessThanOrEqual(1);
      expect(t2.y).toBeGreaterThanOrEqual(t1.bottom - 1);
      expect(t1.right + 16).toBeLessThanOrEqual(chart.x);
      expect(chart.width).toBeGreaterThan(t1.width);
    }
    for (const w of [360, 899]) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.waitForTimeout(100);
      const t = await box(page, '.an-tile:nth-child(1)');
      const chart = await box(page, '.an-chartwrap');
      expect(chart.y).toBeGreaterThanOrEqual(t.bottom - 1);
      await noHorizontalScroll(page);
    }
  });

  test('the range line reads "..., compared with the 30 days before"', async ({ page }) => {
    await ready(page);
    await expect(ov(page).locator('.an-range-line')).toHaveText('28 Oct - 26 Nov 2026 (Malaysia time), compared with the 30 days before');
  });
});

test.describe('(f) no sideways page scroll', () => {
  test('360, 412, 899, 900 and 1280px with everything open and Compare on', async ({ page }) => {
    await ready(page, 1280);
    await page.locator('#an-compare').check();
    await ov(page).locator('details.an-det > summary').click();
    await openAnalyticsSettings(page);
    await page.locator('#an-about > summary').click();
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.waitForTimeout(150);
      await noHorizontalScroll(page);
      const panel = await box(page, '#an-panel');
      expect(panel.right, `panel inside the viewport at ${w}px`).toBeLessThanOrEqual(w);
    }
  });
});
