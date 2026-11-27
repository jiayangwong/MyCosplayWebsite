// Admin Analytics panel (IDEA-17, TASK-32): tabs, range switch, passcode, loading on demand, states.
// Numbers come from the Cloudflare Worker (worker/, TASK-31) through analytics-client.js. Every label that
// came from the Worker is set with textContent, never innerHTML. Nothing is fetched until the panel is open.
import {
  TABS, MESSAGES, analyticsFetch, hasPasscode, isConfigured, readOptOut, rangeLine, savePasscode,
  forgetPasscode, writeOptOut, dayLabel, fullDayLabel, malaysiaClock,
} from './analytics-client.js';
import { lineChart, barChart, stackedBar, patternSwatch, numberTable, formatNumber } from './charts.js';
import { rateVital, formatMs, formatCls, isFewSamples, thresholdText, RATINGS } from './vitals.js';

const $ = (id) => document.getElementById(id);

/** Tab renderers: tab -> (mount, answer, ctx). Each draws only its own blocks; the range line is added before. */
export const RENDERERS = {};
const charts = []; // live charts of the shown tab (their resize observers are released on the next paint)

const S = {
  tab: 'overview',
  days: 30,
  answers: new Map(), // 'tab|days' -> the Worker's answer, kept for the page session
  errors: new Map(), // 'tab|days' -> the explained error shown for it
  ctl: null, // AbortController of the one request in flight
  seq: 0,
  loadingKey: '',
  r90off: false,
  open: false,
  compare: false, // the Overview "Compare with previous period" switch, page session only
};

const keyOf = (tab = S.tab, days = S.days) => `${tab}|${days}`;
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

// ---------------------------------------------------------------- answers -> states
function minutes(seconds) {
  const n = Math.max(1, Math.ceil((Number(seconds) || 60) / 60));
  return `${n} ${n === 1 ? 'minute' : 'minutes'}`;
}

/** Turns a client result into { kind, text, next, retry, role } for the state box. */
export function explain(res) {
  if (!res) return { kind: 'network', text: 'Could not load the numbers. Check your connection, the Worker address and ALLOWED_ORIGIN.', next: 'Nothing was changed. See worker/README.md.', retry: true };
  const code = res.body && res.body.error;
  if (res.status === 401) return { kind: 'passcode', text: 'Passcode is wrong. Paste the current one.', next: 'It is kept in this browser until you press Forget passcode.', retry: true };
  if (res.status === 429) return { kind: 'busy', text: `Cloudflare is busy. Try again in ${minutes(res.body && res.body.retryAfter)}.`, next: 'Your passcode is fine.', retry: true };
  if (res.status === 403) return { kind: 'origin', text: 'This page is not allowed to read the numbers (check ALLOWED_ORIGIN in the Worker).', next: 'See worker/README.md.', retry: false };
  if (res.status === 503) return { kind: 'config', text: 'The Worker is missing a setting. See worker/README.md.', next: '', retry: true };
  if (res.status === 502 && res.body && res.body.code === 'range-unavailable') return { kind: 'range', text: 'Cloudflare does not keep data that far back.', next: '', retry: false };
  if (code === 'bad-request' || res.status === 400) return { kind: 'bad', text: 'Could not load the numbers. Try again.', next: 'The Worker did not understand the request.', retry: true };
  return { kind: 'upstream', text: 'Could not load the numbers. Try again.', next: 'Your passcode is fine.', retry: true };
}

/** True when an answer holds no visits at all (the empty state is shown instead of an empty chart). */
export function isEmpty(tab, data) {
  if (!data) return true;
  const any = (list, key) => Array.isArray(list) && list.some((x) => Number(x && x[key]) > 0);
  switch (tab) {
    case 'overview': return !(Number(data.totals && data.totals.visits) > 0 || Number(data.totals && data.totals.pageViews) > 0);
    case 'sources': return !any(data.groups, 'visits');
    case 'pages': return !(any(data.pages, 'pageViews') || any(data.entries, 'visits'));
    case 'audience': return !(any(data.devices, 'visits') || any(data.countries, 'visits') || any(data.browsers, 'visits'));
    case 'performance': {
      const dev = data.byDevice || {};
      return !Object.values(dev).some((d) => d && Number(d.samples) > 0);
    }
    default: return false;
  }
}

// ---------------------------------------------------------------- view
function setChip(text, state) {
  const chip = $('an-chip');
  chip.textContent = text;
  if (state) chip.dataset.s = state;
  else chip.removeAttribute('data-s');
}

