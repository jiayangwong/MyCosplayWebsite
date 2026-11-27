// TASK-31: the Cloudflare Worker in worker/ (Node only, no browser page). Global fetch is stubbed: any call that is not
// stubbed fails the test, so nothing ever reaches api.cloudflare.com. The Cache API is a small in-memory fake.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { test, expect } = require('@playwright/test');

const ROOT = path.join(__dirname, '..');
const FIX = path.join(__dirname, 'fixtures', 'cf-graphql');
const fx = (name) => JSON.parse(fs.readFileSync(path.join(FIX, name), 'utf8'));

const PASSCODE = 'TESTONLY-passcode-not-real-123456';
const TOKEN = 'TESTONLY-cf-token-not-real-abcdef';
const ORIGIN = 'https://puzzkezz-testing.loc.cc';
const ENV = { CF_API_TOKEN: TOKEN, ACCOUNT_ID: 'acc-test-1', SITE_TAG: 'site-test-1', ALLOWED_ORIGIN: ORIGIN, PASSCODE };
// 2026-11-28 11:00 in Malaysia: 7 days = 2026-11-21 .. 2026-11-27
const NOW = Date.parse('2026-11-28T03:00:00Z');

let W; // the imported worker module
let calls; // every stubbed GraphQL call
let handler;
let store;
const realFetch = globalThis.fetch;
const realCaches = globalThis.caches;
const realWarn = console.warn;
let logs;

const kindOf = (query) => (/query (Settings|Overview|Sources|Pages|Audience|Performance)\b/.exec(query) || [])[1];
const okJson = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

function defaultHandler(kind, vars) {
  switch (kind) {
    case 'Settings': return okJson(fx('settings.json'));
    case 'Overview': return okJson(fx(vars.start === '2026-11-13T16:00:00Z' || vars.start === '2026-11-13T16:00:00Z' ? 'overview-prev.json' : 'overview-hours.json'));
    case 'Sources': return okJson(fx('sources.json'));
    case 'Pages': return okJson(fx('pages.json'));
    case 'Audience': return okJson(fx('audience.json'));
    case 'Performance': return okJson(fx('performance.json'));
    default: throw new Error(`unstubbed query ${kind}`);
  }
}

test.beforeAll(async () => {
  W = await import(path.join(ROOT, 'worker', 'src', 'index.js'));
});

test.beforeEach(() => {
  calls = [];
  logs = [];
  handler = defaultHandler;
  store = new Map();
  W.resetSettingsCache();
  console.warn = (...a) => { logs.push(a.join(' ')); };
  globalThis.fetch = async (url, init = {}) => {
    if (url !== 'https://api.cloudflare.com/client/v4/graphql') throw new Error(`unstubbed fetch ${url}`);
    const body = JSON.parse(init.body);
    const call = { url, init, body, kind: kindOf(body.query), headers: init.headers };
    calls.push(call);
    return handler(call.kind, body.variables, call);
  };
  globalThis.caches = {
    default: {
      async match(req) { const hit = store.get(req.url); return hit ? hit.clone() : undefined; },
      async put(req, res) { store.set(req.url, res); },
    },
  };
});
test.afterEach(() => {
  globalThis.fetch = realFetch;
  if (realCaches === undefined) delete globalThis.caches; else globalThis.caches = realCaches;
  console.warn = realWarn;
});

const req = (qs = 'tab=overview&days=7', opts = {}) => new Request(`https://w.example/v1/stats?${qs}`, {
  method: opts.method || 'GET',
  headers: { ...(opts.origin === null ? {} : { Origin: opts.origin || ORIGIN }), ...(opts.auth === null ? {} : { Authorization: `Bearer ${opts.auth ?? PASSCODE}` }), ...(opts.headers || {}) },
});
const call = (r, env = ENV) => W.handle(r, env, undefined, NOW);
const getJson = async (qs, opts, env) => { const res = await call(req(qs, opts), env); return { res, body: await res.json() }; };

