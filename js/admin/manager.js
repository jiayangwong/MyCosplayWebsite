// Event manager: edit events in the browser, keep a draft in localStorage, import/export events.json.
// Nothing here changes the live site. Publish (publish.js) commits the draft; Export is the hand-made backup.
// The draft also remembers which data/events.json it started from (`base`: git blob SHA + export text),
// so Publish can stop if the repo's copy changed in the meantime.
import { EVENTS_URL, sortEvents, validateEvent, makeEventId, formatDate, eventPhotos, normalizeEvent, MAX_EVENT_PHOTOS } from '../events-data.js';
import { renderMedia } from '../embed.js';
import { gitBlobSha } from './git-blob.js';
import { githubFetch, readToken } from './github-token.js';
import { GITHUB } from './github-config.js';
import { setFold } from './folds.js';
import { defaultPageSize, pageCount, pageOf, readPageSize, savePageSize } from './paging.js';
import { askRemove } from './confirm-remove.js';
import { pendingPairs, removePendingItem } from './pending.js';

export const DRAFT_KEY = 'puzzkezz.events.draft';
const FIELDS = ['date', 'short', 'name', 'venue', 'link'];
/** Photo slot inputs D1 D2 D3 (D1 keeps the ids of the single-photo form). */
const SLOT_IDS = [['f-photo', 'f-photo-full'], ['f-photo-2', 'f-photo-full-2'], ['f-photo-3', 'f-photo-full-3']];
/** Error field -> input that gets the focus and aria-invalid. */
const PHOTO_FIELD_INPUT = { photo: 'f-photo', photoFull: 'f-photo-full', photoFull2: 'f-photo-full-2', photoFull3: 'f-photo-full-3', photos: 'f-photo' };
/** Form input id for a data field ("photoFull" -> "f-photo-full"). */
const inputId = (field) => `f-${field.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
/** Key order used by Export: photoFull is written right after photo. */
const EXPORT_ORDER = ['id', 'date', 'short', 'name', 'venue', 'activities', 'link', 'photo', 'photoFull', 'photos', 'sample'];

const $ = (id) => document.getElementById(id);
const state = { events: [], editingId: null, base: { sha: null, text: '' }, page: 0, size: 10 };
const listeners = new Set();
const slotListeners = new Set();
const draftListeners = new Set();
const REPO_READ_TIMEOUT_MS = 30000;
let draftLoading = false;
const BANNER_DRAFT = 'Source: your browser draft (not published yet). Press Publish to GitHub to put it live.';
let resolveReady;
/** Resolves once the events and the base are loaded. */
export const managerReady = new Promise((resolve) => { resolveReady = resolve; });

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function setBanner(text) {
  $('source-banner').textContent = text;
}

function draftChanged() {
  draftListeners.forEach((fn) => fn());
}

function saveDraft(banner = BANNER_DRAFT) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      version: 1,
      savedAt: new Date().toISOString(),
      baseEventsSha: state.base.sha,
      baseEventsText: state.base.text,
      events: state.events,
    }));
    setBanner(banner);
  } catch (error) {
    setBanner(`Could not save the draft in this browser: ${error.message}`);
  }
  draftChanged();
}

function readDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!Array.isArray(data.events)) return null;
    const base = typeof data.baseEventsSha === 'string' && typeof data.baseEventsText === 'string'
      ? { sha: data.baseEventsSha, text: data.baseEventsText }
      : null;
    return { events: data.events, base };
  } catch {
    return null;
  }
}

/** The published data/events.json: its events and its base (git blob SHA of the exact bytes + export text). */
async function loadPublished() {
  try {
    const response = await fetch(EVENTS_URL, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = await response.arrayBuffer();
    const data = JSON.parse(new TextDecoder().decode(bytes));
    const events = (Array.isArray(data.events) ? data.events : []).map(normalizeEvent);
    return { events, base: { sha: await gitBlobSha(bytes), text: exportText(events) } };
  } catch (error) {
    console.warn('Could not load data/events.json:', error.message);
    return { events: [], base: { sha: null, text: '' } };
  }
}

/* ---------- Event list ---------- */
function renderList() {
  const list = $('event-list');
  list.replaceChildren();
  const total = state.events.length;
  $('event-count').textContent = total ? `${total} ${total === 1 ? 'event' : 'events'}` : 'No events';
  const pages = pageCount(total, state.size);
  state.page = Math.min(Math.max(0, state.page), pages - 1);
  $('event-size-box').hidden = !total;
  $('event-pager').hidden = !total;
  $('event-page').textContent = `Page ${state.page + 1} of ${pages}`;
  $('event-prev').disabled = state.page === 0;
  $('event-next').disabled = state.page >= pages - 1;
  if (!total) {
    list.append(make('li', 'panel-hint', 'No events yet. Use "New event".'));
  }
  const first = state.page * state.size;
  state.events.slice(first, first + state.size).forEach((event, k) => {
    const i = first + k;
    const li = make('li', `event-row${event.id === state.editingId ? ' is-editing' : ''}`);
    li.dataset.id = event.id;
    const info = make('div');
    info.append(make('p', 'event-row-title', `${event.short} · ${event.name}`));
    const meta = make('p', 'event-row-meta', `${formatDate(event.date)}${event.sample ? ' · SAMPLE' : ''}`);
    const count = eventPhotos(event).length;
    const chip = make('span', 'ph-chip', count === 0 ? 'No photos' : `${count} ${count === 1 ? 'photo' : 'photos'}`);
    chip.dataset.n = String(count);
    meta.append(chip);
    info.append(meta);

    const actions = make('div', 'event-row-actions');
    const prev = state.events[i - 1];
    const next = state.events[i + 1];
    const button = (label, aria, onClick, disabled = false, extra = '') => {
      const b = make('button', `icon-btn ${extra}`.trim(), label);
      b.type = 'button';
      b.setAttribute('aria-label', aria);
      b.disabled = disabled;
      b.addEventListener('click', onClick);
      return b;
    };
    actions.append(
      button('Edit', `Edit ${event.short} ${event.date}`, () => startEdit(event.id)),
      button('↑', `Move ${event.short} ${event.date} up`, () => move(i, -1), !(prev && prev.date === event.date)),
      button('↓', `Move ${event.short} ${event.date} down`, () => move(i, 1), !(next && next.date === event.date)),
      button('Delete', `Delete ${event.short} ${event.date}`, () => remove(event.id), false, 'is-danger'),
    );
    li.append(info, actions);
    list.append(li);
  });
}

function move(index, delta) {
  const j = index + delta;
  const a = state.events[index];
  const b = state.events[j];
  if (!a || !b || a.date !== b.date) return;
  state.events[index] = b;
  state.events[j] = a;
  state.page = pageOf(j, state.size); // the list follows the moved row to its page
  saveDraft();
  renderList();
  const row = $('event-list').querySelector(`.event-row[data-id="${a.id}"]`);
  const btn = row && [...row.querySelectorAll('.icon-btn')][delta < 0 ? 1 : 2];
  (btn && !btn.disabled ? btn : row && row.querySelector('.icon-btn'))?.focus();
}

function setPage(page) {
  state.page = page;
  renderList();
}

function onPageSize() {
  const size = Number($('event-page-size').value);
  const firstIndex = state.page * state.size;
  state.size = size;
  state.page = pageOf(firstIndex, size);
  savePageSize(size);
  renderList();
}

function remove(id) {
  const event = state.events.find((e) => e.id === id);
  if (!event) return;
  if (!window.confirm(`Delete "${event.short} · ${event.name}" (${event.date})?`)) return;
  state.events = state.events.filter((e) => e.id !== id);
  if (state.editingId === id) clearForm();
  saveDraft();
  renderList();
}

/* ---------- Form ---------- */
function addActivityRow(value = '') {
  const list = $('activity-list');
  const li = make('li', 'activity-row');
  const n = list.children.length + 1;
  const input = make('input');
  input.type = 'text';
  input.value = value;
  input.id = `f-activity-${Date.now()}-${n}`;
  input.setAttribute('aria-label', `Activity ${n}`);
  input.placeholder = 'e.g. character name, stage, booth';
  const del = make('button', 'icon-btn', 'Remove');
  del.type = 'button';
  del.setAttribute('aria-label', `Remove activity ${n}`);
  del.addEventListener('click', () => li.remove());
  li.append(input, del);
  list.append(li);
  return input;
}

/** The three photo slots as typed in the form: [{ photo, photoFull }] (empty strings when blank). */
function formSlots() {
  return SLOT_IDS.map(([p, f]) => ({ photo: $(p).value.trim(), photoFull: $(f).value.trim() }));
}

/** Slots with a Display photo, in order, as [{ photo, photoFull? }] (no gaps). */
function compactSlots(raw) {
  return raw.filter((x) => x.photo).map((x) => (x.photoFull ? { photo: x.photo, photoFull: x.photoFull } : { photo: x.photo }));
}

/** Puts a list of photos into the three slot rows (empty rows after the last one). */
function setFormSlots(list) {
  SLOT_IDS.forEach(([p, f], i) => {
    $(p).value = (list[i] && list[i].photo) || '';
    $(f).value = (list[i] && list[i].photoFull) || '';
  });
  syncSlots();
}

/** E2 / E3: photo + photoFull = D1; `photos` only for 2-3 photos. No photos = none of the three keys. */
function setEventPhotos(event, list) {
  delete event.photo;
  delete event.photoFull;
  delete event.photos;
  if (!list.length) return;
  event.photo = list[0].photo;
  if (list[0].photoFull) event.photoFull = list[0].photoFull;
  if (list.length >= 2) event.photos = list.slice(0, MAX_EVENT_PHOTOS).map((x) => (x.photoFull ? { photo: x.photo, photoFull: x.photoFull } : { photo: x.photo }));
}

function readForm() {
  const event = {};
  for (const f of FIELDS) {
    const v = $(inputId(f)).value.trim();
    if (v) event[f] = v;
  }
  event.activities = [...$('activity-list').querySelectorAll('input')].map((i) => i.value.trim()).filter(Boolean);
  const raw = formSlots();
  const list = compactSlots(raw);
  if (list.length) setEventPhotos(event, list);
  else if (raw[0].photoFull) event.photoFull = raw[0].photoFull; // validateEvent: "needs a Display photo"
  return event;
}

/** Errors for a Full-size path typed in D2 / D3 without a Display photo (D1 is checked by validateEvent). */
function slotErrors() {
  const out = [];
  formSlots().forEach((x, i) => {
    if (i > 0 && x.photoFull && !x.photo) out.push({ field: `photoFull${i + 1}`, message: `Full-size photo D${i + 1} needs a Display photo D${i + 1} too.` });
  });
  return out;
}

const fieldInput = (f) => $(PHOTO_FIELD_INPUT[f] || inputId(f));

function showErrors(errors) {
  for (const f of [...FIELDS, 'photo', 'photoFull', 'photoFull2', 'photoFull3', 'photos', 'activities']) {
    const box = $(`err-${f}`);
    const input = fieldInput(f);
    const err = errors.find((e) => e.field === f);
    if (box) {
      box.hidden = !err;
      box.textContent = err ? err.message : '';
    }
    if (input && f !== 'photos') input.setAttribute('aria-invalid', err ? 'true' : 'false');
  }
  if (errors.length) {
    const first = fieldInput(errors[0].field);
    if (first) first.focus();
  }
}

function fillForm(event) {
  for (const f of FIELDS) $(inputId(f)).value = event[f] || '';
  $('activity-list').replaceChildren();
  (event.activities || []).forEach((a) => addActivityRow(a));
  if (!(event.activities || []).length) addActivityRow();
  setFormSlots(eventPhotos(event));
  updatePreview();
  notify();
}

function clearForm() {
  state.editingId = null;
  $('form-chip').textContent = 'New';
  $('form-title').textContent = 'New event';
  $('save-event').textContent = 'Save event';
  fillForm({});
  showErrors([]);
  renderList();
}

function startEdit(id) {
  const event = state.events.find((e) => e.id === id);
  if (!event) return;
  setFold('form-panel', true);
  state.editingId = id;
  state.page = pageOf(state.events.indexOf(event), state.size);
  $('form-chip').textContent = 'Editing';
  $('form-title').textContent = `Edit ${event.short} · ${formatDate(event.date)}`;
  $('save-event').textContent = 'Save changes';
  fillForm(event);
  showErrors([]);
  renderList();
  $('f-date').focus();
}

function onSubmit(e) {
  e.preventDefault();
  const data = readForm();
  const errors = [...validateEvent(data), ...slotErrors()];
  showErrors(errors);
  if (errors.length) {
    $('save-status').textContent = 'Not saved: please fix the fields marked with !';
    return;
  }
  let saved;
  if (state.editingId) {
    const index = state.events.findIndex((ev) => ev.id === state.editingId);
    saved = { id: state.editingId, ...data };
    state.events[index] = saved;
  } else {
    saved = { id: makeEventId(data, state.events.map((ev) => ev.id)), ...data };
    state.events.push(saved);
  }
  delete saved.sample;
  state.events = sortEvents(state.events);
  saveDraft();
  $('save-status').textContent = `Saved ${saved.short} · ${formatDate(saved.date)} to the draft.`;
  startEdit(saved.id);
}

/* ---------- Embed preview ---------- */
function updatePreview() {
  const box = $('embed-preview');
  const link = $('f-link').value.trim();
  const photo = $('f-photo').value.trim();
  box.replaceChildren();
  if (!link && !photo) {
    box.append(make('p', 'panel-hint', 'Add a social link or a photo path to see the preview.'));
    return;
  }
  box.append(renderMedia({
    link,
    photo: photo ? new URL(`../../${photo}`, import.meta.url).href : '',
    alt: 'Preview photo',
    placeholder: 'Preview photo (none yet)',
    title: $('f-name').value || 'Event',
  }));
}

/* ---------- Import / export ---------- */
/** Copy of an event with its keys in EXPORT_ORDER (unknown keys keep their place at the end). */
function orderedEvent(event) {
  const out = {};
  for (const key of EXPORT_ORDER) if (event[key] !== undefined) out[key] = event[key];
  for (const key of Object.keys(event)) if (!(key in out)) out[key] = event[key];
  return out;
}

/** events.json text as Export and Publish write it: newest first, fixed key order, 2-space indent, trailing newline. */
export function exportText(events) {
  return `${JSON.stringify({ version: 1, events: sortEvents(events).map(orderedEvent) }, null, 2)}\n`;
}

export function exportEvents() {
  const json = exportText(state.events);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = make('a');
  a.href = url;
  a.download = 'events.json';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  $('save-status').textContent = 'Downloaded events.json. Put it at data/events.json in the repo and push.';
}

async function importEvents(file) {
  const errorBox = $('import-error');
  errorBox.hidden = true;
  try {
    const data = JSON.parse(await file.text());
    const events = Array.isArray(data) ? data : data.events;
    if (!Array.isArray(events)) throw new Error('The file has no "events" list.');
    const ids = new Set();
    events.forEach((ev, i) => {
      const errs = validateEvent(ev);
      if (!ev.id) errs.push({ field: 'id', message: 'missing id' });
      if (ids.has(ev.id)) errs.push({ field: 'id', message: `duplicate id ${ev.id}` });
      ids.add(ev.id);
      if (errs.length) throw new Error(`Event ${i + 1} (${ev.short || '?'} ${ev.date || '?'}): ${errs.map((x) => x.message).join(' ')}`);
    });
    state.events = sortEvents(events.map(normalizeEvent));
    saveDraft(); // keeps the base: the repo copy this browser started from has not changed
    state.page = 0;
    clearForm();
    $('save-status').textContent = `Imported ${events.length} events from ${file.name}.`;
  } catch (error) {
    errorBox.hidden = false;
    errorBox.textContent = `Import failed, nothing changed. ${error.message}`;
  }
}

/** data/events.json as it is on GitHub right now (newer than the site copy for 1-2 minutes after a push).
 *  Needs a saved token. Returns { events, base } or null if there is no token or GitHub can't be read. */
async function loadFromRepo() {
  const token = readToken();
  if (!token) return null;
  try {
    const path = `/repos/${GITHUB.owner}/${GITHUB.repo}/contents/data/events.json?ref=${encodeURIComponent(GITHUB.branch)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REPO_READ_TIMEOUT_MS);
    let file;
    try {
      const response = await githubFetch(path, { token, signal: controller.signal });
      if (!response.ok) return null;
      file = await response.json();
    } finally {
      clearTimeout(timer);
    }
    if (file.encoding !== 'base64' || typeof file.content !== 'string' || typeof file.sha !== 'string') return null;
    const binary = atob(file.content.replace(/\s/g, ''));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes));
    const events = (Array.isArray(data.events) ? data.events : []).map(normalizeEvent);
    return { events, base: { sha: file.sha, text: exportText(events) } };
  } catch {
    return null;
  }
}