function mode() {
  if (!isConfigured()) return 'notset';
  if (!hasPasscode()) return 'nopass';
  return 'ready';
}

function updateChip() {
  const m = mode();
  if (m === 'notset') return setChip('Not set up', '');
  if (m === 'nopass') return setChip('No passcode', '');
  if (S.errors.has(keyOf())) return setChip('Error', 'err');
  return setChip(`Last ${S.days} days`, 'ok');
}

function syncPasscodeBlock() {
  const saved = hasPasscode();
  $('an-pass-field').hidden = saved;
  $('an-saved').hidden = !saved;
  $('an-save').hidden = saved;
  $('an-test').disabled = !saved;
  $('an-forget').disabled = !saved;
  $('an-test').hidden = !saved;
  $('an-forget').hidden = !saved;
  $('an-pass-actions').hidden = false;
}

function layout() {
  const m = mode();
  $('an-notset').hidden = m !== 'notset';
  $('an-pass-block').hidden = m === 'notset';
  $('an-npmsg').hidden = m !== 'nopass';
  const ready = m === 'ready';
  $('an-ctl').hidden = !ready;
  $('an-tps').hidden = !ready;
  syncPasscodeBlock();
  if (m === 'nopass' && !$('an-pass-status').textContent) $('an-pass-status').textContent = MESSAGES.noPasscode;
  $('an-r90').hidden = !(ready && S.r90off);
  const r90 = document.querySelector('#an-range input[value="90"]');
  r90.disabled = S.r90off;
  r90.closest('label').classList.toggle('is-off', S.r90off);
  if (S.r90off) r90.closest('label').setAttribute('aria-disabled', 'true');
  else r90.closest('label').removeAttribute('aria-disabled');
  document.querySelectorAll('#an-range input').forEach((i) => { i.checked = Number(i.value) === S.days; });
  updateChip();
}

/** Settings opens by itself (never closes by itself): not set up, no passcode, wrong passcode. */
function openSettings() {
  const d = $('an-settings');
  if (d && !d.open) d.open = true;
}

function mountOf(tab = S.tab) {
  return $(`an-tp-${tab}`);
}

function stateBox(kind, role, lines, actions = []) {
  const box = el('div', 'msg');
  box.dataset.state = kind === 'info' ? 'none' : 'err';
  box.setAttribute('role', role);
  const icon = el('span', 'msg-icon', kind === 'info' ? '–' : '!');
  icon.setAttribute('aria-hidden', 'true');
  const body = el('div', 'msg-body');
  body.appendChild(el('p', 'msg-text', lines[0]));
  if (lines[1]) body.appendChild(el('p', 'msg-next', lines[1]));
  if (actions.length) {
    const row = el('div', 'msg-actions');
    actions.forEach((a) => row.appendChild(a));
    body.appendChild(row);
  }
  box.append(icon, body);
  return box;
}

function skeleton(tab) {
  const wrap = el('div', 'an-loading');
  wrap.setAttribute('role', 'status');
  const row = el('div', 'an-loading-text');
  row.appendChild(el('p', 'mono', 'Loading...'));
  row.appendChild(el('div', 'ibar'));
  wrap.appendChild(row);
  const sk = el('div', `an-sk an-sk-${tab === 'overview' || tab === 'performance' ? 'chart' : 'rows'}`);
  sk.setAttribute('aria-hidden', 'true');
  wrap.appendChild(sk);
  return wrap;
}

function tryAgain() {
  const b = el('button', 'btn btn-secondary', 'Try again');
  b.type = 'button';
  b.addEventListener('click', () => load(S.tab, S.days, { force: true }));
  return b;
}

function setBusy(mount, busy) {
  if (busy) mount.setAttribute('aria-busy', 'true');
  else mount.removeAttribute('aria-busy');
}

/** '27 Oct - 25 Nov 2026 (Malaysia time)'; the Overview adds what it compares with (or says there is nothing). */
export function rangeSentence(tab, answer) {
  const base = rangeLine(answer.from, answer.to);
  if (tab !== 'overview') return base;
  if (!answer.data || !answer.data.previous) return `${base}. Previous period not available.`;
  return `${base}, compared with the ${answer.days} days before`;
}