// ---------- CORS / routing ----------
test.describe('routing and CORS', () => {
  test('allowed origin gets exact CORS headers and Cache-Control no-store', async () => {
    const { res, body } = await getJson('tab=overview&days=7');
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(res.headers.get('Vary')).toBe('Origin');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(body.v).toBe(1);
  });
  test('other origin or no origin: 403 origin, no CORS headers, no GraphQL call', async () => {
    for (const origin of ['https://evil.example', ORIGIN + '/', 'http://puzzkezz-testing.loc.cc', null]) {
      const res = await call(req('tab=overview&days=7', { origin }));
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'origin' });
      for (const [k] of res.headers) expect(k.toLowerCase().startsWith('access-control-')).toBe(false);
    }
    expect(calls.length).toBe(0);
  });
  test('OPTIONS preflight: 204, GET only, Authorization header, max-age 600; wrong origin 403', async () => {
    const ok = await call(req('tab=overview&days=7', { method: 'OPTIONS', auth: null }));
    expect(ok.status).toBe(204);
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(ok.headers.get('Access-Control-Allow-Methods')).toBe('GET');
    expect(ok.headers.get('Access-Control-Allow-Headers')).toBe('Authorization');
    expect(ok.headers.get('Access-Control-Max-Age')).toBe('600');
    expect(ok.headers.get('Vary')).toBe('Origin');
    const bad = await call(req('tab=overview&days=7', { method: 'OPTIONS', auth: null, origin: 'https://evil.example' }));
    expect(bad.status).toBe(403);
    expect(bad.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
  test('only GET /v1/stats: other paths 404, other methods 405', async () => {
    const r404 = await call(new Request('https://w.example/other', { headers: { Origin: ORIGIN } }));
    expect(r404.status).toBe(404);
    expect(await r404.json()).toEqual({ error: 'not-found' });
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
      const r = await call(req('tab=overview&days=7', { method }));
      expect(r.status).toBe(405);
      expect(await r.json()).toEqual({ error: 'method' });
    }
    expect(calls.length).toBe(0);
  });
});

// ---------- passcode ----------
test.describe('passcode', () => {
  test('missing, wrong, wrong length, near-miss: 401 and no GraphQL call', async () => {
    for (const auth of [null, '', 'short', PASSCODE + 'x', PASSCODE.slice(0, -1), PASSCODE.toUpperCase()]) {
      const res = await call(req('tab=overview&days=7', { auth }));
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'passcode' });
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN); // the admin can read the error
    }
    const noBearer = await call(new Request('https://w.example/v1/stats?tab=overview&days=7', { headers: { Origin: ORIGIN, Authorization: PASSCODE } }));
    expect(noBearer.status).toBe(401);
    expect(calls.length).toBe(0);
  });
  test('right passcode works; short PASSCODE env (and other missing config) makes every request 503', async () => {
    expect((await call(req())).status).toBe(200);
    for (const env of [{ ...ENV, PASSCODE: 'x'.repeat(23) }, { ...ENV, PASSCODE: undefined }, { ...ENV, CF_API_TOKEN: '' }, { ...ENV, ACCOUNT_ID: 'your-account-id' },
      { ...ENV, SITE_TAG: undefined }, { ...ENV, ALLOWED_ORIGIN: 'https://x.example/' }, { ...ENV, ALLOWED_ORIGIN: undefined }]) {
      const before = calls.length;
      const res = await call(req('tab=overview&days=7', { auth: env.PASSCODE ?? PASSCODE }), env);
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: 'not-configured' });
      expect(calls.length).toBe(before);
    }
    expect((await call(req('tab=overview&days=7', { auth: 'y'.repeat(24) }), { ...ENV, PASSCODE: 'y'.repeat(24) })).status).toBe(200);
  });
  test('the placeholder PASSCODE from .dev.vars.example makes the request 503', async () => {
    const example = fs.readFileSync(path.join(ROOT, 'worker', '.dev.vars.example'), 'utf8');
    const placeholder = /^PASSCODE="(.*)"$/m.exec(example)[1];
    expect(placeholder.length).toBeGreaterThanOrEqual(24); // long enough that only the placeholder check rejects it
    const res = await call(req('tab=overview&days=7', { auth: placeholder }), { ...ENV, PASSCODE: placeholder });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'not-configured' });
    expect(calls.length).toBe(0);
  });
  test('constantTimeEqual compares by content, not length, and with the Node fallback loop', async () => {
    expect(await W.constantTimeEqual('abc', 'abc')).toBe(true);
    expect(await W.constantTimeEqual('abc', 'abd')).toBe(false);
    expect(await W.constantTimeEqual('abc', 'abcd')).toBe(false);
    expect(await W.constantTimeEqual('', '')).toBe(true);
    expect(await W.constantTimeEqual('é', 'e')).toBe(false);
  });
});

// ---------- allowlist ----------
test('allowlist: bad tab, days=14, extra parameters, duplicates, missing: 400', async () => {
  for (const qs of ['tab=nope&days=7', 'tab=overview&days=14', 'tab=overview&days=90&x=1', 'tab=overview', 'days=7', '', 'tab=overview&days=7&days=30',
    'tab=overview&days=07', 'tab=overview&days=7.0', 'tab=Overview&days=7', 'tab=overview&days=-7', 'tab=overview&days=']) {
    const res = await call(req(qs));
    expect(res.status, qs).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad-request' });
  }
  expect(calls.length).toBe(0);
});