async function discardDraft() {
  if (!window.confirm('Discard your browser draft (events, site photos and moments) and reload the published data/events.json?')) return;
  localStorage.removeItem(DRAFT_KEY);
  // While the published copy loads, Publish, Import and Discard are locked so nothing races the swap.
  draftLoading = true;
  lockFileActions(true);
  draftChanged();
  try {
    // With a token, start again from the copy on GitHub itself, so its SHA is the new base and a backup
    // imported after this can be published (the stale check compares against GitHub, not the site copy).
    const fromRepo = await loadFromRepo();
    const published = fromRepo || await loadPublished();
    state.events = sortEvents(published.events);
    state.base = published.base;
    setBanner(fromRepo ? 'Source: published data/events.json (newest copy from GitHub)' : 'Source: published data/events.json');
    state.page = 0;
    clearForm();
    // Other drafts (TASK-14 site photos) start again too, still inside the lock.
    for (const hook of discardHooks) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await hook();
      } catch (error) {
        console.error(error);
      }
    }
  } finally {
    draftLoading = false;
    lockFileActions(false);
    draftChanged();
  }
}

const discardHooks = [];
/** `fn` (async) runs when Discard draft is confirmed, after the events reload, while Publish is still locked. */
export function addDiscardHook(fn) {
  discardHooks.push(fn);
}

