// Cloudflare Worker (TASK-31): reads the site's Cloudflare Web Analytics numbers for the /admin/ Analytics panel.
// One endpoint: GET /v1/stats?tab=<overview|sources|pages|audience|performance>&days=<7|30|90>
// Days are GMT+8 (Malaysia) days. GMT+8 is a fixed offset (no daylight saving), so plain arithmetic is used:
// no time-zone database, no Intl. Cloudflare groups its own `date` by UTC, so this file never uses `date`;
// it asks for hourly rows and regroups the hours itself (see hoursToLocalDays).
// No npm dependencies. Secrets (CF_API_TOKEN, PASSCODE) come from the Worker environment, never from the repo.
//
// UNCONFIRMED Cloudflare field names are collected in EXPECTED_FIELDS below. They come from the planner's memory and
// third-party write-ups, NOT from Cloudflare's published docs (see worker/README.md "What was checked").
// Run `node scripts/check-schema.mjs` (needs your token) to compare them with your account's real schema.

export const TZ_OFFSET_MIN = 480; // GMT+8 (Malaysia), fixed
export const TZ_LABEL = '+08:00';
const DAY_MS = 86400000;
const HOUR_MS = 3600000;
const TABS = ['overview', 'sources', 'pages', 'audience', 'performance'];
const DAYS = [7, 30, 90];
const CACHE_SECONDS = 600;
const MIN_PASSCODE = 24;
const DEFAULT_TIMEOUT_MS = 10000;
const GRAPHQL_URL = 'https://api.cloudflare.com/client/v4/graphql';

// Fallbacks used only when the dataset's `settings` node cannot be read (names from Cloudflare's "Settings node" doc,
// but whether the rum datasets appear in it is unconfirmed).
const FALLBACK_CHUNK_DAYS = 7; // 7 x 24 = 168 hourly rows per query, far below any page size
const FALLBACK_MAX_PAGE_SIZE = 1000;
const FALLBACK_NOT_OLDER_THAN_S = 180 * 86400; // Web Analytics FAQ: "data for the previous six months"
const MAX_CHUNK_DAYS = 31;
const CATEGORY_LIMIT = 1000;
const SETTINGS_TTL_MS = 3600000;

/** Every Cloudflare field the Worker relies on. UNCONFIRMED (see header). Used by scripts/check-schema.mjs. */
export const EXPECTED_FIELDS = {
  datasets: ['rumPageloadEventsAdaptiveGroups', 'rumPerformanceEventsAdaptiveGroups', 'rumWebVitalsEventsAdaptiveGroups'],
  filter: ['siteTag', 'datetime_geq', 'datetime_lt'],
  rumPageloadEventsAdaptiveGroups: {
    top: ['count', 'sum', 'dimensions'],
    sum: ['visits'],
    dimensions: ['datetimeHour', 'refererHost', 'requestPath', 'countryName', 'deviceType', 'userAgentBrowser'],
  },
  rumPerformanceEventsAdaptiveGroups: {
    top: ['count', 'quantiles', 'dimensions'],
    quantiles: ['pageLoadTimeP50', 'firstContentfulPaintP75'],
    dimensions: ['deviceType'],
  },
  rumWebVitalsEventsAdaptiveGroups: {
    top: ['count', 'quantiles', 'sum', 'dimensions'],
    quantiles: ['largestContentfulPaintP75', 'interactionToNextPaintP75', 'cumulativeLayoutShiftP75'],
    sum: ['lcpGood', 'lcpNeedsImprovement', 'lcpPoor', 'inpGood', 'inpNeedsImprovement', 'inpPoor', 'clsGood', 'clsNeedsImprovement', 'clsPoor'],
    dimensions: ['deviceType'],
  },
};

