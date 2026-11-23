// Media uploader (TASK-7): every photo becomes two watermarked WebP files, a full-resolution
// master and a 1200px display copy. The watermark is the white dashed diagonal lattice from
// docs/style-guide.md ("Lattice watermark"): +45 and -45 degree dashed lines, a small heart at every
// crossing and the name written along the up-right lines. Everything runs in this browser; drawing
// on a canvas also drops EXIF data (GPS location, camera details).
import { SITE } from '../site-config.js';
import { slugify } from '../events-data.js';
import { onEventChange, attachPhoto, usedPhotoPaths, isEditingSavedEvent } from './manager.js';
import { addPendingPair, removePendingItem, pendingPaths, markPipelineFile, isPendingItem, onPendingChange, pendingHooks } from './pending.js';
import { addWatermarkMarker } from './wm-marker.js';

/** Watermark density: f = round(shorter side / WM_DIVISOR). 80 = "2x" (user decision 2026-11-18). */
export const WM_DIVISOR = 80;
export const WM_MIN_F = 8;
export const DEFAULT_OPACITY = 0.4;
export const DISPLAY_MAX_SIDE = 1200;
export const WEBP_MAX_SIDE = 16383;
export const MASTER_QUALITY = 0.95;
export const DISPLAY_QUALITY = 0.85;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const IOS_CANVAS_PIXELS = 16777216;

const FONT_FAMILY = '"Space Mono", ui-monospace, monospace';
const WHITE = '#FFFFFF';

export const MESSAGES = {
  read: 'Could not read this file. Is it a JPG, PNG or WebP?',
  tooLarge: 'Too large for this browser. Please use a desktop browser (Chrome, Edge or Firefox).',
  noWebp: "This browser can't make WebP files. Please use Chrome, Edge or Firefox.",
  tooBig: 'This photo is too big to publish (over 25 MB). Please use a smaller original.',
};

/* ---------- Pure helpers ---------- */

/** Layout of the lattice for an image of this size. Everything is relative to the unit f. */
export function watermarkLayout(width, height) {
  const f = Math.max(WM_MIN_F, Math.round(Math.min(width, height) / WM_DIVISOR));
  return {
    f,
    cell: 14 * f,
    lineWidth: Math.max(1, 0.1 * f),
    dash: [0.5 * f, 0.35 * f],
    gap: 0.5 * f,
    heart: 0.3 * f,
  };
}

/** Size with the longest side at most `max`, keeping the ratio. Never enlarges. */
export function fitSize(width, height, max) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Master: original pixels, only scaled down when a side is over the WebP limit. */
export const masterSize = (w, h) => fitSize(w, h, WEBP_MAX_SIDE);
/** Display copy: longest side 1200px. */
export const displaySize = (w, h) => fitSize(w, h, DISPLAY_MAX_SIDE);

/** "<slug>" of the original file name (without extension). */
export function baseName(fileName) {
  return slugify(fileName.replace(/\.[^.]+$/, '')) || 'photo';
}

