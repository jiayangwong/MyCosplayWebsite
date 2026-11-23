// Moments draft (TASK-21): the Hall ??? 番外 moments of data/moments.json, edited in /admin/.
// Like the site draft (site-draft.js) it lives in localStorage and remembers the exact file it started from
// (`base`: git blob SHA of the published bytes + the text Publish would write for it), so Publish can stop
// when GitHub's copy changed meanwhile. The moment rules and the album order come from js/bangai.js (one copy).
import { validateMoment, sortMoments, cleanMoments, MOMENTS_URL } from '../bangai.js';
import { slugify } from '../events-data.js';
import { gitBlobSha } from './git-blob.js';
import { githubFetch, readToken } from './github-token.js';
import { GITHUB } from './github-config.js';

export const MOMENTS_DRAFT_KEY = 'puzzkezz.moments.draft';
export const MOMENTS_PATH = 'data/moments.json';
/** Key order in data/moments.json (unknown keys keep their place at the end). */
const KEY_ORDER = ['id', 'year', 'caption', 'alt', 'photo', 'link'];
const READ_TIMEOUT_MS = 30000;
const SLUG_MAX = 48;

const state = { base: { sha: null, text: '' }, moments: [] };
const listeners = new Set();
let resolveReady;
export const momentsDraftReady = new Promise((resolve) => { resolveReady = resolve; });

function ordered(moment) {
  const out = {};
  for (const key of KEY_ORDER) if (moment[key] !== undefined) out[key] = moment[key];
  for (const key of Object.keys(moment)) if (!(key in out)) out[key] = moment[key];
  return out;
}

/** data/moments.json as Publish writes it: album order (A8), fixed key order, 2-space indent, trailing newline. */
export function formatMoments(list) {
  const objects = (Array.isArray(list) ? list : []).filter((m) => m && typeof m === 'object' && !Array.isArray(m));
  return `${JSON.stringify({ version: 1, moments: sortMoments(objects).map(ordered) }, null, 2)}\n`;
}

/* ---------- Draft values ---------- */

/** The moments of the draft in album order (copies). */
export function draftMoments() {
  return state.moments.map((m) => ({ ...m }));
}

export function momentsText() {
  return formatMoments(state.moments);
}

export function momentsChanged() {
  return momentsText() !== state.base.text;
}

/** The data/moments.json this draft started from: { sha, text }. sha is null when it is not on the site. */
export function momentsBase() {
  return { ...state.base };
}

/** The moments of the published file (the base), for "put back the published photo". */
export function baseMoments() {
  try {
    const data = JSON.parse(state.base.text);
    return Array.isArray(data.moments) ? data.moments.filter((m) => m && typeof m === 'object') : [];
  } catch {
    return [];
  }
}

export function onMomentsChange(fn) {
  listeners.add(fn);
}

function changed() {
  listeners.forEach((fn) => fn());
}

function save() {
  try {
    localStorage.setItem(MOMENTS_DRAFT_KEY, JSON.stringify({
      version: 1,
      savedAt: new Date().toISOString(),
      base: state.base,
      moments: state.moments,
    }));
  } catch (error) {
    console.warn('Could not save the moments draft:', error.message);
  }
  changed();
}

/* ---------- Ids ---------- */

