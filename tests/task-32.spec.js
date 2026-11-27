// TASK-32: admin Analytics panel - tab bar, passcode, fake Worker, states, range switch (IDEA-17).
// Everything runs against the fake Worker in tests/analytics-mock.js; nothing reaches Cloudflare.
const fs = require('fs');
const path = require('path');
const { test, expect, FAKE_PASSCODE, FAKE_WORKER, PASSCODE_KEY, OPTOUT_KEY, seedPasscode, gotoAdmin, openAnalytics } = require('./analytics-mock');
const { noHorizontalScroll } = require('./helpers');

const TABS = ['overview', 'sources', 'pages', 'audience', 'performance'];
const ROOT = path.join(__dirname, '..');
const chip = (page) => page.locator('#an-chip');
const view = (page) => page.locator('html');

test.describe('closed panel, placement', () => {
  test('collapsed on load, Events still open, and opening it without a passcode fetches nothing', async ({ page, analytics }) => {
    await gotoAdmin(page);
    await expect(page.locator('#an-panel > .fold-head .fold-btn')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#an-body')).toBeHidden();
    await expect(page.locator('#events-panel > .fold-head .fold-btn')).toHaveAttribute('aria-expanded', 'true');
    await expect(chip(page)).toHaveText('No passcode');
    await openAnalytics(page);
    await expect(page.locator('#an-pass')).toBeVisible();
    await expect(page.locator('#an-tabs')).toBeHidden();
    expect(analytics.requests).toHaveLength(0);
  });

  test('is the last block of the page, after the Media uploader (DOM and screen)', async ({ page }) => {
    await gotoAdmin(page);
    const order = await page.evaluate(() => {
      const ids = ['gh-panel', 'events-panel', 'form-panel', 'publish-panel', 'moments-panel', 'wm-panel', 'an-panel'];
      const els = ids.map((id) => document.getElementById(id));
      const after = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      const grid = document.querySelector('.admin-grid');
      return {
        chain: els.slice(0, -1).every((e, i) => after(e, els[i + 1])),
        afterGrid: after(grid, els[6]),
        panelsAfter: [...document.querySelectorAll('main > .panel')].map((p) => p.id),
        lastPanel: [...document.querySelectorAll('.panel')].pop().id,
      };
    });
    expect(order.chain).toBe(true);
    expect(order.afterGrid).toBe(true);
    expect(order.panelsAfter.slice(-3)).toEqual(['moments-panel', 'wm-panel', 'an-panel']);
    expect(order.lastPanel).toBe('an-panel');
    const box = async (sel) => (await page.locator(sel).boundingBox());
    const an = await box('#an-panel');
    for (const sel of ['#gh-panel', '#events-panel', '#form-panel', '#publish-panel', '#moments-panel', '#wm-panel']) {
      const b = await box(sel);
      expect(an.y, `${sel} is above Analytics`).toBeGreaterThanOrEqual(b.y + b.height - 1);
    }
  });
});

test.describe('not set up', () => {
  test.use({ analyticsConfigured: false });
  test('empty workerUrl: message, chip, zero requests, opt-out still there', async ({ page, analytics }) => {
    const seen = [];
    page.on('request', (r) => seen.push(r.url()));
    await seedPasscode(page);
    await gotoAdmin(page);
    await expect(chip(page)).toHaveText('Not set up');
    await openAnalytics(page);
    await expect(page.locator('#an-notset')).toContainText('Analytics is not set up yet. See worker/README.md.');
    await expect(page.locator('#an-tabs')).toBeHidden();
    await expect(page.locator('#an-pass-block')).toBeHidden();
    await expect(page.locator('#an-optout')).toBeVisible();
    expect(analytics.requests).toHaveLength(0);
    expect(seen.filter((u) => /\/v1\/stats|analytics-test\.invalid/.test(u))).toEqual([]);
  });
});

test.describe('passcode', () => {
  test('too short or empty is refused and not stored', async ({ page }) => {
    await gotoAdmin(page);
    await openAnalytics(page);
    await page.click('#an-save');
    await expect(page.locator('#an-pass-error')).toContainText('at least 24 characters');
    await page.fill('#an-pass', 'short-passcode');
    await page.click('#an-save');
    await expect(page.locator('#an-pass-error')).toBeVisible();
    expect(await page.evaluate((k) => localStorage.getItem(k), PASSCODE_KEY)).toBeNull();
    await expect(chip(page)).toHaveText('No passcode');
  });

  test('save stores it only in its own key, clears the input, never shows it again, survives a reload', async ({ page, analytics }) => {
    await gotoAdmin(page);
    await openAnalytics(page);
    await page.fill('#an-pass', FAKE_PASSCODE);
    await expect(page.locator('#an-pass')).toHaveAttribute('type', 'password');
    await expect(page.locator('#an-pass')).toHaveAttribute('autocomplete', 'off');
    await page.press('#an-pass', 'Enter');
    await expect(page.locator('#an-saved')).toHaveText('Passcode saved');
    await expect(page.locator('#an-pass')).toBeHidden();
    expect(await page.evaluate(() => document.getElementById('an-pass').value)).toBe('');
    expect(await page.evaluate((k) => localStorage.getItem(k), PASSCODE_KEY)).toBe(FAKE_PASSCODE);
    expect(await page.evaluate(() => document.documentElement.outerHTML.includes('TESTONLY'))).toBe(false);
    await expect(page.locator('#an-tabs')).toBeVisible();
    await expect.poll(() => analytics.count('overview', 30)).toBe(1);
    await page.reload();
    await expect(view(page)).toHaveAttribute('data-analytics-ready', 'true');
    await expect(chip(page)).toHaveText('Last 30 days');
    expect(analytics.count('overview', 30)).toBe(1); // collapsed again after the reload: nothing fetched yet
    await openAnalytics(page);
    await expect(page.locator('#an-saved')).toBeVisible();
    await expect.poll(() => analytics.count('overview', 30)).toBe(2);
  });

  test('Forget asks first: Keep / Esc keep it, Yes forgets it', async ({ page }) => {
    await seedPasscode(page);
    await gotoAdmin(page);
    await openAnalytics(page);
    await page.click('#an-forget');
    await expect(page.locator('#an-forget-ask')).toBeVisible();
    await expect(page.locator('#an-forget-no')).toBeFocused();
    await page.click('#an-forget-no');
    expect(await page.evaluate((k) => localStorage.getItem(k), PASSCODE_KEY)).toBe(FAKE_PASSCODE);
    await page.click('#an-forget');
    await page.keyboard.press('Escape');
    await expect(page.locator('#an-forget-ask')).toBeHidden();
    expect(await page.evaluate((k) => localStorage.getItem(k), PASSCODE_KEY)).toBe(FAKE_PASSCODE);
    await page.click('#an-forget');
    await page.click('#an-forget-yes');
    expect(await page.evaluate((k) => localStorage.getItem(k), PASSCODE_KEY)).toBeNull();
    await expect(page.locator('#an-pass-status')).toHaveText('No passcode saved. Paste one above.');
    await expect(page.locator('#an-tabs')).toBeHidden();
    await expect(chip(page)).toHaveText('No passcode');
  });

  test('Test sends one request for overview / 7 days with the passcode only in the Authorization header', async ({ page, analytics }) => {
    await seedPasscode(page);
    await gotoAdmin(page);
    await openAnalytics(page);
    await expect.poll(() => analytics.count('overview', 30)).toBe(1);
    await page.click('#an-test');
    await expect(page.locator('#an-pass-status')).toHaveText('Passcode works. The Worker answered.');
    expect(analytics.requests.filter((r) => r.tab === 'overview' && r.days === 7)).toHaveLength(1);
    const last = analytics.requests[analytics.requests.length - 1];
    expect(last.auth).toBe(`Bearer ${FAKE_PASSCODE}`);
    expect(last.url).not.toContain(FAKE_PASSCODE);
    expect(last.origin).toBe(new URL(process.env.PW_BASE_URL || 'http://127.0.0.1:4173').origin);
  });
});

test.describe('tabs', () => {
  test('roles, roving focus, arrows, Home / End, each tab fetches once per range', async ({ page, analytics }) => {
    await seedPasscode(page);
    await gotoAdmin(page);
    await openAnalytics(page);
    await expect(page.locator('#an-tabs')).toHaveAttribute('role', 'tablist');
    await expect(page.locator('#an-tabs')).toHaveAttribute('aria-label', 'Analytics views');
    await expect(page.locator('[role="tab"]')).toHaveCount(5);
    await expect(page.locator('[role="tabpanel"]')).toHaveCount(5);
    for (const t of TABS) {
      const tab = page.locator(`#an-tab-${t}`);
      await expect(tab).toHaveAttribute('aria-controls', `an-tp-${t}`);
      await expect(page.locator(`#an-tp-${t}`)).toHaveAttribute('aria-labelledby', `an-tab-${t}`);
    }
    await expect(page.locator('#an-tab-overview')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#an-tab-overview')).toHaveAttribute('tabindex', '0');
    await expect(page.locator('#an-tab-sources')).toHaveAttribute('tabindex', '-1');
    const loaded = () => expect(view(page)).toHaveAttribute('data-analytics-view', 'data');
    await loaded();
    await page.locator('#an-tab-overview').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#an-tab-sources')).toBeFocused();
    await expect(page.locator('#an-tab-sources')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#an-tp-sources')).toBeVisible();
    await expect(page.locator('#an-tp-overview')).toBeHidden();
    await loaded();
    await page.keyboard.press('End');
    await expect(page.locator('#an-tab-performance')).toHaveAttribute('aria-selected', 'true');
    await loaded();
    await page.keyboard.press('ArrowRight'); // wraps to the first tab
    await expect(page.locator('#an-tab-overview')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowLeft'); // wraps back to the last tab
    await expect(page.locator('#an-tab-performance')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(page.locator('#an-tab-overview')).toBeFocused();
    for (const t of ['pages', 'audience']) {
      await page.click(`#an-tab-${t}`);
      await loaded();
    }
    // Back and forth: every tab was asked for exactly once (30 days).
    expect(TABS.map((t) => analytics.count(t, 30))).toEqual([1, 1, 1, 1, 1]);
    await page.click('#an-tab-pages');
    await page.click('#an-tab-overview');
    await page.click('#an-tab-performance');
    await loaded();
    expect(TABS.map((t) => analytics.count(t, 30))).toEqual([1, 1, 1, 1, 1]);
    await page.click('#an-tab-overview');
    // Refresh refetches only the shown tab.
    await page.click('#an-refresh');
    await expect.poll(() => analytics.count('overview', 30)).toBe(2);
    expect(analytics.count('sources', 30)).toBe(1);
  });
});

test.describe('range switch', () => {
  test('7 / 30 / 90 send days=, the label says Malaysia time, answers are kept per range', async ({ page, analytics }) => {
    await seedPasscode(page);
    await gotoAdmin(page);
    await openAnalytics(page);
    await expect(page.locator('#an-range').locator('..').locator('legend')).toHaveText('Last 7 / 30 / 90 days (Malaysia time)');
    await expect.poll(() => analytics.count('overview', 30)).toBe(1);
    await page.locator('#an-range label', { hasText: '7 days' }).click();
    await expect.poll(() => analytics.count('overview', 7)).toBe(1);
    await expect(chip(page)).toHaveText('Last 7 days');
    await page.locator('#an-range label', { hasText: '90 days' }).click();
    await expect.poll(() => analytics.count('overview', 90)).toBe(1);
    await page.locator('#an-range label', { hasText: '30 days' }).click();
    await expect(chip(page)).toHaveText('Last 30 days');
    expect(analytics.count('overview', 30)).toBe(1);
    for (const r of analytics.requests) expect(r.url).toMatch(/\/v1\/stats\?tab=overview&days=(7|30|90)$/);
  });

  test('a slow 30-day answer arriving after a 7-day one is ignored', async ({ page, analytics }) => {
    await seedPasscode(page);
    const slow = analytics.hold({ tab: 'overview', days: 30 });
    await gotoAdmin(page);
    await openAnalytics(page);
    await slow.arrivedPromise;
    await page.locator('#an-range label', { hasText: '7 days' }).click();
    await expect.poll(() => analytics.count('overview', 7)).toBe(1);
    await expect(view(page)).toHaveAttribute('data-analytics-view', 'data');
    slow.release();
    await page.waitForTimeout(300);
    await expect(chip(page)).toHaveText('Last 7 days');
    await expect(page.locator('#an-range input[value="7"]')).toBeChecked();
    await expect(view(page)).toHaveAttribute('data-analytics-view', 'data');
    await expect(page.locator('#an-tp-overview .an-range-line')).toContainText('20 Nov - 26 Nov 2026 (Malaysia time)');
  });
});

test.describe('text', () => {
  test('footer says Malaysia time (GMT+8), the panel never says UTC', async ({ page }) => {
    await seedPasscode(page);
    await gotoAdmin(page);
    await openAnalytics(page);
    const foot = page.locator('#an-foot');
    await expect(foot).toContainText('Page loads only (no clicks).');
    await expect(foot).toContainText('Numbers are sampled by Cloudflare and approximate.');
    await expect(foot).toContainText('Days are Malaysia time (GMT+8), midnight to midnight.');
    await expect(foot).toContainText('Updated about every 10 minutes.');
    for (const t of TABS) {
      await page.click(`#an-tab-${t}`);
      await expect(view(page)).toHaveAttribute('data-analytics-view', 'data');
      expect(await page.locator('#an-panel').innerText()).not.toMatch(/UTC/);
    }
  });

  test('the range line comes from the Worker dates, whatever the browser time zone', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, timezoneId: 'America/Los_Angeles' });
    const page = await ctx.newPage();
    const { FakeWorker } = require('./analytics-mock');
    const worker = new FakeWorker();
    await worker.install(page);
    await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [PASSCODE_KEY, FAKE_PASSCODE]);
    await page.route('https://api.github.com/**', (route) => route.fulfill({ status: 501, body: '{}' }));
    await gotoAdmin(page);
    await openAnalytics(page);
    await expect(page.locator('#an-tp-overview .an-range-line')).toContainText('28 Oct - 26 Nov 2026 (Malaysia time)');
    await ctx.close();
  });
});

test.describe('states', () => {
  test('loading while the request is held (status, skeleton, Refresh disabled), then data', async ({ page, analytics }) => {
    await seedPasscode(page);
    const h = analytics.hold({ tab: 'overview', days: 30 });
    await gotoAdmin(page);
    await openAnalytics(page);
    await h.arrivedPromise;
    const mount = page.locator('#an-tp-overview');
    await expect(mount).toHaveAttribute('aria-busy', 'true');
    await expect(mount.locator('[role="status"]')).toContainText('Loading...');
    await expect(page.locator('#an-refresh')).toBeDisabled();
    h.release();
    await expect(view(page)).toHaveAttribute('data-analytics-view', 'data');
    await expect(mount).not.toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('#an-refresh')).toBeEnabled();
  });

  test('empty: all zeros show the empty state', async ({ page, analytics }) => {
    await seedPasscode(page);
    analytics.setFixture('overview', 30, 'overview-30-zero');
    await gotoAdmin(page);
    await openAnalytics(page);
    const box = page.locator('#an-tp-overview [role="status"]');
    await expect(box).toContainText('No visits in this period yet.');
  });

  test('401: wrong passcode is explained, kept and can be forgotten', async ({ page, analytics }) => {
    await seedPasscode(page, 'TESTONLY-wrong-passcode-not-real-9999');
    await gotoAdmin(page);
    await openAnalytics(page);
    const box = page.locator('#an-tp-overview [role="alert"]');
    await expect(box).toContainText('Passcode is wrong. Paste the current one.');
    await expect(chip(page)).toHaveText('Error');
    expect(await page.evaluate((k) => localStorage.getItem(k), PASSCODE_KEY)).toBe('TESTONLY-wrong-passcode-not-real-9999');
    await expect(page.locator('#an-forget')).toBeVisible();
    expect(analytics.count('overview', 30)).toBe(1);
  });

  test('429: tells the minutes', async ({ page, analytics }) => {
    await seedPasscode(page);
    analytics.override(429, { error: 'busy', retryAfter: 120 });
    await gotoAdmin(page);
    await openAnalytics(page);
    await expect(page.locator('#an-tp-overview [role="alert"]')).toContainText('Cloudflare is busy. Try again in 2 minutes.');
    analytics.override(429, { error: 'busy', retryAfter: 30 });
    await page.click('#an-tp-overview button:has-text("Try again")');
    await expect(page.locator('#an-tp-overview [role="alert"]')).toContainText('Try again in 1 minute.');
  });

  test('502 and a network failure: message, Try again works', async ({ page, analytics }) => {
    await seedPasscode(page);
    analytics.override(502, { error: 'upstream' });
    await gotoAdmin(page);
    await openAnalytics(page);
    const box = page.locator('#an-tp-overview [role="alert"]');
    await expect(box).toContainText('Could not load the numbers. Try again.');
    analytics.override(null);
    analytics.failNetwork = true;
    await page.click('#an-tp-overview button:has-text("Try again")');
    await expect(box).toContainText('Could not load the numbers. Try again.');
    await expect(box).toContainText('If it keeps failing, check the Worker address and ALLOWED_ORIGIN.');
    analytics.failNetwork = false;
    await page.click('#an-tp-overview button:has-text("Try again")');
    await expect(view(page)).toHaveAttribute('data-analytics-view', 'data');
    await expect(chip(page)).toHaveText('Last 30 days');
  });

  test('403 (wrong origin) says what to check', async ({ page, analytics }) => {
    await seedPasscode(page);
    analytics.override(403, { error: 'origin' });
    await gotoAdmin(page);
    await openAnalytics(page);
    // The real Worker's 403 has no CORS headers, so the browser only sees a network error: the hint is in that text.
    await expect(page.locator('#an-tp-overview [role="alert"]')).toContainText('If it keeps failing, check the Worker address and ALLOWED_ORIGIN.');
    await expect(page.locator('#an-tp-overview button:has-text("Try again")')).toBeVisible();
  });

  test('explain(): a readable 403 names ALLOWED_ORIGIN, no retry', async ({ page }) => {
    await page.goto('/admin/');
    const r = await page.evaluate(async () => (await import('/js/admin/analytics-panel.js')).explain({ status: 403, body: { error: 'origin' } }));
    expect(r.kind).toBe('origin');
    expect(r.text).toContain('ALLOWED_ORIGIN');
    expect(r.retry).toBe(false);
  });

  test('range-unavailable for 90 days turns 90 off with a note and shows 30 days', async ({ page, analytics }) => {
    await seedPasscode(page);
    await gotoAdmin(page);
    await openAnalytics(page);
    await expect(view(page)).toHaveAttribute('data-analytics-view', 'data');
    analytics.override(502, { error: 'upstream', code: 'range-unavailable' });
    await page.locator('#an-range label', { hasText: '90 days' }).click();
    await expect(page.locator('#an-range input[value="90"]')).toBeDisabled();
    await expect(page.locator('#an-r90')).toContainText('90 days is not available');
    await expect(page.locator('#an-range input[value="30"]')).toBeChecked();
    analytics.override(null);
  });

  test('range-unavailable for 30 days shows the message', async ({ page, analytics }) => {
    await seedPasscode(page);
    analytics.override(502, { error: 'upstream', code: 'range-unavailable' });
    await gotoAdmin(page);
    await openAnalytics(page);
    await expect(page.locator('#an-tp-overview [role="alert"]')).toContainText('Cloudflare does not keep data that far back.');
  });
});