function isIOS() {
  const ua = navigator.userAgent;
  return /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/* ---------- Drawing ---------- */

/** Small upright heart centred on (x, y). The context is rotated -45deg, so the heart turns +45deg back. */
function drawHeart(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.beginPath();
  ctx.moveTo(0, 0.9 * s);
  ctx.bezierCurveTo(-1.6 * s, -0.2 * s, -0.6 * s, -1.4 * s, 0, -0.5 * s);
  ctx.bezierCurveTo(0.6 * s, -1.4 * s, 1.6 * s, -0.2 * s, 0, 0.9 * s);
  ctx.fill();
  ctx.restore();
}

/**
 * Draws the lattice in solid white (full opacity) on `ctx`, covering a width x height area.
 * The caller puts this layer on the photo at the chosen opacity, so overlaps are never brighter.
 */
export function drawLattice(ctx, width, height, text) {
  const { f, cell, lineWidth, dash, gap, heart } = watermarkLayout(width, height);
  const n = Math.ceil(Math.sqrt(width * width + height * height) / 2 / cell) + 1;
  const span = n * cell;
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-Math.PI / 4); // x axis now rises left to right: the up-right lines are horizontal here
  ctx.strokeStyle = WHITE;
  ctx.fillStyle = WHITE;
  ctx.lineWidth = lineWidth;
  ctx.setLineDash(dash);
  ctx.font = `700 ${f}px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = (text || '').trim();
  const half = label ? ctx.measureText(label).width / 2 + gap : 0;

  ctx.beginPath();
  for (let i = -n; i <= n; i += 1) {
    const p = i * cell;
    ctx.moveTo(p, -span); // up-left lines: unbroken
    ctx.lineTo(p, span);
    for (let j = -n; j < n; j += 1) { // up-right lines: broken around the name
      const x0 = j * cell;
      const mid = x0 + cell / 2;
      if (half > 0 && half < cell / 2) {
        ctx.moveTo(x0, p); ctx.lineTo(mid - half, p);
        ctx.moveTo(mid + half, p); ctx.lineTo(x0 + cell, p);
      } else if (half === 0) {
        ctx.moveTo(x0, p); ctx.lineTo(x0 + cell, p);
      } // a name longer than a cell: no line on this up-right segment, only the text
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);

  for (let i = -n; i <= n; i += 1) {
    for (let j = -n; j <= n; j += 1) {
      drawHeart(ctx, j * cell, i * cell, heart);
      if (label && j < n) ctx.fillText(label, j * cell + cell / 2, i * cell);
    }
  }
  ctx.restore();
}

class UploadError extends Error {
  constructor(kind) { super(MESSAGES[kind]); this.kind = kind; }
}

function newCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx || canvas.width !== width || canvas.height !== height) throw new UploadError('tooLarge');
  return { canvas, ctx };
}

/**
 * The photo scaled to width x height with the watermark on top (one layer, one opacity).
 * `crop` (optional, TASK-14 share image) = the source rectangle { sx, sy, sw, sh } to fill the canvas with.
 * The lattice is always drawn after the photo, over the whole width x height output.
 */
export function renderWatermarked(source, width, height, { text, opacity }, crop = null) {
  const { canvas, ctx } = newCanvas(width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (crop) ctx.drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, height);
  else ctx.drawImage(source, 0, 0, width, height);
  const layer = newCanvas(width, height);
  drawLattice(layer.ctx, width, height, text);
  ctx.globalAlpha = Math.min(1, Math.max(0.1, opacity));
  ctx.drawImage(layer.canvas, 0, 0);
  ctx.globalAlpha = 1;
  layer.canvas.width = 0; // free the layer's memory now, big masters use a lot
  return canvas;
}

function toBlob(canvas, quality, type = 'image/webp') {
  return new Promise((resolve) => {
    try {
      canvas.toBlob(resolve, type, quality);
    } catch {
      resolve(null);
    }
  });
}

async function encode(source, size, opts, quality, { type = 'image/webp', crop = null } = {}) {
  const canvas = renderWatermarked(source, size.width, size.height, opts, crop);
  const blob = await toBlob(canvas, quality, type);
  canvas.width = 0;
  if (!blob) throw new UploadError('tooLarge');
  if (blob.type !== type) throw new UploadError(type === 'image/webp' ? 'noWebp' : 'tooLarge');
  // TASK-15: the hidden "made by the uploader" marker, added after the watermark is drawn and before the
  // file is previewed, downloaded, attached or listed. Marking makes a new Blob, and only that marked Blob
  // is registered as a pipeline file (TASK-13): the unmarked encoder output can never be published.
  let marked;
  try {
    const bytes = addWatermarkMarker(new Uint8Array(await blob.arrayBuffer()), {
      f: watermarkLayout(size.width, size.height).f,
      div: WM_DIVISOR,
    });
    marked = new Blob([bytes], { type });
  } catch (error) {
    console.error(error);
    throw new UploadError(type === 'image/webp' ? 'noWebp' : 'tooLarge');
  }
  markPipelineFile(marked); // only blobs registered here can be published (TASK-13)
  return { blob: marked, width: size.width, height: size.height };
}

/* ---------- Site photos (TASK-14): one file per target ---------- */

/** Share image: exactly this size, centre-cropped to fill. */
export const SHARE_WIDTH = 1200;
export const SHARE_HEIGHT = 630;
export const SHARE_MAX_BYTES = 5 * 1024 * 1024;

/** The centred source rectangle with the ratio of outW x outH that fills it (no stretching). */
export function coverCrop(width, height, outW, outH) {
  const scale = Math.max(outW / width, outH / height);
  const sw = Math.min(width, outW / scale);
  const sh = Math.min(height, outH / scale);
  return { sx: (width - sw) / 2, sy: (height - sh) / 2, sw, sh };
}

/**
 * One watermarked + marked site photo from an image file, through the same pipeline as event photos
 * (renderWatermarked -> drawLattice -> watermarkLayout, then addWatermarkMarker, then markPipelineFile).
 * kind 'webp': longest side 1200px, ratio kept, never enlarged (portrait, reel covers).
 * kind 'share': PNG, exactly 1200 x 630, centre-cropped, the lattice drawn after cropping.
 * Resolves { blob, width, height } or throws an Error with a user message.
 */
export async function makeSitePhoto(file, kind, opts = watermarkOptions()) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new UploadError('read');
  }
  try {
    await fontsReady;
    if (kind === 'share') {
      const crop = coverCrop(bitmap.width, bitmap.height, SHARE_WIDTH, SHARE_HEIGHT);
      return await encode(bitmap, { width: SHARE_WIDTH, height: SHARE_HEIGHT }, opts, undefined, { type: 'image/png', crop });
    }
    return await encode(bitmap, displaySize(bitmap.width, bitmap.height), opts, DISPLAY_QUALITY);
  } catch (error) {
    if (error instanceof UploadError) throw error;
    console.error(error);
    throw new UploadError('tooLarge');
  } finally {
    bitmap.close();
  }
}

/* ---------- Uploader UI ---------- */

const $ = (id) => document.getElementById(id);
const items = [];
let eventId = null;
let chain = Promise.resolve();
let rerenderQueued = false;
let rerenderTimer = 0;

/** Space Mono must be loaded before drawing, or the canvas silently uses the fallback font. */
const fontsReady = (async () => {
  if (document.readyState !== 'complete') await new Promise((r) => window.addEventListener('load', r, { once: true }));
  if (!document.fonts || !document.fonts.load) return;
  await Promise.race([
    document.fonts.load(`700 20px "Space Mono"`).catch(() => {}),
    new Promise((r) => setTimeout(r, 4000)),
  ]);
})();

/** Runs uploader work one step at a time (one photo after the other, never in parallel). */
function enqueue(task) {
  chain = chain.then(task).catch((error) => console.error(error));
  return chain;
}

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** The text and opacity controls of the uploader (shared by the Site photos panel). */
export function watermarkOptions() {
  return { text: $('wm-text').value, opacity: Number($('wm-opacity').value) / 100 };
}
const options = watermarkOptions;

function paths(item) {
  const dir = `media/events/${eventId || '<event-id>'}`;
  return { display: `${dir}/${item.name}.webp`, master: `${dir}/${item.name}-full.webp` };
}

/** Gives each card a file name that is not used yet for the selected event ("-2", "-3" ...). */
function assignNames() {
  const taken = eventId ? new Set([...usedPhotoPaths(), ...pendingPaths()]) : new Set();
  for (const item of items) {
    if (item.attached && item.attached.eventId === eventId) {
      item.name = item.attached.name;
    } else {
      const base = baseName(item.file.name);
      let name = base;
      for (let n = 2; ; n += 1) {
        item.name = name;
        const p = paths(item);
        if (!taken.has(p.display) && !taken.has(p.master)) break;
        name = `${base}-${n}`;
      }
    }
    const p = paths(item);
    taken.add(p.display);
    taken.add(p.master);
    updatePaths(item);
  }
}

function updatePaths(item) {
  const p = paths(item);
  item.ui.paths.replaceChildren(p.display, make('br'), p.master);
}

function setState(item, state, message) {
  const { ui } = item;
  item.state = state;
  ui.card.dataset.state = state;
  ui.card.classList.toggle('is-err', state === 'error' || item.tooBig);
  ui.status.replaceChildren();
  ui.bar.hidden = state !== 'processing';
  if (state === 'processing') {
    ui.status.textContent = 'Processing...';
  } else if (state === 'ready') {
    const icon = make('span', 'wm-check', '✓');
    icon.setAttribute('aria-hidden', 'true');
    ui.status.append(icon, ' Ready');
  }
  const errorText = message || (item.tooBig && state === 'ready' ? MESSAGES.tooBig : '');
  ui.error.hidden = !errorText;
  ui.error.textContent = errorText ? `! ${errorText}` : '';
  const hasFiles = state === 'ready';
  ui.downloadDisplay.disabled = !hasFiles;
  ui.downloadMaster.disabled = !hasFiles;
  ui.attach.disabled = !hasFiles || item.tooBig;
  ui.pair.hidden = !(item.display && state !== 'error');
  $('wm-download-all').disabled = !items.some((i) => i.state === 'ready');
}

function showOutput(item, which, out) {
  const fig = item.ui[which];
  if (item.urls[which]) URL.revokeObjectURL(item.urls[which]);
  item.urls[which] = URL.createObjectURL(out.blob);
  fig.img.src = item.urls[which];
  fig.img.width = out.width;
  fig.img.height = out.height;
  fig.size.textContent = `${out.width} x ${out.height} · ${formatBytes(out.blob.size)}`;
  fig.root.dataset.width = String(out.width);
  fig.root.dataset.height = String(out.height);
  fig.root.dataset.bytes = String(out.blob.size);
}

async function processItem(item) {
  if (!items.includes(item)) return; // removed while waiting
  setState(item, 'processing');
  // The decoded photo is only kept while its two files are made (a 24 MP photo is about 96 MB),
  // then released. A re-render decodes item.file again.
  let bitmap;
  try {
    bitmap = await createImageBitmap(item.file);
  } catch {
    if (items.includes(item)) setState(item, 'error', MESSAGES.read);
    return;
  }
  if (!items.includes(item)) { bitmap.close(); return; } // removed with X while the photo was being read
  item.readable = true;
  try {
    await fontsReady;
    if (!items.includes(item)) return;
    const opts = options();
    const m = masterSize(bitmap.width, bitmap.height);
    const d = displaySize(bitmap.width, bitmap.height);
    if (m.width * m.height > IOS_CANVAS_PIXELS && isIOS()) throw new UploadError('tooLarge');
    const display = await encode(bitmap, d, opts, DISPLAY_QUALITY);
    const master = await encode(bitmap, m, opts, MASTER_QUALITY);
    bitmap.close();
    bitmap = null;
    if (!items.includes(item)) return; // removed with X while it was processing: throw the result away
    item.display = display;
    item.master = master;
    item.downloaded = { display: false, master: false };
    item.tooBig = display.blob.size > MAX_FILE_BYTES || master.blob.size > MAX_FILE_BYTES;
    if (item.tooBig) removePendingItem(item);
    showOutput(item, 'display', display);
    showOutput(item, 'master', master);
    setState(item, 'ready');
  } catch (error) {
    if (!(error instanceof UploadError)) console.error(error);
    if (!items.includes(item)) return;
    item.display = null;
    item.master = null;
    removePendingItem(item);
    setState(item, 'error', error instanceof UploadError ? error.message : MESSAGES.tooLarge);
  } finally {
    if (bitmap) bitmap.close();
  }
}

function download(item, which) {
  const p = paths(item);
  const a = make('a');
  a.href = item.urls[which];
  a.download = (which === 'display' ? p.display : p.master).split('/').pop();
  document.body.append(a);
  a.click();
  a.remove();
  item.downloaded[which] = true;
}

function attach(item) {
  if (!eventId) {
    item.ui.error.hidden = false;
    item.ui.error.textContent = '! Pick or fill in an event first (date + short form).';
    return;
  }
  if (item.state !== 'ready' || item.tooBig) return;
  item.attached = { eventId, name: item.name, unsaved: !isEditingSavedEvent() };
  const p = paths(item);
  addPendingPair({ eventId, photo: p.display, photoFull: p.master, item });
  attachPhoto(p.display, p.master);
  assignNames();
}

/**
 * A pair attached to a new event that is not saved yet uses the id the form would give it. When the
 * date or short form changes, that id changes too, so the pair (and the form's photo paths) move to
 * the new id. Pairs whose paths are no longer in the form are left alone (Publish drops unused pairs).
 */
function rekeyUnsavedPairs(newId) {
  if (!newId || isEditingSavedEvent()) return;
  const formPhoto = $('f-photo').value.trim();
  for (const item of items) {
    const a = item.attached;
    if (!a || !a.unsaved || a.eventId === newId) continue;
    const oldDisplay = `media/events/${a.eventId}/${a.name}.webp`;
    if (formPhoto !== oldDisplay) continue;
    item.attached = null;
    assignNames(); // picks a free name for the new id
    item.attached = { eventId: newId, name: item.name, unsaved: true };
    const p = paths(item);
    removePendingItem(item);
    addPendingPair({ eventId: newId, photo: p.display, photoFull: p.master, item });
    attachPhoto(p.display, p.master);
  }
}

function removeNow(item) {
  const i = items.indexOf(item);
  if (i !== -1) items.splice(i, 1);
  removePendingItem(item);
  Object.values(item.urls).forEach((u) => u && URL.revokeObjectURL(u));
  item.ui.card.remove();
  assignNames();
  $('wm-download-all').disabled = !items.some((x) => x.state === 'ready');
}

/** Asks before taking a photo out of the publish. Resolves true on "Remove", false on Cancel or Esc. */
function confirmRemove(item) {
  const dialog = $('wm-remove-confirm');
  const who = pendingHooks.describe ? pendingHooks.describe(item) : '';
  $('wm-remove-text').textContent = `Remove ${item.file.name}? It is attached to ${who || 'an event'} and will be taken out of the publish.`;
  return new Promise((resolve) => {
    const yes = $('wm-remove-yes');
    const no = $('wm-remove-no');
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      yes.removeEventListener('click', onYes);
      no.removeEventListener('click', onNo);
      dialog.removeEventListener('cancel', onCancel);
      dialog.removeEventListener('close', onClose);
      if (dialog.open) dialog.close();
      resolve(ok);
    };
    const onYes = () => finish(true);
    const onNo = () => finish(false);
    const onCancel = (e) => { e.preventDefault(); finish(false); };
    const onClose = () => finish(false);
    yes.addEventListener('click', onYes);
    no.addEventListener('click', onNo);
    dialog.addEventListener('cancel', onCancel);
    dialog.addEventListener('close', onClose);
    dialog.showModal();
    no.focus(); // the safe choice
  });
}

let askingFor = null;
/**
 * TASK-23: the X button. A card that is not waiting to publish goes at once. A pending card asks first, then
 * does exactly what "Remove from publish" does (the event gets its published photo back, or none).
 */
async function removeItem(item) {
  if (!items.includes(item)) return;
  if (!isPendingItem(item)) { removeNow(item); return; }
  if (publishBusy || askingFor) return;
  askingFor = item;
  const ok = await confirmRemove(item);
  askingFor = null;
  if (!ok || !items.includes(item)) return;
  if (isPendingItem(item) && pendingHooks.undo) pendingHooks.undo(item);
  removeNow(item);
}

let publishBusy = false;
function syncRemoveButtons() {
  for (const item of items) item.ui.remove.disabled = publishBusy && isPendingItem(item);
}

function buildFigure(kind, chipText) {
  const root = make('figure', `wm-thumb wm-thumb-${kind}`);
  const img = make('img');
  img.alt = `${chipText} copy with the watermark`;
  const cap = make('figcaption');
  const chip = make('span', `chip chip-${kind}`, chipText);
  const size = make('span', 'wm-size');
  cap.append(chip, make('br'), size);
  root.append(img, cap);
  return { root, img, size };
}

function button(className, label, onClick) {
  const b = make('button', `btn ${className} btn-sm`, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

function buildCard(item) {
  const card = make('li', 'wm-card');
  const pair = make('div', 'wm-pair');
  const master = buildFigure('master', 'MASTER');
  const display = buildFigure('display', 'DISPLAY');
  pair.append(master.root, display.root);
  const nameRow = make('p', 'wm-name', item.file.name);
  const status = make('span', 'wm-status');
  status.setAttribute('role', 'status');
  nameRow.append(' ', status);
  const bar = make('div', 'wm-ibar');
  bar.setAttribute('aria-hidden', 'true');
  const error = make('p', 'wm-error');
  error.setAttribute('role', 'alert');
  const pathsBox = make('p', 'wm-path');
  const actions = make('div', 'wm-actions');
  const ui = {
    card, pair, master, display, status, bar, error, paths: pathsBox,
    downloadDisplay: button('btn-secondary', 'Download display', () => download(item, 'display')),
    downloadMaster: button('btn-secondary', 'Download full size', () => download(item, 'master')),
    attach: button('btn-primary', 'Attach to selected event', () => attach(item)),
    remove: make('button', 'wm-x'),
  };
  ui.remove.type = 'button';
  ui.remove.setAttribute('aria-label', `Remove ${item.file.name}`);
  const cross = make('span', '', '×');
  cross.setAttribute('aria-hidden', 'true');
  ui.remove.append(cross);
  ui.remove.addEventListener('click', () => removeItem(item));
  actions.append(ui.attach, ui.downloadDisplay, ui.downloadMaster);
  card.append(ui.remove, pair, nameRow, bar, error, pathsBox, actions); // X first: Tab order = top to bottom
  return ui;
}

function addFiles(fileList) {
  for (const file of [...fileList]) {
    const item = { file, name: baseName(file.name), urls: {}, downloaded: { display: false, master: false }, state: 'queued', tooBig: false };
    item.ui = buildCard(item);
    items.push(item);
    $('wm-previews').append(item.ui.card);
    setState(item, 'processing');
    enqueue(() => processItem(item));
  }
  assignNames();
}

function scheduleRerender() {
  $('wm-opacity-out').textContent = `${$('wm-opacity').value}%`;
  clearTimeout(rerenderTimer);
  rerenderTimer = setTimeout(() => {
    if (rerenderQueued) return;
    rerenderQueued = true;
    enqueue(async () => {
      rerenderQueued = false;
      for (const item of items.slice()) {
        if (item.readable) await processItem(item); // re-render every photo that could be read
      }
    });
  }, 200);
}

async function downloadAll() {
  for (const item of items.filter((i) => i.state === 'ready')) {
    download(item, 'display');
    await new Promise((r) => setTimeout(r, 300));
    download(item, 'master');
    await new Promise((r) => setTimeout(r, 300));
  }
}

function init() {
  $('wm-text').value = SITE.watermark;
  $('wm-opacity').value = String(Math.round(DEFAULT_OPACITY * 100));
  $('wm-opacity-out').textContent = `${$('wm-opacity').value}%`;
  $('wm-files').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
  $('wm-text').addEventListener('input', scheduleRerender);
  $('wm-opacity').addEventListener('input', scheduleRerender);
  $('wm-download-all').addEventListener('click', downloadAll);

  const zone = $('drop-zone');
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('is-dragging'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-dragging'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('is-dragging');
    addFiles(e.dataTransfer.files);
  });

  window.addEventListener('publish-busy-change', (e) => { publishBusy = Boolean(e.detail && e.detail.busy); syncRemoveButtons(); });
  onPendingChange(syncRemoveButtons);
  onEventChange((id) => {
    eventId = id;
    rekeyUnsavedPairs(id);
    $('wm-event-id').textContent = id || '(fill in date + short form, or edit an event)';
    assignNames();
  });
  document.documentElement.dataset.uploaderReady = 'true';
}

init();
