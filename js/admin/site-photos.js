// Site photos panel (TASK-14): portrait, the 5 reel covers and the share image. One image at a time goes
// through the same watermark pipeline as event photos (watermark.js makeSitePhoto: same watermarkLayout,
// same text and opacity controls, then the TASK-15 marker). "Use for ..." updates the site draft and adds the
// file to the Publish list. Download is the backup path (commit the file by hand at the shown path).
import {
  makeSitePhoto, watermarkOptions, formatBytes, SHARE_MAX_BYTES, MAX_FILE_BYTES,
} from './watermark.js';
import { addPendingSiteFile, removePendingSiteFile } from './pending.js';
import {
  siteDraftReady, onSiteDraftChange, baseReels, draftPortrait, draftThumb, setPortrait, setThumb,
  discardSiteDraft, PORTRAIT_PATH, SHARE_PATH, reelCoverPath,
} from './site-draft.js';
import { addDiscardHook } from './manager.js';
import { PUBLISH_BUSY_EVENT } from './github-panel.js';

export const SITE_MESSAGES = Object.freeze({
  shareTooBig: 'This share image is too big (over 5 MB). Try another photo.',
  tooBig: 'This photo is too big to publish (over 25 MB). Please use a smaller original.',
  noReel: 'This reel is not in data/reels.json, so it has no cover to set.',
});

const $ = (id) => document.getElementById(id);
let file = null; // the picked image (only kept in this tab)
let out = null; // { target, blob, width, height, downloaded, url }
let run = 0; // newer processing makes older results stale
let busy = false;
let timer = 0;

/** The selected target: { kind: 'portrait' | 'reel' | 'share', label, path, reelId, clearLabel }. */
export function currentTarget(select = $('sp-target')) {
  const option = select.selectedOptions[0];
  if (option.value === 'portrait') {
    return { kind: 'portrait', label: 'Portrait', path: PORTRAIT_PATH, clearLabel: 'Clear portrait' };
  }
  if (option.value === 'share') return { kind: 'share', label: 'Share image', path: SHARE_PATH };
  const kana = option.dataset.kana;
  const reel = baseReels().find((r) => r.kana === kana);
  return {
    kind: 'reel',
    label: `Reel cover ${kana}`,
    path: reel ? reelCoverPath(reel.id) : '',
    reelId: reel ? reel.id : null,
    clearLabel: 'Clear cover',
  };
}

function currentValue(target) {
  if (target.kind === 'portrait') return draftPortrait();
  if (target.kind === 'reel') return target.reelId ? draftThumb(target.reelId) : '';
  return null;
}

function setError(text) {
  $('sp-error').hidden = !text;
  $('sp-error').textContent = text ? `! ${text}` : '';
  $('sp-card').classList.toggle('is-err', Boolean(text));
}

function problem(target, o) {
  if (target.kind === 'reel' && !target.reelId) return SITE_MESSAGES.noReel;
  if (!o) return '';
  if (target.kind === 'share' && o.blob.size > SHARE_MAX_BYTES) return SITE_MESSAGES.shareTooBig;
  if (o.blob.size > MAX_FILE_BYTES) return SITE_MESSAGES.tooBig;
  return '';
}

/** Shows the target's current value, the Clear button and the preview buttons. */
function render() {
  const target = currentTarget();
  const value = currentValue(target);
  const now = $('sp-now');
  if (target.kind === 'share') now.textContent = `Now: ${SHARE_PATH} (one file, used as the link preview on every page)`;
  else now.textContent = value ? `Now: ${value}` : 'Now: placeholder (no photo)';
  const clear = $('sp-clear');
  clear.hidden = target.kind === 'share';
  clear.textContent = target.clearLabel || 'Clear';
  clear.disabled = busy || !value;

  const ready = Boolean(out) && out.target.path === target.path && out.target.kind === target.kind;
  const bad = problem(target, ready ? out : null);
  $('sp-use').textContent = `Use for ${target.label}`;
  $('sp-use').disabled = busy || !ready || Boolean(bad);
  $('sp-download').disabled = !ready || Boolean(bad);
  $('sp-path').textContent = target.path || '';
  if (ready || bad) setError(bad);
}