// ---------- Fixed GraphQL documents (variables only; `__LIMIT__` is replaced by a number the Worker computed) ----------
const VARS = '$accountTag: string!, $siteTag: string!, $start: Time!, $end: Time!';
const FILTER = '{ siteTag: $siteTag, datetime_geq: $start, datetime_lt: $end }';
const ORDER = 'orderBy: [count_DESC]';

export const QUERIES = {
  settings: `query Settings($accountTag: string!) { viewer { accounts(filter: { accountTag: $accountTag }) { settings {
    rumPageloadEventsAdaptiveGroups { enabled maxDuration maxPageSize notOlderThan }
    rumPerformanceEventsAdaptiveGroups { enabled maxDuration maxPageSize notOlderThan }
    rumWebVitalsEventsAdaptiveGroups { enabled maxDuration maxPageSize notOlderThan }
  } } } }`,
  overview: `query Overview(${VARS}) { viewer { accounts(filter: { accountTag: $accountTag }) {
    hours: rumPageloadEventsAdaptiveGroups(filter: ${FILTER}, limit: __LIMIT__) { count sum { visits } dimensions { datetimeHour } }
  } } }`,
  sources: `query Sources(${VARS}) { viewer { accounts(filter: { accountTag: $accountTag }) {
    referrers: rumPageloadEventsAdaptiveGroups(filter: ${FILTER}, limit: __LIMIT__, ${ORDER}) { sum { visits } dimensions { refererHost } }
  } } }`,
  pages: `query Pages(${VARS}) { viewer { accounts(filter: { accountTag: $accountTag }) {
    paths: rumPageloadEventsAdaptiveGroups(filter: ${FILTER}, limit: __LIMIT__, ${ORDER}) { count sum { visits } dimensions { requestPath } }
  } } }`,
  audience: `query Audience(${VARS}) { viewer { accounts(filter: { accountTag: $accountTag }) {
    countries: rumPageloadEventsAdaptiveGroups(filter: ${FILTER}, limit: __LIMIT__, ${ORDER}) { sum { visits } dimensions { countryName } }
    devices: rumPageloadEventsAdaptiveGroups(filter: ${FILTER}, limit: __LIMIT__, ${ORDER}) { sum { visits } dimensions { deviceType } }
    browsers: rumPageloadEventsAdaptiveGroups(filter: ${FILTER}, limit: __LIMIT__, ${ORDER}) { sum { visits } dimensions { userAgentBrowser } }
  } } }`,
  performance: `query Performance(${VARS}) { viewer { accounts(filter: { accountTag: $accountTag }) {
    timings: rumPerformanceEventsAdaptiveGroups(filter: ${FILTER}, limit: __LIMIT__, ${ORDER}) { count quantiles { pageLoadTimeP50 firstContentfulPaintP75 } dimensions { deviceType } }
    vitals: rumWebVitalsEventsAdaptiveGroups(filter: ${FILTER}, limit: __LIMIT__, ${ORDER}) { count quantiles { largestContentfulPaintP75 interactionToNextPaintP75 cumulativeLayoutShiftP75 } sum { lcpGood lcpNeedsImprovement lcpPoor inpGood inpNeedsImprovement inpPoor clsGood clsNeedsImprovement clsPoor } dimensions { deviceType } }
  } } }`,
};
// Which dataset limits apply to which tab.
const TAB_DATASETS = {
  overview: ['rumPageloadEventsAdaptiveGroups'],
  sources: ['rumPageloadEventsAdaptiveGroups'],
  pages: ['rumPageloadEventsAdaptiveGroups'],
  audience: ['rumPageloadEventsAdaptiveGroups'],
  performance: ['rumPerformanceEventsAdaptiveGroups', 'rumWebVitalsEventsAdaptiveGroups'],
};

