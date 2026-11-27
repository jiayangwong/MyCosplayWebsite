// QA checks for TASK-31 (extra to tests/task-31.spec.js). Node only. Global fetch is stubbed, so nothing reaches Cloudflare.
// Tests marked test.fail() describe an open bug in bugs/BUGS.md: remove the mark when the bug is fixed.
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawnSync } = require('child_process');
const { test, expect } = require('@playwright/test');

const ROOT = path.join(__dirname, '..');
const ORIGIN = 'https://puzzkezz-testing.loc.cc';
const PASSCODE = 'TESTONLY-passcode-not-real-123456';
const TOKEN = 'TESTONLY-cf-token-not-real-abcdef';
const ENV = { CF_API_TOKEN: TOKEN, ACCOUNT_ID: 'acc-test-1', SITE_TAG: 'site-test-1', ALLOWED_ORIGIN: ORIGIN, PASSCODE };
const NOW = Date.parse('2026-11-28T03:00:00Z'); // 28 Nov 11:00 in Malaysia
const DATASETS = ['rumPageloadEventsAdaptiveGroups', 'rumPerformanceEventsAdaptiveGroups', 'rumWebVitalsEventsAdaptiveGroups'];
const ALIASES = ['hours', 'referrers', 'paths', 'countries', 'devices', 'browsers', 'timings', 'vitals'];

let W;
const realFetch = globalThis.fetch;
const realCaches = globalThis.caches;
const realWarn = console.warn;
let calls;

const ok = (account) => new Response(JSON.stringify({ data: { viewer: { accounts: [account] } }, errors: null }), { status: 200 });
const settings = (limits) => ok({ settings: Object.fromEntries(DATASETS.map((d) => [d, { enabled: true, ...limits }])) });
const iso = (ms) => new Date(ms).toISOString().replace('.000', '');

/** A fake Cloudflare with exactly one visit and two page views in every hour of whatever window is asked for. */
function everyHour(limits) {
  return async (url, init) => {
    if (url !== 'https://api.cloudflare.com/client/v4/graphql') throw new Error(`unstubbed fetch ${url}`);
    const { query, variables } = JSON.parse(init.body);
    calls.push({ query, variables });
    if (query.startsWith('query Settings')) return settings(limits);
    const account = Object.fromEntries(ALIASES.map((a) => [a, []]));
    if (query.startsWith('query Overview')) {
      for (let t = Date.parse(variables.start); t < Date.parse(variables.end); t += 3600000) {
        account.hours.push({ count: 2, sum: { visits: 1 }, dimensions: { datetimeHour: iso(t) } });
      }
    }
    return ok(account);
  };
}

test.beforeAll(async () => { W = await import(path.join(ROOT, 'worker', 'src', 'index.js')); });
test.beforeEach(() => {
  calls = [];
  W.resetSettingsCache();
  console.warn = () => {};
  delete globalThis.caches;
  globalThis.fetch = async (url) => { throw new Error(`unstubbed fetch ${url}`); };
});
test.afterEach(() => {
  globalThis.fetch = realFetch;
  if (realCaches !== undefined) globalThis.caches = realCaches;
  console.warn = realWarn;
});