/** True while Discard draft is loading the published events.json. */
export function isDraftLoading() {
  return draftLoading;
}

/* ---------- API for the media uploader ---------- */
function notify() {
  listeners.forEach((fn) => fn(currentEventId()));
}

/** The id of the event being edited, or the id a new event would get from the form. */
export function currentEventId() {
  if (state.editingId) return state.editingId;
  const date = $('f-date').value;
  const short = $('f-short').value.trim();
  if (!date || !short) return null;
  return makeEventId({ date, short }, state.events.map((e) => e.id));
}

export function onEventChange(fn) {
  listeners.add(fn);
  fn(currentEventId());
}

/** True while the form edits an event that is already in the draft (its id is fixed). */
export function isEditingSavedEvent() {
  return state.editingId !== null;
}

/** Every photo / photoFull path used by an event in the draft (all its slots) or typed into the form. */
export function usedPhotoPaths() {
  const used = new Set();
  for (const event of state.events) {
    if (event.photo) used.add(event.photo);
    if (event.photoFull) used.add(event.photoFull);
    for (const p of eventPhotos(event)) {
      used.add(p.photo);
      if (p.photoFull) used.add(p.photoFull);
    }
  }
  for (const [p, f] of SLOT_IDS) {
    for (const id of [p, f]) {
      const value = $(id).value.trim();
      if (value) used.add(value);
    }
  }
  return used;
}