test.describe('security', () => {
  test('the admin CSP names the configured Worker origin and nothing else leaves the page', async ({ page, analytics }) => {
    const hosts = new Set();
    page.on('request', (r) => hosts.add(new URL(r.url()).hostname));
    await seedPasscode(page);
    await gotoAdmin(page);
    await openAnalytics(page);
    await expect.poll(() => analytics.count('overview', 30)).toBe(1);
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(csp).toContain(`connect-src 'self' https://api.github.com ${FAKE_WORKER}`);
    expect(csp).not.toMatch(/connect-src[^;]*\*/);
    const allowed = new Set(['127.0.0.1', 'analytics-test.invalid', 'fonts.googleapis.com', 'fonts.gstatic.com']);
    expect([...hosts].filter((h) => !allowed.has(h))).toEqual([]);
  });

  test('the repo CSP equals the configured workerUrl (static check on the real files)', async () => {
    const cfg = fs.readFileSync(path.join(ROOT, 'js', 'admin', 'analytics-config.js'), 'utf8');
    const html = fs.readFileSync(path.join(ROOT, 'admin', 'index.html'), 'utf8');
    const url = (/workerUrl:\s*'([^']*)'/.exec(cfg) || [])[1];
    expect(url, 'workerUrl is a string in analytics-config.js').not.toBeUndefined();
    const connect = /connect-src ([^;"]*)/.exec(html)[1].trim();
    if (url) {
      expect(url).toMatch(/^https:\/\/[^/\s*]+$/);
      expect(connect).toBe(`'self' https://api.github.com ${url}`);
    } else {
      expect(connect).toBe("'self' https://api.github.com");
    }
  });

  test('the passcode is sent only by analytics-client.js, only to the stats path', async () => {
    const dir = path.join(ROOT, 'js', 'admin');
    const sending = fs.readdirSync(dir).filter((f) => f.endsWith('.js') && /Authorization/.test(fs.readFileSync(path.join(dir, f), 'utf8')));
    expect(sending.sort()).toEqual(['analytics-client.js', 'github-token.js']);
    const src = fs.readFileSync(path.join(dir, 'analytics-client.js'), 'utf8');
    expect(src).toContain("credentials: 'omit'");
    expect(src).toContain("referrerPolicy: 'no-referrer'");
    expect(src).toContain("cache: 'no-store'");
    expect(src).toContain('TIMEOUT_MS = 20000');
    expect(src).toContain('/v1/stats?tab=');
  });
});

test.describe('opt-out', () => {
  test('the checkbox writes and clears puzzkezz.analytics.optout', async ({ page }) => {
    await gotoAdmin(page);
    await openAnalytics(page);
    const box = page.locator('#an-optout');
    await expect(box).not.toBeChecked();
    await box.check();
    expect(await page.evaluate((k) => localStorage.getItem(k), OPTOUT_KEY)).toBe('1');
    await page.reload();
    await openAnalytics(page);
    await expect(box).toBeChecked();
    await box.uncheck();
    expect(await page.evaluate((k) => localStorage.getItem(k), OPTOUT_KEY)).toBeNull();
  });
});

test.describe('narrow screens', () => {
  test('360px: no horizontal page scroll with the panel open, tabs at least 44px tall', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await seedPasscode(page);
    await gotoAdmin(page);
    await openAnalytics(page);
    await expect(page.locator('#an-tab-overview')).toBeVisible();
    for (const t of TABS) {
      const b = await page.locator(`#an-tab-${t}`).boundingBox();
      expect(b.height, `${t} tab height`).toBeGreaterThanOrEqual(44);
    }
    for (const sel of ['#an-refresh', '#an-save']) {
      const el = page.locator(sel);
      if (await el.isVisible()) expect((await el.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
    const r = await page.locator('#an-range label').first().boundingBox();
    expect(r.height).toBeGreaterThanOrEqual(44);
    await noHorizontalScroll(page);
    const tabs = await page.locator('#an-tabs').boundingBox();
    expect(tabs.x + tabs.width).toBeLessThanOrEqual(360);
  });
});