function paint() {
  charts.splice(0).forEach((c) => c.destroy());
  const tab = S.tab;
  const mount = mountOf(tab);
  const key = keyOf();
  const answer = S.answers.get(key);
  const error = S.errors.get(key);
  mount.textContent = '';
  mount.removeAttribute('tabindex');
  setBusy(mount, false);
  if (answer) {
    if (isEmpty(tab, answer.data)) {
      mount.appendChild(stateBox('info', 'status', ['No visits in this period yet.']));
    } else {
      mount.appendChild(el('p', 'an-range-line mono', rangeSentence(tab, answer)));
      const render = RENDERERS[tab];
      if (render) render(mount, answer, { days: S.days });
    }
  } else if (error) {
    const actions = error.retry ? [tryAgain()] : [];
    mount.appendChild(stateBox('err', 'alert', [error.text, error.next], actions));
    if (!actions.length) mount.tabIndex = 0;
  } else if (S.loadingKey === key) {
    setBusy(mount, true);
    mount.appendChild(skeleton(tab));
  }
  $('an-upd').textContent = answer && answer.generatedAt ? `Updated ${malaysiaClock(answer.generatedAt)} Malaysia time` : '';
  $('an-refresh').disabled = S.loadingKey === key;
  if (S.loadingKey === key) $('an-refresh').setAttribute('aria-disabled', 'true');
  else $('an-refresh').removeAttribute('aria-disabled');
  updateChip();
  document.documentElement.dataset.analyticsView = answer ? 'data' : error ? 'error' : S.loadingKey === key ? 'loading' : 'idle';
}

// ---------------------------------------------------------------- Overview (TASK-33)
/** Whole-number percent change, or null when there is nothing to compare with (previous missing or 0). */
export function percentChange(cur, prev) {
  if (!prev) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

function arrowIcon(kind) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', '12');
  svg.setAttribute('height', '12');
  svg.setAttribute('viewBox', '0 0 12 12');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const shape = kind === 'na' ? document.createElementNS(NS, 'rect') : document.createElementNS(NS, 'polygon');
  if (kind === 'na') ['x:1', 'y:5', 'width:10', 'height:2'].forEach((a) => shape.setAttribute(...a.split(':')));
  else shape.setAttribute('points', { up: '6,1 11,10 1,10', down: '1,2 11,2 6,11', flat: '2,1 11,6 2,11' }[kind]);
  svg.appendChild(shape);
  return svg;
}

/** One tile: exactly the label, the total and the change line. */
function tile(label, cur, prev, days) {
  const pct = percentChange(cur, prev);
  let word = 'n/a';
  let kind = 'na';
  if (pct !== null) {
    kind = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
    word = `${pct > 0 ? '+' : ''}${pct}% vs previous ${days} days`;
  }
  const t = el('div', 'an-tile');
  t.setAttribute('role', 'group');
  t.setAttribute('aria-label', `${label}, ${formatNumber(cur)}, ${pct === null ? 'no earlier numbers to compare with' : word}`);
  const chg = el('div', 'chg');
  chg.append(arrowIcon(kind), el('span', null, word));
  t.append(el('div', 'lab', label), el('div', 'val', formatNumber(cur)), chg);
  return t;
}

/** The "Compare with previous period" switch (off on every page load; toggling redraws the chart, never refetches). */
function compareSwitch(available, onChange) {
  const row = el('div', 'an-cmp');
  const label = el('label', 'an-switch');
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.id = 'an-compare';
  cb.setAttribute('role', 'switch');
  cb.checked = S.compare && available;
  cb.disabled = !available;
  const track = el('span', 'trk');
  track.setAttribute('aria-hidden', 'true');
  label.append(cb, track, el('span', null, 'Compare with previous period'));
  row.appendChild(label);
  if (!available) {
    const note = el('span', 'an-note', 'Previous period not available');
    note.id = 'an-compare-note';
    cb.setAttribute('aria-describedby', 'an-compare-note');
    row.appendChild(note);
  }
  cb.addEventListener('change', () => {
    S.compare = cb.checked;
    onChange();
  });
  return row;
}

function renderOverview(mount, answer) {
  const d = answer.data;
  const prevDaily = Array.isArray(d.previousDaily) && d.previousDaily.length === d.daily.length ? d.previousDaily : null;
  const body = el('div', 'an-ovbody');
  const draw = () => {
    const wasOpen = body.querySelector('.an-det') && body.querySelector('.an-det').open;
    charts.splice(0).forEach((c) => c.destroy());
    body.textContent = '';
    drawOverview(body, answer, S.compare && prevDaily !== null, prevDaily);
    const det = body.querySelector('.an-det');
    if (det && wasOpen) det.open = true;
  };
  mount.appendChild(compareSwitch(prevDaily !== null, draw));
  mount.appendChild(body);
  draw();
}