/** True when the three photo slots of the form all hold a Display photo (Attach is disabled then). */
export function slotsFull() {
  return formSlots().every((x) => x.photo);
}

/** Calls `fn` whenever the photo slots of the form change (typed, attached, moved, removed, form filled). */
export function onSlotsChange(fn) {
  slotListeners.add(fn);
}

/** Saves the form's photo slots into the event being edited (right away, like Attach). False if not editing
 *  a saved event or when a slot holds a path that is not valid yet (then the draft is left alone). */
function commitSlots() {
  const event = state.editingId && state.events.find((e) => e.id === state.editingId);
  if (!event) return false;
  const list = compactSlots(formSlots());
  const probe = { date: '2000-01-01', short: 'X', name: 'X' };
  setEventPhotos(probe, list);
  if (validateEvent(probe).length) return false;
  setEventPhotos(event, list);
  saveDraft();
  renderList();
  return true;
}

/** Puts a photo path (display copy) and, optionally, the full-size path into the next empty slot of the form
 *  (D1, then D2, then D3); a path that is already in a slot only gets its full-size path updated.
 *  When editing an existing event it is saved to the draft right away. Returns the slot number (1-3), or 0 when all 3 are full. */
export function attachPhoto(path, fullPath) {
  setFold('form-panel', true);
  const raw = formSlots();
  let k = raw.findIndex((x) => x.photo === path);
  if (k === -1) k = raw.findIndex((x) => !x.photo);
  if (k === -1) {
    $('save-status').textContent = 'This event already has 3 photos. Remove one first.';
    return 0;
  }
  $(SLOT_IDS[k][0]).value = path;
  if (fullPath !== undefined) $(SLOT_IDS[k][1]).value = fullPath || '';
  syncSlots();
  updatePreview();
  if (state.editingId) {
    const event = state.events.find((e) => e.id === state.editingId);
    if (event) {
      delete event.sample;
      if (commitSlots()) {
        $('save-status').textContent = `Attached ${path} to ${event.short} · ${formatDate(event.date)} as D${k + 1} (draft saved).`;
      } else {
        saveDraft();
        renderList();
        $('save-status').textContent = `Photo path filled in as D${k + 1}. Fix the other photo paths, then press "Save changes".`;
      }
    }
  } else {
    $('save-status').textContent = 'Photo path filled in. Press "Save event" to keep it.';
  }
  return k + 1;
}