// ---------- GMT+8 days: pure helpers ----------
test.describe('GMT+8 days', () => {
  test('localRange around the Malaysia midnight (23:59 and 00:00)', () => {
    const a = W.localRange(Date.parse('2026-11-27T15:59:00Z'), 7);
    expect([a.from, a.to]).toEqual(['2026-11-20', '2026-11-26']);
    const b = W.localRange(Date.parse('2026-11-27T16:00:00Z'), 7);
    expect([b.from, b.to]).toEqual(['2026-11-21', '2026-11-27']);
    expect(b.start).toBe('2026-11-20T16:00:00Z');
    expect(b.end).toBe('2026-11-27T16:00:00Z');
    expect(b.tz).toBe('+08:00');
    expect(b.previous).toEqual({ from: '2026-11-14', to: '2026-11-20', start: '2026-11-13T16:00:00Z', end: '2026-11-20T16:00:00Z' });
    expect(W.dayStartInstant('2026-11-21')).toBe('2026-11-20T16:00:00Z');
    expect(W.dayEndInstant('2026-11-27')).toBe('2026-11-27T16:00:00Z');
  });
  test('a visit at 17:00 UTC lands on the next GMT+8 day; 15:00 UTC stays; 16:00 UTC is 00:00 next day', () => {
    const rows = [
      { hour: '2026-11-20T17:00:00Z', visits: 1, pageViews: 1 },
      { hour: '2026-11-20T15:00:00Z', visits: 10, pageViews: 10 },
      { hour: '2026-11-20T16:00:00Z', visits: 100, pageViews: 100 },
    ];
    const days = W.hoursToLocalDays(rows, '2026-11-20', '2026-11-22');
    expect(days).toEqual([
      { date: '2026-11-20', visits: 10, pageViews: 10 },
      { date: '2026-11-21', visits: 101, pageViews: 101 },
      { date: '2026-11-22', visits: 0, pageViews: 0 },
    ]);
    expect(W.localDateOfHour('2026-11-20T17:00:00Z')).toBe('2026-11-21');
  });
  test('7 / 30 / 90 days give exactly that many dates, first = from, last = to; outside hours ignored; bad rows skipped', () => {
    for (const n of [7, 30, 90]) {
      const r = W.localRange(NOW, n);
      const days = W.hoursToLocalDays([{ hour: `${r.to}T00:00:00Z`, visits: 2, pageViews: 3 }, { hour: 'garbage', visits: 5 }, { hour: '2000-01-01T00:00:00Z', visits: 9 }], r.from, r.to);
      expect(days.length).toBe(n);
      expect(days[0].date).toBe(r.from);
      expect(days[n - 1].date).toBe(r.to);
      expect(days.reduce((s, d) => s + d.visits, 0)).toBe(2);
    }
  });
  test('previous period of 7 days ending 2026-11-27 is 13 Nov 16:00Z to 20 Nov 16:00Z and its total is the sum of its hours', () => {
    const r = W.localRange(Date.parse('2026-11-27T16:00:00Z'), 7);
    expect([r.previous.start, r.previous.end]).toEqual(['2026-11-13T16:00:00Z', '2026-11-20T16:00:00Z']);
    const rows = [{ hour: '2026-11-13T16:00:00Z', visits: 4, pageViews: 6 }, { hour: '2026-11-20T15:00:00Z', visits: 1, pageViews: 2 }, { hour: '2026-11-20T16:00:00Z', visits: 99, pageViews: 99 }];
    const shaped = W.shapeOverview([], rows, r);
    expect(shaped.previous).toEqual({ visits: 5, pageViews: 8 });
  });
  test('the same now gives the same answer on a machine set to any time zone', async () => {
    const saved = process.env.TZ;
    const out = [];
    try {
      for (const tz of ['UTC', 'America/New_York', 'Asia/Kuala_Lumpur', 'Pacific/Kiritimati']) {
        process.env.TZ = tz;
        const r = W.localRange(Date.parse('2026-11-27T16:00:00Z'), 30);
        out.push(JSON.stringify([r, W.hoursToLocalDays([{ hour: '2026-11-20T17:00:00Z', visits: 1, pageViews: 1 }], r.from, r.to)]));
      }
    } finally { if (saved === undefined) delete process.env.TZ; else process.env.TZ = saved; }
    expect(new Set(out).size).toBe(1);
  });
});