function setStatus(state) {
  const card = $('sp-card');
  card.hidden = false;
  card.dataset.state = state;
  $('sp-bar').hidden = state !== 'processing';
  const status = $('sp-status');
  status.replaceChildren();
  if (state === 'processing') status.textContent = 'Processing...';
  else if (state === 'ready') {
    const icon = document.createElement('span');
    icon.className = 'wm-check';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '✓';
    status.append(icon, ' Ready');
  } else if (state === 'added') status.textContent = 'Added to Publish';
}

async function process() {
  if (!file) return;
  const mine = ++run;
  const target = currentTarget();
  out = null;
  setError('');
  setStatus('processing');
  $('sp-name').firstChild.textContent = `${file.name} `;
  render();
  let made;
  try {
    made = await makeSitePhoto(file, target.kind === 'share' ? 'share' : 'webp', watermarkOptions());
  } catch (error) {
    if (mine !== run) return;
    setStatus('error');
    setError(error.message);
    render();
    return;
  }
  if (mine !== run) return; // a newer target, file or watermark setting took over
  out = { ...made, target, downloaded: false };
  const img = $('sp-img');
  if (img.dataset.url) URL.revokeObjectURL(img.dataset.url);
  img.dataset.url = URL.createObjectURL(out.blob);
  img.src = img.dataset.url;
  img.width = out.width;
  img.height = out.height;
  img.alt = `${target.label} with the watermark`;
  const fig = $('sp-figure');
  fig.dataset.width = String(out.width);
  fig.dataset.height = String(out.height);
  fig.dataset.bytes = String(out.blob.size);
  $('sp-size').textContent = `${out.width} x ${out.height} · ${formatBytes(out.blob.size)}`;
  setStatus('ready');
  render();
}

function download() {
  if (!out) return;
  const a = document.createElement('a');
  a.href = $('sp-img').dataset.url;
  a.download = out.target.path.split('/').pop();
  document.body.append(a);
  a.click();
  a.remove();
  out.downloaded = true;
}

function use() {
  const target = currentTarget();
  if (!out || busy || problem(target, out) || out.target.path !== target.path) return;
  if (target.kind === 'portrait') setPortrait(PORTRAIT_PATH);
  else if (target.kind === 'reel') setThumb(target.reelId, target.path);
  addPendingSiteFile({ target: target.kind, label: target.label, path: target.path, out });
  setStatus('added');
  render();
}

function clearValue() {
  const target = currentTarget();
  if (busy) return;
  if (target.kind === 'portrait') setPortrait(null);
  else if (target.kind === 'reel' && target.reelId) setThumb(target.reelId, '');
  else return;
  removePendingSiteFile(target.path);
  render();
}

function rerenderSoon() {
  clearTimeout(timer);
  timer = setTimeout(process, 250);
}

async function init() {
  if (!$('site-photos')) return;
  await siteDraftReady;
  $('sp-target').addEventListener('change', () => (file ? process() : render()));
  $('sp-file').addEventListener('change', (e) => {
    const picked = e.target.files[0];
    e.target.value = '';
    if (!picked) return;
    file = picked;
    process();
  });
  $('sp-use').addEventListener('click', use);
  $('sp-download').addEventListener('click', download);
  $('sp-clear').addEventListener('click', clearValue);
  $('wm-text').addEventListener('input', rerenderSoon);
  $('wm-opacity').addEventListener('input', rerenderSoon);
  window.addEventListener(PUBLISH_BUSY_EVENT, (e) => {
    busy = Boolean(e.detail && e.detail.busy);
    render();
  });
  onSiteDraftChange(render);
  addDiscardHook(discardSiteDraft);
  render();
  document.documentElement.dataset.sitePhotosReady = 'true';
}

init();
