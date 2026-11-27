// Shared fake Worker for the admin Analytics tests (TASK-32 to TASK-37), like tests/github-mock.js.
// - The page is given a fake Worker origin (https://analytics-test.invalid): js/admin/analytics-config.js is
//   routed to a module with that workerUrl, and admin/index.html is routed with the same origin added to its
//   Content-Security-Policy connect-src (a static meta tag cannot read the config). No real Worker exists.
// - GET <fake>/v1/stats?tab=&days= is answered from tests/fixtures/analytics/<tab>-<days>.json. It checks the
//   page Origin and `Authorization: Bearer <FAKE_PASSCODE>` (401 otherwise, like the real Worker).
// - override(status, body) forces an answer; hold(match) keeps a request until release(); setFixture() swaps
//   one fixture; failNetwork makes requests fail like an offline browser; `requests` lists every call.
// - Any request to api.cloudflare.com or cloudflareinsights.com, and any call to the fake host this mock does not
//   handle, fails the test. A leak watcher fails the test if the passcode shows up anywhere except the
//   Authorization header of a request to the fake Worker (URLs, other requests, console, DOM, other storage keys).
const fs = require('fs');
const path = require('path');
const { test: githubTest, expect, openFold, openBackup } = require('./github-mock');
const { openAnalyticsSettings } = require('./helpers');

const FAKE_PASSCODE = 'TESTONLY-passcode-not-real-123456';
const FAKE_WORKER = 'https://analytics-test.invalid';
const PASSCODE_KEY = 'puzzkezz.analytics.passcode';
const OPTOUT_KEY = 'puzzkezz.analytics.optout';
const FIXTURES = path.join(__dirname, 'fixtures', 'analytics');
const CORS_BASE = { 'access-control-allow-headers': 'Authorization', 'access-control-allow-methods': 'GET', 'access-control-max-age': '600', vary: 'Origin' };

const readFixture = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.json`), 'utf8'));

class FakeWorker {
  constructor({ configured = true } = {}) {
    this.configured = configured;
    this.url = FAKE_WORKER;
    this.requests = []; // { tab, days, auth, origin, url }
    this.unhandled = [];
    this.forbidden = [];
    this.fixtures = new Map(); // 'tab|days' -> object
    this.forced = null; // { status, body }
    this.failNetwork = false;
    this.holds = [];
  }

  /** Answer for tab + days (a replaced fixture, or the file tests/fixtures/analytics/<tab>-<days>.json). */
  fixture(tab, days) {
    const k = `${tab}|${days}`;
    return this.fixtures.has(k) ? this.fixtures.get(k) : readFixture(`${tab}-${days}`);
  }

  /** Replace one answer with a fixture file name (for example 'overview-30-nullprev') or an object. */
  setFixture(tab, days, what) {
    this.fixtures.set(`${tab}|${days}`, typeof what === 'string' ? readFixture(what) : what);
  }

  /** Every request gets this answer until override(null). */
  override(status, body = {}) {
    this.forced = status === null ? null : { status, body };
  }

  /**
   * Holds the next matching request ({ tab, days }, both optional) until release(). `arrived` resolves when the
   * request reached the mock. release(answer) then answers it normally, or with { status, body } if given.
   */
  hold(match = {}) {
    const h = { match, released: false, arrived: false };
    h.arrivedPromise = new Promise((resolve) => { h.markArrived = () => { h.arrived = true; resolve(); }; });
    h.gate = new Promise((resolve) => { h.release = (answer) => { h.released = true; h.answer = answer; resolve(); }; });
    this.holds.push(h);
    return h;
  }

  count(tab, days) {
    return this.requests.filter((r) => (tab === undefined || r.tab === tab) && (days === undefined || r.days === days)).length;
  }

  json(route, status, body, extraHeaders = {}) {
    // Like the real Worker (worker/src/index.js): the 403 for a wrong origin carries NO CORS headers, so the
    // browser reports a network error and the page never sees the status. (Playwright's route.fulfill adds
    // CORS headers by itself, so the blocked answer is modelled by aborting the request.)
    if (status === 403) return route.abort('failed');
    const cors = this.cors;
    return route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store', ...cors, ...extraHeaders },
      body: JSON.stringify(body),
    });
  }

  async install(page) {
    this.page = page;
    const origin = new URL(process.env.PW_BASE_URL || 'http://127.0.0.1:4173').origin;
    this.cors = { ...CORS_BASE, 'access-control-allow-origin': origin };
    page.on('request', (r) => {
      const host = new URL(r.url()).hostname;
      if (/(^|\.)(api\.cloudflare\.com|cloudflareinsights\.com)$/.test(host)) this.forbidden.push(r.url());
    });
    await page.route(/https:\/\/(api\.cloudflare\.com|[^/]*cloudflareinsights\.com)\//, (route) => route.abort());
    if (!this.configured) return;
    await page.route('**/js/admin/analytics-config.js', (route) => route.fulfill({
      contentType: 'text/javascript',
      body: `export const ANALYTICS = Object.freeze({ workerUrl: ${JSON.stringify(this.url)} });\n`,
    }));
    const patchCsp = async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace(/connect-src 'self' https:\/\/api\.github\.com/, `connect-src 'self' https://api.github.com ${this.url}`);
      await route.fulfill({ response, body });
    };
    await page.route('**/admin/index.html', patchCsp);
    await page.route(/\/admin\/(\?.*)?$/, patchCsp);
    await page.route(`${this.url}/**`, (route) => this.handle(route));
  }

  async handle(route) {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === 'OPTIONS') {
      // A wrong origin gets no CORS headers on the preflight either (real Worker), so the browser blocks the call.
      if (this.forced && this.forced.status === 403) return route.abort('failed');
      return route.fulfill({ status: 204, headers: this.cors });
    }
    if (req.method() !== 'GET' || url.pathname !== '/v1/stats') {
      this.unhandled.push(`${req.method()} ${req.url()}`);
      return this.json(route, 404, { error: 'not-found' });
    }
    const tab = url.searchParams.get('tab');
    const days = Number(url.searchParams.get('days'));
    const headers = req.headers();
    const entry = { tab, days, auth: headers.authorization || '', origin: headers.origin || '', url: req.url() };
    this.requests.push(entry);
    if (this.failNetwork) return route.abort('failed');
    const held = this.holds.find((h) => !h.released && !h.arrived && (h.match.tab === undefined || h.match.tab === tab) && (h.match.days === undefined || h.match.days === days));
    if (held) {
      held.markArrived();
      await held.gate;
      if (held.answer) return this.json(route, held.answer.status, held.answer.body);
    }
    if (this.forced) return this.json(route, this.forced.status, this.forced.body);
    if (entry.auth !== `Bearer ${FAKE_PASSCODE}`) return this.json(route, 401, { error: 'passcode' });
    if (!['overview', 'sources', 'pages', 'audience', 'performance'].includes(tab) || ![7, 30, 90].includes(days)) {
      return this.json(route, 400, { error: 'bad-request' });
    }
    return this.json(route, 200, this.fixture(tab, days));
  }

  expectAllHandled() {
    this.holds.forEach((h) => h.release());
    expect(this.forbidden, 'requests to api.cloudflare.com / cloudflareinsights.com').toEqual([]);
    expect(this.unhandled, 'calls to the fake Worker that tests/analytics-mock.js does not handle').toEqual([]);
  }
}

