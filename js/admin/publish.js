// Publish to GitHub: commits the draft's data/events.json, the pending photo pairs (TASK-13), the removal
// of old, unused photo files, and the site photos with data/site.json + data/reels.json (TASK-14) as ONE
// commit through the Git Data API. TASK-21 adds data/moments.json (moments-draft.js) to the same commit.
// Order: read ref -> read commit -> read contents (stale check) -> read tree (recursive) -> [confirm removals]
// -> blobs (one at a time) -> tree -> commit -> move ref (force: false).
// The ref is the only write that changes the live site, and it is always the last call, so a failure at any
// earlier step leaves GitHub as it was. The token is only ever sent by githubFetch (github-token.js).
import { GITHUB } from './github-config.js';
import { githubFetch, readToken, MESSAGES as TOKEN_MESSAGES, TOKEN_EVENT, TOKEN_KEY } from './github-token.js';
import { PUBLISH_BUSY_EVENT } from './github-panel.js';
import { gitBlobSha } from './git-blob.js';
import {
  managerReady, draftText, eventCount, baseEvents, draftDiffersFromBase, setBase, onDraftChange,
  lockFileActions, exportEvents, isDraftLoading, draftEventIds, revertPhoto,
} from './manager.js';
import {
  pendingPairs, onPendingChange, clearPendingPairs, removePendingItem, isPipelineFile,
  pendingSiteFiles, removePendingSiteFile, clearPendingSiteFiles,
} from './pending.js';
import {
  siteDraftReady, onSiteDraftChange, siteText, reelsText, siteChanged, reelsChanged, baseOf, setSiteBase,
  reelIds, draftPortrait, draftThumb, resetToBase, SITE_PATH, REELS_PATH, PORTRAIT_PATH, SHARE_PATH, reelCoverPath,
} from './site-draft.js';
import {
  momentsDraftReady, onMomentsChange, momentsText, momentsChanged, momentsBase, setMomentsBase, MOMENTS_PATH,
  draftMoments, revertMomentPhoto, MOMENT_MEDIA_PREFIX,
} from './moments-draft.js';
import { validateMoment } from '../bangai.js';
import { MAX_FILE_BYTES, formatBytes } from './watermark.js';
import { readWatermarkMarker } from './wm-marker.js';

export const EVENTS_PATH = 'data/events.json';
/** The only folder Publish may remove files from (and only unused `.webp` files, see isRemovable). */
export const MEDIA_PREFIX = 'media/events/';
/** At most this many photos (pairs) per publish: 2 blobs each keeps one publish under GitHub's rate limit. */
export const MAX_PHOTOS = 20;
const REPO = `/repos/${GITHUB.owner}/${GITHUB.repo}`;
const STEPS = 8;
const UPLOAD_STEP = 5;
const REQUEST_TIMEOUT_MS = 30000;

export const PUBLISH_MESSAGES = Object.freeze({
  noToken: 'Add a GitHub token to publish',
  nothing: 'The draft is the same as the published events.json.',
  ready: `Makes one commit on ${GITHUB.owner}/${GITHUB.repo} (${GITHUB.branch}).`,
  success: 'Published. The site updates in about 1-2 minutes.',
  stale: 'The site changed since you started editing (maybe from another device). Export a backup, then reload this page.',
  nothingChanged: 'Nothing was changed on GitHub.',
  nothingSent: 'Nothing was sent to GitHub.',
  network: TOKEN_MESSAGES.network,
  unauthorized: 'Your GitHub token is wrong or has expired.',
  unauthorizedNext: 'Nothing was changed on GitHub. Make a new token, save it in the GitHub panel above, then try again.',
  noWrite: "This token can't write to the repo. It needs Contents: Read and write.",
  noWriteNext: 'Nothing was changed on GitHub. Give the token Contents: Read and write on GitHub, then try again.',
  noRepo: TOKEN_MESSAGES.noRepo,
  rateLimit: (minutes) => `GitHub is busy. Wait ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} and try again.`,
  other: (status) => `GitHub said no (${status}).`,
  unsure: 'The connection dropped while the site was being updated.',
  unsureNext: 'It is not clear if the change went live. Try again: it checks GitHub first and never publishes twice.',
  // TASK-13
  tooMany: `Publish at most ${MAX_PHOTOS} photos at a time`,
  tooManyNext: 'Press "Remove from publish" on some photos. They stay in the uploader and can go in the next publish.',
  tooBig: (path) => `This file is too big to publish (over 25 MB): ${path}`,
  tooBigNext: 'Remove it from the publish list and use a smaller original.',
  notUploader: (path) => `This file did not come from the uploader: ${path}`,
  notUploaderNext: 'Nothing was sent to GitHub. Process the photo again with the uploader.',
  badPath: (path) => `This path is not allowed in a publish: ${path}`,
  guard: (path) => `Refused to remove ${path}: only unused .webp files under ${MEDIA_PREFIX} can be removed.`,
  cancelled: 'Publish cancelled. Nothing was changed.',
  removed: (n) => `Removed ${n} old ${n === 1 ? 'file' : 'files'}.`,
  truncated: 'Could not list all old photos, so none were removed this time.',
  confirmTitle: (n) => (n === 1 ? 'This 1 old file will be removed' : `These ${n} old files will be removed`),
  // TASK-15
  notWatermarked: (path) => `This file is not a watermarked file from the uploader: ${path}. Please process it again with the uploader.`,
  // TASK-16: photo links in the JSON files of this publish. `who` = 'Event "CF 2026" (2026-03-14-cf)',
  // 'Portrait' or 'Reel cover す (sugoi)'. The first sentence is the error text, the rest the "what to do" line.
  linkForm: (who, value) => `${who} has a photo path that is not in the usual form: ${value}`,
  linkMissing: (who, path) => `${who} points at a photo that is not on GitHub and not in this publish: ${path}`,
  linkEventNext: 'Attach the photo again or fix the path, then publish. Nothing was changed.',
  linkEventMissingNext: 'Attach the photo again, or remove it from the event, then publish. Nothing was changed.',
  linkSiteNext: (clear) => `Make the photo again or press "${clear}", then publish. Nothing was changed.`,
  linkUnchecked: "Could not list all files on GitHub, so the photo links can't be checked.",
  linkUncheckedNext: 'Nothing was changed.',
  more: (n) => ` (and ${n} more)`,
  revertedBase: (name) => `Photo for ${name} set back to the published photo.`,
  revertedNone: (name) => `Photo for ${name} removed from the event (it has no published photo).`,
  // TASK-22: moment photos
  linkMomentNext: 'Make the photo again with "Moment photo", or remove it from the moment, then publish. Nothing was changed.',
  momentRevertedBase: (id) => `Photo for moment ${id} set back to the published photo.`,
  momentRevertedNone: (id) => `Photo for moment ${id} removed (it has no published photo).`,
  momentIncomplete: (id, errors) => `Moment ${id} can't be published: ${errors}.`,
  momentIncompleteNext: 'Edit it in the Moments panel (add a photo or a link), or delete it, then publish. Nothing was sent to GitHub.',
});