// ---------- GraphQL request ----------
test.describe('GraphQL requests', () => {
  test('right dataset per tab; variables hold account, site and GMT+8 instants; token only in the header; no date dimension', async () => {
    const expected = {
      overview: ['rumPageloadEventsAdaptiveGroups'], sources: ['rumPageloadEventsAdaptiveGroups'], pages: ['rumPageloadEventsAdaptiveGroups'], audience: ['rumPageloadEventsAdaptiveGroups'],
      performance: ['rumPerformanceEventsAdaptiveGroups', 'rumWebVitalsEventsAdaptiveGroups'],
    };
    for (const [tab, datasets] of Object.entries(expected)) {
      calls.length = 0; store.clear();
      const res = await call(req(`tab=${tab}&days=7`));
      expect(res.status, tab).toBe(200);
      const data = calls.filter((c) => c.kind !== 'Settings');
      expect(data.length).toBeGreaterThan(0);
      for (const c of data) {
        for (const ds of datasets) expect(c.body.query).toContain(ds);
        expect(c.body.variables.accountTag).toBe('acc-test-1');
        expect(c.body.variables.siteTag).toBe('site-test-1');
        const prev = tab === 'overview' && c.body.variables.start === '2026-11-13T16:00:00Z'; // the previous-period query
        expect(c.body.variables.start).toBe(prev ? '2026-11-13T16:00:00Z' : '2026-11-20T16:00:00Z');
        expect(c.body.variables.end).toBe(prev ? '2026-11-20T16:00:00Z' : '2026-11-27T16:00:00Z');
        expect(c.body.query).toContain('datetime_geq: $start');
        expect(c.body.query).toContain('datetime_lt: $end');
        expect(c.body.query).not.toMatch(/\bdate\b|dimensions\s*\{[^}]*\bdate\b|datetimeMinute|datetimeDay/);
        expect(c.body.query).not.toContain('__LIMIT__');
        expect(c.body.query).not.toContain(TOKEN);
        expect(JSON.stringify(c.body.variables)).not.toContain(TOKEN);
        expect(JSON.stringify(c.body.variables)).not.toContain(PASSCODE);
      }
      for (const c of calls) {
        expect(c.headers.Authorization).toBe(`Bearer ${TOKEN}`);
        expect(c.url).toBe('https://api.cloudflare.com/client/v4/graphql');
        expect(c.init.method).toBe('POST');
        expect(JSON.stringify(c.body)).not.toContain(PASSCODE);
      }
    }
  });
  test('overview groups by the hourly dimension and also queries the previous period', async () => {
    await call(req('tab=overview&days=7'));
    const ov = calls.filter((c) => c.kind === 'Overview');
    expect(ov.length).toBe(2);
    expect(ov[0].body.query).toContain('datetimeHour');
    expect(ov.map((c) => c.body.variables.start)).toEqual(['2026-11-20T16:00:00Z', '2026-11-13T16:00:00Z']);
    expect(ov.map((c) => c.body.variables.end)).toEqual(['2026-11-27T16:00:00Z', '2026-11-20T16:00:00Z']);
  });
  test('request input never reaches the query text: queries are the fixed strings', async () => {
    await call(req('tab=sources&days=30'));
    for (const c of calls.filter((x) => x.kind === 'Sources')) {
      const fixed = W.QUERIES.sources.replaceAll('__LIMIT__', String(/limit: (\d+)/.exec(c.body.query)[1]));
      expect(c.body.query).toBe(fixed);
    }
  });
});

