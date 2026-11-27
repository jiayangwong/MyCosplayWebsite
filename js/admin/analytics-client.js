// Admin Analytics: passcode storage and the only request that carries it.
// The passcode lives only in this browser's localStorage, is sent only as an Authorization header to
// ANALYTICS.workerUrl + '/v1/stats', and is never put in a URL, the DOM, the console or an exported file.
import { ANALYTICS } from './analytics-config.js';

export const PASSCODE_KEY = 'puzzkezz.analytics.passcode';
export const OPTOUT_KEY = 'puzzkezz.analytics.optout';
export const MIN_PASSCODE = 24;
export const TABS = Object.freeze(['overview', 'sources', 'pages', 'audience', 'performance']);
export const RANGES = Object.freeze([7, 30, 90]);
const TIMEOUT_MS = 20000;

export const MESSAGES = Object.freeze({
  short: `The passcode is at least ${MIN_PASSCODE} characters. Paste the whole passcode.`,
  storage: 'This browser could not save the passcode (storage is full or blocked).',
  noPasscode: 'No passcode saved. Paste one above.',
  testOk: 'Passcode works. The Worker answered.',
});

function get(key) {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

export const readPasscode = () => get(PASSCODE_KEY);
export const hasPasscode = () => readPasscode() !== '';
export const isConfigured = () => typeof ANALYTICS.workerUrl === 'string' && ANALYTICS.workerUrl.trim() !== '';

/** Returns { passcode } or { error } with the text to show. Nothing is stored here. */
export function checkPasscode(raw) {
  const passcode = String(raw ?? '').trim();
  if (passcode.length < MIN_PASSCODE) return { error: MESSAGES.short };
  return { passcode };
}

/** Saves a usable passcode. Returns { ok: true } or { error }. A refused passcode is never stored. */
export function savePasscode(raw) {
  const r = checkPasscode(raw);
  if (r.error) return r;
  try {
    localStorage.setItem(PASSCODE_KEY, r.passcode);
  } catch {
    return { error: MESSAGES.storage };
  }
  return { ok: true };
}

export function forgetPasscode() {
  try {
    localStorage.removeItem(PASSCODE_KEY);
  } catch {
    // Storage blocked: there is nothing stored to use either.
  }
}

export function readOptOut() {
  return get(OPTOUT_KEY) === '1';
}

export function writeOptOut(on) {
  try {
    if (on) localStorage.setItem(OPTOUT_KEY, '1');
    else localStorage.removeItem(OPTOUT_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Joins the configured Worker origin and the stats path. Throws when nothing is configured. */
export function statsUrl(tab, days) {
  if (!isConfigured()) throw new Error('Analytics is not set up');
  if (!TABS.includes(tab) || !RANGES.includes(days)) throw new Error('Unknown tab or range');
  const base = ANALYTICS.workerUrl.trim().replace(/\/+$/, '');
  return `${base}/v1/stats?tab=${tab}&days=${days}`;
}

/**
 * The only place that sends the passcode. Resolves to { ok, status, body } (body = parsed JSON or null) for
 * any answer from the Worker. Rejects with an Error whose `kind` is 'network' (no answer, CORS failure,
 * 20 s timeout) or 'aborted' (the caller cancelled with `signal`).
 */
export async function analyticsFetch(tab, days, { signal, passcode = readPasscode() } = {}) {
  const url = statsUrl(tab, days);
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, TIMEOUT_MS);
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${passcode}`, Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return { ok: response.ok, status: response.status, body };
  } catch (cause) {
    const err = new Error('Analytics request failed');
    err.kind = signal && signal.aborted && !timedOut ? 'aborted' : 'network';
    throw err;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

// ---- Malaysia time helpers: plain arithmetic on the Worker's dates, never the browser's time zone ----
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-10-27' -> { y, m, d } (m = 1..12) or null. */
export function parseDay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
}

/** '2026-10-27' -> '27 Oct'. Never goes through Date. */
export function dayLabel(iso) {
  const p = parseDay(iso);
  return p && p.m >= 1 && p.m <= 12 ? `${p.d} ${MON[p.m - 1]}` : String(iso);
}

/** '27 Oct - 25 Nov 2026 (Malaysia time)' (both years when they differ). */
export function rangeLine(from, to) {
  const a = parseDay(from);
  const b = parseDay(to);
  if (!a || !b) return '(Malaysia time)';
  const left = a.y === b.y ? dayLabel(from) : `${dayLabel(from)} ${a.y}`;
  return `${left} - ${dayLabel(to)} ${b.y} (Malaysia time)`;
}