// ---------- Pure date helpers (GMT+8 days) ----------
const pad = (n) => String(n).padStart(2, '0');
export function isoDate(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
const dateMs = (date) => Date.parse(`${date}T00:00:00Z`);
export function addDays(date, n) { return isoDate(dateMs(date) + n * DAY_MS); }
/** Start instant (UTC, inclusive) of GMT+8 day `date`: the day before at 16:00:00Z. */
export function dayStartInstant(date) { return `${addDays(date, -1)}T16:00:00Z`; }
/** End instant (UTC, exclusive) of GMT+8 day `date`: that date at 16:00:00Z. */
export function dayEndInstant(date) { return `${date}T16:00:00Z`; }

/** Range of `days` complete GMT+8 days ending yesterday (Malaysia time), plus the same-length previous period. */
export function localRange(now, days) {
  const nowMs = typeof now === 'number' ? now : new Date(now).getTime();
  const today = isoDate(nowMs + TZ_OFFSET_MIN * 60000); // date in Malaysia right now
  const to = addDays(today, -1);
  const from = addDays(to, -(days - 1));
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(days - 1));
  const span = (f, t) => ({ from: f, to: t, start: dayStartInstant(f), end: dayEndInstant(t) });
  return { days, tz: TZ_LABEL, ...span(from, to), previous: span(prevFrom, prevTo) };
}

/** Every GMT+8 date from..to inclusive. */
export function listDates(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** GMT+8 date of an hourly instant (hour start + 8 h, UTC date). null when the instant cannot be parsed. */
export function localDateOfHour(hour) {
  const ms = typeof hour === 'number' ? hour : Date.parse(hour);
  if (!Number.isFinite(ms)) return null;
  return isoDate(ms + TZ_OFFSET_MIN * 60000);
}

/** Put values from a date-keyed map into a list covering every date (0 for missing days). */
export function fillDays(byDate, from, to, zero = { visits: 0, pageViews: 0 }) {
  return listDates(from, to).map((date) => ({ date, ...zero, ...(byDate[date] || {}) }));
}

/** Regroup hourly rows [{ hour, visits, pageViews }] into GMT+8 days. Hours outside from..to are ignored. */
export function hoursToLocalDays(rows, from, to) {
  const byDate = {};
  for (const row of rows || []) {
    const date = localDateOfHour(row.hour);
    if (!date || date < from || date > to) continue;
    const slot = byDate[date] || (byDate[date] = { visits: 0, pageViews: 0 });
    slot.visits += num(row.visits);
    slot.pageViews += num(row.pageViews);
  }
  return fillDays(byDate, from, to);
}

/** Split from..to into pieces of at most `chunkDays` GMT+8 days (on day boundaries). */
export function splitRange(from, to, chunkDays) {
  const size = Math.max(1, Math.floor(chunkDays));
  const dates = listDates(from, to);
  const out = [];
  for (let i = 0; i < dates.length; i += size) {
    const f = dates[i];
    const t = dates[Math.min(i + size, dates.length) - 1];
    out.push({ from: f, to: t, start: dayStartInstant(f), end: dayEndInstant(t) });
  }
  return out;
}

// ---------- Pure shaping helpers ----------
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function numOrNull(v) { return v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v); }