/** `<year or "x">-<slug(caption)>`, with "-2", "-3"... when the id is taken. */
export function makeMomentId({ year, caption } = {}, existingIds = []) {
  const taken = new Set(existingIds);
  const text = String(caption || '');
  const slug = /[a-z0-9]/i.test(text.normalize('NFKD'))
    ? slugify(text).slice(0, SLUG_MAX).replace(/-+$/, '')
    : 'moment';
  const base = `${Number.isInteger(year) ? year : 'x'}-${slug}`;
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export function momentIds() {
  return new Set(state.moments.map((m) => m.id));
}

/* ---------- Edits (each one saves the draft) ---------- */

/**
 * Adds (no id) or replaces (id of a moment in the draft) one moment. Returns { errors } or { moment }.
 * The moment rules are validateMoment() from js/bangai.js; nothing is saved when it finds a problem.
 */
export function saveMoment(data, id = null) {
  const fields = { ...data };
  delete fields.id;
  const index = id ? state.moments.findIndex((m) => m.id === id) : -1;
  if (id && index === -1) return { errors: ['id is not in the draft'] };
  const newId = id || makeMomentId(fields, state.moments.map((m) => m.id));
  const moment = { id: newId, ...fields };
  const errors = validateMoment(moment);
  if (errors.length) return { errors };
  if (index === -1) state.moments.push(moment);
  else state.moments[index] = moment;
  state.moments = sortMoments(state.moments);
  save();
  return { moment: { ...moment } };
}

export function deleteMoment(id) {
  const before = state.moments.length;
  state.moments = state.moments.filter((m) => m.id !== id);
  if (state.moments.length !== before) save();
}

const yearKey = (m) => (Number.isInteger(m.year) ? m.year : null);

/** True when the moment can move up (-1) or down (1): only next to a moment of the same year. */
export function canMove(id, delta) {
  const i = state.moments.findIndex((m) => m.id === id);
  const other = state.moments[i + delta];
  return i !== -1 && Boolean(other) && yearKey(other) === yearKey(state.moments[i]);
}

export function moveMoment(id, delta) {
  if (!canMove(id, delta)) return;
  const i = state.moments.findIndex((m) => m.id === id);
  const j = i + delta;
  [state.moments[i], state.moments[j]] = [state.moments[j], state.moments[i]];
  save();
}

/** Sets or clears (value '') one moment's photo. Returns false when the moment is not in the draft. */
export function setMomentPhoto(id, value) {
  const moment = state.moments.find((m) => m.id === id);
  if (!moment) return false;
  if (value) moment.photo = value;
  else delete moment.photo;
  save();
  return true;
}

export const MOMENT_MEDIA_PREFIX = 'media/moments/';

/** `media/moments/<moment-id>.webp`, or `<moment-id>-2.webp`, `-3`... when that path is used or pending. */
export function momentPhotoPath(id, taken = new Set()) {
  const used = new Set(taken);
  for (const m of [...state.moments, ...baseMoments()]) if (typeof m.photo === 'string') used.add(m.photo);
  const first = `${MOMENT_MEDIA_PREFIX}${id}.webp`;
  if (!used.has(first)) return first;
  let n = 2;
  while (used.has(`${MOMENT_MEDIA_PREFIX}${id}-${n}.webp`)) n += 1;
  return `${MOMENT_MEDIA_PREFIX}${id}-${n}.webp`;
}

/**
 * TASK-22 "Remove from publish" on a moment photo: the moment that uses `path` gets the photo of the published
 * moment with the same id back, or none. Returns { id, restored } or null when no moment uses `path`.
 */
export function revertMomentPhoto(path) {
  const moment = state.moments.find((m) => m.photo === path);
  if (!moment) return null;
  const published = baseMoments().find((m) => m.id === moment.id);
  const restored = published && typeof published.photo === 'string' && published.photo ? published.photo : '';
  setMomentPhoto(moment.id, restored);
  return { id: moment.id, restored };
}

/** After a publish: the committed text and its blob SHA become the new base. */
export function setMomentsBase(sha, text) {
  state.base = { sha, text };
  save();
}

/* ---------- Loading ---------- */

/** The moments a file holds: the valid ones for the draft (bad ones are skipped with a warning, as on the site). */
function fromText(raw) {
  let list = [];
  try {
    const data = JSON.parse(raw);
    list = data && Array.isArray(data.moments) ? data.moments : [];
  } catch {
    list = [];
  }
  return { moments: cleanMoments(list), text: formatMoments(list) };
}

async function fromSite() {
  try {
    const response = await fetch(MOMENTS_URL, { cache: 'no-cache' });
    if (!response.ok) return { sha: null, ...fromText('') };
    const bytes = await response.arrayBuffer();
    return { sha: await gitBlobSha(bytes), ...fromText(new TextDecoder().decode(bytes)) };
  } catch {
    return { sha: null, ...fromText('') };
  }
}

/** data/moments.json on GitHub right now, or null when it can't be read. A missing file = sha null. */
async function fromRepo(token) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), READ_TIMEOUT_MS);
  try {
    const url = `/repos/${GITHUB.owner}/${GITHUB.repo}/contents/${MOMENTS_PATH}?ref=${encodeURIComponent(GITHUB.branch)}`;
    const response = await githubFetch(url, { token, signal: controller.signal });
    if (response.status === 404) return { sha: null, ...fromText('') };
    if (!response.ok) return null;
    const file = await response.json();
    if (file.encoding !== 'base64' || typeof file.content !== 'string' || typeof file.sha !== 'string') return null;
    const bytes = Uint8Array.from(atob(file.content.replace(/\s/g, '')), (c) => c.charCodeAt(0));
    return { sha: file.sha, ...fromText(new TextDecoder().decode(bytes)) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function startFrom(loaded) {
  state.base = { sha: loaded.sha, text: loaded.text };
  state.moments = loaded.moments;
}

/** Discard draft (manager.js) also starts the moments draft again: from GitHub with a token, else the site copy. */
export async function discardMomentsDraft() {
  localStorage.removeItem(MOMENTS_DRAFT_KEY);
  const token = readToken();
  const loaded = (token && await fromRepo(token)) || await fromSite();
  startFrom(loaded);
  changed();
}

function readDraft() {
  try {
    const data = JSON.parse(localStorage.getItem(MOMENTS_DRAFT_KEY) || 'null');
    if (!data || !data.base || !Array.isArray(data.moments)) return null;
    const { sha, text } = data.base;
    if (!(sha === null || typeof sha === 'string') || typeof text !== 'string') return null;
    return data;
  } catch {
    return null;
  }
}

async function init() {
  const draft = readDraft();
  if (draft) {
    state.base = { sha: draft.base.sha, text: draft.base.text };
    state.moments = sortMoments(draft.moments.filter((m) => m && typeof m === 'object' && !Array.isArray(m)));
  } else {
    startFrom(await fromSite());
  }
  resolveReady();
  changed();
}

init();