/** An unsaved event's pair got a new id: the same slot now holds the new paths (the slot keeps its place). */
export function replaceSlotPath(oldPath, path, fullPath) {
  const k = formSlots().findIndex((x) => x.photo === oldPath);
  if (k === -1) return false;
  $(SLOT_IDS[k][0]).value = path;
  $(SLOT_IDS[k][1]).value = fullPath || '';
  syncSlots();
  updatePreview();
  return true;
}

/** True when a Display path is in one of the form's slots. */
export function slotHasPath(path) {
  return formSlots().some((x) => x.photo === path);
}

/**
 * TASK-27 "Remove from publish" on a pending pair: takes the slot holding `photo` out of the event in the
 * draft and closes the gap (published slots are not touched). Returns the slot number (1-3) it had, or 0
 * when the event does not hold that photo (the draft is not changed). The open form follows.
 * `published` (list of published photos) + `sample` put the published "Sample" tag back when the event is back to them.
 */
export function removeEventPhoto(eventId, photo, { published, sample } = {}) {
  const event = state.events.find((e) => e.id === eventId);
  if (!event) return 0;
  const list = eventPhotos(event);
  const k = list.findIndex((x) => x.photo === photo);
  if (k === -1) return 0;
  list.splice(k, 1);
  setEventPhotos(event, list);
  // BUG-5: attaching dropped the "Sample" tag; when the event is back to exactly its published photos, put it back.
  const back = Array.isArray(published) ? published : null;
  if (back && sample !== undefined && back.length === list.length && back.every((x, i) => x.photo === list[i].photo)) event.sample = sample;
  saveDraft();
  renderList();
  if (state.editingId === eventId) {
    const raw = formSlots();
    const j = raw.findIndex((x) => x.photo === photo);
    if (j !== -1) {
      raw.splice(j, 1);
      setFormSlots(raw);
      updatePreview();
    }
  }
  return k + 1;
}