const PAGE_LABELS = {
  '/': 'Home', '/index': 'Home', '/gallery': 'Gallery', '/reels': 'Reels', '/events': 'Events', '/about': 'About', '/contact': 'Contact',
};
export const NOT_FOUND_PATH = '/404';
/** { path, label } for a request path: `/` and `/index.html` are Home, the 6 pages get their tab names, the rest is Not found. */
export function labelPath(rawPath) {
  let p = String(rawPath ?? '').split(/[?#]/)[0].trim().toLowerCase();
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.replace(/\.html$/, '').replace(/\/+$/, '') || '/';
  if (PAGE_LABELS[p]) {
    const canon = p === '/index' ? '/' : p;
    return { path: canon === '/' ? '/' : `${canon}.html`, label: PAGE_LABELS[p] };
  }
  return { path: NOT_FOUND_PATH, label: 'Not found (404)' };
}

const GROUP_LABELS = { instagram: 'Instagram', facebook: 'Facebook', google: 'Google', direct: 'Direct / unknown', other: 'Other' };
const GROUP_ORDER = ['instagram', 'facebook', 'google', 'direct', 'other'];
/** Referrer host -> group key, or null for the site's own host (not a source). */
export function groupReferrer(host, ownHost = '') {
  const h = String(host ?? '').trim().toLowerCase().replace(/\.$/, '');
  if (!h) return 'direct';
  const strip = (x) => String(x || '').toLowerCase().replace(/^www\./, '');
  if (ownHost && strip(h) === strip(ownHost)) return null;
  if (h === 'instagram.com' || h.endsWith('.instagram.com')) return 'instagram';
  if (h === 'facebook.com' || h.endsWith('.facebook.com')) return 'facebook';
  if (/^(www\.)?google\.[a-z]{2,}(\.[a-z]{2})?$/.test(h)) return 'google';
  return 'other';
}

/** Top `n` entries by `key`, the rest summed into one entry with `otherLabel`. Stable for equal values. */
export function topN(items, n, nameKey = 'name', valueKey = 'visits', otherLabel = 'Other') {
  const sorted = items.map((x, i) => [x, i]).sort((a, b) => num(b[0][valueKey]) - num(a[0][valueKey]) || a[1] - b[1]).map((x) => x[0]);
  const head = sorted.slice(0, n);
  const rest = sorted.slice(n);
  if (rest.length) head.push({ [nameKey]: otherLabel, [valueKey]: rest.reduce((s, x) => s + num(x[valueKey]), 0) });
  return head;
}

const sumByKey = (rows, keyFn, valueFn) => {
  const map = new Map();
  for (const r of rows) { const k = keyFn(r); map.set(k, (map.get(k) || 0) + valueFn(r)); }
  return map;
};

export function shapeOverview(hourRows, prevHourRows, range) {
  const daily = hoursToLocalDays(hourRows, range.from, range.to);
  const total = (list) => list.reduce((a, d) => ({ visits: a.visits + d.visits, pageViews: a.pageViews + d.pageViews }), { visits: 0, pageViews: 0 });
  let previous = null;
  let previousDaily = null;
  if (prevHourRows) {
    previousDaily = hoursToLocalDays(prevHourRows, range.previous.from, range.previous.to);
    previous = total(previousDaily);
  }
  return { daily, totals: total(daily), previous, previousDaily };
}

export function shapeSources(rows, ownHost) {
  const visits = Object.fromEntries(GROUP_ORDER.map((k) => [k, 0]));
  const other = new Map();
  for (const r of rows) {
    const host = String(r.host ?? '').trim().toLowerCase();
    const key = groupReferrer(host, ownHost);
    if (key === null) continue;
    visits[key] += num(r.visits);
    if (key === 'other') other.set(host, (other.get(host) || 0) + num(r.visits));
  }
  const otherHosts = [...other.entries()].map(([host, v]) => ({ host, visits: v })).sort((a, b) => b.visits - a.visits || (a.host < b.host ? -1 : 1)).slice(0, 5);
  return { groups: GROUP_ORDER.map((key) => ({ key, label: GROUP_LABELS[key], visits: visits[key] })), otherHosts };
}

export function shapePages(rows) {
  const pv = new Map(); const en = new Map(); const labels = new Map();
  for (const r of rows) {
    const { path, label } = labelPath(r.path);
    labels.set(path, label);
    pv.set(path, (pv.get(path) || 0) + num(r.pageViews));
    en.set(path, (en.get(path) || 0) + num(r.visits));
  }
  const list = (map, field) => [...map.entries()].map(([path, v]) => ({ path, label: labels.get(path), [field]: v })).sort((a, b) => b[field] - a[field] || (a.path < b.path ? -1 : 1));
  return { pages: list(pv, 'pageViews'), entries: list(en, 'visits') };
}

const cleanName = (v) => (String(v ?? '').trim() || 'Unknown');
export function shapeAudience(parts) {
  const named = (rows, key) => [...sumByKey(rows, (r) => cleanName(r[key]), (r) => num(r.visits)).entries()].map(([name, visits]) => ({ name, visits }));
  const types = new Map();
  for (const r of parts.devices) {
    const t = ['mobile', 'desktop', 'tablet'].includes(String(r.type).toLowerCase()) ? String(r.type).toLowerCase() : 'other';
    types.set(t, (types.get(t) || 0) + num(r.visits));
  }
  const devices = ['mobile', 'desktop', 'tablet', 'other'].filter((t) => types.has(t)).map((type) => ({ type, visits: types.get(type) }));
  return { countries: topN(named(parts.countries, 'name'), 10), devices, browsers: topN(named(parts.browsers, 'name'), 6) };
}

const emptyDevice = () => ({ samples: 0, pageLoadP50Ms: null, fcpP75Ms: null, lcpP75Ms: null, inpP75Ms: null, clsP75: null });
const emptyVital = () => ({ good: null, needsImprovement: null, poor: null });
/** Count-weighted average of nullable values (an approximation when a range had to be split into several queries). */
function weighted(pairs) {
  let w = 0; let s = 0;
  for (const [v, c] of pairs) { if (v === null || v === undefined || !Number.isFinite(Number(v))) continue; const wt = Math.max(num(c), 1); w += wt; s += Number(v) * wt; }
  return w ? s / w : null;
}
const roundOrNull = (v, d = 0) => (v === null ? null : Number(v.toFixed(d)));
const devType = (t) => (['mobile', 'desktop', 'tablet'].includes(String(t).toLowerCase()) ? String(t).toLowerCase() : 'other');

/** timings: [{ type, count, pageLoadP50, fcpP75 }], vitals: [{ type, count, lcpP75, inpP75, clsP75, ratings: { lcpGood, ... } }] */
export function shapePerformance(timings, vitals) {
  const byDevice = { mobile: emptyDevice(), desktop: emptyDevice() };
  const groups = {};
  const add = (type, field, v, c) => { ((groups[type] ||= {})[field] ||= []).push([v, c]); };
  for (const r of timings) {
    const t = devType(r.type);
    byDevice[t] ||= emptyDevice();
    byDevice[t].samples += num(r.count);
    add(t, 'pageLoadP50Ms', numOrNull(r.pageLoadP50), r.count);
    add(t, 'fcpP75Ms', numOrNull(r.fcpP75), r.count);
  }
  for (const r of vitals) {
    const t = devType(r.type);
    byDevice[t] ||= emptyDevice();
    add(t, 'lcpP75Ms', numOrNull(r.lcpP75), r.count);
    add(t, 'inpP75Ms', numOrNull(r.inpP75), r.count);
    add(t, 'clsP75', numOrNull(r.clsP75), r.count);
  }
  for (const [t, fields] of Object.entries(groups)) {
    for (const [f, pairs] of Object.entries(fields)) byDevice[t][f] = roundOrNull(weighted(pairs), f === 'clsP75' ? 3 : 0);
  }
  const out = { lcp: emptyVital(), inp: emptyVital(), cls: emptyVital() };
  for (const r of vitals) {
    for (const metric of ['lcp', 'inp', 'cls']) {
      for (const [bucket, suffix] of [['good', 'Good'], ['needsImprovement', 'NeedsImprovement'], ['poor', 'Poor']]) {
        const v = numOrNull(r.ratings?.[`${metric}${suffix}`]);
        if (v === null) continue;
        out[metric][bucket] = (out[metric][bucket] || 0) + v;
      }
    }
  }
  return { byDevice, vitals: out };
}

// ---------- Security helpers ----------
const encoder = new TextEncoder();
async function sha256(text) { return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text))); }
/** Constant-time string compare: both sides are hashed to 32 bytes first, so length does not leak. */
export async function constantTimeEqual(a, b) {
  const [x, y] = await Promise.all([sha256(String(a)), sha256(String(b))]);
  if (typeof crypto.subtle.timingSafeEqual === 'function') return crypto.subtle.timingSafeEqual(x, y);
  let diff = x.length ^ y.length;
  for (let i = 0; i < x.length; i += 1) diff |= x[i] ^ (y[i] ?? 0);
  return diff === 0;
}