const request = (qs, { origin = ORIGIN, auth = PASSCODE, method = 'GET', pathname = '/v1/stats' } = {}) => new Request(`https://w.example${pathname}?${qs}`, {
  method, headers: { ...(origin ? { Origin: origin } : {}), ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
});
const run = (qs, opts, env = ENV) => W.handle(request(qs, opts), env, undefined, NOW);

const GENEROUS = { maxDuration: 400 * 86400, maxPageSize: 10000, notOlderThan: 400 * 86400 };

test('every tab x range answers the contract envelope with GMT+8 dates', async () => {
  globalThis.fetch = everyHour(GENEROUS);
  const keys = { overview: ['daily', 'previous', 'totals'], sources: ['groups', 'otherHosts'], pages: ['entries', 'pages'], audience: ['browsers', 'countries', 'devices'], performance: ['byDevice', 'vitals'] };
  const from = { 7: '2026-11-21', 30: '2026-10-29', 90: '2026-08-30' };
  for (const [tab, expected] of Object.entries(keys)) {
    for (const days of [7, 30, 90]) {
      const res = await run(`tab=${tab}&days=${days}`);
      expect(res.status, `${tab} ${days}`).toBe(200);
      const body = await res.json();
      expect(Object.keys(body).sort()).toEqual(['data', 'days', 'from', 'generatedAt', 'sampled', 'tab', 'to', 'tz', 'v']);
      expect(body).toMatchObject({ v: 1, tab, days, from: from[days], to: '2026-11-27', tz: '+08:00' });
      expect(Object.keys(body.data).sort()).toEqual(expected);
    }
  }
});

// Splitting must neither lose nor double count an hour, whatever limits Cloudflare reports.
for (const [name, limits] of [
  ['generous limits', GENEROUS],
  ['7-day maxDuration', { ...GENEROUS, maxDuration: 7 * 86400 }],
  ['100-row page (4-day pieces)', { ...GENEROUS, maxPageSize: 100 }],
]) {
  test(`one visit in every hour gives 24 per Malaysia day, no gap or overlap: ${name}`, async () => {
    globalThis.fetch = everyHour(limits);
    for (const days of [7, 30, 90]) {
      calls.length = 0;
      const body = await (await run(`tab=overview&days=${days}`)).json();
      expect(body.data.daily.length).toBe(days);
      for (const d of body.data.daily) expect(d, d.date).toMatchObject({ visits: 24, pageViews: 48 });
      expect(body.data.totals).toEqual({ visits: 24 * days, pageViews: 48 * days });
      expect(body.data.previous).toEqual({ visits: 24 * days, pageViews: 48 * days });
      for (const c of calls.filter((x) => x.variables.start)) {
        expect(c.variables.start).toMatch(/T16:00:00Z$/);
        expect(c.variables.end).toMatch(/T16:00:00Z$/);
        const limit = Number(/limit: (\d+)/.exec(c.query)[1]);
        expect((Date.parse(c.variables.end) - Date.parse(c.variables.start)) / 3600000).toBeLessThanOrEqual(limit);
      }
    }
  });
}

test('unknown paths, trailing slash and a passcode in the URL are refused without any Cloudflare call', async () => {
  for (const pathname of ['/', '/v1', '/v1/stats/', '/v2/stats', '/V1/STATS']) {
    expect((await run('tab=overview&days=7', { pathname })).status, pathname).toBe(404);
  }
  const res = await run(`tab=overview&days=7&passcode=${PASSCODE}`, { auth: null });
  expect(res.status).toBe(401);
  expect((await run(`tab=overview&days=7&passcode=${PASSCODE}`)).status).toBe(400);
  expect((await run('tab=overview&days=7', { method: 'HEAD' })).status).toBe(405);
});

// Stronger secret scan than a keyword + 37 characters: any value given to a secret name must be an obvious placeholder.
const SECRET_ASSIGN = /\b(CF_API_TOKEN|PASSCODE)\b\s*=\s*(["'])([^"'\n]*)\2|\b(CF_API_TOKEN|PASSCODE)=([^\s"'<$`]+)/g;
const suspicious = (text) => [...text.matchAll(SECRET_ASSIGN)].map((m) => m[3] ?? m[5]).filter((v) => v && !/^(your[-_ ]|<|TESTONLY|\.\.\.$)/i.test(v));
test('no secret name in worker/ is given a real-looking value (also 24 to 36 character passcodes)', () => {
  expect(suspicious('PASSCODE="Zq8vT2mLp0Xr5Wc9Ks1Nd4Hb"')).toHaveLength(1); // the scan itself works
  expect(suspicious('CF_API_TOKEN=abcdEFGH1234 node x.mjs')).toHaveLength(1);
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (['node_modules', '.wrangler', '.dev.vars', 'wrangler.toml'].includes(e.name) ? [] : e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  for (const f of walk(path.join(ROOT, 'worker'))) expect(suspicious(fs.readFileSync(f, 'utf8')), path.relative(ROOT, f)).toEqual([]);
});

test('README has the ten setup steps in order, the limits box and the dashboard search tip', () => {
  const readme = fs.readFileSync(path.join(ROOT, 'worker', 'README.md'), 'utf8');
  const setup = readme.slice(readme.indexOf('## Setup'), readme.indexOf("## What Cloudflare can't tell you"));
  expect([...setup.matchAll(/^(\d+)\. \*\*/gm)].map((m) => Number(m[1]))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (const s of ['CNAME', 'beacon token', 'site tag', 'js/site-config.js', 'Account ID', 'Create Custom Token', 'Account Analytics -> Read', 'only this account', 'expiry', '24 or more', 'wrangler login', 'wrangler.toml.example', 'ALLOWED_ORIGIN', 'js/admin/analytics-config.js', 'revoke']) expect(setup, s).toContain(s);
  expect(readme).toContain('search box');
  expect(readme).toContain('Page loads only');
});

test.describe('schema check script (stubbed Cloudflare)', () => {
  // A preload replaces fetch inside the child process, so the script never reaches the network.
  const runScript = (env, missingField = '') => {
    const preload = `
      globalThis.fetch = async (url, init) => {
        const { query, variables } = JSON.parse(init.body);
        const { EXPECTED_FIELDS: F } = await import(${JSON.stringify(`file://${path.join(ROOT, 'worker', 'src', 'index.js')}`)});
        const named = (name) => ({ name, args: [], type: { kind: 'OBJECT', name: 'T' } });
        const reply = (data) => new Response(JSON.stringify({ data }), { status: 200 });
        if (query.includes('__type')) {
          const n = variables.n;
          if (n === 'account') return reply({ __type: { fields: F.datasets.map((d) => ({ name: d, type: { kind: 'OBJECT', name: 'G:' + d }, args: [{ name: 'filter', type: { kind: 'INPUT_OBJECT', name: 'Filter' } }] })) } });
          if (n === 'Filter') return reply({ __type: { inputFields: F.filter.map((name) => ({ name })) } });
          const [kind, d] = n.split(':');
          if (kind === 'G') return reply({ __type: { fields: F[d].top.map((name) => ({ name, args: [], type: { kind: 'OBJECT', name: name + ':' + d } })) } });
          return reply({ __type: { fields: F[d][kind].filter((x) => x !== ${JSON.stringify(missingField)}).map(named) } });
        }
        if (query.includes('settings')) return reply({ viewer: { accounts: [{ settings: {} }] } });
        return reply({ viewer: { accounts: [{ hours: [] }] } });
      };`;
    return spawnSync(process.execPath, ['--import', `data:text/javascript,${encodeURIComponent(preload)}`, path.join(ROOT, 'worker', 'scripts', 'check-schema.mjs')],
      { env: { PATH: process.env.PATH, ...env }, encoding: 'utf8', timeout: 20000 });
  };
  const creds = { CF_API_TOKEN: TOKEN, ACCOUNT_ID: 'acc-test-1', SITE_TAG: 'site-test-1' };
  test('exit 2 without credentials', () => {
    expect(runScript({}).status).toBe(2);
  });
  test('all fields present: exit 0, no MISSING, token never printed', () => {
    const r = runScript(creds);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).not.toContain('MISSING');
    expect(r.stdout).toContain('Everything the Worker uses exists');
    expect(r.stdout + r.stderr).not.toContain(TOKEN);
  });
  test('a missing field: exit 1 and the field is named', () => {
    const r = runScript(creds, 'datetimeHour');
    expect(r.status, r.stderr).toBe(1);
    expect(r.stdout).toContain('MISSING rumPageloadEventsAdaptiveGroups.dimensions.datetimeHour');
  });
});

// ---------- bug re-tests (BUG-19, BUG-20, BUG-21) ----------
test('BUG-19: not-configured answers to the allowed origin carry CORS headers, so the admin can read them', async () => {
  for (const method of ['GET', 'OPTIONS']) {
    const res = await run('tab=overview&days=7', { method }, { ...ENV, PASSCODE: 'short' });
    expect(res.headers.get('Access-Control-Allow-Origin'), method).toBe(ORIGIN);
  }
});

test('BUG-20: an answer without the expected rows is 502 upstream, not a 200 full of zeros', async () => {
  globalThis.fetch = async (url, init) => (JSON.parse(init.body).query.startsWith('query Settings') ? settings(GENEROUS) : ok({ somethingElse: 1 }));
  for (const tab of ['overview', 'sources', 'pages', 'audience', 'performance']) {
    expect((await run(`tab=${tab}&days=7`)).status, tab).toBe(502);
  }
});

test('BUG-21: the 10 s timeout also covers a Cloudflare answer whose body stalls after the headers', async () => {
  // A local server stands in for Cloudflare and is called with the real fetch and the Worker's own abort signal.
  const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.write('{"data":'); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  globalThis.fetch = (url, init) => realFetch(`http://127.0.0.1:${server.address().port}/`, init);
  let timer;
  try {
    const outcome = await Promise.race([
      run('tab=sources&days=7', {}, { ...ENV, UPSTREAM_TIMEOUT_MS: '100' }).then((r) => r.status),
      new Promise((r) => { timer = setTimeout(() => r('still waiting after 3 s'), 3000); }),
    ]);
    expect(outcome).toBe(502);
  } finally {
    clearTimeout(timer);
    server.closeAllConnections();
    server.close();
  }
});

// ---------- QA re-test of the fixes in 58d511a ----------
test('BUG-19: bad config gives CORS to the allowed origin only, and never calls Cloudflare', async () => {
  const quiet = async (env, opts) => {
    const res = await run('tab=overview&days=7', opts, env);
    return [res.status, res.headers.get('Access-Control-Allow-Origin'), res.headers.get('Vary')];
  };
  for (const key of ['CF_API_TOKEN', 'ACCOUNT_ID', 'SITE_TAG', 'PASSCODE']) {
    const env = { ...ENV, [key]: '' };
    expect(await quiet(env, {}), key).toEqual([503, ORIGIN, 'Origin']);
    expect(await quiet(env, { auth: null }), key).toEqual([503, ORIGIN, 'Origin']);
    expect(await quiet(env, { method: 'OPTIONS', auth: null }), key).toEqual([204, ORIGIN, 'Origin']);
    for (const origin of ['https://evil.example', `${ORIGIN}.evil.example`, null]) {
      for (const method of ['GET', 'OPTIONS']) expect(await quiet(env, { origin, method }), `${key} ${origin} ${method}`).toEqual([503, null, null]);
    }
  }
  for (const bad of [undefined, '', '*', `${ORIGIN}/`, '<your origin>']) {
    for (const method of ['GET', 'OPTIONS']) {
      expect(await quiet({ ...ENV, ALLOWED_ORIGIN: bad }, { origin: bad || ORIGIN, method }), `${bad} ${method}`).toEqual([503, null, null]);
    }
  }
  expect(await (await run('tab=overview&days=7', {}, { ...ENV, PASSCODE: 'short' })).json()).toEqual({ error: 'not-configured' });
});

test('BUG-20: non-array rows (also only in the previous period) are 502 and never cached; empty arrays stay 200', async () => {
  const puts = [];
  globalThis.caches = { default: { async match() {}, async put(req) { puts.push(req.url); } } };
  for (const value of [null, {}, 'x', 0]) {
    globalThis.fetch = async (url, init) => (JSON.parse(init.body).query.startsWith('query Settings') ? settings(GENEROUS) : ok(Object.fromEntries(ALIASES.map((a) => [a, value]))));
    for (const tab of ['overview', 'sources', 'pages', 'audience', 'performance']) {
      const res = await run(`tab=${tab}&days=7`);
      expect([res.status, await res.json()], `${tab} ${JSON.stringify(value)}`).toEqual([502, { error: 'upstream' }]);
    }
  }
  globalThis.fetch = async (url, init) => {
    const { query, variables } = JSON.parse(init.body);
    if (query.startsWith('query Settings')) return settings(GENEROUS);
    return ok(variables.end === '2026-11-27T16:00:00Z' ? { hours: [] } : {}); // the previous period lacks the alias
  };
  expect((await run('tab=overview&days=7')).status).toBe(502);
  expect(puts).toEqual([]);
  globalThis.fetch = everyHour(GENEROUS);
  expect((await run('tab=sources&days=7')).status).toBe(200);
  expect(puts).toHaveLength(1);
});

// A guard only: this runs in Node and does NOT show that the Workers runtime accepts the module (BUG-22 stays open).
test('BUG-22 guard: the entry module exports no plain numbers or strings', () => {
  for (const [name, value] of Object.entries(W)) expect(['function', 'object'], name).toContain(typeof value);
  expect(typeof W.default.fetch).toBe('function');
});
