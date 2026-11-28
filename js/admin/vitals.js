// Core Web Vitals helpers for the admin Analytics Performance tab (TASK-35). Pure functions, no DOM.
// Thresholds are Google's published ones: "equal to the limit" counts as the better rating.
export const THRESHOLDS = Object.freeze({
  lcp: Object.freeze({ good: 2500, poor: 4000 }), // ms
  inp: Object.freeze({ good: 200, poor: 500 }), // ms
  cls: Object.freeze({ good: 0.1, poor: 0.25 }), // unitless
});

export const RATINGS = Object.freeze({ good: 'Good', mid: 'Needs improvement', poor: 'Poor', na: 'n/a' });

/** rateVital('lcp', 2500) -> 'good'; 2501 -> 'mid'; 4001 -> 'poor'; null / not a number -> 'na'. */
export function rateVital(kind, value) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return 'na';
  const t = THRESHOLDS[kind];
  if (!t) return 'na';
  const v = Number(value);
  if (v <= t.good) return 'good';
  if (v <= t.poor) return 'mid';
  return 'poor';
}

/** Milliseconds as text: under 1000 -> '950 ms', otherwise seconds with one decimal ('2.3 s'). null -> 'n/a'. */
export function formatMs(ms) {
  if (ms === null || ms === undefined || !Number.isFinite(Number(ms))) return 'n/a';
  const v = Number(ms);
  return v < 1000 ? `${Math.round(v)} ms` : `${(v / 1000).toFixed(1)} s`;
}

/** CLS with two decimals, no unit. null -> 'n/a'. */
export function formatCls(v) {
  return v === null || v === undefined || !Number.isFinite(Number(v)) ? 'n/a' : Number(v).toFixed(2);
}

/** Samples below this are marked as unreliable. */
export const FEW_SAMPLES = 20;
export const isFewSamples = (n) => !(Number(n) >= FEW_SAMPLES);

/** Threshold sentence shown under a vital: 'Good up to 2.5 s, poor above 4 s'. */
export function thresholdText(kind) {
  const t = THRESHOLDS[kind];
  if (kind === 'cls') return `Good up to ${t.good}, poor above ${t.poor}`;
  const word = (ms) => (ms < 1000 ? `${ms} ms` : `${ms / 1000} s`);
  return `Good up to ${word(t.good)}, poor above ${word(t.poor)}`;
}