// ---------- range split / retention ----------
test.describe('range split and retention', () => {
  test('a dataset limit smaller than the range gives several queries on GMT+8 day boundaries, summed', async () => {
    handler = (kind, vars) => {
      if (kind === 'Settings') return okJson(fx('settings-small.json')); // maxDuration 3 days, maxPageSize 72 rows (3 days x 24)
      if (kind === 'Overview') {
        // one hourly row in the middle of each queried piece: 12:00 GMT+8 of its first day
        const first = new Date(Date.parse(vars.start) + 20 * 3600000).toISOString().replace('.000', '');
        return okJson({ data: { viewer: { accounts: [{ hours: [{ count: 2, sum: { visits: 1 }, dimensions: { datetimeHour: first } }] }] } }, errors: null });
      }
      return defaultHandler(kind, vars);
    };
    const { body } = await getJson('tab=overview&days=7');
    const ov = calls.filter((c) => c.kind === 'Overview');
    // 7 days in pieces of 3: 3 + 3 + 1 for the current period (previous period is 40 days old at most: kept, same split)
    const current = ov.filter((c) => c.body.variables.end <= '2026-11-27T16:00:00Z' && c.body.variables.start >= '2026-11-20T16:00:00Z');
    expect(current.map((c) => [c.body.variables.start, c.body.variables.end])).toEqual([
      ['2026-11-20T16:00:00Z', '2026-11-23T16:00:00Z'],
      ['2026-11-23T16:00:00Z', '2026-11-26T16:00:00Z'],
      ['2026-11-26T16:00:00Z', '2026-11-27T16:00:00Z'],
    ]);
    expect(body.data.daily.length).toBe(7);
    expect(body.data.totals).toEqual({ visits: 3, pageViews: 6 });
    for (const c of current) expect(c.body.query).toMatch(/limit: 72\b/);
  });
  test('retention: 7 days keeps its previous period, 30 days with a 40-day retention gets previous null', async () => {
    handler = (kind, vars) => (kind === 'Settings' ? okJson(fx('settings-small.json')) : defaultHandler(kind, vars)); // notOlderThan 40 days
    const seven = (await getJson('tab=overview&days=7')).body;
    expect(seven.data.previous).not.toBeNull(); // 15 days back: kept
    store.clear(); calls.length = 0;
    const thirty = await getJson('tab=overview&days=30'); // current starts 30 days back (inside 40); previous starts 60 days back
    expect(thirty.res.status).toBe(200);
    expect(thirty.body.data.previous).toBeNull();
  });
  test('range-unavailable: 90 days with a short retention is 502 upstream + code, and no data query runs', async () => {
    handler = (kind, vars) => (kind === 'Settings' ? okJson(fx('settings-small.json')) : defaultHandler(kind, vars));
    const { res, body } = await getJson('tab=sources&days=90');
    expect(res.status).toBe(502);
    expect(body).toEqual({ error: 'upstream', code: 'range-unavailable' });
    expect(calls.filter((c) => c.kind !== 'Settings').length).toBe(0);
  });
  test('previous null when only the previous period is too old (30 days, 45-day retention)', async () => {
    const s = fx('settings.json');
    for (const k of Object.keys(s.data.viewer.accounts[0].settings)) s.data.viewer.accounts[0].settings[k].notOlderThan = 45 * 86400;
    handler = (kind, vars) => (kind === 'Settings' ? okJson(s) : defaultHandler(kind, vars));
    const { res, body } = await getJson('tab=overview&days=30');
    expect(res.status).toBe(200);
    expect(body.data.previous).toBeNull();
    expect(body.data.daily.length).toBe(30);
  });
  test('settings unreadable: safe defaults (7-day pieces) and a 180-day fallback retention', async () => {
    handler = (kind, vars) => (kind === 'Settings' ? okJson({ data: null, errors: [{ message: 'nope' }] }) : defaultHandler(kind, vars));
    const { res, body } = await getJson('tab=overview&days=30');
    expect(res.status).toBe(200);
    expect(body.data.daily.length).toBe(30);
    expect(calls.filter((c) => c.kind === 'Overview').length).toBe(5 + 5); // 30 days in 7-day pieces, twice
    store.clear();
    const ninety = await getJson('tab=overview&days=90');
    expect(ninety.res.status).toBe(200);
    expect(ninety.body.data.previous).toBeNull(); // 90 + 90 days back is 180 days: the previous period start is older than 180 days
  });
  test('a disabled dataset is a 502', async () => {
    const s = fx('settings.json');
    s.data.viewer.accounts[0].settings.rumPageloadEventsAdaptiveGroups.enabled = false;
    handler = (kind, vars) => (kind === 'Settings' ? okJson(s) : defaultHandler(kind, vars));
    expect((await call(req('tab=pages&days=7'))).status).toBe(502);
  });
});