const isPlaceholder = (v) => typeof v !== 'string' || !v.trim() || /^your[-_ ]/i.test(v.trim()) || /^<.*>$/.test(v.trim());
/** null when the Worker is configured, otherwise a short reason for the log (never shown to the browser). */
export function configProblem(env) {
  for (const k of ['CF_API_TOKEN', 'ACCOUNT_ID', 'SITE_TAG']) if (isPlaceholder(env?.[k])) return `missing ${k}`;
  if (typeof env.PASSCODE !== 'string' || env.PASSCODE.length < MIN_PASSCODE) return 'weak PASSCODE';
  if (isPlaceholder(env.ALLOWED_ORIGIN) || !/^https?:\/\/[^/\s]+$/.test(env.ALLOWED_ORIGIN)) return 'bad ALLOWED_ORIGIN';
  return null;
}

// ---------- Responses ----------
function corsHeaders(origin) {
  return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
}
function json(status, body, origin, extra = {}) {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra };
  if (origin) Object.assign(headers, corsHeaders(origin));
  return new Response(JSON.stringify(body), { status, headers });
}

class UpstreamError extends Error {
  constructor(code, extra = {}) { super(code); this.code = code; this.extra = extra; }
}

// ---------- Cloudflare GraphQL ----------
async function graphql(env, doc, variables) {
  const timeoutMs = Number(env.UPSTREAM_TIMEOUT_MS) > 0 ? Number(env.UPSTREAM_TIMEOUT_MS) : DEFAULT_TIMEOUT_MS;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: doc, variables }),
      signal: ctl.signal,
    });
  } catch {
    throw new UpstreamError('network');
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 429) {
    const ra = Number(res.headers.get('Retry-After'));
    throw new UpstreamError('busy', { retryAfter: Number.isFinite(ra) && ra > 0 ? Math.min(Math.ceil(ra), 3600) : 60 });
  }
  if (!res.ok) throw new UpstreamError(`http-${res.status}`);
  let body;
  try { body = await res.json(); } catch { throw new UpstreamError('bad-json'); }
  if (!body || (Array.isArray(body.errors) && body.errors.length)) throw new UpstreamError('graphql-errors');
  const account = body.data?.viewer?.accounts?.[0];
  if (!account || typeof account !== 'object') throw new UpstreamError('no-account');
  return account;
}

