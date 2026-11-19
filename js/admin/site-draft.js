// Site draft (TASK-14): the portrait in data/site.json and the reel covers (`thumb`) in data/reels.json.
// Like the events draft (manager.js) it lives in localStorage and remembers the exact files it started from
// (`base`: git blob SHA + text of each), so Publish can stop when GitHub's copy changed meanwhile.
// The admin only ever changes `portrait` and each reel's `thumb`; every other part of both files is kept.
import { gitBlobSha } from './git-blob.js';
import { githubFetch, readToken } from './github-token.js';
import { GITHUB } from './github-config.js';

export const SITE_DRAFT_KEY = 'puzzkezz.site.draft';
export const SITE_PATH = 'data/site.json';
export const REELS_PATH = 'data/reels.json';
export const PORTRAIT_PATH = 'media/site/portrait.webp';
export const SHARE_PATH = 'og-image.png';
export const reelCoverPath = (id) => `media/reels/${id}.webp`;

const SITE_URL = new URL('../../data/site.json', import.meta.url).href;
const REELS_URL = new URL('../../data/reels.json', import.meta.url).href;
const READ_TIMEOUT_MS = 30000;

const empty = () => ({ sha: null, text: '' });
const state = {
  base: { site: empty(), reels: empty() },
  portrait: null, // draft value: PORTRAIT_PATH or null
  thumbs: {}, // reel id -> draft thumb ('' = none)
};
const listeners = new Set();
let resolveReady;
export const siteDraftReady = new Promise((resolve) => { resolveReady = resolve; });