const STEP_TEXT = [
  'Reading the branch',
  'Reading the latest commit',
  'Checking events.json on GitHub',
  'Listing the photo files on GitHub',
  'Uploading',
  'Building the file tree',
  'Making the commit',
  'Updating the site',
];

/**
 * Checks run on every file right before a publish sends anything (also on Try again).
 * Each check is `async (path, blob) => message | null`; a message stops the whole publish with no request.
 * TASK-15 registers the watermark marker check here (watermarkMarkerCheck, below).
 */
const fileChecks = [];
export function addFileCheck(check) {
  fileChecks.push(check);
}

/** Image files Publish checks for the watermark marker (TASK-15). */
export const MARKED_IMAGE_RE = /\.(webp|png|jpe?g)$/i;

/**
 * TASK-15: every image file must carry the hidden marker the uploader adds (js/admin/wm-marker.js).
 * This checks the bytes, on top of the WeakSet check, which only knows which Blob objects the pipeline made.
 */
export async function watermarkMarkerCheck(path, blob) {
  if (!MARKED_IMAGE_RE.test(String(path))) return null;
  let bytes = null;
  try {
    bytes = new Uint8Array(await blob.arrayBuffer());
  } catch {
    bytes = null;
  }
  return bytes && readWatermarkMarker(bytes) ? null : PUBLISH_MESSAGES.notWatermarked(path);
}
addFileCheck(watermarkMarkerCheck);

/**
 * Test seam only: `editRemovals(paths) => paths` lets tests inject a removal path that breaks the rules, to
 * prove the guard stops the publish before any write. Never set by the app.
 */
export const publishHooks = { editRemovals: null };

const $ = (id) => document.getElementById(id);
let busy = false;

/** One failed publish. `kind` picks the message; `next` is the muted "what to do" line. */
class PublishError extends Error {
  constructor(kind, message, next = PUBLISH_MESSAGES.nothingChanged, status = 0) {
    super(message);
    this.kind = kind;
    this.next = next;
    this.status = status;
  }
}

/** Stale: the stale box in admin/index.html holds its own text and the recovery steps (one place only). */
function staleError(status = 0) {
  return new PublishError('stale', PUBLISH_MESSAGES.stale, '', status);
}

function waitMinutes(response) {
  const retry = Number(response.headers.get('retry-after'));
  if (Number.isFinite(retry) && retry > 0) return Math.max(1, Math.ceil(retry / 60));
  const reset = Number(response.headers.get('x-ratelimit-reset'));
  if (Number.isFinite(reset) && reset > 0) return Math.max(1, Math.ceil((reset * 1000 - Date.now()) / 60000));
  return 1;
}

/** Turns a non-OK response into the message the page shows. `write` = a POST/PATCH call. */
function failure(response, { write, refUpdate }) {
  const { status } = response;
  const nothing = PUBLISH_MESSAGES.nothingChanged;
  const limited = status === 429
    || (status === 403 && (response.headers.get('x-ratelimit-remaining') === '0' || response.headers.has('retry-after')));
  if (limited) return new PublishError('rate', PUBLISH_MESSAGES.rateLimit(waitMinutes(response)), nothing, status);
  if (status === 401) return new PublishError('unauthorized', PUBLISH_MESSAGES.unauthorized, PUBLISH_MESSAGES.unauthorizedNext, status);
  if (refUpdate && (status === 409 || status === 422)) return staleError(status);
  if (status === 403 || status === 404) {
    return write
      ? new PublishError('no-write', PUBLISH_MESSAGES.noWrite, PUBLISH_MESSAGES.noWriteNext, status)
      : new PublishError('no-repo', PUBLISH_MESSAGES.noRepo, nothing, status);
  }
  return new PublishError('other', PUBLISH_MESSAGES.other(status), `${nothing} Try again in a few minutes.`, status);
}

/** One API call. Network errors and timeouts become a PublishError with kind 'network'. */
async function api(token, path, { method = 'GET', body, refUpdate = false } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await githubFetch(path, { token, method, body, signal: controller.signal });
  } catch {
    throw new PublishError('network', PUBLISH_MESSAGES.network, `${PUBLISH_MESSAGES.nothingChanged} Try again when you are back online.`);
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) throw failure(response, { write: method !== 'GET', refUpdate });
  try {
    return await response.json();
  } catch {
    throw new PublishError('other', PUBLISH_MESSAGES.other(response.status));
  }
}

/* ---------- Pure rules (paths, removals) ---------- */

/** Every `photo` / `photoFull` string of the events in an events.json text (raw, as written). */
function photoValues(text) {
  let events = [];
  try {
    const data = JSON.parse(text);
    events = Array.isArray(data.events) ? data.events : [];
  } catch {
    return [];
  }
  const values = [];
  for (const event of events) {
    if (event && typeof event.photo === 'string' && event.photo) values.push(event.photo);
    if (event && typeof event.photoFull === 'string' && event.photoFull) values.push(event.photoFull);
  }
  return values;
}

/**
 * The repo file a photo value points at, as the site resolves it: "./a", "a/./b", "a?v=2", "a#x" and
 * percent-escapes all lead to the same file. null if it can't be resolved.
 */
export function resolvedPath(value) {
  try {
    return decodeURIComponent(new URL(value, 'https://x.invalid/').pathname.slice(1));
  } catch {
    return null;
  }
}

/** Every file used by an event in an events.json text: each value as written AND as the site resolves it. */
export function usedPathsIn(text) {
  const used = new Set();
  for (const value of photoValues(text)) {
    used.add(value);
    const resolved = resolvedPath(value);
    if (resolved) used.add(resolved);
  }
  return used;
}