/** Number of photos the event has in the draft. */
export function eventPhotoCount(eventId) {
  const event = state.events.find((e) => e.id === eventId);
  return event ? eventPhotos(event).length : 0;
}

/**
 * TASK-16: "Remove from publish" on a 1-photo event whose only photo is the pending pair sets the event's
 * photo paths back (the published ones, or none when `photo` is ''). Saves the draft; if the event is open in
 * the form, its photo fields and preview follow. Returns false when the event is not in the draft.
 * BUG-5: `sample` (when not undefined) is the published event's "Sample" tag, put back since attaching drops it.
 * `photos` (optional list) puts back all the published slots. BUG-6: `formPaths` ({ photo, photoFull }) are the pair's own paths; the open form's D1 fields are only
 * updated while they still hold exactly those (an unsaved typed path is left alone; the draft is reverted).
 */
export function revertPhoto(eventId, photo, photoFull, { sample, formPaths, photos } = {}) {
  const event = state.events.find((e) => e.id === eventId);
  if (!event) return false;
  setEventPhotos(event, photos || (photo ? [photoFull ? { photo, photoFull } : { photo }] : []));
  if (sample !== undefined) event.sample = sample;
  saveDraft();
  renderList();
  const formUntouched = !formPaths || ($('f-photo').value.trim() === (formPaths.photo || '')
    && $('f-photo-full').value.trim() === (formPaths.photoFull || ''));
  if (state.editingId === eventId && formUntouched) {
    $('f-photo').value = event.photo || '';
    $('f-photo-full').value = event.photoFull || '';
    syncSlots();
    updatePreview();
  }
  return true;
}

