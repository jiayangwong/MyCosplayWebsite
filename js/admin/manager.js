// Event manager: edit events in the browser, keep a draft in localStorage, import/export events.json.
// Nothing here changes the live site. Publish (publish.js) commits the draft; Export is the hand-made backup.
// The draft also remembers which data/events.json it started from (`base`: git blob SHA + export text),
// so Publish can stop if the repo's copy changed in the meantime.
import { EVENTS_URL, sortEvents, validateEvent, makeEventId, formatDate } from '../events-data.js';
import { renderMedia } from '../embed.js';
import { gitBlobSha } from './git-blob.js';

export const DRAFT_KEY = 'puzzkezz.events.draft';
const FIELDS = ['date', 'short', 'name', 'venue', 'link', 'photo', 'photoFull'];
/** Form input id for a data field ("photoFull" -> "f-photo-full"). */
const inputId = (field) => `f-${field.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
/** Key order used by Export: photoFull is written right after photo. */
const EXPORT_ORDER = ['id', 'date', 'short', 'name', 'venue', 'activities', 'link', 'photo', 'photoFull', 'sample'];

const $ = (id) => document.getElementById(id);
const state = { events: [], editingId: null, base: { sha: null, text: '' } };
const listeners = new Set();
const draftListeners = new Set();
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
    const events = Array.isArray(data.events) ? data.events : [];
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
  $('event-count').textContent = `(${state.events.length})`;
  if (!state.events.length) {
    list.append(make('li', 'panel-hint', 'No events yet. Use "New event".'));
  }
  state.events.forEach((event, i) => {
    const li = make('li', `event-row${event.id === state.editingId ? ' is-editing' : ''}`);
    li.dataset.id = event.id;
    const info = make('div');
    info.append(make('p', 'event-row-title', `${event.short} · ${event.name}`));
    info.append(make('p', 'event-row-meta', `${formatDate(event.date)}${event.sample ? ' · SAMPLE' : ''}`));

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
  saveDraft();
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

function readForm() {
  const event = {};
  for (const f of FIELDS) {
    const v = $(inputId(f)).value.trim();
    if (v) event[f] = v;
  }
  event.activities = [...$('activity-list').querySelectorAll('input')].map((i) => i.value.trim()).filter(Boolean);
  return event;
}

function showErrors(errors) {
  for (const f of [...FIELDS, 'activities']) {
    const box = $(`err-${f}`);
    const input = $(inputId(f));
    const err = errors.find((e) => e.field === f);
    if (box) {
      box.hidden = !err;
      box.textContent = err ? err.message : '';
    }
    if (input) input.setAttribute('aria-invalid', err ? 'true' : 'false');
  }
  if (errors.length) {
    const first = $(inputId(errors[0].field));
    if (first) first.focus();
  }
}

function fillForm(event) {
  for (const f of FIELDS) $(inputId(f)).value = event[f] || '';
  $('activity-list').replaceChildren();
  (event.activities || []).forEach((a) => addActivityRow(a));
  if (!(event.activities || []).length) addActivityRow();
  updatePreview();
  notify();
}

function clearForm() {
  state.editingId = null;
  $('form-title').textContent = 'New event';
  $('save-event').textContent = 'Save event';
  fillForm({});
  showErrors([]);
  renderList();
}

function startEdit(id) {
  const event = state.events.find((e) => e.id === id);
  if (!event) return;
  state.editingId = id;
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
  const errors = validateEvent(data);
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
    state.events = sortEvents(events);
    saveDraft(); // keeps the base: the repo copy this browser started from has not changed
    clearForm();
    $('save-status').textContent = `Imported ${events.length} events from ${file.name}.`;
  } catch (error) {
    errorBox.hidden = false;
    errorBox.textContent = `Import failed, nothing changed. ${error.message}`;
  }
}

async function discardDraft() {
  if (!window.confirm('Discard your browser draft and reload the published data/events.json?')) return;
  localStorage.removeItem(DRAFT_KEY);
  const published = await loadPublished();
  state.events = sortEvents(published.events);
  state.base = published.base;
  setBanner('Source: published data/events.json');
  clearForm();
  draftChanged();
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

/** Every photo / photoFull path used by an event in the draft or typed into the form. */
export function usedPhotoPaths() {
  const used = new Set();
  for (const event of state.events) {
    if (event.photo) used.add(event.photo);
    if (event.photoFull) used.add(event.photoFull);
  }
  for (const id of ['f-photo', 'f-photo-full']) {
    const value = $(id).value.trim();
    if (value) used.add(value);
  }
  return used;
}

/** Puts a photo path (display copy) and, optionally, the full-size path into the form.
 *  When editing an existing event it is saved to the draft right away. */
export function attachPhoto(path, fullPath) {
  $('f-photo').value = path;
  if (fullPath !== undefined) $('f-photo-full').value = fullPath || '';
  updatePreview();
  if (state.editingId) {
    const event = state.events.find((e) => e.id === state.editingId);
    if (event) {
      event.photo = path;
      if (fullPath) event.photoFull = fullPath;
      else if (fullPath !== undefined) delete event.photoFull;
      delete event.sample;
      saveDraft();
      renderList();
      $('save-status').textContent = `Attached ${path} to ${event.short} · ${formatDate(event.date)} (draft saved).`;
    }
  } else {
    $('save-status').textContent = `Photo path filled in. Press "Save event" to keep it.`;
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
    state.events = sortEvents(draft.events);
    // A draft from before Publish existed has no base: use the published file this page can see now.
    state.base = draft.base || (await loadPublished()).base;
    setBanner(BANNER_DRAFT);
  } else {
    const published = await loadPublished();
    state.events = sortEvents(published.events);
    state.base = published.base;
    setBanner('Source: published data/events.json');
  }
  $('event-form').addEventListener('submit', onSubmit);
  $('new-event').addEventListener('click', () => { clearForm(); $('f-date').focus(); });
  $('cancel-edit').addEventListener('click', clearForm);
  $('add-activity').addEventListener('click', () => addActivityRow().focus());
  $('f-link').addEventListener('input', updatePreview);
  $('f-photo').addEventListener('change', updatePreview);
  $('f-date').addEventListener('input', notify);
  $('f-short').addEventListener('input', notify);
  $('export-events').addEventListener('click', exportEvents);
  $('import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importEvents(file);
    e.target.value = '';
  });
  $('discard-draft').addEventListener('click', discardDraft);
  clearForm();
  document.documentElement.dataset.managerReady = 'true';
  resolveReady();
}

init();