/** Plain path characters only: ASCII letters, digits, "-", "_", ".", "~", one "/" between non-empty parts. */
const PLAIN_PATH = /^[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*$/;

/**
 * True when a photo value is written in plain form: only the characters above (so no "//", leading or
 * trailing "/", "%", "?", "#", ";", "\\", ":", whitespace or non-ASCII), no "." or ".." part, and equal to
 * the file the site resolves it to. Anything else might reach the same file in a way this code can't see.
 */
export function isCanonicalPath(value) {
  if (typeof value !== 'string' || !PLAIN_PATH.test(value)) return false;
  if (value.split('/').some((seg) => seg === '.' || seg === '..')) return false;
  return resolvedPath(value) === value;
}

/**
 * True when every photo value is in plain form (isCanonicalPath). If not, the pending list previews no
 * removals, and Publish stops before listing any (TASK-16, brokenPhotoLinks), so an unusual way of writing
 * a path can never let a file that is still in use be removed.
 */
export function allPathsCanonical(text) {
  return photoValues(text).every(isCanonicalPath);
}

/**
 * True only for a path Publish may remove: under media/events/, ending in ".webp" (exact, lowercase),
 * no empty, "." or ".." segment, not used by any event in the committed events.json, and not a new file
 * of this publish. Exact string match, so a file used by any event is never removed.
 */
export function isRemovable(path, used, newPaths) {
  if (typeof path !== 'string' || !path.startsWith(MEDIA_PREFIX) || !path.endsWith('.webp')) return false;
  const rest = path.slice(MEDIA_PREFIX.length).split('/');
  if (rest.some((seg) => seg === '' || seg === '.' || seg === '..')) return false;
  if (rest[rest.length - 1] === '.webp') return false;
  return !used.has(path) && !newPaths.has(path);
}

/**
 * TASK-22: true only for a moment photo Publish may remove: directly in media/moments/ (no sub-folder), ending
 * in ".webp" (exact, lowercase), not used by any moment or event of this commit, and not a new file of it.
 */
export function isRemovableMoment(path, used, newPaths) {
  if (typeof path !== 'string' || !path.startsWith(MOMENT_MEDIA_PREFIX) || !path.endsWith('.webp')) return false;
  const name = path.slice(MOMENT_MEDIA_PREFIX.length);
  if (!name || name === '.webp' || name.includes('/') || name.startsWith('.')) return false;
  return !used.has(path) && !newPaths.has(path);
}

/** Every `photo` of the moments in a data/moments.json text, as written and as the site resolves it. */
export function momentPathsIn(text) {
  const used = new Set();
  const data = objectOf(text);
  for (const m of (data && Array.isArray(data.moments) ? data.moments : [])) {
    if (!m || typeof m.photo !== 'string' || !m.photo) continue;
    used.add(m.photo);
    const resolved = resolvedPath(m.photo);
    if (resolved) used.add(resolved);
  }
  return used;
}

/** Paths in a recursive tree listing that no event uses any more (see isRemovable). */
export function removalCandidates(treeEntries, used, newPaths) {
  return treeEntries
    .filter((e) => e && e.type === 'blob' && isRemovable(e.path, used, newPaths))
    .map((e) => e.path)
    .sort();
}

const MOMENT_FILE_RE = /^media\/moments\/([a-z0-9][a-z0-9-]*)\.webp$/;

/**
 * TASK-22: '' if a pending moment photo may be published, else the bad path. Allowed only at
 * media/moments/<id>.webp (or <id>-<n>.webp) of a moment in the draft that uses exactly this path.
 */
export function momentPathProblem(entry, moments) {
  const path = entry && typeof entry.path === 'string' ? entry.path : '';
  const m = MOMENT_FILE_RE.exec(path);
  const owner = m && moments.find((x) => x.id === entry.momentId && x.photo === path);
  if (owner && (m[1] === owner.id || new RegExp(`^${owner.id}-[0-9]+$`).test(m[1]))) return '';
  return path || '(empty path)';
}

const PAIR_RE = /^media\/events\/([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9-]*)\.webp$/;

/** '' if a pending pair's paths fit `media/events/<event-id>/<name>.webp` + `<name>-full.webp`, else the bad path. */
export function pairPathProblem(pair, eventIds) {
  const m = PAIR_RE.exec(pair.photo || '');
  if (!m || m[1] !== pair.eventId || !eventIds.has(m[1])) return pair.photo || '(empty path)';
  if (pair.photoFull !== `${MEDIA_PREFIX}${m[1]}/${m[2]}-full.webp`) return pair.photoFull || '(empty path)';
  return '';
}

/**
 * '' if a pending site photo (TASK-14) has one of the allowed fixed paths for its target, else the bad path:
 * media/site/portrait.webp, media/reels/<reel-id>.webp (only ids in data/reels.json), og-image.png.
 */
export function sitePathProblem(entry, ids) {
  const path = entry && typeof entry.path === 'string' ? entry.path : '';
  if (entry.target === 'portrait' && path === PORTRAIT_PATH) return '';
  if (entry.target === 'share' && path === SHARE_PATH) return '';
  const m = /^media\/reels\/([^/]+)\.webp$/.exec(path);
  if (entry.target === 'reel' && m && ids.has(m[1]) && reelCoverPath(m[1]) === path) return '';
  return path || '(empty path)';
}

/* ---------- Photo link checks (TASK-16) ---------- */

/** The events of an events.json text, in the order written ([] for bad JSON). */
function eventsOf(text) {
  try {
    const data = JSON.parse(text);
    return data && Array.isArray(data.events) ? data.events.filter((e) => e && typeof e === 'object') : [];
  } catch {
    return [];
  }
}

/** How a message names an event: 'CF 2026'. */
const eventName = (event) => `${event.short ?? ''} ${String(event.date ?? '').slice(0, 4)}`;

/**
 * The problem with one photo link, or null. 'form': not in plain form. Then, for paths under `prefix`
 * ('' = every path): 'unchecked' when the listing is truncated and the file is not new in this publish,
 * 'missing' when the tree has no blob with exactly that path and it is not new in this publish.
 */
function linkProblem(value, blobs, truncated, newPaths, prefix) {
  if (!isCanonicalPath(value)) return 'form';
  if (!value.startsWith(prefix) || newPaths.has(value)) return null;
  if (truncated) return 'unchecked';
  return blobs.has(value) ? null : 'missing';
}

const blobPathsOf = (treeEntries) => new Set((Array.isArray(treeEntries) ? treeEntries : [])
  .filter((e) => e && e.type === 'blob' && typeof e.path === 'string').map((e) => e.path));
const asSet = (paths) => (paths instanceof Set ? paths : new Set(paths || []));

/**
 * Photo links of the events in the events.json text about to be committed that would be broken on the live
 * site: [] when all is well, else [{ kind: 'form' | 'missing' | 'unchecked', who, id, field, value, next }]
 * in the order of the text (display order: newest first). Plain paths outside media/events/ are not checked
 * here (the repo guard of TASK-15 checks them). Never throws: bad JSON gives [].
 */
export function brokenPhotoLinks(text, treeEntries, truncated, newPaths) {
  const blobs = blobPathsOf(treeEntries);
  const fresh = asSet(newPaths);
  const problems = [];
  for (const event of eventsOf(text)) {
    for (const field of ['photo', 'photoFull']) {
      const value = event[field];
      if (typeof value !== 'string' || !value) continue;
      const kind = linkProblem(value, blobs, Boolean(truncated), fresh, MEDIA_PREFIX);
      if (!kind) continue;
      problems.push({
        kind,
        who: `Event "${eventName(event)}" (${event.id})`,
        id: event.id,
        field,
        value,
        next: kind === 'form' ? PUBLISH_MESSAGES.linkEventNext : PUBLISH_MESSAGES.linkEventMissingNext,
      });
    }
  }
  return problems;
}

/** A JSON text as an object, or null (bad JSON, not an object, or no text: the file is not in this commit). */
function objectOf(text) {
  if (typeof text !== 'string') return null;
  try {
    const data = JSON.parse(text);
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

/**
 * The same check for the site photos (BUG-4): `portrait` in the data/site.json text and every reel's `thumb`
 * in the data/reels.json text of this commit (pass null for a file that is not in the commit). Every path is
 * checked, not only media/... ones. Order: portrait, then reels in file order. Never throws: bad JSON gives [].
 */
export function brokenSitePhotoLinks(siteJsonText, reelsJsonText, treeEntries, truncated, newPaths) {
  const blobs = blobPathsOf(treeEntries);
  const fresh = asSet(newPaths);
  const problems = [];
  const check = (value, who, clear, extra) => {
    if (typeof value !== 'string' || !value) return;
    const kind = linkProblem(value, blobs, Boolean(truncated), fresh, '');
    if (kind) problems.push({ kind, who, value, next: PUBLISH_MESSAGES.linkSiteNext(clear), ...extra });
  };
  const site = objectOf(siteJsonText);
  if (site) check(site.portrait, 'Portrait', 'Clear portrait', { field: 'portrait' });
  const reels = objectOf(reelsJsonText);
  if (reels && Array.isArray(reels.reels)) {
    for (const reel of reels.reels) {
      if (!reel || typeof reel !== 'object') continue;
      check(reel.thumb, `Reel cover ${reel.kana ?? ''} (${reel.id})`, 'Clear cover', { id: reel.id, field: 'thumb' });
    }
  }
  return problems;
}

/**
 * TASK-22: the same check for the moment photos in the data/moments.json text of this commit (null = not in the
 * commit). Every photo must be in plain form; one under media/moments/ must be on GitHub or in this publish.
 * Order: album order of the text. Never throws: bad JSON gives [].
 */
export function brokenMomentPhotoLinks(momentsJsonText, treeEntries, truncated, newPaths) {
  const blobs = blobPathsOf(treeEntries);
  const fresh = asSet(newPaths);
  const problems = [];
  const data = objectOf(momentsJsonText);
  for (const m of (data && Array.isArray(data.moments) ? data.moments : [])) {
    if (!m || typeof m !== 'object' || typeof m.photo !== 'string' || !m.photo) continue;
    const kind = linkProblem(m.photo, blobs, Boolean(truncated), fresh, MOMENT_MEDIA_PREFIX);
    if (kind) {
      const who = m.caption ? `Moment "${m.caption}" (${m.id})` : `Moment ${m.id}`;
      problems.push({ kind, who, id: m.id, field: 'photo', value: m.photo, next: PUBLISH_MESSAGES.linkMomentNext });
    }
  }
  return problems;
}

/**
 * One message for all link problems: the first one by name, then "(and N more)" where N counts the other
 * events / site photos with a problem (an event whose photo and photoFull are both missing counts once).
 */
function linkError(problems) {
  const [first] = problems;
  if (first.kind === 'unchecked') {
    return new PublishError('link', PUBLISH_MESSAGES.linkUnchecked, PUBLISH_MESSAGES.linkUncheckedNext);
  }
  const text = first.kind === 'form'
    ? PUBLISH_MESSAGES.linkForm(first.who, first.value)
    : PUBLISH_MESSAGES.linkMissing(first.who, first.value);
  const others = new Set(problems.map((p) => p.who)).size - 1;
  const more = others > 0 ? PUBLISH_MESSAGES.more(others) : '';
  return new PublishError('link', `${text}${more}.`, first.next);
}

/** True while the site draft points at this file (a share image is always used: og:image). */
function siteFileUsed(entry) {
  if (entry.target === 'share') return true;
  if (entry.target === 'moment') {
    if (momentPathProblem(entry, draftMoments())) return true; // kept, so prepare() refuses it before any request
    return draftMoments().some((m) => m.photo === entry.path);
  }
  if (sitePathProblem(entry, reelIds())) return true; // kept, so prepare() refuses it before any request
  if (entry.target === 'portrait') return draftPortrait() === entry.path;
  const m = /^media\/reels\/([^/]+)\.webp$/.exec(entry.path || '');
  return Boolean(m) && draftThumb(m[1]) === entry.path;
}

/** Number of moments in a data/moments.json text (0 for bad JSON). */
function momentCount(text) {
  const data = objectOf(text);
  return data && Array.isArray(data.moments) ? data.moments.length : 0;
}

/* ---------- What is pending ---------- */

/**
 * The pending pairs that go in this publish: only files whose path is still used by an event in the draft
 * (pairs of a deleted event, or replaced by another attach, are dropped). Each file holds the current blob.
 */
function publishSet(text = draftText()) {
  const used = usedPathsIn(text);
  const pairs = [];
  const files = [];
  for (const pair of pendingPairs()) {
    const item = pair.item || {};
    const mine = [
      { path: pair.photo, blob: item.display ? item.display.blob : null, pair },
      { path: pair.photoFull, blob: item.master ? item.master.blob : null, pair },
    ].filter((f) => used.has(f.path));
    if (!mine.length) continue;
    pairs.push(pair);
    files.push(...mine);
  }
  // Site photos (TASK-14): only files the site draft still uses.
  const site = pendingSiteFiles().filter(siteFileUsed);
  for (const entry of site) files.push({ path: entry.path, blob: entry.out ? entry.out.blob : null, site: entry });
  return { pairs, site, files };
}

/** Number of photos in a publish: each event pair and each site photo counts as one. */
const photoCount = (set) => set.pairs.length + set.site.length;

/** Limit problems that keep the button disabled: { message, next } or null. */
function limitProblem(set) {
  const { files } = set;
  if (photoCount(set) > MAX_PHOTOS) return { message: PUBLISH_MESSAGES.tooMany, next: PUBLISH_MESSAGES.tooManyNext };
  const big = files.find((f) => f.blob && f.blob.size > MAX_FILE_BYTES);
  if (big) return { message: PUBLISH_MESSAGES.tooBig(big.path), next: PUBLISH_MESSAGES.tooBigNext };
  return null;
}

/** Old photos that this draft no longer uses (a preview; the real list comes from the repo tree at publish). */
function expectedRemovals(text, newPaths) {
  if (!allPathsCanonical(text)) return [];
  const used = usedPathsIn(text);
  for (const p of momentPathsIn(momentsText())) used.add(p); // a file a moment uses is never removed
  return [...usedPathsIn(baseEvents().text)].filter((p) => isRemovable(p, used, newPaths)).sort();
}

/** TASK-22: old moment photos that the moments draft no longer uses (preview, like expectedRemovals). */
function expectedMomentRemovals(eventsText, newPaths) {
  const used = new Set([...momentPathsIn(momentsText()), ...usedPathsIn(eventsText)]);
  return [...momentPathsIn(momentsBase().text)].filter((p) => isRemovableMoment(p, used, newPaths)).sort();
}

/**
 * Everything checked before any request: limits, allowed paths, files from the uploader only, then the
 * extra file checks (TASK-15). Returns the snapshot this publish uses, so a re-render meanwhile can't change it.
 */
async function prepare() {
  const text = draftText();
  const set = publishSet(text);
  const limit = limitProblem(set);
  if (limit) throw new PublishError('limit', limit.message, limit.next);
  const ids = draftEventIds();
  for (const pair of set.pairs) {
    const bad = pairPathProblem(pair, ids);
    if (bad) throw new PublishError('path', PUBLISH_MESSAGES.badPath(bad), PUBLISH_MESSAGES.nothingSent);
  }
  const reels = reelIds();
  const moments = draftMoments();
  for (const entry of set.site) {
    const bad = entry.target === 'moment' ? momentPathProblem(entry, moments) : sitePathProblem(entry, reels);
    if (bad) throw new PublishError('path', PUBLISH_MESSAGES.badPath(bad), PUBLISH_MESSAGES.nothingSent);
  }
  for (const file of set.files) {
    if (!isPipelineFile(file.blob)) {
      throw new PublishError('not-uploader', PUBLISH_MESSAGES.notUploader(file.path), PUBLISH_MESSAGES.notUploaderNext);
    }
  }
  for (const file of set.files) {
    for (const check of fileChecks) {
      // eslint-disable-next-line no-await-in-loop
      const problem = await check(file.path, file.blob);
      if (problem) throw new PublishError('check', String(problem), PUBLISH_MESSAGES.nothingSent);
    }
  }
  // Events go in when they changed or event photos are pending (as before TASK-14); site JSON when changed.
  const withEvents = text !== baseEvents().text || set.pairs.length > 0;
  const json = [];
  if (siteChanged()) json.push({ path: SITE_PATH, text: siteText(), base: baseOf(SITE_PATH) });
  if (reelsChanged()) json.push({ path: REELS_PATH, text: reelsText(), base: baseOf(REELS_PATH) });
  if (momentsChanged()) {
    // TASK-22: a moment left with no photo and no link (for example after "Remove from publish") is not sent.
    for (const m of moments) {
      const errors = validateMoment(m);
      if (errors.length) throw new PublishError('moment', PUBLISH_MESSAGES.momentIncomplete(m.id, errors.join('; ')), PUBLISH_MESSAGES.momentIncompleteNext);
    }
    json.push({ path: MOMENTS_PATH, text: momentsText(), base: momentsBase() }); // TASK-21
  }
  return { text, withEvents, json, ...set };
}

/* ---------- UI ---------- */
function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function setBusy(value) {
  busy = value;
  lockFileActions(value);
  window.dispatchEvent(new CustomEvent(PUBLISH_BUSY_EVENT, { detail: { busy: value } }));
  render();
}

/** step 0 hides the bar. During the upload step, `sub` = { n, total } blobs. */
function showProgress(step, sub = null, label = null) {
  const box = $('pub-progress');
  box.hidden = step === 0;
  if (!step) return;
  const part = sub ? (sub.n - 1) / sub.total : 0;
  const pct = Math.round(((step - 1 + part) / STEPS) * 100);
  const what = sub ? `Uploading file ${sub.n} of ${sub.total}` : (label || STEP_TEXT[step - 1]);
  $('pub-step').textContent = `Step ${step} of ${STEPS}: ${what}`;
  const bar = $('pub-bar');
  bar.setAttribute('aria-valuenow', String(pct));
  bar.firstElementChild.style.width = `${pct}%`;
}

/** Shows one result box: '' (none) | 'ok' | 'err' | 'stale' | 'cancel'. */
function showResult(kind, detail = {}) {
  $('pub-ok').hidden = kind !== 'ok';
  $('pub-err').hidden = kind !== 'err';
  $('pub-stale').hidden = kind !== 'stale';
  $('pub-cancel').hidden = kind !== 'cancel';
  if (kind === 'ok') {
    const link = $('pub-commit');
    link.href = `https://github.com/${GITHUB.owner}/${GITHUB.repo}/commit/${detail.sha}`;
    link.textContent = `View commit ${detail.sha.slice(0, 7)}`;
    const notes = [];
    if (detail.removed) notes.push(PUBLISH_MESSAGES.removed(detail.removed));
    if (detail.truncated) notes.push(PUBLISH_MESSAGES.truncated);
    $('pub-ok-note').textContent = notes.join(' ');
    $('pub-ok-note').hidden = notes.length === 0;
  }
  if (kind === 'err') {
    $('pub-err-text').textContent = detail.message;
    $('pub-err-next').textContent = detail.next;
  }
}

/** The short note under the pending list ('' hides it). Replaced by the next note, cleared by Publish. */
function showNote(text) {
  const note = $('pub-note');
  note.textContent = text;
  note.hidden = !text;
}

/**
 * TASK-16 (2): after "Remove from publish" on a pair, the event goes back to its published photo (or has
 * none), so the draft never points at a file that will not be on GitHub. Only when the event still uses
 * exactly this pair's paths; a path changed meanwhile is left alone. Returns the note, or ''.
 */
function revertPair(pair) {
  const event = eventsOf(draftText()).find((e) => e.id === pair.eventId);
  if (!event || event.photo !== pair.photo) return '';
  if (event.photoFull && event.photoFull !== pair.photoFull) return '';
  const published = eventsOf(baseEvents().text).find((e) => e.id === pair.eventId);
  // BUG-5: the attach dropped the "Sample" tag; put back the published one. BUG-6: keep a typed form path.
  const options = {
    sample: published && published.sample !== undefined ? published.sample : undefined,
    formPaths: { photo: pair.photo, photoFull: pair.photoFull },
  };
  if (published && typeof published.photo === 'string' && published.photo) {
    const full = typeof published.photoFull === 'string' ? published.photoFull : '';
    revertPhoto(pair.eventId, published.photo, full, options);
    return PUBLISH_MESSAGES.revertedBase(eventName(event));
  }
  revertPhoto(pair.eventId, '', '', options);
  return PUBLISH_MESSAGES.revertedNone(eventName(event));
}

/** "Remove from publish" on a pair: drop it (and any pair of the same file), then undo its attach. */
function undoAttach(item) {
  const gone = pendingPairs().filter((p) => p.item === item);
  removePendingItem(item);
  const notes = gone.map(revertPair).filter(Boolean);
  showNote(notes.length ? notes[notes.length - 1] : '');
}

function pendRow(mark, label, text) {
  const li = make('li');
  const b = make('b', '', mark);
  b.setAttribute('aria-label', label);
  li.append(b, ` ${text}`);
  return li;
}

function render() {
  const btn = $('publish-btn');
  const hint = $('publish-hint');
  const text = draftText();
  const changed = draftDiffersFromBase();
  const set = publishSet(text);
  const newPaths = new Set(set.files.map((f) => f.path));
  const removals = changed ? expectedRemovals(text, newPaths) : [];
  const limit = limitProblem(set);

  const list = $('pub-pending');
  list.replaceChildren();
  for (const pair of set.pairs) {
    const li = make('li', 'pend-pair');
    const files = set.files.filter((f) => f.pair === pair);
    if (files.some((f) => f.blob && f.blob.size > MAX_FILE_BYTES)) li.classList.add('is-err');
    const paths = make('div', 'pend-paths');
    for (const f of files) {
      const row = make('p', 'pend-file');
      const b = make('b', '', '+');
      b.setAttribute('aria-label', 'added');
      const size = f.blob ? formatBytes(f.blob.size) : '?';
      row.append(b, ` ${f.path} `, make('span', 'pend-size', `(${size})`));
      paths.append(row);
    }
    const remove = make('button', 'btn btn-secondary btn-sm pend-remove', 'Remove from publish');
    remove.type = 'button';
    remove.disabled = busy;
    remove.setAttribute('aria-label', `Remove ${pair.photo} from publish`);
    remove.addEventListener('click', () => undoAttach(pair.item));
    li.append(paths, remove);
    list.append(li);
  }
  for (const entry of set.site) {
    const li = make('li', 'pend-pair');
    const big = entry.out && entry.out.blob.size > MAX_FILE_BYTES;
    if (big) li.classList.add('is-err');
    const row = make('p', 'pend-file');
    const b = make('b', '', '+');
    b.setAttribute('aria-label', 'added');
    const size = entry.out ? formatBytes(entry.out.blob.size) : '?';
    row.append(b, ` ${entry.label} -> ${entry.path} `, make('span', 'pend-size', `(${size})`));
    const paths = make('div', 'pend-paths');
    paths.append(row);
    const remove = make('button', 'btn btn-secondary btn-sm pend-remove', 'Remove from publish');
    remove.type = 'button';
    remove.disabled = busy;
    remove.setAttribute('aria-label', `Remove ${entry.path} from publish`);
    remove.addEventListener('click', () => {
      removePendingSiteFile(entry.path);
      if (entry.target === 'moment') {
        // TASK-22: the moment gets its published photo back (or none), like "Remove from publish" on a pair.
        const done = revertMomentPhoto(entry.path);
        if (done) showNote(done.restored ? PUBLISH_MESSAGES.momentRevertedBase(done.id) : PUBLISH_MESSAGES.momentRevertedNone(done.id));
        return;
      }
      resetToBase(entry.path); // the draft goes back to the published value, never to a missing file
    });
    li.append(paths, remove);
    list.append(li);
  }
  if (changed) list.append(pendRow('~', 'changed', `${EVENTS_PATH} changed`));
  if (siteChanged()) list.append(pendRow('~', 'changed', `${SITE_PATH} changed`));
  if (reelsChanged()) list.append(pendRow('~', 'changed', `${REELS_PATH} changed`));
  if (momentsChanged()) list.append(pendRow('~', 'changed', `${MOMENTS_PATH} changed`));
  for (const path of removals) list.append(pendRow('-', 'removed', `${path} (no event uses it)`));
  if (momentsChanged()) {
    for (const path of expectedMomentRemovals(text, newPaths)) list.append(pendRow('-', 'removed', `${path} (no moment uses it)`));
  }
  if (!list.children.length) list.append(make('li', 'pend-empty', 'No pending changes.'));

  const total = $('pub-total');
  if (photoCount(set)) {
    const bytes = set.files.reduce((sum, f) => sum + (f.blob ? f.blob.size : 0), 0);
    const n = photoCount(set);
    const k = set.files.length;
    total.textContent = `Adds ${n} ${n === 1 ? 'photo' : 'photos'}, ${k} ${k === 1 ? 'file' : 'files'}, ${formatBytes(bytes)}`;
    total.hidden = false;
  } else {
    total.textContent = '';
    total.hidden = true;
  }

  const token = readToken() !== '';
  const something = changed || photoCount(set) > 0 || siteChanged() || reelsChanged() || momentsChanged();
  btn.classList.remove('is-limit');
  if (isDraftLoading()) {
    btn.disabled = true;
    btn.textContent = 'Publish to GitHub';
    hint.textContent = 'Loading the published events.json...';
  } else if (busy) {
    btn.disabled = true;
    btn.textContent = 'Publishing...';
    hint.textContent = 'Publishing... Keep this page open.';
  } else if (!token) {
    btn.disabled = true;
    btn.textContent = 'Publish to GitHub';
    hint.textContent = PUBLISH_MESSAGES.noToken;
  } else if (!something) {
    btn.disabled = true;
    btn.textContent = 'Nothing to publish';
    hint.textContent = PUBLISH_MESSAGES.nothing;
  } else if (limit) {
    btn.disabled = true;
    btn.textContent = 'Publish to GitHub';
    hint.textContent = `${limit.message}. ${limit.next}`;
  } else {
    btn.disabled = false;
    btn.textContent = 'Publish to GitHub';
    hint.textContent = PUBLISH_MESSAGES.ready;
  }
  const limitBox = $('pub-limit');
  limitBox.hidden = !(limit && !busy);
  if (limit) limitBox.querySelector('.msg-text').textContent = limit.message;
}

/** Asks before removing files. Resolves true on "Remove and publish", false on Cancel or Esc. */
function confirmRemovals(paths) {
  const dialog = $('pub-confirm');
  $('pub-confirm-title').textContent = PUBLISH_MESSAGES.confirmTitle(paths.length);
  const list = $('pub-confirm-list');
  list.replaceChildren(...paths.map((p) => {
    const li = make('li');
    const icon = make('span', 'confirm-minus', '−');
    icon.setAttribute('aria-hidden', 'true');
    li.append(icon, ` ${p}`);
    return li;
  }));
  return new Promise((resolve) => {
    const yes = $('pub-confirm-yes');
    const no = $('pub-confirm-no');
    let settled = false;
    const finish = (ok) => {
      if (settled) return; // the close event after an answer must not answer again
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
    const onCancel = (e) => { e.preventDefault(); finish(false); }; // Esc = Cancel
    // Closed any other way (some browsers skip 'cancel' on Esc, or close() from elsewhere): also Cancel,
    // so Publish can never stay stuck on "Publishing...".
    const onClose = () => finish(false);
    yes.addEventListener('click', onYes);
    no.addEventListener('click', onNo);
    dialog.addEventListener('cancel', onCancel);
    dialog.addEventListener('close', onClose);
    dialog.showModal();
    no.focus(); // the safe choice
  });
}

/** Base64 of a Blob without one huge btoa string: FileReader.readAsDataURL, then drop the "data:...," prefix. */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      resolve(url.slice(url.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** True when every file is already on GitHub with the same bytes (a Try again after an unsure result). */
async function allOnGitHub(treeEntries, files) {
  const have = new Map(treeEntries.map((e) => [e.path, e.sha]));
  for (const f of files) {
    // eslint-disable-next-line no-await-in-loop
    if (have.get(f.path) !== await gitBlobSha(await f.blob.arrayBuffer())) return false;
  }
  return true;
}

/* ---------- Publish ---------- */
/** GitHub's blob SHA of a file at `head`, or null when the file is not there (404). */
async function shaOnGitHub(token, path, head) {
  try {
    const file = await api(token, `${REPO}/contents/${path}?ref=${head}`);
    return file.sha;
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

async function run(token, { text, files, pairs, site, withEvents, json }) {
  const base = baseEvents();
  const branch = encodeURIComponent(GITHUB.branch);

  showProgress(1);
  const ref = await api(token, `${REPO}/git/ref/heads/${branch}`);
  const head = ref.object.sha;

  showProgress(2);
  const commit = await api(token, `${REPO}/git/commits/${head}`);
  const baseTree = commit.tree.sha;

  // The JSON files of this publish, each with its own base SHA (stale check).
  showProgress(3, null, withEvents ? null : 'Checking the site files on GitHub');
  const data = [];
  if (withEvents) {
    let current;
    try {
      current = await api(token, `${REPO}/contents/${EVENTS_PATH}?ref=${head}`);
    } catch (error) {
      // No events.json on the branch any more: someone else changed the repo.
      if (error.status === 404) throw staleError(404);
      throw error;
    }
    data.push({ path: EVENTS_PATH, text, current: current.sha, base: base.sha, events: true });
  }
  for (const j of json) {
    // eslint-disable-next-line no-await-in-loop
    data.push({ path: j.path, text: j.text, current: await shaOnGitHub(token, j.path, head), base: j.base.sha });
  }

  let tree = null;
  const readTree = async () => {
    showProgress(4);
    const listing = await api(token, `${REPO}/git/trees/${baseTree}?recursive=1`);
    return { entries: Array.isArray(listing.tree) ? listing.tree : [], truncated: Boolean(listing.truncated) };
  };
  // GitHub already has exactly these texts (and these files), for example a Try again after an unsure
  // result: done, no writes.
  const shas = [];
  for (const d of data) shas.push(await gitBlobSha(d.text)); // eslint-disable-line no-await-in-loop
  const done = {
    commitSha: head, text, pairs, site, withEvents, removed: 0, truncated: false,
    json: data.map((d) => ({ path: d.path, sha: d.current, text: d.text })),
  };
  if (data.every((d, i) => d.current && d.current === shas[i])) {
    if (!files.length && data.length) return done;
    tree = await readTree();
    if (!tree.truncated && await allOnGitHub(tree.entries, files)) return done;
  }
  for (const d of data) {
    // events.json: a base is needed (as in TASK-12). site.json may be new on both sides (null === null).
    if (d.events ? (!d.base || d.current !== d.base) : d.current !== d.base) throw staleError();
  }
  if (!tree) tree = await readTree();

  // TASK-16: no photo link in the JSON files of this commit may point at a file that is neither on GitHub
  // nor in this publish (and every link must be in plain form). Checked before the removal list, the dialog
  // and any write. This also makes every non-plain path stop here, so the removal rules below only ever see
  // plain paths.
  const newPaths = new Set(files.map((f) => f.path));
  const jsonText = (path) => (data.find((d) => d.path === path) || {}).text ?? null;
  const problems = [
    ...(withEvents ? brokenPhotoLinks(text, tree.entries, tree.truncated, newPaths) : []),
    ...brokenSitePhotoLinks(jsonText(SITE_PATH), jsonText(REELS_PATH), tree.entries, tree.truncated, newPaths),
    ...brokenMomentPhotoLinks(jsonText(MOMENTS_PATH), tree.entries, tree.truncated, newPaths),
  ];
  if (problems.length) throw linkError(problems);

  // Old photo files no event uses any more (never when the listing is incomplete). Only when events.json
  // is part of this publish: the removal rules of TASK-13 need the events.json being committed.
  // TASK-22: a file used by an event OR a moment (as it will be live after this commit) is never removed.
  const withMoments = jsonText(MOMENTS_PATH) !== null;
  const used = usedPathsIn(text);
  for (const p of momentPathsIn(withMoments ? jsonText(MOMENTS_PATH) : momentsBase().text)) used.add(p);
  let removals = !withEvents || tree.truncated ? [] : removalCandidates(tree.entries, used, newPaths);
  // Unused moment photos directly under media/moments/, only when data/moments.json is part of this commit.
  if (withMoments && !tree.truncated) {
    removals = [...removals, ...tree.entries
      .filter((e) => e && e.type === 'blob' && isRemovableMoment(e.path, used, newPaths)).map((e) => e.path).sort()];
  }
  if (typeof publishHooks.editRemovals === 'function') removals = publishHooks.editRemovals(removals.slice());
  const guard = () => {
    for (const path of removals) {
      const ok = isRemovable(path, used, newPaths) || (withMoments && isRemovableMoment(path, used, newPaths));
      if (!ok) throw new PublishError('guard', PUBLISH_MESSAGES.guard(path));
    }
  };
  guard(); // before the dialog and before any write
  if (removals.length && !(await confirmRemovals(removals))) {
    throw new PublishError('cancelled', PUBLISH_MESSAGES.cancelled);
  }

  // Blobs, one at a time: the photos, then the JSON files.
  const total = files.length + data.length;
  const entries = [];
  for (let i = 0; i < files.length; i += 1) {
    showProgress(UPLOAD_STEP, { n: i + 1, total });
    let content;
    try {
      // eslint-disable-next-line no-await-in-loop
      content = await blobToBase64(files[i].blob);
    } catch {
      throw new PublishError('other', PUBLISH_MESSAGES.other('file read'));
    }
    // eslint-disable-next-line no-await-in-loop
    const blob = await api(token, `${REPO}/git/blobs`, { method: 'POST', body: { content, encoding: 'base64' } });
    entries.push({ path: files[i].path, mode: '100644', type: 'blob', sha: blob.sha });
  }
  const jsonEntries = [];
  for (let i = 0; i < data.length; i += 1) {
    showProgress(UPLOAD_STEP, { n: files.length + i + 1, total });
    // eslint-disable-next-line no-await-in-loop
    const blob = await api(token, `${REPO}/git/blobs`, { method: 'POST', body: { content: data[i].text, encoding: 'utf-8' } });
    data[i].made = blob.sha;
    jsonEntries.push({ path: data[i].path, mode: '100644', type: 'blob', sha: blob.sha });
  }

  guard(); // again, right before the tree is built
  showProgress(6);
  const newTree = await api(token, `${REPO}/git/trees`, {
    method: 'POST',
    body: {
      base_tree: baseTree,
      tree: [
        ...jsonEntries,
        ...entries,
        ...removals.map((path) => ({ path, mode: '100644', type: 'blob', sha: null })),
      ],
    },
  });

  showProgress(7);
  const k = removals.length;
  const photos = pairs.length + site.length;
  let message = `Update site photos from /admin/ (${photos} photos)`;
  if (withEvents) message = `Update events from /admin/ (${eventCount()} events, ${photos} photos${k ? `, ${k} old files removed` : ''})`;
  else if (withMoments) message = `Update moments from /admin/ (${momentCount(jsonText(MOMENTS_PATH))} moments, ${photos} photos${k ? `, ${k} old files removed` : ''})`;
  const made = await api(token, `${REPO}/git/commits`, {
    method: 'POST',
    body: { message, tree: newTree.sha, parents: [head] },
  });

  showProgress(8);
  try {
    await api(token, `${REPO}/git/refs/heads/${branch}`, { method: 'PATCH', body: { sha: made.sha, force: false }, refUpdate: true });
  } catch (error) {
    // A dropped connection or a server error here is ambiguous: the ref may have moved. Ask GitHub.
    if (error.kind !== 'network' && error.kind !== 'other') throw error;
    let now;
    try {
      now = await api(token, `${REPO}/git/ref/heads/${branch}`);
    } catch {
      throw new PublishError('unsure', PUBLISH_MESSAGES.unsure, PUBLISH_MESSAGES.unsureNext);
    }
    // Not visible yet does not prove it failed: the PATCH may still be applied, or the read may lag.
    if (now.object.sha !== made.sha) throw new PublishError('unsure', PUBLISH_MESSAGES.unsure, PUBLISH_MESSAGES.unsureNext);
  }
  return {
    commitSha: made.sha, text, pairs, site, withEvents, removed: k, truncated: tree.truncated,
    json: data.map((d) => ({ path: d.path, sha: d.made, text: d.text })),
  };
}

function hasSomethingToPublish() {
  return draftDiffersFromBase() || photoCount(publishSet()) > 0 || siteChanged() || reelsChanged() || momentsChanged();
}

export async function publish() {
  // `busy` is set before the first await, so a second click (or Try again) cannot start a second publish.
  if (busy || isDraftLoading()) return;
  const token = readToken();
  if (!token || !hasSomethingToPublish()) return;
  setBusy(true);
  showNote('');
  showResult('');
  try {
    const prepared = await prepare(); // no request is made before this passes
    const result = await run(token, prepared);
    for (const j of result.json) {
      if (j.path === EVENTS_PATH) setBase(j.sha, j.text);
      else if (j.path === MOMENTS_PATH) setMomentsBase(j.sha, j.text);
      else setSiteBase(j.path, j.sha, j.text);
    }
    clearPendingPairs(result.pairs); // published: no more "unsaved files" warning for them
    clearPendingSiteFiles(result.site);
    showResult('ok', { sha: result.commitSha, removed: result.removed, truncated: result.truncated });
  } catch (error) {
    if (error instanceof PublishError && error.kind === 'stale') showResult('stale');
    else if (error instanceof PublishError && error.kind === 'cancelled') showResult('cancel');
    else if (error instanceof PublishError) showResult('err', { message: error.message, next: error.next });
    else {
      console.error(error);
      showResult('err', { message: PUBLISH_MESSAGES.other('error'), next: PUBLISH_MESSAGES.nothingChanged });
    }
  } finally {
    showProgress(0);
    setBusy(false);
  }
}

async function init() {
  if (!$('publish-panel')) return;
  await managerReady;
  await siteDraftReady;
  await momentsDraftReady;
  $('publish-btn').addEventListener('click', publish);
  $('pub-retry').addEventListener('click', publish);
  $('pub-export').addEventListener('click', exportEvents);
  $('pub-reload').addEventListener('click', () => window.location.reload());
  onDraftChange(render);
  onPendingChange(render);
  onSiteDraftChange(render);
  onMomentsChange(render);
  window.addEventListener(TOKEN_EVENT, render);
  window.addEventListener('storage', (e) => {
    if (e.key === null || e.key === TOKEN_KEY) render();
  });
  render();
  document.documentElement.dataset.publishReady = 'true';
}

init();
