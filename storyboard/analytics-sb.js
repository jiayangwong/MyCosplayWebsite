/* STORYBOARD ONLY - IDEA-17 Analytics panel prototype (TASK-32 to TASK-35).
   All numbers are made-up sample data. Nothing is stored, nothing is sent. Plain JS, hand-written SVG. */
(function () {
  'use strict';
  var $ = function (i) { return document.getElementById(i); };
  var NS = 'http://www.w3.org/2000/svg';
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var TABS = [['overview', 'Overview'], ['sources', 'Sources'], ['pages', 'Pages'], ['audience', 'Audience'], ['performance', 'Performance']];
  var SW = [['ok', 'Working (sample data)'], ['notset', 'Not set up'], ['nopass', 'No passcode'], ['loading', 'Loading skeleton'], ['empty', 'Empty'], ['401', '401 wrong passcode'], ['429', '429 busy'], ['502', '502 Cloudflare'], ['net', 'Network failure'], ['r90', '90 days not available'], ['403', '403 wrong origin'], ['503', '503 not configured']];
  var END = Date.UTC(2026, 10, 26); /* sample "to" date (a Malaysia date, never converted with the browser time zone) */
  var S = { sw: 'ok', setup: true, pass: true, last: 'x7Kq', range: 30, cmp: false, autoKey: '', tab: 'overview', view: 'data', r90off: false, lastChip: 'Last 30 days', min: 5, everOpen: false, test: '' };
  var timer, lastW = 0, openSet = {};
  var nf = new Intl.NumberFormat('en');

  /* ---------- helpers ---------- */
  function h(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function sv(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function add(p) { for (var i = 1; i < arguments.length; i++) if (arguments[i]) p.appendChild(arguments[i]); return p; }
  function icon(html, w, hh) { var s = document.createElementNS(NS, 'svg'); s.setAttribute('width', w || 14); s.setAttribute('height', hh || w || 14); s.setAttribute('viewBox', '0 0 ' + (w || 14) + ' ' + (hh || w || 14)); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false'); s.innerHTML = html; return s; }
  function num(n) { return n >= 10000 ? Math.round(n / 1000) + 'k' : nf.format(n); }
  function dmy(ts) { var d = new Date(ts); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; }
  function dfull(ts) { var d = new Date(ts); return DOW[d.getUTCDay()] + ' ' + dmy(ts); }
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function isPC() { return window.matchMedia('(min-width: 900px)').matches; }
  function sum(a, k) { return a.reduce(function (t, x) { return t + (k ? x[k] : x); }, 0); }

  /* ---------- sample data (changes a little with 7 / 30 / 90) ---------- */
  function gen(days, empty) {
    var r = rng(days * 7 + 3), pr = rng(days * 5 + 1), base = { 7: 14, 30: 11, 90: 8 }[days], cur = [], prev = [], i;
    for (i = 0; i < days; i++) {
      var ts = END - (days - 1 - i) * 864e5, dw = new Date(ts).getUTCDay(), wk = (dw === 0 || dw === 6) ? 1.25 : 1;
      var v = Math.round(base * wk * (0.55 + 0.9 * r()) * (1 + 0.3 * Math.sin(i / 4))), pv = Math.round(v * (2.1 + 0.9 * r()));
      var v0 = Math.round(base * 0.82 * wk * (0.55 + 0.9 * pr()) * (1 + 0.3 * Math.sin(i / 5))), pv0 = Math.round(v0 * (2.1 + 0.9 * pr()));
      if (empty) { v = pv = v0 = pv0 = 0; }
      cur.push({ ts: ts, v: v, pv: pv, v0: v0, pv0: pv0 });
    }
    return cur;
  }
  var F = { 7: 0.23, 30: 1, 90: 2.8 };
  function scaled(base, days, seed, empty) {
    var r = rng(days * 11 + seed);
    return base.map(function (b) { var v = empty ? 0 : Math.round(b * F[days] * (0.92 + 0.16 * r())); return (!empty && b > 0 && v < 1) ? 1 : v; });
  }
  function named(names, vals) { return names.map(function (n, i) { return { n: n, v: vals[i] }; }); }
  var SRC = ['Instagram', 'Facebook', 'Google', 'Direct / unknown', 'Other'];
  var PAGES = [['Home', '/'], ['Gallery', '/gallery.html'], ['Reels', '/reels.html'], ['Events', '/events.html'], ['About', '/about.html'], ['Contact', '/contact.html'], ['Not found (404)', 'other paths']];
  var ENTRY = [['Home', '/'], ['Reels', '/reels.html'], ['Gallery', '/gallery.html'], ['Events', '/events.html'], ['About', '/about.html'], ['Contact', '/contact.html']];
  var DEV = ['Phone', 'PC', 'Tablet'];
  var CTRY = ['Malaysia', 'Singapore', 'Indonesia', 'Japan', 'Philippines', 'Thailand', 'United States', 'Australia', 'United Kingdom', 'Hong Kong', 'Other'];
  var BRW = ['Chrome', 'Safari', 'Instagram app', 'Edge', 'Firefox', 'Samsung Internet', 'Other'];

  /* ---------- table + details ---------- */
  function details(key, caption, heads, rows) {
    var d = h('details', 'an-det'); d.dataset.k = key; if (openSet[key]) d.open = true;
    d.addEventListener('toggle', function () { openSet[key] = d.open; });
    d.appendChild(h('summary', null, 'Show the numbers'));
    var w = h('div', 'an-tw'), t = h('table'); t.appendChild(h('caption', null, caption));
    var th = h('thead'), tr = h('tr'); heads.forEach(function (x) { var c = h('th', null, x); c.scope = 'col'; tr.appendChild(c); }); th.appendChild(tr); t.appendChild(th);
    var tb = h('tbody'); rows.forEach(function (r) { var q = h('tr'); r.forEach(function (x, i) { var c = h(i ? 'td' : 'th', null, String(x)); if (!i) c.scope = 'row'; q.appendChild(c); }); tb.appendChild(q); });
    t.appendChild(tb); w.appendChild(t); d.appendChild(w); return d;
  }
  function block(title) { var b = h('div', 'an-block'); if (title) b.appendChild(h('h3', 'panel-subtitle', title)); return b; }

  /* ---------- stat tiles ---------- */
  function tile(label, cur, prev, days) {
    var t = h('div', 'an-tile'); t.setAttribute('role', 'group');
    var word, pct, shape;
    if (!prev) { word = 'n/a - no earlier numbers'; shape = '<rect x="1" y="5" width="10" height="2" fill="#1D1A24"/>'; }
    else {
      pct = Math.round((cur - prev) / prev * 100);
      if (pct > 0) { word = '+' + pct + '% up'; shape = '<polygon points="6,1 11,10 1,10" fill="#1D1A24"/>'; }
      else if (pct < 0) { word = pct + '% down'; shape = '<polygon points="1,2 11,2 6,11" fill="#1D1A24"/>'; }
      else { word = '0% no change'; shape = '<polygon points="2,1 11,6 2,11" fill="#1D1A24"/>'; }
    }
    t.setAttribute('aria-label', label + ' ' + cur + ', ' + (prev ? (pct > 0 ? 'up ' + pct + ' percent' : pct < 0 ? 'down ' + (-pct) + ' percent' : 'no change') + ' compared with the previous ' + days + ' days' : 'no earlier numbers'));
    t.appendChild(h('div', 'lab', label)); t.appendChild(h('div', 'val', nf.format(cur)));
    var c = h('div', 'chg'); c.appendChild(icon(shape, 12)); c.appendChild(h('span', null, word)); t.appendChild(c);
    return t;
  }

  /* ---------- line chart ---------- */
  function niceStep(max) { var r = Math.max(max, 1) / 4, p = Math.pow(10, Math.floor(Math.log(r) / Math.LN10)), c = [1, 2, 5, 10], i; for (i = 0; i < 4; i++) if (c[i] * p >= r) return c[i] * p; return 10 * p; }
  function legendItem(parent, color, dashed, shape, text) {
    var s = h('span'), g = '<line x1="1" x2="27" y1="7" y2="7" stroke="' + color + '" stroke-width="2"' + (dashed ? ' stroke-dasharray="6 4"' : '') + '/>';
    if (!dashed) g += shape === 'c' ? '<circle cx="14" cy="7" r="4" fill="' + color + '" stroke="#fff" stroke-width="2"/>' : '<rect x="10" y="3" width="8" height="8" fill="' + color + '" stroke="#fff" stroke-width="2"/>';
    s.appendChild(icon(g, 28, 14)); s.appendChild(document.createTextNode(text)); parent.appendChild(s);
  }
  function lineChart(days, W, cmp) {
    var data = gen(days), n = data.length, pc = isPC(), H = pc ? 260 : 220, ml = 40, mr = pc ? 92 : 16, mt = 12, mb = 28, pw = W - ml - mr, ph = H - mt - mb;
    var wrap = h('div', 'an-block');
    var lg = h('div', 'an-legend'); lg.setAttribute('aria-hidden', 'true');
    legendItem(lg, '#1D1A24', false, 'c', 'Visits'); legendItem(lg, '#5B4A8B', false, 's', 'Page views');
    if (cmp) { legendItem(lg, '#1D1A24', true, 'c', 'Visits, previous period'); legendItem(lg, '#5B4A8B', true, 's', 'Page views, previous period'); }
    wrap.appendChild(lg);
    var box = h('div', 'an-chart'); box.style.height = H + 'px';
    var max = 0; data.forEach(function (d) { max = Math.max(max, d.v, d.pv); if (cmp) max = Math.max(max, d.v0, d.pv0); });
    var step = niceStep(max), top = Math.max(step, Math.ceil(max / step) * step);
    var x = function (i) { return ml + (n === 1 ? pw / 2 : pw * i / (n - 1)); }, y = function (v) { return mt + ph * (1 - v / top); };
    var svg = sv('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'img' }, box);
    var best = data.reduce(function (b, d) { return d.v > b.v ? d : b; }, data[0]);
    sv('title', {}, svg).textContent = 'Visits and page views per day, ' + dmy(data[0].ts) + ' to ' + dmy(data[n - 1].ts) + ' 2026 (Malaysia time). Sample numbers. Total visits ' + sum(data, 'v') + ', busiest day ' + dmy(best.ts) + ' with ' + best.v + '.';
    var t, i;
    for (t = 0; t <= top; t += step) {
      sv('line', { x1: ml, x2: W - mr, y1: y(t), y2: y(t), stroke: '#CFC8DA', 'stroke-width': 1 }, svg);
      var yl = sv('text', { x: ml - 8, y: y(t) + 4, 'text-anchor': 'end' }, svg); yl.textContent = num(t);
    }
    sv('line', { x1: ml, x2: W - mr, y1: y(0), y2: y(0), stroke: '#1D1A24', 'stroke-width': 2 }, svg);
    /* x labels: first, last, others only 56px apart */
    var dx = n > 1 ? pw / (n - 1) : pw, k = Math.max(1, Math.ceil(56 / dx)), lab = [0];
    for (i = k; i < n - 1; i += k) if (x(n - 1) - x(i) >= 56) lab.push(i);
    if (n > 1) lab.push(n - 1);
    lab.forEach(function (j) { var last = j === n - 1 && x(j) + 24 > W, xt = sv('text', { x: last ? W - 2 : x(j), y: H - 8, 'text-anchor': last ? 'end' : 'middle' }, svg); xt.textContent = dmy(data[j].ts); });
    var path = function (key, color, dashed) { var d = ''; data.forEach(function (p, j) { d += (j ? 'L' : 'M') + x(j).toFixed(1) + ' ' + y(p[key]).toFixed(1); }); var a = { d: d, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round' }; if (dashed) a['stroke-dasharray'] = '6 4'; sv('path', a, svg); };
    if (cmp) { path('v0', '#1D1A24', true); path('pv0', '#5B4A8B', true); } path('v', '#1D1A24'); path('pv', '#5B4A8B');
    var mk = function (j, key, color, sq) { var c = x(j), yy = y(data[j][key]); return sq ? sv('rect', { x: c - 4, y: yy - 4, width: 8, height: 8, fill: color, stroke: '#fff', 'stroke-width': 2 }, svg) : sv('circle', { cx: c, cy: yy, r: 4, fill: color, stroke: '#fff', 'stroke-width': 2 }, svg); };
    for (i = 0; i < n; i++) if (days === 7 || i === n - 1) { mk(i, 'v', '#1D1A24', false); mk(i, 'pv', '#5B4A8B', true); }
    if (pc) { /* direct labels at the right end, moved apart by 14px */
      var ya = y(data[n - 1].v) + 4, yb = y(data[n - 1].pv) + 4;
      if (Math.abs(ya - yb) < 14) { if (ya >= yb) { ya = yb + 14; } else { yb = ya + 14; } }
      var l1 = sv('text', { x: x(n - 1) + 10, y: ya, class: 'dl' }, svg); l1.textContent = 'Visits';
      var l2 = sv('text', { x: x(n - 1) + 10, y: yb, class: 'dl' }, svg); l2.textContent = 'Page views';
    }
    var hover = sv('g', {}, svg), plot = h('div', 'an-plot'), tip = h('div', 'an-tip'), live = h('div', 'an-vh'), idx = n - 1;
    plot.style.cssText = 'left:' + ml + 'px;top:' + mt + 'px;width:' + pw + 'px;height:' + ph + 'px';
    plot.tabIndex = 0; plot.setAttribute('role', 'group'); plot.setAttribute('aria-label', 'Chart. Left and Right arrows read each day. Escape hides.');
    tip.hidden = true; live.setAttribute('aria-live', 'polite');
    function show(j) {
      idx = Math.max(0, Math.min(n - 1, j)); var d = data[idx]; hover.innerHTML = '';
      sv('line', { x1: x(idx), x2: x(idx), y1: mt, y2: y(0), stroke: '#1D1A24', 'stroke-width': 1 }, hover);
      [['v', '#1D1A24', 0], ['pv', '#5B4A8B', 1]].forEach(function (m) { var yy = y(d[m[0]]); if (m[2]) sv('rect', { x: x(idx) - 4, y: yy - 4, width: 8, height: 8, fill: m[1], stroke: '#fff', 'stroke-width': 2 }, hover); else sv('circle', { cx: x(idx), cy: yy, r: 4, fill: m[1], stroke: '#fff', 'stroke-width': 2 }, hover); });
      var l1 = 'Visits ' + d.v + (cmp ? ' (before: ' + d.v0 + ')' : ''), l2 = 'Page views ' + d.pv + (cmp ? ' (before: ' + d.pv0 + ')' : '');
      tip.innerHTML = ''; tip.appendChild(h('b', null, dfull(d.ts))); tip.appendChild(h('span', null, l1)); tip.appendChild(h('br')); tip.appendChild(h('span', null, l2));
      tip.hidden = false; var tw = tip.offsetWidth; tip.style.left = Math.max(0, Math.min(W - tw, x(idx) + 12)) + 'px'; tip.style.top = (mt + 4) + 'px';
      if (x(idx) + 12 + tw > W) tip.style.left = Math.max(0, x(idx) - 12 - tw) + 'px';
      live.textContent = dfull(d.ts) + '. ' + l1 + '. ' + l2 + '.';
    }
    function hide() { tip.hidden = true; hover.innerHTML = ''; }
    function at(e) { var r = plot.getBoundingClientRect(); return Math.round((e.clientX - r.left) / pw * (n - 1)); }
    plot.addEventListener('pointermove', function (e) { show(at(e)); });
    plot.addEventListener('pointerdown', function (e) { show(at(e)); });
    plot.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && document.activeElement !== plot) hide(); });
    plot.addEventListener('focus', function () { show(idx); });
    plot.addEventListener('blur', hide);
    plot.addEventListener('keydown', function (e) {
      var m = { ArrowLeft: idx - 1, ArrowRight: idx + 1, Home: 0, End: n - 1 };
      if (e.key in m) { e.preventDefault(); show(m[e.key]); } else if (e.key === 'Escape') { e.preventDefault(); hide(); }
    });
    add(box, plot, tip, live); wrap.appendChild(box);
    var rows = data.map(function (d) { return cmp ? [dfull(d.ts), d.v, d.pv, d.v0, d.pv0] : [dfull(d.ts), d.v, d.pv]; });
    var tot = { v: sum(data, 'v'), pv: sum(data, 'pv'), v0: sum(data, 'v0'), pv0: sum(data, 'pv0') };
    wrap.appendChild(details('line' + (cmp ? '-c' : ''), 'Visits and page views per day, last ' + days + ' days, sample numbers', cmp ? ['Date', 'Visits', 'Page views', 'Visits before', 'Page views before'] : ['Date', 'Visits', 'Page views'], rows));
    return { el: wrap, tot: tot };
  }

  /* ---------- bar chart ---------- */
  function barChart(title, items, o) {
    o = o || {}; var b = block(title), total = sum(items, 'v'), mx = Math.max.apply(null, items.map(function (i) { return i.v; }).concat([1]));
    var list = items.slice();
    if (!o.fixed) { var oth = list.filter(function (i) { return i.n === 'Other'; }); list = list.filter(function (i) { return i.n !== 'Other'; }).sort(function (a, c) { return c.v - a.v; }).concat(oth); }
    var ul = h('ul', 'an-bars'); ul.setAttribute('role', 'img'); ul.setAttribute('aria-label', title + '. Sample numbers. ' + list.map(function (i) { return i.n + ' ' + i.v; }).join(', ') + '.');
    list.forEach(function (i) {
      var li = h('li', 'an-bar'), nm = h('div', 'nm', i.n); if (i.sub) nm.appendChild(h('small', null, i.sub)); li.appendChild(nm);
      var tr = h('div', 'tr'), fl = h('div', 'fl' + (i.v === 0 ? ' zero' : '')); var f = i.v / mx;
      fl.style.width = i.v === 0 ? '0' : 'max(4px, calc((100% - 132px) * ' + f.toFixed(4) + '))'; tr.style.position = 'relative';
      tr.appendChild(fl); tr.appendChild(h('div', 'vl', i.v === 0 ? '0' : nf.format(i.v) + ' ' + (o.unit || 'visits') + ' - ' + Math.round(i.v / (total || 1) * 100) + '%')); li.appendChild(tr); ul.appendChild(li);
    });
    b.appendChild(ul);
    b.appendChild(details('bar-' + title, title + ', sample numbers', [o.col || 'Item', o.unitHead || 'Visits', 'Share'], list.map(function (i) { return [i.n + (i.sub ? ' (' + i.sub + ')' : ''), i.v, Math.round(i.v / (total || 1) * 100) + '%']; })));
    return b;
  }

  /* ---------- split bar ---------- */
  function swatch(kind, w, hh) {
    var s = document.createElementNS(NS, 'svg'); s.setAttribute('width', w); s.setAttribute('height', hh); s.setAttribute('aria-hidden', 'true');
    var f = { Phone: ['#F4A7C0', 'dots'], PC: ['#B9A3E3', 'hatch'], Tablet: ['#DCD6E4', null], Other: ['#FFFFFF', 'cross'] }[kind];
    sv('rect', { x: 1, y: 1, width: w - 2, height: hh - 2, fill: f[0], stroke: '#1D1A24', 'stroke-width': 2 }, s);
    if (f[1]) sv('rect', { x: 2, y: 2, width: w - 4, height: hh - 4, fill: 'url(#an-p-' + f[1] + ')' }, s);
    return s;
  }
  function splitBar(items, W) {
    var b = block('Phone, PC and tablet'), total = sum(items, 'v') || 1, H = 36, svg = sv('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'img' });
    svg.style.display = 'block'; svg.style.maxWidth = '100%';
    sv('title', {}, svg).textContent = 'Visits by device. Sample numbers. ' + items.map(function (i) { return i.n + ' ' + Math.round(i.v / total * 100) + ' percent'; }).join(', ') + '.';
    var cp = sv('clipPath', { id: 'an-sbclip' }, svg); sv('rect', { x: 1, y: 2, width: W - 2, height: 32, rx: 6 }, cp);
    var g = sv('g', { 'clip-path': 'url(#an-sbclip)' }, svg), x = 1, iw = W - 2;
    var vis = items.filter(function (i) { return i.v > 0; });
    vis.forEach(function (i, j) {
      var w = Math.max(4, i.v / total * iw), f = { Phone: ['#F4A7C0', 'dots'], PC: ['#B9A3E3', 'hatch'], Tablet: ['#DCD6E4', null], Other: ['#FFFFFF', 'cross'] }[i.n];
      sv('rect', { x: x, y: 2, width: w, height: 32, fill: f[0] }, g); if (f[1]) sv('rect', { x: x, y: 2, width: w, height: 32, fill: 'url(#an-p-' + f[1] + ')' }, g);
      x += w; if (j < vis.length - 1) sv('rect', { x: x - 1, y: 2, width: 2, height: 32, fill: '#1D1A24' }, g);
    });
    sv('rect', { x: 1, y: 2, width: W - 2, height: 32, rx: 6, fill: 'none', stroke: '#1D1A24', 'stroke-width': 2 }, svg);
    b.appendChild(svg);
    var ul = h('ul', 'an-split');
    items.forEach(function (i) { var li = h('li'); li.appendChild(swatch(i.n, 24, 16)); li.appendChild(h('span', 'nm', i.n)); li.appendChild(h('span', 'big', Math.round(i.v / total * 100) + '%')); li.appendChild(h('span', 'sm', nf.format(i.v) + ' visits')); ul.appendChild(li); });
    b.appendChild(ul);
    b.appendChild(details('split', 'Visits by device, sample numbers', ['Device', 'Visits', 'Share'], items.map(function (i) { return [i.n, i.v, Math.round(i.v / total * 100) + '%']; })));
    return b;
  }

  /* ---------- Core Web Vitals ---------- */
  var RATE = {
    good: ['Good', '<circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4 7.2l2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.5"/>'],
    mid: ['Needs improvement', '<path d="M7 1.5L13 12.5H1Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M7 5.5v3M7 10v.5" stroke="currentColor" stroke-width="1.5"/>'],
    poor: ['Poor', '<rect x="1.5" y="1.5" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4.5 4.5l5 5M9.5 4.5l-5 5" stroke="currentColor" stroke-width="1.5"/>'],
    na: ['n/a', '<path d="M3 7h8" stroke="currentColor" stroke-width="1.5"/>']
  };
  function chip(k) { var c = h('span', 'an-rate ' + k); c.appendChild(icon(RATE[k][1], 14)); c.appendChild(document.createTextNode(RATE[k][0])); return c; }
  function rate(kind, v) { if (v == null) return 'na'; var t = { lcp: [2500, 4000], inp: [200, 500], cls: [0.1, 0.25] }[kind]; return v <= t[0] ? 'good' : v <= t[1] ? 'mid' : 'poor'; }
  function fms(v) { return v == null ? 'n/a' : v < 1000 ? v + ' ms' : (v / 1000).toFixed(1) + ' s'; }
  function perf(days, empty) {
    var i = { 7: 0, 30: 1, 90: 2 }[days];
    return {
      Phone: { n: [34, 120, 340][i], load: [1900, 1800, 1700][i], lcp: [2600, 2300, 2100][i], inp: [180, 150, 140][i], cls: [0.06, 0.04, 0.03][i] },
      PC: { n: [6, 18, 55][i], load: [1100, 950, 900][i], lcp: [1500, 1400, 1300][i], inp: [[620, 640][0], 620, 410][i], cls: [null, null, 0.12][i] }
    };
  }
  function vitals(days) {
    var P = perf(days), wrap = h('div', 'an-block'), cols = h('div', 'an-vcols'), rows = [];
    ['Phone', 'PC'].forEach(function (dev) {
      var p = P[dev], col = h('div', 'an-vcol'), h4 = h('h4'); h4.appendChild(swatch(dev, 24, 16)); h4.appendChild(document.createTextNode(dev)); col.appendChild(h4);
      var sm = h('p', 'an-samp'); if (p.n < 20) { sm.appendChild(icon('<circle cx="7" cy="7" r="5.5" fill="none" stroke="#6A6378" stroke-width="1.5"/><path d="M7 6.5v3.5M7 4v1" stroke="#6A6378" stroke-width="1.5"/>', 14)); sm.appendChild(document.createTextNode('Few samples (' + p.n + '). Treat as a guess.')); } else sm.textContent = 'from ' + p.n + ' page loads';
      col.appendChild(sm);
      [['Page load (median)', null, p.load, null, ''], ['Loading', 'LCP', p.lcp, 'lcp', 'Good up to 2.5 s, poor above 4 s'], ['Reacting to taps', 'INP', p.inp, 'inp', 'Good up to 200 ms, poor above 500 ms'], ['Layout jumping', 'CLS', p.cls, 'cls', 'Good up to 0.1, poor above 0.25']].forEach(function (m) {
        var r = h('div', 'an-vrow'), nm = h('div', 'nm', m[0] + (m[1] ? ' ' : '')); if (m[1]) nm.appendChild(h('small', null, '(' + m[1] + ')'));
        var val = m[3] === 'cls' ? (m[2] == null ? 'n/a' : m[2].toFixed(2)) : fms(m[2]), v = h('div', 'vv' + (m[2] == null ? ' na' : ''), val);
        r.appendChild(nm); r.appendChild(v); var rc = h('div', 'rc'); if (m[3]) rc.appendChild(chip(rate(m[3], m[2]))); r.appendChild(rc);
        if (m[4]) r.appendChild(h('div', 'th', m[4])); col.appendChild(r);
        rows.push([dev + ' - ' + m[0] + (m[1] ? ' (' + m[1] + ')' : ''), val, m[3] ? RATE[rate(m[3], m[2])][0] : '-']);
      });
      cols.appendChild(col);
    });
    wrap.appendChild(cols); wrap.appendChild(details('perf', 'Core Web Vitals by device, last ' + days + ' days, sample numbers', ['Measure', 'Value', 'Rating'], rows)); return wrap;
  }

  /* ---------- tab content ---------- */
  function content(tab, W) {
    var d = S.range, empty = S.view === 'empty', out = [], r = rng(d + 9);
    if (tab === 'overview') {
      var data = gen(d, empty), tv = sum(data, 'v'), tpv = sum(data, 'pv'), pv0 = sum(data, 'pv0'), v0 = sum(data, 'v0');
      var sw = h('label', 'an-switch'), cb = h('input'); cb.type = 'checkbox'; cb.id = 'an-cmp'; cb.checked = S.cmp;
      cb.addEventListener('change', function () { S.cmp = cb.checked; $('an-live').textContent = ''; drawTp(); $('an-cmp').focus(); setTimeout(function () { $('an-live').textContent = S.cmp ? 'Comparison on' : 'Comparison off'; }, 30); });
      sw.appendChild(cb); sw.appendChild(h('span', 'trk')); sw.lastChild.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M3 7.5l2.5 2.5L11 4.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>'; sw.appendChild(h('span', null, 'Compare with previous period'));
      out.push(sw);
      var ov = h('div', 'an-ov'), tb = block(), tiles = h('div', 'an-tiles'); tiles.appendChild(tile('VISITS', tv, v0, d)); tiles.appendChild(tile('PAGE VIEWS', tpv, pv0, d)); tb.appendChild(tiles); ov.appendChild(tb);
      var cw = isPC() ? Math.max(300, W - 240 - 32) : W;
      var lb = block('Visits and page views per day'); lb.appendChild(lineChart(d, cw, S.cmp).el); ov.appendChild(lb);
      out.push(ov);
    } else if (tab === 'sources') {
      var s = named(SRC, scaled([82, 12, 26, 70, 20], d, 1, empty));
      out.push(barChart('Where visits came from', s.map(function (i) { return i; }), { fixed: true }));
      var oh = h('p', 'an-note', 'Other sites (top 5): ' + named(['t.co', 'bing.com', 'duckduckgo.com', 'reddit.com', 'linktr.ee'], scaled([6, 5, 4, 3, 2], d, 2, empty)).map(function (i) { return i.n + ' ' + i.v; }).join(', '));
      out.push(oh); out.push(h('p', 'an-note', 'Some Instagram visits arrive with no referrer and show as Direct / unknown, so Instagram may be under-counted.'));
    } else if (tab === 'pages') {
      var pv = scaled([210, 90, 150, 64, 35, 12, 3], d, 3, empty), en = scaled([96, 58, 22, 14, 7, 3], d, 4, empty), c = h('div', 'an-cols');
      c.appendChild(barChart('Page views by page', PAGES.map(function (p, i) { return { n: p[0], sub: p[1], v: pv[i] }; }), { unit: 'page views', col: 'Page', unitHead: 'Page views' }));
      c.appendChild(barChart('Where visits start (entry pages)', ENTRY.map(function (p, i) { return { n: p[0], sub: p[1], v: en[i] }; }), { col: 'Page' }));
      out.push(c);
    } else if (tab === 'audience') {
      out.push(splitBar(named(DEV, scaled([85, 32, 3], d, 5, empty)), W));
      var cc = h('div', 'an-cols'); cc.appendChild(barChart('Countries', named(CTRY, scaled([96, 14, 9, 6, 5, 4, 3, 3, 2, 2, 6], d, 6, empty)), { col: 'Country' }));
      cc.appendChild(barChart('Browsers', named(BRW, scaled([52, 38, 24, 12, 6, 3, 4], d, 7, empty)), { col: 'Browser' })); out.push(cc);
    } else { out.push(vitals(d)); }
    return out;
  }

  /* ---------- messages ---------- */
  function msg(kind, l1, l2, btns, role) {
    var m = h('div', 'msg ' + kind); m.setAttribute('role', role || 'status');
    m.appendChild(h('span', 'ic', kind === 'err' ? '!' : '–')); m.lastChild.setAttribute('aria-hidden', 'true');
    var d = h('div'); d.appendChild(kind === 'err' ? (function () { var p = h('p'); p.appendChild(h('b', null, l1)); return p; })() : h('p', null, l1));
    if (l2) d.appendChild(h('p', 'next', l2));
    if (btns && btns.length) { var a = h('div', 'acts'); btns.forEach(function (b) { a.appendChild(b); }); d.appendChild(a); }
    m.appendChild(d); return m;
  }
  function btn(txt, cls, fn) { var b = h('button', 'btn ' + cls, txt); b.type = 'button'; b.addEventListener('click', fn); return b; }
  function errFor(v) {
    var again = function () { return btn('Try again', 'btn-secondary', function () { goLoad('data'); }); };
    if (v === '401') return msg('err', 'Passcode is wrong. Paste the current one.', 'It is kept in this browser until you press Forget passcode in Settings below.', [again()], 'alert');
    if (v === '429') return msg('err', 'Cloudflare is busy. Try again in 2 minutes.', 'Your passcode is fine.', [again()], 'alert');
    if (v === '502') return msg('err', 'Could not load the numbers. Try again.', 'Cloudflare did not answer properly. Your passcode is fine.', [again()], 'alert');
    if (v === 'net') return msg('err', 'Could not reach the analytics Worker. Check your internet connection.', 'Nothing was changed.', [again()], 'alert');
    if (v === '403') return msg('err', 'This page is not allowed to ask for the numbers. Open /admin/ from the real site address.', 'The Worker only answers the address it was set up for. See worker/README.md.', [], 'alert');
    return msg('err', 'The Worker is missing a setting. See worker/README.md.', null, [again()], 'alert');
  }
  function skeleton(tab) {
    var f = [], t = h('div', 'an-sk-t');
    if (tab === 'overview') { t.appendChild(h('div', 'an-sk t')); t.appendChild(h('div', 'an-sk t')); f.push(t, h('div', 'an-sk c')); }
    else if (tab === 'performance') { f.push(h('div', 'an-sk c')); }
    else { for (var i = 0; i < 4; i++) f.push(h('div', 'an-sk r')); }
    var l = h('div'); l.appendChild(h('p', 'mono', 'Loading...')); l.appendChild(h('div', 'ibar')); f.unshift(l); return f;
  }

  /* ---------- render ---------- */
  function chipText() {
    if (!S.setup) return ['Not set up', '']; if (!S.pass) return ['No passcode', ''];
    if (S.view === 'loading') return [S.lastChip, S.lastS || 'ok'];
    if (['401', '429', '502', 'net', '403', '503'].indexOf(S.view) >= 0) return ['Error', 'err'];
    return ['Last ' + S.range + ' days', 'ok'];
  }
  function render() {
    var ct = chipText(), chipEl = $('an-chip'); chipEl.textContent = ct[0]; if (ct[1]) chipEl.dataset.s = ct[1]; else chipEl.removeAttribute('data-s');
    if (S.view !== 'loading') { S.lastChip = ct[0]; S.lastS = ct[1]; }
    var nots = $('an-notset'); nots.hidden = S.setup; nots.innerHTML = ''; if (!S.setup) nots.appendChild(msg('none', 'Analytics is not set up yet. See worker/README.md.', 'Nothing is sent anywhere until it is.'));
    $('an-pc').hidden = !(S.setup && !S.pass); $('an-npmsg').hidden = !(S.setup && !S.pass);
    var on = S.setup && S.pass; ['an-tools', 'an-tabs', 'an-tp'].forEach(function (i) { $(i).hidden = !on; }); $('an-prow').hidden = !on;
    var key = !S.setup ? '' : !S.pass ? 'np' : S.view === '401' ? '401' : '';
    if (key && key !== S.autoKey) $('an-settings').open = true; S.autoKey = key;
    if (!on) { drawPassRow(); drawSb(); return; }
    /* range */
    var rg = $('an-range'); rg.innerHTML = '';
    [7, 30, 90].forEach(function (d) {
      var l = h('label', d === 90 && S.r90off ? 'is-off' : ''), i = h('input'); i.type = 'radio'; i.name = 'an-r'; i.value = d; i.checked = S.range === d;
      if (d === 90 && S.r90off) { i.disabled = true; l.setAttribute('aria-disabled', 'true'); i.setAttribute('aria-describedby', 'an-r90'); }
      i.addEventListener('change', function () { S.range = d; S.cmp = false; if (S.view === 'data' || S.view === 'empty') goLoad(S.view); else render(); });
      l.appendChild(i); l.appendChild(document.createTextNode(d + ' days')); rg.appendChild(l);
    });
    var r90 = $('an-r90'); r90.hidden = !S.r90off; r90.innerHTML = ''; if (S.r90off) r90.appendChild(msg('none', '90 days is not available yet. Cloudflare has not kept that much data.', 'Showing 30 days instead.'));
    $('an-refresh').disabled = S.view === 'loading'; $('an-refresh').setAttribute('aria-disabled', S.view === 'loading');
    $('an-upd').textContent = 'Updated 14:' + (S.min < 10 ? '0' : '') + S.min + ' Malaysia time';
    /* tabs */
    var tl = $('an-tabs'), had = tl.contains(document.activeElement); tl.innerHTML = '';
    TABS.forEach(function (t) {
      var b = h('button', null, t[1]); b.type = 'button'; b.id = 'an-t-' + t[0]; b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', 'an-tp');
      var sel = S.tab === t[0]; b.setAttribute('aria-selected', sel); b.tabIndex = sel ? 0 : -1;
      b.addEventListener('click', function () { selectTab(t[0], false); });
      b.addEventListener('focus', function () { b.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'auto' }); });
      tl.appendChild(b);
    });
    if (had) $('an-t-' + S.tab).focus();
    drawTp(); drawPassRow(); drawSb();
  }
  function drawTp() {
    var tp = $('an-tp'), W = tp.clientWidth || lastW || 600; tp.innerHTML = ''; lastW = tp.clientWidth || lastW;
    tp.setAttribute('aria-labelledby', 'an-t-' + S.tab); tp.setAttribute('aria-busy', S.view === 'loading');
    var kids = [], plain = false;
    if (S.view === 'loading') { kids = skeleton(S.tab); plain = true; }
    else if (S.view === 'data' || S.view === 'empty') {
      var f = END - (S.range - 1) * 864e5;
      kids.push(h('p', 'an-range-line', dmy(f) + ' - ' + dmy(END) + ' 2026 (Malaysia time)' + (S.tab === 'overview' ? ', compared with the ' + S.range + ' days before' : '') + ' - sample numbers'));
      if (S.view === 'empty') { kids.push(msg('none', 'No visits in this period yet.', 'Only page loads on the public pages are counted. Numbers update about every 10 minutes.')); plain = true; }
      else kids = kids.concat(content(S.tab, W));
    } else { kids.push(errFor(S.view)); plain = S.view === '403'; }
    kids.forEach(function (k) { tp.appendChild(k); });
    if (plain) tp.tabIndex = 0; else tp.removeAttribute('tabindex');
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) { tp.classList.remove('fade'); void tp.offsetWidth; tp.classList.add('fade'); }
  }
  function drawSb() {
    var box = $('an-sb'); if (box.children.length) { [].forEach.call(box.children, function (b) { b.setAttribute('aria-pressed', b.dataset.k === S.sw); }); return; }
    SW.forEach(function (s) { var b = h('button', null, s[1]); b.type = 'button'; b.dataset.k = s[0]; b.addEventListener('click', function () { setSw(s[0]); }); box.appendChild(b); });
    drawSb();
  }
  function setSw(k) {
    clearTimeout(timer); S.sw = k; S.setup = k !== 'notset'; S.pass = k !== 'nopass'; S.r90off = false; S.test = '';
    S.view = { ok: 'data', empty: 'empty', loading: 'loading', r90: 'data' }[k] || (['notset', 'nopass'].indexOf(k) >= 0 ? 'data' : k);
    if (k === 'r90') { S.r90off = true; if (S.range === 90) S.range = 30; }
    if (k !== 'nopass') { S.pass = true; }
    if (k === 'notset' || k === 'nopass') S.view = 'data';
    render();
  }
  function goLoad(next) {
    clearTimeout(timer); var prevSw = S.sw; S.view = 'loading'; S.sw = next === 'empty' ? 'empty' : (S.sw === 'r90' ? 'r90' : 'ok'); render();
    timer = setTimeout(function () { S.view = next; S.min = Math.min(59, S.min + 5); render(); }, 450);
  }
  function selectTab(id, focus) {
    S.tab = id; if (S.view === 'data' || S.view === 'empty') goLoad(S.view); else render();
    var b = $('an-t-' + id); if (b) { b.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'auto' }); if (focus) b.focus(); }
  }
  $('an-tabs').addEventListener('keydown', function (e) {
    var i = TABS.map(function (t) { return t[0]; }).indexOf(S.tab), n = TABS.length, j = null;
    if (e.key === 'ArrowRight') j = (i + 1) % n; else if (e.key === 'ArrowLeft') j = (i - 1 + n) % n; else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = n - 1;
    if (j == null) return; e.preventDefault(); selectTab(TABS[j][0], true); $('an-t-' + TABS[j][0]).focus();
  });

  /* ---------- passcode ---------- */
  function drawPassRow(mode, keepFocus) {
    var r = $('an-prow'); r.innerHTML = ''; if (!S.pass) return;
    var p = h('p', 'mono', 'Passcode saved (ends in ...' + S.last + ')'); r.appendChild(p);
    if (S.test) r.appendChild(h('p', 'mono', S.test));
    if (mode === 'confirm') {
      r.appendChild(h('p', 'mono', 'Forget the passcode on this browser?'));
      var bar = h('div', 'bar'), keep, yes = btn('Yes, forget it', 'btn-secondary is-danger', function () { S.pass = false; S.sw = 'nopass'; S.test = ''; S.view = 'data'; render(); var f = $('an-pass'); if (f) f.focus(); });
      keep = btn('Keep it', 'btn-secondary', function () { drawPassRow(); var f = $('an-forget'); if (f) f.focus(); });
      bar.appendChild(yes); bar.appendChild(keep); r.appendChild(bar); keep.focus();
      r.onkeydown = function (e) { if (e.key === 'Escape') { e.preventDefault(); keep.click(); } };
    } else {
      r.onkeydown = null;
      var b2 = h('div', 'bar'); b2.appendChild(btn('Test', 'btn-secondary', function () { S.test = 'Passcode works (sample, nothing was sent).'; drawPassRow(); }));
      var fg = btn('Forget passcode', 'btn-secondary is-danger', startForget); fg.id = 'an-forget'; b2.appendChild(fg); r.appendChild(b2);
    }
  }
  function startForget() { drawPassRow('confirm'); $('an-prow').scrollIntoView({ block: 'nearest', behavior: 'auto' }); }
  $('an-save').addEventListener('click', function () { var v = $('an-pass').value; S.last = v.length >= 4 ? v.slice(-4) : 'x7Kq'; $('an-pass').value = ''; S.pass = true; S.sw = 'ok'; S.view = 'data'; render(); goLoad('data'); });
  $('an-test0').addEventListener('click', function () { $('an-test0').textContent = 'Test (sample)'; setTimeout(function () { $('an-test0').textContent = 'Test'; }, 900); });
  $('an-refresh').addEventListener('click', function () { goLoad(S.view === 'empty' ? 'empty' : 'data'); });

  /* ---------- redraw when the width changes (charts are pixel-exact, text never scaled) ---------- */
  var tpEl = $('an-tp');
  function onSize() {
    var w = tpEl.clientWidth; if (!w || w === lastW) return; lastW = w;
    if (!S.everOpen) { S.everOpen = true; if (S.setup && S.pass && S.view === 'data') { goLoad('data'); return; } }
    if (S.view === 'data' || S.view === 'empty') drawTp();
  }
  if (window.ResizeObserver) new ResizeObserver(onSize).observe(tpEl); else window.addEventListener('resize', onSize);
  render();
})();