const settingsCache = new Map();
export function resetSettingsCache() { settingsCache.clear(); }
/** Per-dataset limits from Cloudflare's settings node; falls back to safe defaults when they cannot be read. */
async function readSettings(env, now) {
  const hit = settingsCache.get(env.ACCOUNT_ID);
  if (hit && now - hit.at < SETTINGS_TTL_MS) return hit.value;
  let value = {};
  try {
    const account = await graphql(env, QUERIES.settings, { accountTag: env.ACCOUNT_ID });
    value = account.settings && typeof account.settings === 'object' ? account.settings : {};
  } catch (e) {
    if (e instanceof UpstreamError && e.code === 'busy') throw e;
    value = {}; // unreadable: defaults below, and the real query will report a real problem
  }
  settingsCache.set(env.ACCOUNT_ID, { at: now, value });
  return value;
}

function limitsFor(settings, tab) {
  let maxDurationS = Infinity; let maxPage = Infinity; let notOlder = Infinity;
  for (const name of TAB_DATASETS[tab]) {
    const s = settings?.[name];
    if (!s) continue;
    if (s.enabled === false) throw new UpstreamError('dataset-disabled');
    if (Number(s.maxDuration) > 0) { maxDurationS = Math.min(maxDurationS, Number(s.maxDuration)); }
    if (Number(s.maxPageSize) > 0) maxPage = Math.min(maxPage, Number(s.maxPageSize));
    if (Number(s.notOlderThan) > 0) notOlder = Math.min(notOlder, Number(s.notOlderThan));
  }
  // Chunk length: the dataset's maxDuration when known (else 7 days), at most 31 days; the hourly tab also keeps
  // 24 rows per day inside one page of rows.
  const chunkByDuration = Number.isFinite(maxDurationS) ? Math.max(1, Math.floor(maxDurationS / 86400)) : FALLBACK_CHUNK_DAYS;
  const pageSize = Number.isFinite(maxPage) ? maxPage : FALLBACK_MAX_PAGE_SIZE;
  const chunkByRows = Math.max(1, Math.floor(pageSize / 24));
  return {
    chunkDays: Math.min(MAX_CHUNK_DAYS, chunkByDuration, tab === 'overview' ? chunkByRows : MAX_CHUNK_DAYS),
    limit: tab === 'overview' ? Math.min(pageSize, 10000) : Math.min(pageSize, CATEGORY_LIMIT),
    notOlderThanS: Number.isFinite(notOlder) ? notOlder : FALLBACK_NOT_OLDER_THAN_S,
  };
}