/** Records requests and console lines; check() fails if the passcode appears anywhere except the fake Worker's Authorization header. */
function watchPasscodeLeaks(page, worker, passcode = FAKE_PASSCODE) {
  const requests = [];
  const lines = [];
  page.on('request', (r) => requests.push(r));
  page.on('console', (m) => lines.push(m.text()));
  page.on('pageerror', (e) => lines.push(String(e && e.stack ? e.stack : e)));
  return {
    async check() {
      const leaks = [];
      for (const r of requests) {
        const url = r.url();
        if (url.includes(passcode)) leaks.push(`passcode in URL: ${url}`);
        const headers = await r.allHeaders().catch(() => r.headers());
        for (const [name, value] of Object.entries(headers)) {
          if (!String(value).includes(passcode)) continue;
          if (name.toLowerCase() === 'authorization' && url.startsWith(`${worker.url}/v1/stats?`)) continue;
          leaks.push(`passcode in header "${name}" of ${r.method()} ${url}`);
        }
        const body = r.postData();
        if (body && body.includes(passcode)) leaks.push(`passcode in body of ${r.method()} ${url}`);
      }
      for (const line of lines) if (line.includes(passcode)) leaks.push(`passcode in console: ${line.slice(0, 80)}`);
      if (!page.isClosed() && page.url().startsWith('http')) {
        const inPage = await page.evaluate((code, key) => {
          const found = [];
          if (document.documentElement.outerHTML.includes(code)) found.push('passcode in the DOM');
          for (const i of document.querySelectorAll('input, textarea')) if (String(i.value).includes(code)) found.push(`passcode in the value of #${i.id}`);
          for (let n = 0; n < localStorage.length; n += 1) {
            const k = localStorage.key(n);
            if (k !== key && (k.includes(code) || String(localStorage.getItem(k)).includes(code))) found.push(`passcode in localStorage key ${k}`);
          }
          return found;
        }, passcode, PASSCODE_KEY).catch(() => []);
        leaks.push(...inPage);
      }
      expect(leaks, 'places the analytics passcode leaked to').toEqual([]);
    },
  };
}

/**
 * `test` with an `analytics` fixture (the fake Worker, installed before the page loads) on top of the `github`
 * fixture. `test.use({ analyticsConfigured: false })` gives the "Not set up" admin (empty workerUrl).
 */
const test = githubTest.extend({
  analyticsConfigured: [true, { option: true }],
  analytics: [async ({ page, analyticsConfigured }, use) => {
    const worker = new FakeWorker({ configured: analyticsConfigured });
    await worker.install(page);
    const leaks = watchPasscodeLeaks(page, worker);
    await use(worker);
    worker.expectAllHandled();
    await leaks.check();
  }, { auto: true }],
});

/** Stores the fake passcode before the page loads (the passcode UI itself is tested in task-32). */
async function seedPasscode(page, passcode = FAKE_PASSCODE) {
  await page.addInitScript(([key, value]) => { try { localStorage.setItem(key, value); } catch (e) { /* ignore */ } }, [PASSCODE_KEY, passcode]);
}

/** Opens the admin page and waits for the Analytics script. */
async function gotoAdmin(page) {
  await page.goto('admin/index.html');
  await expect(page.locator('html')).toHaveAttribute('data-analytics-ready', 'true');
}

/** Opens the Analytics panel (if collapsed). */
async function openAnalytics(page) {
  await openFold(page, 'an-panel');
}

module.exports = { test, expect, FAKE_PASSCODE, FAKE_WORKER, PASSCODE_KEY, OPTOUT_KEY, FakeWorker, seedPasscode, gotoAdmin, openAnalytics, openAnalyticsSettings, openFold, openBackup, readFixture };