function drawOverview(mount, answer, compare, prevDaily) {
  const d = answer.data;
  const days = answer.days;
  const wrap = el('div', 'an-ov');
  const tiles = el('div', 'an-tiles');
  tiles.append(
    tile('Visits', d.totals.visits, d.previous && d.previous.visits, days),
    tile('Page views', d.totals.pageViews, d.previous && d.previous.pageViews, days),
  );
  const block = el('div', 'an-block');
  block.appendChild(el('h3', 'panel-subtitle', 'Visits and page views per day'));
  wrap.append(tiles, block);
  mount.appendChild(wrap);
  const daily = d.daily;
  const best = daily.reduce((b, x) => (x.visits > b.visits ? x : b), daily[0]);
  let summary = `Visits and page views per day, last ${days} days (Malaysia time). ${formatNumber(d.totals.visits)} visits and ${formatNumber(d.totals.pageViews)} page views in total, busiest day ${dayLabel(best.date)} with ${formatNumber(best.visits)} visits.`;
  const series = [
    { name: 'Visits', values: daily.map((x) => x.visits), color: 'var(--color-ink)', marker: 'circle' },
    { name: 'Page views', values: daily.map((x) => x.pageViews), color: 'var(--color-purple-deep)', marker: 'square' },
  ];
  let table;
  if (compare) {
    summary += ` Compared with the previous ${days} days: ${formatNumber(d.previous.visits)} visits and ${formatNumber(d.previous.pageViews)} page views, shown as dashed lines.`;
    series.push(
      { name: `Visits, previous ${days} days`, values: prevDaily.map((x) => x.visits), color: 'var(--color-ink)', dashed: true },
      { name: `Page views, previous ${days} days`, values: prevDaily.map((x) => x.pageViews), color: 'var(--color-purple-deep)', dashed: true },
    );
    table = {
      columns: ['Day', 'Visits', 'Page views', 'Previous day', 'Previous visits', 'Previous page views'],
      rows: daily.map((x, i) => [dayLabel(x.date), x.visits, x.pageViews, dayLabel(prevDaily[i].date), prevDaily[i].visits, prevDaily[i].pageViews]),
      caption: summary,
    };
  }
  charts.push(lineChart(block, {
    series,
    xLabels: daily.map((x) => dayLabel(x.date)),
    xTitles: daily.map((x) => fullDayLabel(x.date)),
    yLabel: 'visits and page views per day',
    summary,
    table,
  }));
}
RENDERERS.overview = renderOverview;

// ---------------------------------------------------------------- Sources and Pages (TASK-34)
const SOURCE_ORDER = ['instagram', 'facebook', 'google', 'direct', 'other'];
const SOURCE_LABEL = { instagram: 'Instagram', facebook: 'Facebook', google: 'Google', direct: 'Direct / unknown', other: 'Other' };

/** One titled block (h3 + content). */
function block(mount, title) {
  const b = el('div', 'an-block');
  b.appendChild(el('h3', 'panel-subtitle', title));
  mount.appendChild(b);
  return b;
}

function renderSources(mount, answer) {
  const d = answer.data;
  const byKey = new Map((d.groups || []).map((g) => [g.key, g]));
  const items = SOURCE_ORDER.map((k) => {
    const g = byKey.get(k);
    return { label: (g && g.label) || SOURCE_LABEL[k], value: g ? Number(g.visits) || 0 : 0 };
  });
  const total = items.reduce((t, i) => t + i.value, 0);
  const sentence = items.map((i) => `${i.label} ${formatNumber(i.value)}`).join(', ');
  const b = block(mount, 'Where visits came from');
  barChart(b, {
    items,
    valueLabel: 'visits',
    nameHeader: 'Source',
    summary: `Where visits came from, last ${answer.days} days (Malaysia time). ${formatNumber(total)} visits in total: ${sentence}.`,
    caption: `Visits by source, last ${answer.days} days (Malaysia time)`,
  });
  const hosts = el('div', 'an-block');
  hosts.appendChild(el('h3', 'panel-subtitle', 'Other sites'));
  const list = Array.isArray(d.otherHosts) ? d.otherHosts.slice(0, 5) : [];
  if (list.length) {
    const ul = el('ul', 'an-hosts');
    list.forEach((h) => ul.appendChild(el('li', null, `${h.host} - ${formatNumber(Number(h.visits) || 0)} ${Number(h.visits) === 1 ? 'visit' : 'visits'}`)));
    hosts.appendChild(ul);
  } else {
    hosts.appendChild(el('p', 'an-note', 'No other sites in this period.'));
  }
  mount.appendChild(hosts);
  mount.appendChild(el('p', 'an-note an-ig-note', 'Visits from inside the Instagram app often show as Direct / unknown.'));
}
RENDERERS.sources = renderSources;

