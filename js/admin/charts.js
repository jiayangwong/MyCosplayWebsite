// Admin chart kit (IDEA-17, TASK-33): plain inline SVG, no library, no canvas, no animation.
// Every chart is followed by a "Show the numbers" table with the exact values. All labels are set with
// textContent (they may come from the Worker). Colours are CSS custom properties from css/tokens.css.
// Nothing here touches the DOM when the module is imported.
import { dayLabel, fullDayLabel } from './analytics-client.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const nf = typeof Intl !== 'undefined' ? new Intl.NumberFormat('en') : { format: (n) => String(n) };
let uid = 0;

// ---------------------------------------------------------------- pure helpers (tested through page.evaluate)
/** 1234 -> '1,234'. */
export function formatNumber(n) {
  return nf.format(n);
}

/** Axis numbers: 10,000 and over as '12k'. */
export function axisNumber(n) {
  return n >= 10000 ? `${Math.round(n / 1000)}k` : nf.format(n);
}

/** "Nice" y scale from 0: { step, top, ticks } with 3-5 gridlines (max 14 -> 0, 5, 10, 15). */
export function niceScale(max) {
  const m = Math.max(Number(max) || 0, 1);
  const raw = m / 4;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 5, 10].map((c) => c * p).find((s) => s >= raw) || 10 * p);
  const top = Math.max(step, Math.ceil(m / step) * step);
  const ticks = [];
  for (let t = 0; t <= top + step / 1000; t += step) ticks.push(Math.round(t * 1000) / 1000);
  return { step, top, ticks };
}

/** Indexes that get an x label: always the first and last; others only when `minGap` px from the last one drawn and from the end. */
export function thinLabels(count, plotWidth, minGap = 56) {
  if (count <= 0) return [];
  if (count === 1) return [0];
  const dx = plotWidth / (count - 1);
  const k = Math.max(1, Math.ceil(minGap / dx));
  const out = [0];
  for (let i = k; i < count - 1; i += k) if ((count - 1 - i) * dx >= minGap) out.push(i);
  out.push(count - 1);
  return out;
}

// ---------------------------------------------------------------- DOM helpers
function h(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function sv(tag, attrs = {}, parent) {
  const e = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, String(v)));
  if (parent) parent.appendChild(e);
  return e;
}

const isPC = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 900px)').matches;

/** Series marker: circle for the first series, square for the second, diamond-free (only two shapes). */
function marker(parent, shape, cx, cy, color) {
  const style = `fill: ${color}; stroke: var(--color-surface); stroke-width: 2px`;
  if (shape === 'square') return sv('rect', { x: cx - 4, y: cy - 4, width: 8, height: 8, style }, parent);
  return sv('circle', { cx, cy, r: 4, style }, parent);
}

function legendSwatch(s) {
  const svg = sv('svg', { width: 28, height: 14, viewBox: '0 0 28 14', 'aria-hidden': 'true', focusable: 'false' });
  const attrs = { x1: 1, x2: 27, y1: 7, y2: 7, style: `stroke: ${s.color}; stroke-width: 2px` };
  if (s.dashed) attrs.style += '; stroke-dasharray: 6 4';
  sv('line', attrs, svg);
  if (!s.dashed) marker(svg, s.marker, 14, 7, s.color);
  return svg;
}

// ---------------------------------------------------------------- numbers table
/**
 * Appends `<details class="an-det"><summary>Show the numbers</summary><table>` to container and returns it.
 * columns = header names; rows = arrays of cells (first cell is the row header); caption is required.
 */
export function numberTable(container, { columns, rows, caption }) {
  const d = h('details', 'an-det');
  d.appendChild(h('summary', null, 'Show the numbers'));
  const wrap = h('div', 'an-tw');
  const t = h('table');
  t.appendChild(h('caption', null, caption));
  const head = h('thead');
  const hr = h('tr');
  columns.forEach((c) => {
    const th = h('th', null, c);
    th.scope = 'col';
    hr.appendChild(th);
  });
  head.appendChild(hr);
  t.appendChild(head);
  const body = h('tbody');
  rows.forEach((r) => {
    const tr = h('tr');
    r.forEach((cell, i) => {
      const c = h(i ? 'td' : 'th', null, typeof cell === 'number' ? formatNumber(cell) : String(cell));
      if (!i) c.scope = 'row';
      tr.appendChild(c);
    });
    body.appendChild(tr);
  });
  t.appendChild(body);
  wrap.appendChild(t);
  d.appendChild(wrap);
  container.appendChild(d);
  return d;
}

