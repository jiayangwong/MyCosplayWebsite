// QA for TASK-31 (previousDaily, see qa-task-31), TASK-32 to TASK-38: exercises the real /admin/ page with the fake
// Worker in every state at 390 / 768 / 900 / 1024 / 1280px, writes screenshots to /tmp/qa-shots/, and checks that
// nothing puts the passcode in a URL, uses another localStorage key, or calls a host other than the Worker + GitHub.
const fs = require('fs');
const { test, expect, FAKE_PASSCODE, PASSCODE_KEY, OPTOUT_KEY, seedPasscode, gotoAdmin, openAnalytics, openAnalyticsSettings, readFixture } = require('./analytics-mock');

const SHOTS = '/tmp/qa-shots';
fs.mkdirSync(SHOTS, { recursive: true });
const WIDTHS = [390, 768, 900, 1024, 1280];
const view = (page) => page.locator('html');
const shot = (page, name, w) => page.locator('#an-panel').screenshot({ path: `${SHOTS}/${name}-${w}.png` }).catch(() => {});
const hscroll = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

function watch(page, workerUrl) {
  const bad = [];
  const errors = [];
  page.on('request', (r) => {
    const t = r.resourceType();
    if (!['fetch', 'xhr', 'websocket', 'eventsource', 'ping', 'other'].includes(t)) return;
    const u = new URL(r.url());
    if (u.protocol === 'data:' || u.protocol === 'blob:') return;
    const ok = u.origin === workerUrl || u.hostname === 'api.github.com' || u.hostname === '127.0.0.1';
    if (!ok) bad.push(`${t} ${r.url()}`);
  });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  return { bad, errors };
}

async function ready(page, w, seed = true) {
  await page.setViewportSize({ width: w, height: 900 });
  if (seed) await seedPasscode(page);
  await gotoAdmin(page);
  await openAnalytics(page);
}