/** Run one tab's query over every chunk (max 4 at a time) and return the list of `account` answers. */
async function runChunks(env, tab, span, lim) {
  const doc = QUERIES[tab].replaceAll('__LIMIT__', String(Math.max(1, Math.floor(lim.limit))));
  const chunks = splitRange(span.from, span.to, lim.chunkDays);
  const answers = [];
  for (let i = 0; i < chunks.length; i += 4) {
    const batch = chunks.slice(i, i + 4);
    answers.push(...await Promise.all(batch.map((c) => graphql(env, doc, { accountTag: env.ACCOUNT_ID, siteTag: env.SITE_TAG, start: c.start, end: c.end }))));
  }
  return answers;
}

const list = (v) => (Array.isArray(v) ? v : []);
const dim = (row, key) => row?.dimensions?.[key];
const collect = (answers, alias) => answers.flatMap((a) => list(a[alias]));

async function buildData(env, tab, range, lim) {
  const own = (() => { try { return new URL(env.ALLOWED_ORIGIN).hostname; } catch { return ''; } })();
  const current = { from: range.from, to: range.to };
  const mainAnswers = await runChunks(env, tab, current, lim);
  switch (tab) {
    case 'overview': {
      const toHours = (answers) => collect(answers, 'hours').map((r) => ({ hour: dim(r, 'datetimeHour'), visits: r?.sum?.visits, pageViews: r?.count }));
      let prev = null;
      const oldest = Date.parse(range.previous.start);
      if (lim.nowMs - oldest <= lim.notOlderThanS * 1000) { // older than Cloudflare keeps -> previous stays null
        prev = toHours(await runChunks(env, tab, range.previous, lim));
      }
      return shapeOverview(toHours(mainAnswers), prev, range);
    }
    case 'sources':
      return shapeSources(collect(mainAnswers, 'referrers').map((r) => ({ host: dim(r, 'refererHost'), visits: r?.sum?.visits })), own);
    case 'pages':
      return shapePages(collect(mainAnswers, 'paths').map((r) => ({ path: dim(r, 'requestPath'), pageViews: r?.count, visits: r?.sum?.visits })));
    case 'audience': {
      const rows = (alias, key, as) => collect(mainAnswers, alias).map((r) => ({ [as]: dim(r, key), visits: r?.sum?.visits }));
      return shapeAudience({ countries: rows('countries', 'countryName', 'name'), devices: rows('devices', 'deviceType', 'type'), browsers: rows('browsers', 'userAgentBrowser', 'name') });
    }
    default: // performance
      return shapePerformance(
        collect(mainAnswers, 'timings').map((r) => ({ type: dim(r, 'deviceType'), count: r?.count, pageLoadP50: r?.quantiles?.pageLoadTimeP50, fcpP75: r?.quantiles?.firstContentfulPaintP75 })),
        collect(mainAnswers, 'vitals').map((r) => ({
          type: dim(r, 'deviceType'), count: r?.count, lcpP75: r?.quantiles?.largestContentfulPaintP75, inpP75: r?.quantiles?.interactionToNextPaintP75, clsP75: r?.quantiles?.cumulativeLayoutShiftP75, ratings: r?.sum,
        })),
      );
  }
}