// ---------------------------------------------------------------- line chart
/**
 * lineChart(container, { series, xLabels, xTitles, yLabel, summary, table })
 *  series[]  = { name, values[], color (CSS value, e.g. 'var(--color-ink)'), dashed?, marker?: 'circle'|'square' }
 *  xLabels[] = short axis labels ('3 Nov'), one per point; xTitles[] = longer tooltip headings (optional)
 *  summary   = the sentence used as the SVG <title> (screen readers), yLabel = what the y axis counts
 *  table     = { columns, rows, caption } for "Show the numbers" (default: Day + one column per series)
 * Draws a legend (HTML), the SVG with a hover / keyboard layer, the axis title and the table. Returns { destroy }.
 */
export function lineChart(container, { series, xLabels, xTitles, yLabel = '', summary, table }) {
  const n = xLabels.length;
  const wrap = h('div', 'an-chartwrap');
  const legend = h('div', 'an-legend');
  series.forEach((s) => {
    const item = h('span');
    item.appendChild(legendSwatch(s));
    item.appendChild(document.createTextNode(s.legend || s.name));
    legend.appendChild(item);
  });
  const box = h('div', 'an-chart');
  const axis = h('p', 'an-axis-title', 'Day (Malaysia time)');
  wrap.append(legend, box, axis);
  container.appendChild(wrap);
  numberTable(container, table || {
    columns: ['Day', ...series.map((s) => s.name)],
    rows: xLabels.map((x, i) => [x, ...series.map((s) => s.values[i])]),
    caption: summary,
  });

  let lastWidth = 0;
  let focusIdx = n - 1;

  function draw() {
    const W = Math.floor(box.clientWidth);
    if (W < 120) return; // hidden or not laid out yet
    lastWidth = W;
    box.textContent = '';
    const pc = isPC();
    const H = pc ? 260 : 220;
    const ml = 40;
    const mr = pc ? 92 : 16;
    const mt = 12;
    const mb = 28;
    const pw = W - ml - mr;
    const ph = H - mt - mb;
    box.style.height = `${H}px`;
    const max = Math.max(0, ...series.flatMap((s) => s.values));
    const { ticks, top } = niceScale(max);
    const x = (i) => ml + (n === 1 ? pw / 2 : (pw * i) / (n - 1));
    const y = (v) => mt + ph * (1 - v / top);
    uid += 1;
    const titleId = `an-ct-${uid}`;
    const svg = sv('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-labelledby': titleId }, box);
    sv('title', { id: titleId }, svg).textContent = summary;
    const marks = sv('g', { 'aria-hidden': 'true' }, svg);
    ticks.forEach((t) => {
      sv('line', { x1: ml, x2: W - mr, y1: y(t), y2: y(t), class: 'an-grid' }, marks);
      sv('text', { x: ml - 8, y: y(t) + 4, 'text-anchor': 'end', class: 'an-tick' }, marks).textContent = axisNumber(t);
    });
    sv('line', { x1: ml, x2: W - mr, y1: y(0), y2: y(0), class: 'an-base' }, marks);
    thinLabels(n, pw).forEach((i) => {
      const lastLabel = i === n - 1 && x(i) + 24 > W;
      sv('text', { x: lastLabel ? W - 2 : x(i), y: H - 8, 'text-anchor': lastLabel ? 'end' : 'middle', class: 'an-tick' }, marks).textContent = xLabels[i];
    });
    series.forEach((s) => {
      const d = s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
      const style = `fill: none; stroke: ${s.color}; stroke-width: 2px; stroke-linejoin: round${s.dashed ? '; stroke-dasharray: 6 4' : ''}`;
      sv('path', { d, style, 'data-series': s.name }, marks);
    });
    const solid = series.filter((s) => !s.dashed);
    solid.forEach((s) => {
      s.values.forEach((v, i) => { if (n <= 7 || i === n - 1) marker(marks, s.marker, x(i), y(v), s.color); });
    });
    if (pc) {
      // Direct labels at the right end of the solid lines, moved apart by at least 14px.
      const ends = solid.map((s) => ({ s, y: y(s.values[n - 1]) + 4 })).sort((a, b) => a.y - b.y);
      for (let k = 1; k < ends.length; k += 1) if (ends[k].y - ends[k - 1].y < 14) ends[k].y = ends[k - 1].y + 14;
      ends.forEach((e) => sv('text', { x: x(n - 1) + 10, y: e.y, class: 'an-dl' }, marks).textContent = e.s.name);
    }
    const hover = sv('g', { 'aria-hidden': 'true' }, svg);

    // Hover / touch / keyboard layer: a focusable box over the plot and a tooltip.
    const plot = h('div', 'an-plot');
    plot.style.cssText = `left:${ml}px;top:${mt}px;width:${pw}px;height:${ph}px`;
    plot.tabIndex = 0;
    plot.setAttribute('role', 'group');
    plot.setAttribute('aria-label', `Chart of ${yLabel || 'the numbers'}. Left and Right arrows read each day, Escape hides the box. The same numbers are in Show the numbers.`);
    const tip = h('div', 'an-tip');
    tip.hidden = true;
    const live = h('div', 'an-vh');
    live.setAttribute('aria-live', 'polite');
    function hide() {
      tip.hidden = true;
      hover.textContent = '';
    }
    function show(j) {
      focusIdx = Math.max(0, Math.min(n - 1, j));
      hover.textContent = '';
      sv('line', { x1: x(focusIdx), x2: x(focusIdx), y1: mt, y2: y(0), class: 'an-cursor' }, hover);
      series.filter((s) => !s.dashed).forEach((s) => marker(hover, s.marker, x(focusIdx), y(s.values[focusIdx]), s.color));
      tip.textContent = '';
      tip.appendChild(h('b', null, xTitles ? xTitles[focusIdx] : xLabels[focusIdx]));
      const parts = [];
      series.forEach((s) => {
        const line = `${s.name} ${formatNumber(s.values[focusIdx])}`;
        parts.push(line);
        tip.appendChild(h('span', null, line));
      });
      tip.hidden = false;
      const tw = tip.offsetWidth;
      let left = x(focusIdx) + 12;
      if (left + tw > W) left = Math.max(0, x(focusIdx) - 12 - tw);
      tip.style.left = `${left}px`;
      tip.style.top = `${mt + 4}px`;
      live.textContent = `${xTitles ? xTitles[focusIdx] : xLabels[focusIdx]}. ${parts.join('. ')}.`;
    }
    const at = (e) => {
      const r = plot.getBoundingClientRect();
      return Math.round(((e.clientX - r.left) / pw) * (n - 1));
    };
    plot.addEventListener('pointermove', (e) => show(at(e)));
    plot.addEventListener('pointerdown', (e) => show(at(e)));
    plot.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && document.activeElement !== plot) hide(); });
    plot.addEventListener('focus', () => show(focusIdx));
    plot.addEventListener('blur', hide);
    plot.addEventListener('keydown', (e) => {
      const m = { ArrowLeft: focusIdx - 1, ArrowRight: focusIdx + 1, Home: 0, End: n - 1 };
      if (e.key in m) {
        e.preventDefault();
        show(m[e.key]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        hide();
      }
    });
    box.append(plot, tip, live);
  }

  draw();
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => {
      const w = Math.floor(box.clientWidth);
      if (w !== lastWidth && w >= 120) draw();
    });
    ro.observe(box);
  }
  return { destroy() { if (ro) ro.disconnect(); }, redraw: draw };
}