/* ---------- Photo slots in the form (TASK-27) ---------- */
function slotThumb(row, path) {
  const box = row.querySelector('.slot-th');
  if (box.dataset.path === path) return;
  box.dataset.path = path;
  box.replaceChildren();
  if (!path || photoPathBad(path)) {
    box.textContent = 'No photo';
    return;
  }
  const pair = pendingPairs().find((p) => p.photo === path);
  const blobUrl = pair && pair.item && pair.item.urls && pair.item.urls.display;
  const img = make('img');
  img.alt = '';
  img.addEventListener('error', () => { box.replaceChildren('Not found'); });
  img.src = blobUrl || new URL(`../../${path}`, import.meta.url).href;
  box.append(img);
}

const photoPathBad = (path) => path.startsWith('/') || path.includes('..') || path.includes('\\') || /^[a-z][a-z0-9+.-]*:/i.test(path);

/** Row states: empty or filled, move buttons enabled where a move makes sense, preview of the display copy. */
function syncSlots(thumbs = true) {
  const raw = formSlots();
  const rows = [...$('slots').children];
  const count = raw.filter((x) => x.photo).length;
  rows.forEach((row, i) => {
    const has = Boolean(raw[i].photo);
    row.classList.toggle('is-empty', !has);
    if (thumbs) slotThumb(row, raw[i].photo);
    const [up, down, rm] = row.querySelectorAll('.slot-btn');
    up.disabled = !has || i === 0;
    down.disabled = !has || i === rows.length - 1 || !raw[i + 1].photo;
    rm.disabled = !has && !raw[i].photoFull;
  });
  $('slots-sum').textContent = count === 0 ? 'No photos on this event.' : `${count} ${count === 1 ? 'photo' : 'photos'} on this form.`;
  slotListeners.forEach((fn) => fn());
}

function focusSlotButton(i, act) {
  const row = $('slots').children[i];
  const target = row && (row.querySelector(`[data-act="${act}"]:not(:disabled)`) || row.querySelector('.slot-btn:not(:disabled)') || row.querySelector('input'));
  if (target) target.focus();
}

function moveSlot(i, delta) {
  const raw = formSlots();
  const j = i + delta;
  if (j < 0 || j >= raw.length || !raw[i].photo || !raw[j].photo) return;
  [raw[i], raw[j]] = [raw[j], raw[i]];
  setFormSlots(raw);
  updatePreview();
  commitSlots();
  focusSlotButton(j, delta < 0 ? 'up' : 'down');
}

let removing = false;
async function removeSlot(i) {
  if (removing) return;
  const raw = formSlots();
  const slot = raw[i];
  if (!slot.photo && !slot.photoFull) return;
  const pair = slot.photo ? pendingPairs().find((p) => p.photo === slot.photo) : null;
  if (pair) {
    removing = true;
    const event = state.events.find((e) => e.id === (state.editingId || pair.eventId));
    const who = event ? `${event.short} ${String(event.date).slice(0, 4)}` : 'an event';
    const ok = await askRemove(`Remove photo D${i + 1} (${pair.item && pair.item.file ? pair.item.file.name : slot.photo})? It is attached to ${who} and will be taken out of the publish.`);
    removing = false;
    if (!ok) { $('slots').children[i].querySelector('[data-act="remove"]').focus(); return; }
    removePendingItem(pair.item);
  }
  const now = formSlots();
  now.splice(i, 1);
  setFormSlots(now);
  updatePreview();
  commitSlots();
  $('save-status').textContent = `Photo D${i + 1} removed from the form${state.editingId ? ' (draft saved)' : ''}.`;
  focusSlotButton(Math.min(i, 2), 'remove');
}