function pageItems(list, key) {
  return (list || []).map((p) => ({ label: p.label, sub: typeof p.path === 'string' && p.path.startsWith('/') ? p.path : undefined, value: Number(p[key]) || 0 }));
}

function renderPages(mount, answer) {
  const d = answer.data;
  const cols = el('div', 'an-cols');
  mount.appendChild(cols);
  // "Not found (404)" only when it has page views; it always comes last.
  const pv = pageItems(d.pages, 'pageViews');
  const notFound = pv.filter((p) => p.label === 'Not found (404)');
  const rows = [...pv.filter((p) => p.label !== 'Not found (404)'), ...notFound.filter((p) => p.value > 0)];
  const a = block(cols, 'Page views per page');
  barChart(a, {
    items: rows,
    valueLabel: 'page views',
    nameHeader: 'Page',
    summary: `Page views per page, last ${answer.days} days (Malaysia time). ${rows.map((r) => `${r.label} ${formatNumber(r.value)}`).join(', ')}.`,
    caption: `Page views per page, last ${answer.days} days (Malaysia time)`,
  });
  const entries = pageItems(d.entries, 'visits');
  const b = block(cols, 'Where visits start');
  barChart(b, {
    items: entries,
    valueLabel: 'visits',
    nameHeader: 'Page',
    summary: `Where visits start (the first page of a visit), last ${answer.days} days (Malaysia time). ${entries.map((r) => `${r.label} ${formatNumber(r.value)}`).join(', ')}.`,
    caption: `Where visits start, last ${answer.days} days (Malaysia time)`,
  });
}
RENDERERS.pages = renderPages;

// ---------------------------------------------------------------- Audience and Performance (TASK-35)
/** Series fills for devices: Phone pink + dots, PC purple + hatch, Tablet grey, Other white + cross-hatch. */
const DEVICE = {
  mobile: { label: 'Phone', fill: 'var(--color-pink)', pattern: 'dots' },
  desktop: { label: 'PC', fill: 'var(--color-purple)', pattern: 'hatch' },
  tablet: { label: 'Tablet', fill: 'var(--ph-grey)', pattern: null },
  other: { label: 'Other', fill: 'var(--color-surface)', pattern: 'cross' },
};

/** Largest first, the "Other" row last. */
function topWithOther(list, nameKey) {
  const rows = (list || []).map((x) => ({ label: String(x[nameKey]), value: Number(x.visits) || 0 }));
  return [...rows.filter((r) => r.label !== 'Other').sort((a, b) => b.value - a.value), ...rows.filter((r) => r.label === 'Other')];
}

function renderAudience(mount, answer) {
  const d = answer.data;
  const byType = new Map((d.devices || []).map((x) => [x.type, Number(x.visits) || 0]));
  const kinds = ['mobile', 'desktop', 'tablet', 'other'].filter((k) => k !== 'other' || byType.get('other') > 0);
  const items = kinds.map((k) => ({ ...DEVICE[k], value: byType.get(k) || 0 }));
  const total = items.reduce((t, i) => t + i.value, 0);
  const pct = (v) => Math.round((v / (total || 1)) * 100);
  const b = block(mount, 'Phone, PC and tablet');
  charts.push(stackedBar(b, {
    items,
    nameHeader: 'Device',
    summary: `Visits by device, last ${answer.days} days (Malaysia time). ${items.map((i) => `${i.label} ${pct(i.value)} percent`).join(', ')}.`,
    caption: `Visits by device, last ${answer.days} days (Malaysia time)`,
  }));
  const cols = el('div', 'an-cols');
  mount.appendChild(cols);
  const countries = topWithOther(d.countries, 'name');
  barChart(block(cols, 'Countries'), {
    items: countries,
    valueLabel: 'visits',
    nameHeader: 'Country',
    summary: `Countries, last ${answer.days} days (Malaysia time). ${countries.map((c) => `${c.label} ${formatNumber(c.value)}`).join(', ')}.`,
    caption: `Visits by country, last ${answer.days} days (Malaysia time)`,
  });
  const browsers = topWithOther(d.browsers, 'name');
  barChart(block(cols, 'Browsers'), {
    items: browsers,
    valueLabel: 'visits',
    nameHeader: 'Browser',
    summary: `Browsers, last ${answer.days} days (Malaysia time). ${browsers.map((c) => `${c.label} ${formatNumber(c.value)}`).join(', ')}.`,
    caption: `Visits by browser, last ${answer.days} days (Malaysia time)`,
  });
}
RENDERERS.audience = renderAudience;