// ---------------------------------------------------------------- bar chart (TASK-34 / TASK-35 use it)
/**
 * barChart(container, { items, valueLabel, summary, caption, nameHeader })
 *  items[]    = { label, sub?, value } in the order to show; sub = small mono text under the label (a path)
 *  valueLabel = unit word shown after each value ('visits', 'page views')
 * Horizontal bars, the label above each bar and the value at its end; long labels wrap. A list with role "img" and
 * a text summary, plus a numbers table (Name, <valueLabel>, Share). Returns the list element.
 */
export function barChart(container, { items, valueLabel = 'visits', summary, caption, nameHeader = 'Item' }) {
  const total = items.reduce((t, i) => t + i.value, 0);
  const max = Math.max(1, ...items.map((i) => i.value));
  const share = (v) => Math.round((v / (total || 1)) * 100);
  const ul = h('ul', 'an-bars');
  ul.setAttribute('role', 'img');
  ul.setAttribute('aria-label', summary);
  items.forEach((i) => {
    const li = h('li', 'an-bar');
    const nm = h('div', 'nm', i.label);
    if (i.sub) nm.appendChild(h('small', null, i.sub));
    const tr = h('div', 'tr');
    const fl = h('div', `fl${i.value === 0 ? ' zero' : ''}`);
    fl.style.width = i.value === 0 ? '0' : `max(4px, calc((100% - 150px) * ${(i.value / max).toFixed(4)}))`;
    tr.append(fl, h('div', 'vl', i.value === 0 ? '0' : `${formatNumber(i.value)} ${valueLabel} - ${share(i.value)}%`));
    li.append(nm, tr);
    ul.appendChild(li);
  });
  container.appendChild(ul);
  numberTable(container, {
    columns: [nameHeader, valueLabel.replace(/^./, (c) => c.toUpperCase()), 'Share'],
    rows: items.map((i) => [i.sub ? `${i.label} (${i.sub})` : i.label, i.value, `${share(i.value)}%`]),
    caption: caption || summary,
  });
  return ul;
}