function initSlots() {
  [...$('slots').children].forEach((row, i) => {
    row.querySelector('[data-act="up"]').addEventListener('click', () => moveSlot(i, -1));
    row.querySelector('[data-act="down"]').addEventListener('click', () => moveSlot(i, 1));
    row.querySelector('[data-act="remove"]').addEventListener('click', () => removeSlot(i));
  });
  for (const [p, f] of SLOT_IDS) {
    for (const id of [p, f]) {
      $(id).addEventListener('input', () => syncSlots(false));
      $(id).addEventListener('change', () => { syncSlots(); updatePreview(); });
    }
  }
}

/* ---------- API for Publish ---------- */
/** The events.json text Publish would commit (same as Export). */
export function draftText() {
  return exportText(state.events);
}

export function eventCount() {
  return state.events.length;
}

/** Ids of the events in the draft (saved events only, not an unsaved form). */
export function draftEventIds() {
  return new Set(state.events.map((e) => e.id));
}

/** The data/events.json this draft started from: { sha, text }. sha is null if it could not be read. */
export function baseEvents() {
  return { ...state.base };
}

/** True when the draft differs from the events.json it started from. */
export function draftDiffersFromBase() {
  return draftText() !== state.base.text;
}

/** After a publish: the committed text and its blob SHA become the new base, so the next publish needs no reload. */
export function setBase(sha, text) {
  state.base = { sha, text };
  saveDraft('Source: your browser draft (same as what you last published).');
}

export function onDraftChange(fn) {
  draftListeners.add(fn);
}

/** While publishing, Import and Discard are locked so the draft cannot be swapped underneath. */
export function lockFileActions(locked) {
  $('import-file').disabled = locked;
  const label = document.querySelector('label[for="import-file"]');
  label.classList.toggle('is-disabled', locked);
  label.setAttribute('aria-disabled', String(locked));
  $('discard-draft').disabled = locked;
}

/* ---------- Start ---------- */
async function init() {
  const draft = readDraft();
  if (draft) {
    state.events = sortEvents(draft.events.map(normalizeEvent));
    // A draft from before Publish existed has no base. Its start point is unknown, so the first Publish
    // stops as stale and the page explains how to go on (Export, Discard, Import, Publish).
    state.base = draft.base || { sha: null, text: '' };
    setBanner(BANNER_DRAFT);
  } else {
    const published = await loadPublished();
    state.events = sortEvents(published.events);
    state.base = published.base;
    setBanner('Source: published data/events.json');
  }
  $('event-form').addEventListener('submit', onSubmit);
  $('new-event').addEventListener('click', () => { setFold('form-panel', true); clearForm(); $('f-date').focus(); });
  $('cancel-edit').addEventListener('click', clearForm);
  $('add-activity').addEventListener('click', () => addActivityRow().focus());
  $('f-link').addEventListener('input', updatePreview);
  initSlots();
  $('f-date').addEventListener('input', notify);
  $('f-short').addEventListener('input', notify);
  $('export-events').addEventListener('click', exportEvents);
  $('import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importEvents(file);
    e.target.value = '';
  });
  $('discard-draft').addEventListener('click', discardDraft);
  state.size = readPageSize(matchMedia('(max-width: 767px)').matches ? defaultPageSize(0) : defaultPageSize(768));
  $('event-page-size').value = String(state.size);
  $('event-page-size').addEventListener('change', onPageSize);
  $('event-prev').addEventListener('click', () => setPage(state.page - 1));
  $('event-next').addEventListener('click', () => setPage(state.page + 1));
  clearForm();
  document.documentElement.dataset.managerReady = 'true';
  resolveReady();
}

init();