// ---------- shaping ----------
test.describe('shaping', () => {
  test('overview: every day filled, hours regrouped to GMT+8, totals and previous', async () => {
    const { body } = await getJson('tab=overview&days=7');
    expect(body).toMatchObject({ v: 1, tab: 'overview', days: 7, from: '2026-11-21', to: '2026-11-27', tz: '+08:00', sampled: true, generatedAt: '2026-11-28T03:00:00Z' });
    expect(body.data.daily).toEqual([
      { date: '2026-11-21', visits: 5, pageViews: 12 },
      { date: '2026-11-22', visits: 3, pageViews: 6 },
      { date: '2026-11-23', visits: 0, pageViews: 0 },
      { date: '2026-11-24', visits: 0, pageViews: 0 },
      { date: '2026-11-25', visits: 0, pageViews: 0 },
      { date: '2026-11-26', visits: 0, pageViews: 0 },
      { date: '2026-11-27', visits: 1, pageViews: 2 },
    ]);
    expect(body.data.totals).toEqual({ visits: 9, pageViews: 20 });
    expect(body.data.previous).toEqual({ visits: 5, pageViews: 10 });
    expect(Object.keys(body).sort()).toEqual(['data', 'days', 'from', 'generatedAt', 'sampled', 'tab', 'to', 'tz', 'v']);
  });
  test('referrer grouping table', () => {
    const own = 'puzzkezz-testing.loc.cc';
    const table = [
      ['instagram.com', 'instagram'], ['l.instagram.com', 'instagram'], ['www.instagram.com', 'instagram'], ['facebook.com', 'facebook'], ['l.facebook.com', 'facebook'],
      ['m.facebook.com', 'facebook'], ['lm.facebook.com', 'facebook'], ['google.com', 'google'], ['www.google.com', 'google'], ['google.com.my', 'google'], ['www.google.co.uk', 'google'],
      ['', 'direct'], [null, 'direct'], [undefined, 'direct'], ['  ', 'direct'], ['t.co', 'other'], ['notinstagram.com', 'other'], ['google.evil.com', 'other'], ['bing.com', 'other'],
      [own, null], ['www.' + own, null], ['PUZZKEZZ-TESTING.LOC.CC', null],
    ];
    for (const [host, key] of table) expect(W.groupReferrer(host, own), String(host)).toBe(key);
  });
  test('sources: fixed five groups, own host left out, top 5 other hosts', async () => {
    const { body } = await getJson('tab=sources&days=7');
    expect(body.data.groups).toEqual([
      { key: 'instagram', label: 'Instagram', visits: 15 }, { key: 'facebook', label: 'Facebook', visits: 4 }, { key: 'google', label: 'Google', visits: 3 },
      { key: 'direct', label: 'Direct / unknown', visits: 7 }, { key: 'other', label: 'Other', visits: 8 },
    ]);
    expect(body.data.otherHosts.length).toBe(5);
    expect(body.data.otherHosts[0]).toEqual({ host: 't.co', visits: 2 });
    expect(JSON.stringify(body)).not.toContain('puzzkezz-testing.loc.cc');
  });
  test('pages: / and /index.html merged as Home, page names, 404 paths grouped', async () => {
    const { body } = await getJson('tab=pages&days=7');
    expect(body.data.pages).toEqual([
      { path: '/reels.html', label: 'Reels', pageViews: 50 }, { path: '/', label: 'Home', pageViews: 40 },
      { path: '/gallery.html', label: 'Gallery', pageViews: 5 }, { path: '/404', label: 'Not found (404)', pageViews: 6 },
    ].sort((a, b) => b.pageViews - a.pageViews || (a.path < b.path ? -1 : 1)));
    expect(body.data.entries.find((e) => e.path === '/')).toEqual({ path: '/', label: 'Home', visits: 25 });
    expect(body.data.entries.find((e) => e.path === '/404')).toEqual({ path: '/404', label: 'Not found (404)', visits: 3 });
    expect(JSON.stringify(body)).not.toContain('wp-login');
    expect(W.labelPath('/events.html?x=1')).toEqual({ path: '/events.html', label: 'Events' });
    expect(W.labelPath('/ABOUT/')).toEqual({ path: '/about.html', label: 'About' });
    expect(W.labelPath('/contact')).toEqual({ path: '/contact.html', label: 'Contact' });
    expect(W.labelPath('/admin/')).toEqual({ path: '/404', label: 'Not found (404)' });
  });
  test('audience: top 10 countries + Other, device types, top 6 browsers + Other', async () => {
    const { body } = await getJson('tab=audience&days=7');
    const a = body.data;
    expect(a.countries.length).toBe(11);
    expect(a.countries[0]).toEqual({ name: 'Country 0', visits: 20 });
    expect(a.countries[10]).toEqual({ name: 'Other', visits: 10 + 9 }); // countries 10 and 11: 10 + 9
    expect(a.devices).toEqual([{ type: 'mobile', visits: 70 }, { type: 'desktop', visits: 30 }, { type: 'tablet', visits: 3 }, { type: 'other', visits: 1 }]);
    expect(a.browsers.length).toBe(7);
    expect(a.browsers[6]).toEqual({ name: 'Other', visits: 3 + 1 });
  });
  test('topN keeps order for ties and adds no Other when nothing is left', () => {
    expect(W.topN([{ name: 'a', visits: 1 }, { name: 'b', visits: 1 }], 5)).toEqual([{ name: 'a', visits: 1 }, { name: 'b', visits: 1 }]);
    expect(W.topN([{ name: 'a', visits: 3 }, { name: 'b', visits: 2 }, { name: 'c', visits: 1 }], 2).map((x) => x.name)).toEqual(['a', 'b', 'Other']);
  });
  test('performance: nulls instead of zero for missing values; ratings summed', async () => {
    const { body } = await getJson('tab=performance&days=7');
    expect(body.data.byDevice.mobile).toEqual({ samples: 100, pageLoadP50Ms: 1800, fcpP75Ms: 1200, lcpP75Ms: 2300, inpP75Ms: 150, clsP75: 0.04 });
    expect(body.data.byDevice.desktop).toEqual({ samples: 50, pageLoadP50Ms: 900, fcpP75Ms: null, lcpP75Ms: null, inpP75Ms: null, clsP75: null });
    expect(body.data.vitals.lcp).toEqual({ good: 60, needsImprovement: 15, poor: 5 });
    expect(body.data.vitals.inp).toEqual({ good: 70, needsImprovement: 8, poor: 2 });
    expect(body.data.vitals.cls).toEqual({ good: 75, needsImprovement: 3, poor: 2 });
    const empty = W.shapePerformance([], []);
    expect(empty.byDevice.mobile).toEqual({ samples: 0, pageLoadP50Ms: null, fcpP75Ms: null, lcpP75Ms: null, inpP75Ms: null, clsP75: null });
    expect(empty.vitals.lcp).toEqual({ good: null, needsImprovement: null, poor: null });
  });
  test('nothing else from Cloudflare is passed on (extra fields in the answer are dropped)', async () => {
    handler = (kind, vars) => {
      if (kind !== 'Pages') return defaultHandler(kind, vars);
      return okJson({ data: { viewer: { accounts: [{ paths: [{ count: 3, sum: { visits: 1 }, dimensions: { requestPath: '/', clientIP: '203.0.113.9', userAgent: 'SecretAgent' } }], secret: 'x' }] } }, errors: null });
    };
    const text = JSON.stringify((await getJson('tab=pages&days=7')).body);
    expect(text).not.toContain('203.0.113.9');
    expect(text).not.toContain('SecretAgent');
  });
});