const SVG_NS = 'http://www.w3.org/2000/svg';
const RATE_ICON = {
  good: [['circle', { cx: 7, cy: 7, r: 5.5 }], ['path', { d: 'M4 7.2l2 2 4-4' }]],
  mid: [['path', { d: 'M7 1.5L13 12.5H1Z', 'stroke-linejoin': 'round' }], ['path', { d: 'M7 5.5v3M7 10v.5' }]],
  poor: [['rect', { x: 1.5, y: 1.5, width: 11, height: 11 }], ['path', { d: 'M4.5 4.5l5 5M9.5 4.5l-5 5' }]],
  na: [['path', { d: 'M3 7h8' }]],
};

function iconSvg(shapes, size = 14) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 14 14');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  shapes.forEach(([tag, attrs]) => {
    const e = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, String(v)));
    e.setAttribute('style', 'fill: none; stroke: currentColor; stroke-width: 1.5px');
    svg.appendChild(e);
  });
  return svg;
}

/** Rating chip: icon + word + colour, so it never relies on colour alone. */
export function ratingChip(rating) {
  const c = el('span', `an-rate ${rating}`);
  c.appendChild(iconSvg(RATE_ICON[rating]));
  c.appendChild(document.createTextNode(RATINGS[rating]));
  return c;
}

const VITAL_ROWS = [
  { name: 'Page load', short: 'median', key: 'pageLoadP50Ms', kind: null },
  { name: 'Loading', short: 'LCP', key: 'lcpP75Ms', kind: 'lcp' },
  { name: 'Reacting to taps', short: 'INP', key: 'inpP75Ms', kind: 'inp' },
  { name: 'Layout jumping', short: 'CLS', key: 'clsP75', kind: 'cls' },
];

function deviceColumn(label, kind, p) {
  const col = el('div', 'an-vcol');
  const h4 = el('h4', 'an-vhead');
  h4.appendChild(patternSwatch(DEVICE[kind]));
  h4.appendChild(document.createTextNode(label));
  col.appendChild(h4);
  const samples = Number(p.samples) || 0;
  col.appendChild(el('p', 'an-samp', `from ${formatNumber(samples)} page loads`));
  if (isFewSamples(samples)) col.appendChild(el('p', 'an-samp an-few', 'Few samples, may be unreliable'));
  const table = [];
  VITAL_ROWS.forEach((r) => {
    const v = p[r.key] === undefined ? null : p[r.key];
    const text = r.kind === 'cls' ? formatCls(v) : formatMs(v);
    const rating = r.kind ? rateVital(r.kind, v) : null;
    const row = el('div', 'an-vrow');
    const nm = el('div', 'nm', `${r.name} `);
    nm.appendChild(el('small', null, `(${r.short})`));
    row.append(nm, el('div', `vv${text === 'n/a' ? ' na' : ''}`, text));
    const rc = el('div', 'rc');
    if (rating) rc.appendChild(ratingChip(rating));
    row.appendChild(rc);
    if (text === 'n/a') row.appendChild(el('div', 'th', 'Not enough data'));
    else if (r.kind) row.appendChild(el('div', 'th', thresholdText(r.kind)));
    col.appendChild(row);
    table.push([`${label} - ${r.name} (${r.short})`, text, rating ? RATINGS[rating] : '-']);
  });
  return { col, table };
}

const VITAL_TITLE = { lcp: 'Loading (LCP)', inp: 'Reacting to taps (INP)', cls: 'Layout jumping (CLS)' };
const RATING_FILL = [
  { key: 'good', label: 'Good', fill: 'var(--color-purple)', pattern: null },
  { key: 'needsImprovement', label: 'Needs improvement', fill: 'var(--color-pink)', pattern: 'dots' },
  { key: 'poor', label: 'Poor', fill: 'var(--color-surface)', pattern: 'cross' },
];

