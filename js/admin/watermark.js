// Media uploader: resize to max 2000px, draw the watermark, export WebP. Runs only in the browser;
// redrawing on a canvas also drops EXIF data (GPS location, camera details).
import { SITE } from '../site-config.js';
import { slugify } from '../events-data.js';
import { onEventChange, attachPhoto } from './manager.js';

export const MAX_SIDE = 2000;
export const QUALITY = 0.85;

const $ = (id) => document.getElementById(id);
const items = []; // { file, bitmap, blob, url, outName, card }
let eventId = null;

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function token(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/** Output size: longest side at most MAX_SIDE, never enlarged. */
export function fitSize(width, height, max = MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Draws `source` (ImageBitmap / image / canvas) with the watermark onto a new canvas.
 * opts: { text, position: br|bl|tr|tl|c, opacity: 0.1..1 }
 */
export function renderWatermark(source, opts) {
  const { width, height } = fitSize(source.width, source.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0, width, height);

  const text = (opts.text || '').trim();
  if (!text) return canvas;
  const size = Math.max(14, Math.round(Math.min(width, height) * 0.035));
  const pad = Math.round(size * 0.9);
  ctx.font = `700 ${size}px "Space Mono", ui-monospace, monospace`;
  ctx.textBaseline = 'alphabetic';
  const metrics = ctx.measureText(text);
  const textW = metrics.width;
  const pos = opts.position || 'br';
  let x;
  let y;
  if (pos === 'c') {
    x = (width - textW) / 2;
    y = height / 2 + size / 3;
  } else {
    x = pos.endsWith('r') ? width - pad - textW : pad;
    y = pos.startsWith('b') ? height - pad : pad + size;
  }

  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.max(0.1, opts.opacity ?? 0.6));
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, Math.round(size * 0.14));
  ctx.strokeStyle = token('--color-ink', '#1D1A24');
  ctx.strokeText(text, x, y);
  ctx.fillStyle = token('--color-surface', '#FFFFFF');
  ctx.fillText(text, x, y);
  ctx.restore();
  return canvas;
}

export function outputName(fileName) {
  const base = fileName.replace(/\.[^.]+$/, '');
  return `${slugify(base)}-wm.webp`;
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', QUALITY));
}

function options() {
  return {
    text: $('wm-text').value,
    position: $('wm-pos').value,
    opacity: Number($('wm-opacity').value) / 100,
  };
}

function repoPath(item) {
  return `media/events/${eventId || '<event-id>'}/${item.outName}`;
}

function download(item) {
  const a = make('a');
  a.href = item.url;
  a.download = item.outName;
  document.body.append(a);
  a.click();
  a.remove();
}

function formatKb(bytes) {
  return `${Math.round(bytes / 1024)} KB`;
}

async function renderItem(item) {
  const canvas = renderWatermark(item.bitmap, options());
  const blob = await canvasToBlob(canvas);
  if (item.url) URL.revokeObjectURL(item.url);
  item.blob = blob;
  item.url = URL.createObjectURL(blob);
  item.width = canvas.width;
  item.height = canvas.height;
  if (blob.type !== 'image/webp') item.outName = item.outName.replace(/\.webp$/, '.png');

  const { card } = item;
  card.querySelector('img').src = item.url;
  card.querySelector('.wm-meta').textContent = `${canvas.width} × ${canvas.height} · ${formatKb(blob.size)} · ${blob.type.replace('image/', '').toUpperCase()}`;
  card.querySelector('.wm-path').textContent = repoPath(item);
  card.dataset.width = String(canvas.width);
  card.dataset.height = String(canvas.height);
}

function buildCard(item) {
  const li = make('li', 'wm-card');
  const img = make('img');
  img.alt = `Watermarked preview of ${item.file.name}`;
  li.append(img, make('p', 'wm-name', item.outName), make('p', 'wm-meta', 'Working…'), make('p', 'wm-path'));
  const actions = make('div', 'wm-actions');
  const dl = make('button', 'btn btn-primary btn-sm', 'Download');
  dl.type = 'button';
  dl.addEventListener('click', () => download(item));
  const attach = make('button', 'btn btn-secondary btn-sm', 'Attach to selected event');
  attach.type = 'button';
  attach.addEventListener('click', () => {
    if (!eventId) {
      li.querySelector('.wm-path').textContent = 'Pick or fill in an event first (date + short form).';
      return;
    }
    attachPhoto(repoPath(item));
  });
  actions.append(dl, attach);
  li.append(actions);
  return li;
}

async function addFiles(fileList) {
  const files = [...fileList].filter((f) => f.type.startsWith('image/') || /\.(heic|heif|avif)$/i.test(f.name));
  for (const file of files) {
    const item = { file, outName: outputName(file.name) };
    item.card = buildCard(item);
    $('wm-previews').append(item.card);
    try {
      item.bitmap = await createImageBitmap(file);
      items.push(item);
      await renderItem(item);
    } catch (error) {
      item.card.querySelector('.wm-meta').textContent = `Could not open this image in this browser (${error.message}).`;
    }
  }
  $('wm-download-all').disabled = items.length === 0;
}

async function rerenderAll() {
  $('wm-opacity-out').textContent = `${$('wm-opacity').value}%`;
  for (const item of items) await renderItem(item);
}

async function downloadAll() {
  for (const item of items) {
    download(item);
    await new Promise((r) => setTimeout(r, 300));
  }
}

function init() {
  $('wm-text').value = SITE.watermark;
  $('wm-files').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
  ['wm-text', 'wm-pos', 'wm-opacity'].forEach((id) => $(id).addEventListener('input', rerenderAll));
  $('wm-download-all').addEventListener('click', downloadAll);

  const zone = $('drop-zone');
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('is-dragging'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-dragging'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('is-dragging');
    addFiles(e.dataTransfer.files);
  });

  onEventChange((id) => {
    eventId = id;
    $('wm-event-id').textContent = id || '(fill in date + short form, or edit an event)';
    items.forEach((item) => { item.card.querySelector('.wm-path').textContent = repoPath(item); });
  });
  if (document.fonts && document.fonts.load) document.fonts.load('700 20px "Space Mono"').then(rerenderAll).catch(() => {});
  document.documentElement.dataset.uploaderReady = 'true';
}

init();