// ---------- upstream errors ----------
test.describe('upstream errors', () => {
  const leaks = (text) => { for (const s of [TOKEN, PASSCODE, 'secret-cloudflare-error-text', 'acc-test-1', 'site-test-1']) expect(text).not.toContain(s); };
  test('GraphQL errors array, HTTP 500, bad JSON, wrong shape: 502 upstream, nothing leaked, short log code only', async () => {
    const cases = [
      () => okJson(fx('error-graphql.json')),
      () => new Response('secret-cloudflare-error-text', { status: 500 }),
      () => new Response('not json secret-cloudflare-error-text', { status: 200 }),
      () => okJson({ data: { viewer: { accounts: [] } }, errors: null }),
      () => okJson({ data: null, errors: null }),
    ];
    for (const make of cases) {
      store.clear(); logs.length = 0; W.resetSettingsCache();
      handler = (kind, vars) => (kind === 'Settings' ? okJson(fx('settings.json')) : make());
      const res = await call(req('tab=sources&days=7'));
      expect(res.status).toBe(502);
      const text = await res.text();
      expect(JSON.parse(text)).toEqual({ error: 'upstream' });
      leaks(text);
      for (const l of logs) { leaks(l); expect(l.length).toBeLessThan(60); }
    }
  });
  test('timeout: a hanging Cloudflare call is aborted and becomes 502', async () => {
    globalThis.fetch = (url, init) => new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
    const res = await call(req('tab=sources&days=7'), { ...ENV, UPSTREAM_TIMEOUT_MS: '50' });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'upstream' });
  });
  test('Cloudflare 429 becomes 429 busy with retryAfter (header, or 60 when missing)', async () => {
    handler = () => new Response('secret-cloudflare-error-text', { status: 429, headers: { 'Retry-After': '120' } });
    let r = await getJson('tab=sources&days=7');
    expect(r.res.status).toBe(429);
    expect(r.body).toEqual({ error: 'busy', retryAfter: 120 });
    W.resetSettingsCache(); store.clear();
    handler = () => new Response('', { status: 429 });
    r = await getJson('tab=sources&days=7');
    expect(r.body).toEqual({ error: 'busy', retryAfter: 60 });
    expect(r.res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
  });
});