function renderPerformance(mount, answer) {
  const d = answer.data;
  const wrap = el('div', 'an-block');
  const cols = el('div', 'an-vcols');
  const tableRows = [];
  [['mobile', 'Phone'], ['desktop', 'PC']].forEach(([key, label]) => {
    const { col, table } = deviceColumn(label, key, (d.byDevice && d.byDevice[key]) || {});
    cols.appendChild(col);
    tableRows.push(...table);
  });
  wrap.appendChild(cols);
  mount.appendChild(wrap);
  numberTable(wrap, {
    columns: ['Measure', 'Value', 'Rating'],
    rows: tableRows,
    caption: `Core Web Vitals by device, last ${answer.days} days (Malaysia time). Page load is the median, the vitals are the 75th percentile.`,
  });
  const shares = block(mount, 'Share of page loads by rating');
  ['lcp', 'inp', 'cls'].forEach((k) => {
    const v = (d.vitals && d.vitals[k]) || {};
    const items = RATING_FILL.map((r) => ({ label: r.label, fill: r.fill, pattern: r.pattern, value: Number(v[r.key]) || 0 }));
    const total = items.reduce((t, i) => t + i.value, 0);
    const sub = el('div', 'an-vshare');
    sub.appendChild(el('h4', 'an-vhead', VITAL_TITLE[k]));
    shares.appendChild(sub);
    if (!total) {
      sub.appendChild(el('p', 'an-note', 'Not enough data'));
      return;
    }
    charts.push(stackedBar(sub, {
      items,
      big: false,
      valueLabel: 'page loads',
      nameHeader: 'Rating',
      summary: `${VITAL_TITLE[k]}, share of page loads by rating, last ${answer.days} days (Malaysia time). ${items.map((i) => `${i.label} ${Math.round((i.value / total) * 100)} percent`).join(', ')}.`,
      caption: `${VITAL_TITLE[k]}: page loads by rating, last ${answer.days} days (Malaysia time)`,
    }));
  });
}
RENDERERS.performance = renderPerformance;

// ---------------------------------------------------------------- loading
function load(tab, days, { force = false } = {}) {
  if (mode() !== 'ready' || !S.open) return;
  const key = keyOf(tab, days);
  if (force) {
    S.answers.delete(key);
    S.errors.delete(key);
  }
  if (S.ctl) S.ctl.abort();
  const ctl = new AbortController();
  S.ctl = ctl;
  S.seq += 1;
  const mine = S.seq;
  S.loadingKey = key;
  paint();
  analyticsFetch(tab, days, { signal: ctl.signal }).then((res) => {
    if (mine !== S.seq) return; // a newer request replaced this one
    S.ctl = null;
    S.loadingKey = '';
    if (res.ok && res.body && res.body.v === 1 && res.body.tab === tab) {
      S.answers.set(key, res.body);
      S.errors.delete(key);
    } else if (days === 90 && res.status === 502 && res.body && res.body.code === 'range-unavailable') {
      // 90 days is not available: turn it off and show 30 instead.
      S.r90off = true;
      S.days = 30;
      layout();
      ensureLoaded();
      return;
    } else {
      S.errors.set(key, explain(res.ok ? { status: 502, body: null } : res));
      if (res.status === 401) openSettings();
    }
    if (S.tab === tab && S.days === days) paint();
    layout();
  }, (err) => {
    if (mine !== S.seq) return;
    S.ctl = null;
    S.loadingKey = '';
    if (err && err.kind === 'aborted') return;
    S.errors.set(key, explain(null));
    if (S.tab === tab && S.days === days) paint();
    layout();
  });
}

function ensureLoaded() {
  if (mode() !== 'ready' || !S.open) {
    paint();
    return;
  }
  const key = keyOf();
  if (S.answers.has(key) || S.errors.has(key)) {
    // Kept answer: no request. A request for another tab / range is cancelled so it cannot paint over this one.
    if (S.ctl && S.loadingKey !== key) {
      S.ctl.abort();
      S.ctl = null;
      S.seq += 1;
      S.loadingKey = '';
    }
    paint();
    return;
  }
  if (S.loadingKey === key) {
    paint();
    return;
  }
  load(S.tab, S.days);
}