function parse(text) {
  try {
    const data = JSON.parse(text);
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

/** The published site.json data ({ version, portrait } plus any other keys). */
function baseSite() {
  return parse(state.base.site.text) || { version: 1, portrait: null };
}

function baseReelsData() {
  const data = parse(state.base.reels.text);
  return data && Array.isArray(data.reels) ? data : null;
}

/** The reels of the published data/reels.json: [{ id, kana, kanaRomaji, en, thumb }]. */
export function baseReels() {
  const data = baseReelsData();
  return data ? data.reels.filter((r) => r && typeof r.id === 'string' && r.id) : [];
}

export function reelIds() {
  return new Set(baseReels().map((r) => r.id));
}

const basePortrait = () => (typeof baseSite().portrait === 'string' && baseSite().portrait ? baseSite().portrait : null);
const baseThumb = (reel) => (typeof reel.thumb === 'string' ? reel.thumb : '');

/* ---------- Text the files are written as ---------- */

/** data/site.json: 2-space JSON with a trailing newline. Only `portrait` changes. */
export function siteText() {
  const data = { version: 1, ...baseSite() };
  data.portrait = state.portrait;
  return `${JSON.stringify(data, null, 2)}\n`;
}

const oneLine = (value) => (value && typeof value === 'object' && !Array.isArray(value)
  ? `{ ${Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ')} }`
  : JSON.stringify(value));

/** data/reels.json in its own layout (one line per reel). Only each reel's `thumb` changes. */
export function formatReels(data) {
  const keys = Object.keys(data);
  const lines = ['{'];
  keys.forEach((key, i) => {
    const comma = i < keys.length - 1 ? ',' : '';
    if (key === 'reels' && Array.isArray(data.reels)) {
      lines.push('  "reels": [');
      data.reels.forEach((reel, j) => lines.push(`    ${oneLine(reel)}${j < data.reels.length - 1 ? ',' : ''}`));
      lines.push(`  ]${comma}`);
    } else {
      lines.push(`  ${JSON.stringify(key)}: ${JSON.stringify(data[key], null, 2).replace(/\n/g, '\n  ')}${comma}`);
    }
  });
  lines.push('}');
  return `${lines.join('\n')}\n`;
}

export function reelsText() {
  const data = baseReelsData();
  if (!data) return state.base.reels.text;
  return formatReels({
    ...data,
    reels: data.reels.map((r) => (r && typeof r.id === 'string' && r.id in state.thumbs ? { ...r, thumb: state.thumbs[r.id] } : r)),
  });
}

/* ---------- Draft values ---------- */

export function draftPortrait() {
  return state.portrait;
}

export function draftThumb(id) {
  return id in state.thumbs ? state.thumbs[id] : '';
}

export function siteChanged() {
  return state.portrait !== basePortrait();
}

export function reelsChanged() {
  return baseReels().some((r) => draftThumb(r.id) !== baseThumb(r));
}

export function baseOf(path) {
  return { ...(path === SITE_PATH ? state.base.site : state.base.reels) };
}

function save() {
  try {
    localStorage.setItem(SITE_DRAFT_KEY, JSON.stringify({
      version: 1,
      savedAt: new Date().toISOString(),
      base: state.base,
      portrait: state.portrait,
      thumbs: state.thumbs,
    }));
  } catch (error) {
    console.warn('Could not save the site draft:', error.message);
  }
  listeners.forEach((fn) => fn());
}

export function onSiteDraftChange(fn) {
  listeners.add(fn);
}

export function setPortrait(value) {
  state.portrait = value || null;
  save();
}

/** Sets one reel's thumb. Only ids that exist in data/reels.json. */
export function setThumb(id, value) {
  if (!reelIds().has(id)) return;
  state.thumbs[id] = value || '';
  save();
}

/**
 * "Remove from publish" on a site photo: the value that uses this file goes back to the published one, so
 * the draft never points at a file that will not be on GitHub.
 */
export function resetToBase(path) {
  if (path === PORTRAIT_PATH && state.portrait === path) {
    state.portrait = basePortrait();
    save();
    return;
  }
  const reel = baseReels().find((r) => reelCoverPath(r.id) === path);
  if (reel && draftThumb(reel.id) === path) {
    state.thumbs[reel.id] = baseThumb(reel);
    save();
  }
}

/** After a publish: the committed text and its blob SHA become the new base of that file. */
export function setSiteBase(path, sha, text) {
  if (path === SITE_PATH) state.base.site = { sha, text };
  else if (path === REELS_PATH) state.base.reels = { sha, text };
  save();
}

/* ---------- Loading ---------- */

function startFrom(base) {
  state.base = base;
  state.portrait = basePortrait();
  state.thumbs = Object.fromEntries(baseReels().map((r) => [r.id, baseThumb(r)]));
}

async function fromSite(url) {
  try {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) return empty();
    const bytes = await response.arrayBuffer();
    return { sha: await gitBlobSha(bytes), text: new TextDecoder().decode(bytes) };
  } catch {
    return empty();
  }
}

/** A file as it is on GitHub right now, or null when it can't be read. A missing file = { sha: null }. */
async function fromRepo(path, token) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), READ_TIMEOUT_MS);
  try {
    const url = `/repos/${GITHUB.owner}/${GITHUB.repo}/contents/${path}?ref=${encodeURIComponent(GITHUB.branch)}`;
    const response = await githubFetch(url, { token, signal: controller.signal });
    if (response.status === 404) return empty();
    if (!response.ok) return null;
    const file = await response.json();
    if (file.encoding !== 'base64' || typeof file.content !== 'string' || typeof file.sha !== 'string') return null;
    const bytes = Uint8Array.from(atob(file.content.replace(/\s/g, '')), (c) => c.charCodeAt(0));
    return { sha: file.sha, text: new TextDecoder().decode(bytes) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Discard draft (manager.js) also starts the site draft again: from GitHub with a token, else the site copy. */
export async function discardSiteDraft() {
  localStorage.removeItem(SITE_DRAFT_KEY);
  const token = readToken();
  let site = null;
  let reels = null;
  if (token) {
    site = await fromRepo(SITE_PATH, token);
    reels = site && await fromRepo(REELS_PATH, token);
  }
  if (!site || !reels) {
    site = await fromSite(SITE_URL);
    reels = await fromSite(REELS_URL);
  }
  startFrom({ site, reels });
  listeners.forEach((fn) => fn());
}

function readDraft() {
  try {
    const data = JSON.parse(localStorage.getItem(SITE_DRAFT_KEY) || 'null');
    if (!data || !data.base || !data.base.site || !data.base.reels) return null;
    const ok = (b) => (b.sha === null || typeof b.sha === 'string') && typeof b.text === 'string';
    if (!ok(data.base.site) || !ok(data.base.reels)) return null;
    return data;
  } catch {
    return null;
  }
}

async function init() {
  const draft = readDraft();
  if (draft) {
    startFrom({ site: draft.base.site, reels: draft.base.reels });
    state.portrait = typeof draft.portrait === 'string' && draft.portrait ? draft.portrait : null;
    for (const id of reelIds()) {
      if (draft.thumbs && typeof draft.thumbs[id] === 'string') state.thumbs[id] = draft.thumbs[id];
    }
  } else {
    startFrom({ site: await fromSite(SITE_URL), reels: await fromSite(REELS_URL) });
  }
  resolveReady();
  listeners.forEach((fn) => fn());
}

init();