// ---------- Request handling ----------
const CACHE_HOST = 'https://analytics-cache.invalid';
function cacheStore() { try { return globalThis.caches?.default || null; } catch { return null; } }

export async function handle(request, env, ctx, nowMs = Date.now()) {
  const url = new URL(request.url);
  if (url.pathname !== '/v1/stats') return json(404, { error: 'not-found' });
  if (request.method !== 'GET' && request.method !== 'OPTIONS') return json(405, { error: 'method' }, null, { Allow: 'GET, OPTIONS' });

  const bad = configProblem(env || {});
  const origin = request.headers.get('Origin');
  if (bad) {
    console.warn(`not-configured: ${bad}`);
    return json(503, { error: 'not-configured' });
  }
  if (!origin || origin !== env.ALLOWED_ORIGIN) return json(403, { error: 'origin' });

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { ...corsHeaders(origin), 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Allow-Headers': 'Authorization', 'Access-Control-Max-Age': '600' },
    });
  }

  // Passcode first: before the allowlist details, the cache and any Cloudflare call.
  const auth = request.headers.get('Authorization') || '';
  const m = /^Bearer (.+)$/.exec(auth);
  if (!m || !(await constantTimeEqual(m[1], env.PASSCODE))) return json(401, { error: 'passcode' }, origin);

  const keys = [...url.searchParams.keys()];
  const tab = url.searchParams.get('tab');
  const days = Number(url.searchParams.get('days'));
  if (keys.length !== 2 || new Set(keys).size !== 2 || !TABS.includes(tab) || url.searchParams.get('days') !== String(days) || !DAYS.includes(days)) {
    return json(400, { error: 'bad-request' }, origin);
  }

  const range = localRange(nowMs, days);
  const cache = cacheStore();
  const cacheKey = new Request(`${CACHE_HOST}/v1/stats?tab=${tab}&days=${days}&from=${range.from}&to=${range.to}`);
  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) return json(200, await hit.json(), origin);
  }

  try {
    const settings = await readSettings(env, nowMs);
    const lim = { ...limitsFor(settings, tab), nowMs };
    if (nowMs - Date.parse(range.start) > lim.notOlderThanS * 1000) throw new UpstreamError('range-unavailable');
    const data = await buildData(env, tab, range, lim);
    const body = {
      v: 1, tab, days, from: range.from, to: range.to, tz: TZ_LABEL, sampled: true,
      generatedAt: new Date(nowMs).toISOString().replace(/\.\d{3}Z$/, 'Z'), data,
    };
    if (cache) {
      const put = cache.put(cacheKey, new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${CACHE_SECONDS}` } }));
      if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(put); else await put;
    }
    return json(200, body, origin);
  } catch (e) {
    const code = e instanceof UpstreamError ? e.code : 'internal';
    console.warn(`upstream: ${code}`); // short code only: never the token, passcode or Cloudflare's text
    if (code === 'busy') return json(429, { error: 'busy', retryAfter: e.extra.retryAfter }, origin);
    if (code === 'range-unavailable') return json(502, { error: 'upstream', code: 'range-unavailable' }, origin);
    return json(502, { error: 'upstream' }, origin);
  }
}

export default {
  fetch(request, env, ctx) {
    return handle(request, env, ctx);
  },
};