// ---------------------------------------------------------------- stacked 100% bar (TASK-35)
/** Pattern fills: the series colours are told apart by pattern as well, never by colour alone. */
function addPatterns(svg, id) {
  const defs = sv('defs', {}, svg);
  const mk = (name) => sv('pattern', { id: `${id}-${name}`, width: 6, height: 6, patternUnits: 'userSpaceOnUse' }, defs);
  const ink = 'stroke: var(--color-ink); stroke-width: 1px; fill: none';
  const dots = mk('dots');
  sv('circle', { cx: 3, cy: 3, r: 1, style: 'fill: var(--color-ink)' }, dots);
  const hatch = mk('hatch');
  sv('path', { d: 'M-1 7 L7 -1 M-1 1 L1 -1 M5 7 L7 5', style: ink }, hatch);
  const cross = mk('cross');
  sv('path', { d: 'M-1 7 L7 -1 M-1 1 L1 -1 M5 7 L7 5 M-1 -1 L7 7', style: ink }, cross);
}

function swatch(item, id) {
  const svg = sv('svg', { width: 24, height: 16, viewBox: '0 0 24 16', 'aria-hidden': 'true', focusable: 'false' });
  addPatterns(svg, id);
  sv('rect', { x: 1, y: 1, width: 22, height: 14, style: `fill: ${item.fill}; stroke: var(--color-ink); stroke-width: 2px` }, svg);
  if (item.pattern) sv('rect', { x: 2, y: 2, width: 20, height: 12, style: `fill: url(#${id}-${item.pattern})` }, svg);
  return svg;
}

/**
 * stackedBar(container, { items, summary, caption, valueLabel, nameHeader })
 *  items[] = { label, value, fill (CSS value), pattern: 'dots' | 'hatch' | 'cross' | null }
 * One 32px bar (2px ink outline, 2px ink separators, a pattern per segment), a list under it with swatch, name, big
 * percent and the count, and the numbers table. Returns { destroy }.
 */
export function stackedBar(container, { items, summary, caption, valueLabel = 'visits', nameHeader = 'Item', big = true }) {
  const total = items.reduce((t, i) => t + i.value, 0);
  const pct = (v) => Math.round((v / (total || 1)) * 100);
  const holder = h('div', 'an-stack');
  container.appendChild(holder);
  uid += 1;
  const id = `an-sb-${uid}`;
  let lastWidth = 0;
  function draw() {
    const W = Math.floor(holder.clientWidth);
    if (W < 60) return;
    lastWidth = W;
    holder.textContent = '';
    const H = 36;
    const svg = sv('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-labelledby': `${id}-t` }, holder);
    sv('title', { id: `${id}-t` }, svg).textContent = summary;
    const g0 = sv('g', { 'aria-hidden': 'true' }, svg);
    addPatterns(g0, id);
    const clip = sv('clipPath', { id: `${id}-clip` }, g0);
    sv('rect', { x: 1, y: 2, width: W - 2, height: 32, rx: 6 }, clip);
    const g = sv('g', { 'clip-path': `url(#${id}-clip)` }, g0);
    const shown = items.filter((i) => i.value > 0);
    const inner = W - 2;
    let x = 1;
    shown.forEach((i, k) => {
      const w = Math.max(4, (i.value / (total || 1)) * inner);
      sv('rect', { x, y: 2, width: w, height: 32, style: `fill: ${i.fill}` }, g);
      if (i.pattern) sv('rect', { x, y: 2, width: w, height: 32, style: `fill: url(#${id}-${i.pattern})` }, g);
      x += w;
      if (k < shown.length - 1) sv('rect', { x: x - 1, y: 2, width: 2, height: 32, style: 'fill: var(--color-ink)' }, g);
    });
    sv('rect', { x: 1, y: 2, width: W - 2, height: 32, rx: 6, style: 'fill: none; stroke: var(--color-ink); stroke-width: 2px' }, g0);
  }
  draw();
  const ul = h('ul', 'an-split');
  items.forEach((i, k) => {
    const li = h('li');
    li.appendChild(swatch(i, `${id}-s${k}`));
    li.appendChild(h('span', 'nm', i.label));
    li.appendChild(h('span', big ? 'big' : 'sm', `${pct(i.value)}%`));
    li.appendChild(h('span', 'sm', `${formatNumber(i.value)} ${valueLabel}`));
    ul.appendChild(li);
  });
  container.appendChild(ul);
  numberTable(container, {
    columns: [nameHeader, valueLabel.replace(/^./, (c) => c.toUpperCase()), 'Share'],
    rows: items.map((i) => [i.label, i.value, `${pct(i.value)}%`]),
    caption: caption || summary,
  });
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => {
      const w = Math.floor(holder.clientWidth);
      if (w !== lastWidth && w >= 60) draw();
    });
    ro.observe(holder);
  }
  return { destroy() { if (ro) ro.disconnect(); } };
}

/** A 24 x 16 swatch with the same pattern and outline as a stacked-bar segment: { fill, pattern }. */
export function patternSwatch(item) {
  uid += 1;
  return swatch(item, `an-sw-${uid}`);
}

export { dayLabel, fullDayLabel };
