// Moment photo (TASK-22): the uploader target for the moment open in the Moments panel. One image at a time
// goes through the same pipeline as site photos (watermark.js makeSitePhoto 'webp': longest side 1200px,
// never enlarged, q0.85, the same watermarkLayout / WM_DIVISOR lattice, then the TASK-15 marker).
// "Use for moment" sets the moment's photo, saves the draft and adds the file to the Publish list (it uses the
// site-photo pending list with target 'moment', so it counts towards the 20-photo limit). Download is the backup.
import { makeSitePhoto, watermarkOptions, formatBytes, MAX_FILE_BYTES } from './watermark.js';
import { addPendingSiteFile, pendingSiteFiles, onPendingChange } from './pending.js';
import { momentsDraftReady, onMomentsChange, momentPhotoPath } from './moments-draft.js';
import { currentMomentId, editingMomentId, onMomentFormChange, useMomentPhoto } from './moments.js';
import { PUBLISH_BUSY_EVENT } from './github-panel.js';

export const MOMENT_PHOTO_MESSAGES = Object.freeze({
  tooBig: 'This photo is too big to publish (over 25 MB). Please use a smaller original.',
  notSaved: 'The moment form has errors, so the photo was not used. Fix the fields marked with !, then press "Use for moment" again.',
});

const $ = (id) => document.getElementById(id);
let file = null; // the picked image (only kept in this tab)
let out = null; // { blob, width, height, downloaded }
let run = 0;
let busy = false;
let timer = 0;
let addedPath = ''; // the path of the file just added with "Use for moment" (shown until the next image)

/** The path the photo gets for the moment in the form now (pending files count as taken). */
function targetPath() {
  const taken = new Set(pendingSiteFiles().map((f) => f.path));
  return momentPhotoPath(currentMomentId(), taken);
}

function setError(text) {
  $('mp-error').hidden = !text;
  $('mp-error').textContent = text ? `! ${text}` : '';
  $('mp-card').classList.toggle('is-err', Boolean(text));
}

function render() {
  const id = currentMomentId();
  $('mp-for').textContent = editingMomentId()
    ? `For moment: ${id}`
    : `For a new moment: ${id} (saved when you press "Use for moment")`;
  $('mp-path').textContent = addedPath || targetPath();
  const tooBig = Boolean(out) && out.blob.size > MAX_FILE_BYTES;
  if (out) setError(tooBig ? MOMENT_PHOTO_MESSAGES.tooBig : $('mp-error').dataset.keep || '');
  $('mp-use').disabled = busy || !out || tooBig || Boolean(addedPath);
  $('mp-download').disabled = !out || tooBig;
}

function setStatus(state) {
  const card = $('mp-card');
  card.hidden = false;
  card.dataset.state = state;
  $('mp-bar').hidden = state !== 'processing';
  const status = $('mp-status');
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
  out = null;
  addedPath = '';
  $('mp-error').dataset.keep = '';
  setError('');
  setStatus('processing');
  $('mp-name').firstChild.textContent = `${file.name} `;
  render();
  let made;
  try {
    made = await makeSitePhoto(file, 'webp', watermarkOptions());
  } catch (error) {
    if (mine !== run) return;
    setStatus('error');
    setError(error.message);
    $('mp-use').disabled = true;
    $('mp-download').disabled = true;
    return;
  }
  if (mine !== run) return; // a newer file or watermark setting took over
  out = { ...made, downloaded: false };
  const img = $('mp-img');
  if (img.dataset.url) URL.revokeObjectURL(img.dataset.url);
  img.dataset.url = URL.createObjectURL(out.blob);
  img.src = img.dataset.url;
  img.width = out.width;
  img.height = out.height;
  img.alt = 'Moment photo with the watermark';
  const fig = $('mp-figure');
  fig.dataset.width = String(out.width);
  fig.dataset.height = String(out.height);
  fig.dataset.bytes = String(out.blob.size);
  $('mp-size').textContent = `${out.width} x ${out.height} · ${formatBytes(out.blob.size)}`;
  setStatus('ready');
  render();
}

function download() {
  if (!out) return;
  const a = document.createElement('a');
  a.href = $('mp-img').dataset.url;
  a.download = (addedPath || targetPath()).split('/').pop();
  document.body.append(a);
  a.click();
  a.remove();
  out.downloaded = true;
}

function use() {
  if (!out || busy || out.blob.size > MAX_FILE_BYTES) return;
  const path = targetPath();
  const saved = useMomentPhoto(path);
  if (!saved || saved.photo !== path) {
    $('mp-error').dataset.keep = MOMENT_PHOTO_MESSAGES.notSaved;
    setError(MOMENT_PHOTO_MESSAGES.notSaved);
    return;
  }
  $('mp-error').dataset.keep = '';
  addedPath = path;
  addPendingSiteFile({ target: 'moment', label: `Moment ${saved.id}`, path, momentId: saved.id, out });
  setStatus('added');
  render();
}

function rerenderSoon() {
  clearTimeout(timer);
  timer = setTimeout(process, 250);
}

async function init() {
  if (!$('moment-photo')) return;
  await momentsDraftReady;
  $('mp-file').addEventListener('change', (e) => {
    const picked = e.target.files[0];
    e.target.value = '';
    if (!picked) return;
    file = picked;
    process();
  });
  $('mp-use').addEventListener('click', use);
  $('mp-download').addEventListener('click', download);
  $('wm-text').addEventListener('input', rerenderSoon);
  $('wm-opacity').addEventListener('input', rerenderSoon);
  window.addEventListener(PUBLISH_BUSY_EVENT, (e) => {
    busy = Boolean(e.detail && e.detail.busy);
    render();
  });
  onMomentFormChange(render);
  onMomentsChange(render);
  onPendingChange(render);
  render();
  document.documentElement.dataset.momentPhotoReady = 'true';
}

init();