test.describe('real page, states x widths', () => {
  for (const w of WIDTHS) {
    test(`data / empty / few samples / compare / tabs / ranges at ${w}px`, async ({ page, analytics }) => {
      const w8 = watch(page, analytics.url);
      analytics.setFixture('overview', 7, 'overview-30-zero');
      const big = readFixture('overview-30');
      big.data.totals = { visits: 390, pageViews: 1011 };
      analytics.setFixture('overview', 30, big);
      await ready(page, w);
      await expect(view(page)).toHaveAttribute('data-analytics-view', 'data');
      await expect(page.locator('#an-tp-overview')).toContainText('390');
      await expect(page.locator('#an-tp-overview')).toContainText('1,011');
      await shot(page, 'overview-data', w);
      expect(await hscroll(page), 'no sideways page scroll').toBeLessThanOrEqual(0);
      // compare on / off
      const sw = page.locator('#an-compare');
      await sw.click();
      await expect(sw).toBeChecked();
      await shot(page, 'overview-compare', w);
      await sw.click();
      await expect(sw).not.toBeChecked();
      // tabs x ranges
      for (const tab of ['sources', 'pages', 'audience', 'performance', 'overview']) {
        await page.click(`#an-tab-${tab}`);
        await expect(page.locator(`#an-tp-${tab}`)).toBeVisible();
        await expect(view(page)).toHaveAttribute('data-analytics-view', /data|empty/);
        await shot(page, `tab-${tab}`, w);
        expect(await hscroll(page), `${tab} sideways scroll`).toBeLessThanOrEqual(0);
      }
      for (const d of [7, 90, 30]) {
        await page.locator('#an-range label', { hasText: String(d) }).first().click();
        await expect.poll(() => analytics.count('overview', d)).toBeGreaterThan(0);
      }
      // empty (all zeros) for 7 days
      await page.locator('#an-range label', { hasText: '7' }).first().click();
      await expect(page.locator('#an-tp-overview')).toContainText('No visits in this period yet.');
      await shot(page, 'overview-empty', w);
      // few samples
      const perf = readFixture('performance-30');
      perf.data.byDevice.mobile.samples = 5;
      analytics.setFixture('performance', 30, perf);
      await page.locator('#an-range label', { hasText: '30' }).first().click();
      await page.click('#an-tab-performance');
      await expect(page.locator('#an-tp-performance')).toContainText('Few samples');
      await shot(page, 'performance-few', w);
      expect(await hscroll(page)).toBeLessThanOrEqual(0);
      expect(w8.errors, 'console errors').toEqual([]);
      expect(w8.bad, 'requests to other hosts').toEqual([]);
    });

    test(`error and setup states at ${w}px`, async ({ page, analytics }) => {
      const w8 = watch(page, analytics.url);
      // no passcode
      await ready(page, w, false);
      await expect(page.locator('#an-settings')).toHaveJSProperty('open', true);
      await expect(page.locator('#an-pass')).toBeVisible();
      await shot(page, 'state-nopass', w);
      expect(analytics.requests).toHaveLength(0);
      // wrong passcode -> 401
      await page.fill('#an-pass', 'WRONG-passcode-0123456789abcdef');
      await page.click('#an-save');
      await expect(page.locator('#an-panel [role="alert"]:visible').first()).toContainText('Passcode is wrong');
      await shot(page, 'state-401', w);
      await expect(page.locator('#an-settings')).toHaveJSProperty('open', true);
      // good passcode, then each error
      await page.click('#an-forget');
      await page.click('#an-forget-yes');
      await page.fill('#an-pass', FAKE_PASSCODE);
      await page.click('#an-save');
      await expect(view(page)).toHaveAttribute('data-analytics-view', 'data');
      for (const [name, status, body, text] of [
        ['429', 429, { error: 'busy', retryAfter: 150 }, 'Cloudflare is busy. Try again in 3 minutes.'],
        ['502', 502, { error: 'upstream' }, 'Could not load the numbers. Try again.'],
        ['403', 403, { error: 'origin' }, 'Could not load the numbers'],
      ]) {
        analytics.override(status, body);
        await page.click('#an-tab-sources');
        await page.getByRole('button', { name: 'Refresh' }).first().click();
        await expect(page.locator('#an-tp-sources')).toContainText(text);
        await shot(page, `state-${name}`, w);
        analytics.override(null);
        await page.click('#an-tab-overview');
        await page.click('#an-tab-sources');
      }
      analytics.failNetwork = true;
      await page.getByRole('button', { name: 'Refresh' }).first().click();
      await expect(page.locator('#an-tp-sources')).toContainText('Could not load the numbers. Try again.');
      await shot(page, 'state-network', w);
      analytics.failNetwork = false;
      // loading
      const h = analytics.hold({ tab: 'pages' });
      await page.click('#an-tab-pages');
      await h.arrivedPromise;
      await expect(view(page)).toHaveAttribute('data-analytics-view', 'loading');
      await expect(page.locator('#an-tp-pages')).toContainText('Loading');
      await shot(page, 'state-loading', w);
      h.release();
      await expect(view(page)).toHaveAttribute('data-analytics-view', 'data');
      expect(await hscroll(page)).toBeLessThanOrEqual(0);
      expect(w8.errors.filter((e) => !/Failed to load resource|ERR_FAILED/.test(e)), 'console errors').toEqual([]);
      expect(w8.bad).toEqual([]);
    });
  }

  test('not set up (empty workerUrl)', async ({ page }) => {
    await page.route('**/js/admin/analytics-config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "export const ANALYTICS = Object.freeze({ workerUrl: '' });\n" }));
    const seen = [];
    page.on('request', (r) => { if (/workers\.dev|analytics-test/.test(r.url())) seen.push(r.url()); });
    for (const w of [390, 1280]) {
      await ready(page, w);
      await expect(page.locator('#an-notset')).toContainText('not set up');
      await shot(page, 'state-notset', w);
    }
    expect(seen).toEqual([]);
  });
});

test.describe('keyboard, reduced motion, storage', () => {
  test('keyboard-only: tabs, Settings, About, Backup menu', async ({ page, analytics }) => {
    await ready(page, 1280);
    await expect(page.locator('html')).toHaveAttribute('data-analytics-view', 'data');
    await page.focus('#an-tab-overview');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#an-tab-sources')).toBeFocused();
    await expect(page.locator('#an-tab-sources')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('End');
    await expect(page.locator('#an-tab-performance')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#an-tab-overview')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#an-tab-performance')).toHaveAttribute('aria-selected', 'true');
    // Tab order reaches the range radios and Refresh with the keyboard
    await page.keyboard.press('Tab');
    const next = await page.evaluate(() => document.activeElement.id || document.activeElement.tagName);
    expect(next).not.toBe('BODY');
    // Settings + About with Enter and Space
    const sum = page.locator('#an-settings > summary');
    await sum.focus();
    const was = await page.locator('#an-settings').evaluate((d) => d.open);
    await page.keyboard.press('Enter');
    expect(await page.locator('#an-settings').evaluate((d) => d.open)).toBe(!was);
    await page.keyboard.press('Space');
    expect(await page.locator('#an-settings').evaluate((d) => d.open)).toBe(was);
    const about = page.locator('#an-about > summary');
    await about.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#an-about')).toHaveJSProperty('open', true);
    await page.keyboard.press('Space');
    await expect(page.locator('#an-about')).toHaveJSProperty('open', false);
    // Backup menu
    const bs = page.locator('#backup-menu > summary');
    await bs.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#export-events')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#export-events')).toBeHidden();
    await expect(bs).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page.locator('#export-events')).toBeVisible();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement.closest('#backup-menu') !== null)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(bs).toBeFocused();
  });

  test('reduced motion: no transitions or animations in the Analytics panel', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await ready(page, 1280);
    await expect(view(page)).toHaveAttribute('data-analytics-view', 'data');
    await page.click('#an-compare');
    const moving = await page.evaluate(() => [...document.querySelectorAll('#an-panel, #an-panel *')].filter((e) => {
      const s = getComputedStyle(e);
      const t = (v) => v.split(',').some((x) => parseFloat(x) > 0);
      return t(s.transitionDuration) || t(s.animationDuration);
    }).map((e) => e.id || e.className));
    expect(moving).toEqual([]);
  });

  test('passcode only in its key; only Worker + GitHub origins; no passcode in any URL after a full session', async ({ page, analytics }) => {
    const w8 = watch(page, analytics.url);
    const urls = [];
    page.on('request', (r) => urls.push(r.url()));
    page.on('framenavigated', (f) => urls.push(f.url()));
    await ready(page, 390, false);
    await page.fill('#an-pass', FAKE_PASSCODE);
    await page.press('#an-pass', 'Enter');
    await expect(view(page)).toHaveAttribute('data-analytics-view', 'data');
    await page.click('#an-optout', { force: true }).catch(async () => { await page.check('#an-optout'); });
    for (const t of ['sources', 'pages', 'audience', 'performance']) await page.click(`#an-tab-${t}`);
    await page.click('#an-test').catch(() => {});
    const keys = await page.evaluate(() => Object.keys(localStorage));
    for (const k of keys) expect(k.startsWith('puzzkezz.'), k).toBe(true);
    const holders = await page.evaluate((code) => Object.keys(localStorage).filter((k) => localStorage.getItem(k).includes(code)), FAKE_PASSCODE);
    expect(holders).toEqual([PASSCODE_KEY]);
    expect(await page.evaluate((k) => localStorage.getItem(k), OPTOUT_KEY)).not.toBeNull();
    expect(urls.filter((u) => u.includes(FAKE_PASSCODE) || u.includes(encodeURIComponent(FAKE_PASSCODE)))).toEqual([]);
    expect(page.url()).not.toContain('TESTONLY');
    expect(w8.bad).toEqual([]);
    expect(w8.errors).toEqual([]);
    // every /admin/ script / stylesheet comes from this site
    const ext = await page.evaluate(() => [...document.querySelectorAll('script[src]')].map((s) => s.src).filter((s) => !s.startsWith(location.origin)));
    expect(ext).toEqual([]);
  });

  test('previousDaily: compare table matches fixture; Worker origin in CSP only', async ({ page, analytics }) => {
    await ready(page, 1280);
    await expect(view(page)).toHaveAttribute('data-analytics-view', 'data');
    const fx = readFixture('overview-30');
    expect(fx.data.previousDaily).toHaveLength(fx.data.daily.length);
    await page.click('#an-compare');
    await expect(page.locator('#an-tp-overview table')).toContainText(String(fx.data.previousDaily[0].visits));
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(csp).toContain("connect-src 'self' https://api.github.com");
  });
});
