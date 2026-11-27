// Cloudflare Web Analytics beacon loader (TASK-30). Public pages only: no file under admin/ or storyboard/ loads this.
// The beacon is added only on the real site host, only when a beacon token is set, and never when this browser opted out.
// Everything is a no-op while `analytics.beaconToken` in js/site-config.js is still '' (placeholder).
import { SITE } from './site-config.js';

const BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';
export const OPT_OUT_KEY = 'puzzkezz.analytics.optout';

/** Pure: true only on the real site host, with a non-empty token, and when the opt-out value is not "1". */
export function shouldLoadBeacon({ hostname, siteHost, token, optOut } = {}) {
  if (typeof hostname !== 'string' || !hostname || hostname !== siteHost) return false;
  if (typeof token !== 'string' || !token.trim()) return false;
  if (optOut === '1') return false;
  return true;
}

/** localStorage that throws (blocked storage, private mode) counts as "not opted out". */
export function readOptOut(storage) {
  try {
    const store = storage === undefined ? globalThis.localStorage : storage;
    return store ? store.getItem(OPT_OUT_KEY) : null;
  } catch {
    return null;
  }
}

/** Adds one beacon <script> to <head> when allowed. Never adds a second one. Returns true when a beacon was added. */
export function loadBeacon({ hostname, siteHost, token, optOut, doc = document } = {}) {
  if (!shouldLoadBeacon({ hostname, siteHost, token, optOut })) return false;
  if (doc.querySelector('script[data-cf-beacon]')) return false;
  const script = doc.createElement('script');
  script.defer = true;
  script.src = BEACON_SRC;
  script.setAttribute('data-cf-beacon', JSON.stringify({ token: token.trim() }));
  doc.head.append(script);
  return true;
}

if (typeof document !== 'undefined' && typeof location !== 'undefined') {
  loadBeacon({
    hostname: location.hostname,
    siteHost: SITE.analytics.siteHost,
    token: SITE.analytics.beaconToken,
    optOut: readOptOut(),
  });
}