// ---------------------------------------------------------------- tabs
function selectTab(tab, { focus = false } = {}) {
  S.tab = tab;
  TABS.forEach((t) => {
    const on = t === tab;
    const btn = $(`an-tab-${t}`);
    btn.setAttribute('aria-selected', String(on));
    btn.tabIndex = on ? 0 : -1;
    $(`an-tp-${t}`).hidden = !on;
    if (on && focus) btn.focus();
  });
  const sel = $(`an-tab-${tab}`);
  if (sel.scrollIntoView) sel.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'auto' });
  ensureLoaded();
  layout();
}

function onTabKey(e) {
  const i = TABS.indexOf(S.tab);
  let next = -1;
  if (e.key === 'ArrowRight') next = (i + 1) % TABS.length;
  else if (e.key === 'ArrowLeft') next = (i + TABS.length - 1) % TABS.length;
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = TABS.length - 1;
  if (next < 0) return;
  e.preventDefault();
  selectTab(TABS[next], { focus: true });
}

// ---------------------------------------------------------------- passcode
function showPassError(text) {
  const err = $('an-pass-error');
  err.textContent = text;
  err.hidden = !text;
  $('an-pass').setAttribute('aria-invalid', text ? 'true' : 'false');
}

function onSave() {
  const result = savePasscode($('an-pass').value);
  if (result.error) {
    showPassError(result.error);
    return;
  }
  showPassError('');
  $('an-pass').value = '';
  $('an-pass-status').textContent = 'Passcode saved.';
  S.errors.clear();
  layout();
  ensureLoaded();
}

async function onTest() {
  const status = $('an-pass-status');
  status.textContent = 'Testing...';
  $('an-test').disabled = true;
  let res = null;
  try {
    res = await analyticsFetch('overview', 7);
  } catch {
    res = null;
  }
  $('an-test').disabled = !hasPasscode();
  if (res && res.ok) status.textContent = MESSAGES.testOk;
  else status.textContent = explain(res).text;
}

function askForget(show) {
  $('an-forget-ask').hidden = !show;
  $('an-pass-actions').hidden = show;
  if (show) $('an-forget-no').focus();
  else if (hasPasscode()) $('an-forget').focus();
}

function onForget() {
  forgetPasscode();
  S.answers.clear();
  S.errors.clear();
  if (S.ctl) S.ctl.abort();
  S.ctl = null;
  S.seq += 1;
  S.loadingKey = '';
  $('an-forget-ask').hidden = true;
  $('an-pass-actions').hidden = false;
  $('an-pass-status').textContent = MESSAGES.noPasscode;
  layout();
  paint();
  openSettings();
  $('an-pass').focus();
}

// ---------------------------------------------------------------- init
function init() {
  if (!$('an-panel')) return;
  const foldBtn = document.querySelector('#an-panel > .fold-head .fold-btn');
  const checkOpen = () => {
    const open = foldBtn.getAttribute('aria-expanded') === 'true';
    if (open === S.open) return;
    S.open = open;
    if (open) {
      layout();
      ensureLoaded();
    }
  };
  new MutationObserver(checkOpen).observe(foldBtn, { attributes: true, attributeFilter: ['aria-expanded'] });

  $('an-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[role="tab"]');
    if (btn) selectTab(btn.dataset.tab);
  });
  $('an-tabs').addEventListener('keydown', onTabKey);
  $('an-range').addEventListener('change', (e) => {
    const v = Number(e.target.value);
    if (![7, 30, 90].includes(v)) return;
    S.days = v;
    ensureLoaded();
    layout();
  });
  $('an-refresh').addEventListener('click', () => load(S.tab, S.days, { force: true }));

  $('an-save').addEventListener('click', onSave);
  $('an-pass').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSave();
    }
  });
  $('an-test').addEventListener('click', onTest);
  $('an-forget').addEventListener('click', () => askForget(true));
  $('an-forget-no').addEventListener('click', () => askForget(false));
  $('an-forget-yes').addEventListener('click', onForget);
  $('an-forget-ask').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      askForget(false);
    }
  });

  const opt = $('an-optout');
  opt.checked = readOptOut();
  opt.addEventListener('change', () => {
    if (!writeOptOut(opt.checked)) opt.checked = readOptOut();
  });

  layout();
  if (mode() !== 'ready') openSettings();
  paint();
  S.open = foldBtn.getAttribute('aria-expanded') === 'true';
  document.documentElement.dataset.analyticsReady = 'true';
}

if (typeof document !== 'undefined') init();
