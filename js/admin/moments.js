// Moments panel (TASK-21): list, add, edit, delete and reorder the Hall ??? 番外 moments in /admin/.
// The draft and the file text live in moments-draft.js; Publish (publish.js) commits data/moments.json.
// All moment text is shown with textContent, never innerHTML.
import {
  momentsDraftReady, onMomentsChange, draftMoments, saveMoment, deleteMoment, moveMoment, canMove,
  discardMomentsDraft, makeMomentId,
} from './moments-draft.js';
import { addDiscardHook } from './manager.js';

const $ = (id) => document.getElementById(id);
const FIELDS = ['year', 'caption', 'alt', 'link', 'photo'];
let editingId = null;

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** How the page names a moment: its caption, else its id. */
export const momentName = (m) => (m.caption ? `"${m.caption}"` : m.id);

/* ---------- List ---------- */
function renderList() {
  const list = $('moment-list');
  const moments = draftMoments();
  list.replaceChildren();
  $('mo-count').textContent = `(${moments.length})`;
  if (!moments.length) list.append(make('li', 'panel-hint', 'No moments yet. Use "New moment".'));
  for (const m of moments) {
    const li = make('li', `event-row${m.id === editingId ? ' is-editing' : ''}`);
    li.dataset.id = m.id;
    const info = make('div');
    info.append(make('p', 'event-row-title', m.caption || '(no caption)'));
    const kinds = [m.photo ? 'PHOTO' : '', m.link ? 'LINK' : ''].filter(Boolean).join(' + ');
    info.append(make('p', 'event-row-meta', `${Number.isInteger(m.year) ? m.year : 'No year'} · ${kinds || '-'} · ${m.id}`));
    const actions = make('div', 'event-row-actions');
    const button = (label, aria, onClick, disabled = false, extra = '') => {
      const b = make('button', `icon-btn ${extra}`.trim(), label);
      b.type = 'button';
      b.setAttribute('aria-label', aria);
      b.disabled = disabled;
      b.addEventListener('click', onClick);
      return b;
    };
    actions.append(
      button('Edit', `Edit moment ${m.id}`, () => startEdit(m.id)),
      button('↑', `Move moment ${m.id} up`, () => moveMoment(m.id, -1), !canMove(m.id, -1)),
      button('↓', `Move moment ${m.id} down`, () => moveMoment(m.id, 1), !canMove(m.id, 1)),
      button('Delete', `Delete moment ${m.id}`, () => remove(m), false, 'is-danger'),
    );
    li.append(info, actions);
    list.append(li);
  }
}

function remove(moment) {
  if (!window.confirm(`Delete moment ${momentName(moment)} (${moment.id})?`)) return;
  if (editingId === moment.id) clearForm();
  deleteMoment(moment.id);
  $('mo-status').textContent = `Deleted moment ${moment.id} from the draft.`;
}

/* ---------- Form ---------- */

/** The form as a moment (no id). A year that is not a whole number stays text, so validation names it. */
export function readMomentForm() {
  const data = {};
  for (const f of FIELDS) {
    const value = $(`m-${f}`).value.trim();
    if (!value) continue;
    data[f] = f === 'year' && /^\d+$/.test(value) ? Number(value) : value;
  }
  return data;
}

/** validateMoment() texts -> the field they belong to. */
function fieldOf(error) {
  if (error.startsWith('needs a photo or a link')) return 'link';
  const first = error.split(' ')[0];
  return FIELDS.includes(first) ? first : 'caption';
}

function sentence(error) {
  if (error.startsWith('needs a photo or a link')) return 'Add a link or a photo: a moment needs at least one.';
  const text = `${error.charAt(0).toUpperCase()}${error.slice(1)}`;
  return text.endsWith('.') ? text : `${text}.`;
}

function showErrors(errors) {
  const byField = {};
  for (const e of errors) {
    const f = fieldOf(e);
    byField[f] = byField[f] ? `${byField[f]} ${sentence(e)}` : sentence(e);
  }
  for (const f of FIELDS) {
    const box = $(`err-m-${f}`);
    box.hidden = !byField[f];
    box.textContent = byField[f] || '';
    $(`m-${f}`).setAttribute('aria-invalid', byField[f] ? 'true' : 'false');
  }
  const first = FIELDS.find((f) => byField[f]);
  if (first) $(`m-${first}`).focus();
}

function fillForm(moment) {
  for (const f of FIELDS) $(`m-${f}`).value = moment[f] !== undefined ? String(moment[f]) : '';
  formChanged();
}

export function clearForm() {
  editingId = null;
  $('mo-form-title').textContent = 'New moment';
  $('save-moment').textContent = 'Save moment';
  fillForm({});
  showErrors([]);
  renderList();
}

function startEdit(id) {
  const moment = draftMoments().find((m) => m.id === id);
  if (!moment) return;
  editingId = id;
  $('mo-form-title').textContent = `Edit moment ${id}`;
  $('save-moment').textContent = 'Save changes';
  fillForm(moment);
  showErrors([]);
  renderList();
  $('m-year').focus();
}

/** Saves the form to the draft. Returns the saved moment, or null (errors shown, nothing saved). */
export function submitMoment() {
  const result = saveMoment(readMomentForm(), editingId);
  showErrors(result.errors || []);
  if (result.errors) {
    $('mo-status').textContent = 'Not saved: please fix the fields marked with !';
    return null;
  }
  editingId = result.moment.id;
  $('mo-status').textContent = `Saved moment ${result.moment.id} to the draft.`;
  $('mo-form-title').textContent = `Edit moment ${result.moment.id}`;
  $('save-moment').textContent = 'Save changes';
  renderList();
  formChanged();
  return result.moment;
}

/* ---------- For the Moment photo uploader (TASK-22) ---------- */
const formListeners = new Set();
function formChanged() {
  formListeners.forEach((fn) => fn());
}
export function onMomentFormChange(fn) {
  formListeners.add(fn);
}
/** The id of the moment open in the form (null for a new, unsaved moment). */
export function editingMomentId() {
  return editingId;
}

/** The id of the moment in the form: the one being edited, or the id a new moment would get on Save. */
export function currentMomentId() {
  if (editingId) return editingId;
  return makeMomentId(readMomentForm(), draftMoments().map((m) => m.id));
}

/**
 * "Use for moment" (TASK-22): puts `path` in the photo field and saves the form to the draft (a new moment is
 * created). Returns the saved moment, or null when the form has errors (the photo field gets its old value back).
 */
export function useMomentPhoto(path) {
  const field = $('m-photo');
  const before = field.value;
  field.value = path;
  const saved = submitMoment();
  if (!saved) field.value = before;
  return saved;
}

async function init() {
  if (!$('moments-panel')) return;
  await momentsDraftReady;
  $('moment-form').addEventListener('submit', (e) => {
    e.preventDefault();
    submitMoment();
  });
  $('new-moment').addEventListener('click', () => { clearForm(); $('m-year').focus(); });
  $('clear-moment').addEventListener('click', clearForm);
  for (const f of FIELDS) $(`m-${f}`).addEventListener('input', formChanged);
  onMomentsChange(() => {
    if (editingId && !draftMoments().some((m) => m.id === editingId)) clearForm();
    else renderList();
  });
  addDiscardHook(async () => {
    await discardMomentsDraft();
    clearForm();
  });
  clearForm();
  document.documentElement.dataset.momentsReady = 'true';
}

init();