// ---------- cache ----------
test.describe('cache', () => {
  test('second identical request makes no new GraphQL call; other tab or days do', async () => {
    await call(req('tab=sources&days=7'));
    const n = calls.length;
    expect(n).toBeGreaterThan(0);
    const again = await call(req('tab=sources&days=7'));
    expect(again.status).toBe(200);
    expect(again.headers.get('Cache-Control')).toBe('no-store');
    expect(calls.length).toBe(n);
    await call(req('tab=sources&days=30'));
    expect(calls.length).toBeGreaterThan(n);
  });
  test('a wrong passcode is 401 even when the answer is cached; the cache key has no passcode', async () => {
    await call(req('tab=pages&days=7'));
    const n = calls.length;
    const res = await call(req('tab=pages&days=7', { auth: 'wrong-wrong-wrong-wrong-wrong' }));
    expect(res.status).toBe(401);
    expect(calls.length).toBe(n);
    for (const k of store.keys()) { expect(k).not.toContain(PASSCODE); expect(k).toContain('from=2026-11-21'); }
  });
  test('a new Malaysia day never gets the old cached answer', async () => {
    await W.handle(req('tab=sources&days=7'), ENV, undefined, Date.parse('2026-11-28T15:59:00Z')); // 23:59 on 28 Nov in Malaysia
    const n = calls.length;
    await W.handle(req('tab=sources&days=7'), ENV, undefined, Date.parse('2026-11-28T15:59:30Z'));
    expect(calls.length).toBe(n); // same Malaysia day: cached
    await W.handle(req('tab=sources&days=7'), ENV, undefined, Date.parse('2026-11-28T16:00:00Z')); // 00:00 on 29 Nov
    expect(calls.length).toBeGreaterThan(n);
    expect([...store.keys()].some((k) => k.includes('to=2026-11-27')) && [...store.keys()].some((k) => k.includes('to=2026-11-28'))).toBe(true);
  });
  test('works without a Cache API (tests / local) and uses ctx.waitUntil when given', async () => {
    delete globalThis.caches;
    expect((await call(req('tab=sources&days=7'))).status).toBe(200);
    globalThis.caches = { default: { async match() { return undefined; }, async put() {} } };
    const waits = [];
    const res = await W.handle(req('tab=sources&days=7'), ENV, { waitUntil: (p) => waits.push(p) }, NOW);
    expect(res.status).toBe(200);
    expect(waits.length).toBe(1);
  });
  test('default export is an ES module Worker with fetch', async () => {
    expect(typeof W.default.fetch).toBe('function');
    const res = await W.default.fetch(req('tab=sources&days=7'), ENV, undefined);
    expect([200, 502]).toContain(res.status); // uses the real clock: with stubbed fetch the answer shape is fixed
  });
});

// ---------- repo: no secrets ----------
test.describe('repo secrets', () => {
  const walk = (dir, out = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.wrangler') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, out); else out.push(p);
    }
    return out;
  };
  test('worker/ has no package dependencies, type module, and only placeholders in examples', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'worker', 'package.json'), 'utf8'));
    expect(pkg.type).toBe('module');
    expect(pkg.dependencies).toBeUndefined();
    expect(pkg.devDependencies).toBeUndefined();
    const ex = fs.readFileSync(path.join(ROOT, 'worker', 'wrangler.toml.example'), 'utf8');
    expect(ex).toContain('ACCOUNT_ID = "your-account-id"');
    expect(ex).not.toMatch(/CF_API_TOKEN\s*=|PASSCODE\s*=/);
  });
  test('nothing in worker/ looks like a real Cloudflare token or passcode', () => {
    const files = walk(path.join(ROOT, 'worker'));
    expect(files.length).toBeGreaterThan(3);
    for (const f of files) {
      const text = fs.readFileSync(f, 'utf8');
      // Cloudflare API tokens are 40 characters of [A-Za-z0-9_-]; global keys are 37 hex characters.
      for (const m of text.matchAll(/(?:token|passcode|secret|api[_-]?key|bearer)[^\n]{0,20}?[:=\s"'`]\s*["'`]?([A-Za-z0-9_-]{37,})\b/gi)) {
        expect(m[0], `${path.relative(ROOT, f)}`).toMatch(/your-|TESTONLY|example/i);
      }
      expect(text, f).not.toMatch(/\bcfut_[A-Za-z0-9]{20,}|\bcfat_[A-Za-z0-9]{20,}/);
      expect(text, f).not.toMatch(/-----BEGIN [A-Z ]*PRIVATE KEY-----/);
    }
  });
  test('.gitignore covers the real config and secret files, and none of them is tracked', () => {
    const ignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8').split('\n').map((l) => l.trim());
    for (const entry of ['worker/wrangler.toml', 'worker/.dev.vars', 'worker/.wrangler/']) expect(ignore, entry).toContain(entry);
    let tracked = '';
    try { tracked = execFileSync('git', ['ls-files', 'worker'], { cwd: ROOT, encoding: 'utf8' }); } catch { tracked = ''; }
    for (const line of tracked.split('\n').filter(Boolean)) {
      expect(line).not.toMatch(/(^|\/)wrangler\.toml$/);
      expect(line).not.toMatch(/(^|\/)\.dev\.vars$/);
    }
    try {
      for (const f of ['worker/wrangler.toml', 'worker/.dev.vars', 'worker/.wrangler/x']) execFileSync('git', ['check-ignore', '-q', f], { cwd: ROOT });
    } catch (e) { if (e.status === 1) throw new Error('git does not ignore a worker secret file'); }
  });
  test('the README names every step and the unconfirmed facts', () => {
    const readme = fs.readFileSync(path.join(ROOT, 'worker', 'README.md'), 'utf8');
    for (const s of ['wrangler secret put CF_API_TOKEN', 'wrangler secret put PASSCODE', 'wrangler deploy', 'Account Analytics', 'beaconToken', 'check-schema', 'NOT confirmed', 'GMT+8']) expect(readme, s).toContain(s);
  });
});
