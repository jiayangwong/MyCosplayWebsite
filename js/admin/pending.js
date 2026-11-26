// In-memory list of photo pairs that were attached to an event but are not published yet.
// The uploader (TASK-7) adds pairs here; Publish (TASK-13) reads them. Nothing is stored on disk:
// the files only live in this tab, so the page warns before it is closed while a pair is unsaved.

const pairs = []; // { eventId, photo, photoFull, item } - item holds the current blobs (re-rendered on changes)
const listeners = new Set();

/**
 * Files made by the TASK-7 watermark pipeline. watermark.js registers every blob it encodes, and Publish
 * refuses any file that is not in this set, so nothing that skipped the watermark can be uploaded.
 * (TASK-15 adds a second, content-based check on top: the watermark marker, see publish.js addFileCheck.)
 */
const pipelineFiles = new WeakSet();

export function markPipelineFile(blob) {
  if (blob) pipelineFiles.add(blob);
  return blob;
}

export function isPipelineFile(blob) {
  return Boolean(blob) && pipelineFiles.has(blob);
}

function changed() {
  listeners.forEach((fn) => fn());
}

/**
 * Set by publish.js (TASK-23): `undo(item)` = the "Remove from publish" action for a card's pair, and
 * `describe(item)` = "<short> <year>" of the event the pair is attached to. The uploader's X button uses them,
 * so the revert logic exists only once.
 */
export const pendingHooks = { undo: null, describe: null };

/** True while a card's pair is waiting in the Publish list. */
export function isPendingItem(item) {
  return pairs.some((p) => p.item === item);
}

/** Calls `fn` whenever the pending list changes (add, remove, clear). */
export function onPendingChange(fn) {
  listeners.add(fn);
}

/** Adds a pair. TASK-27: one pending pair per slot path (an event can hold up to 3 photos), so attaching a second
 *  photo keeps the first pair; only a pair with the same display path is replaced. */
export function addPendingPair(pair) {
  const old = pairs.findIndex((p) => p.photo === pair.photo);
  if (old !== -1) pairs.splice(old, 1);
  pairs.push(pair);
  changed();
}

export function removePendingItem(item) {
  let removed = false;
  for (let i = pairs.length - 1; i >= 0; i -= 1) {
    if (pairs[i].item === item) {
      pairs.splice(i, 1);
      removed = true;
    }
  }
  if (removed) changed();
}

/** Removes exactly these pair objects (after a successful publish). A pair re-attached meanwhile stays. */
export function clearPendingPairs(done) {
  const gone = new Set(done);
  let removed = false;
  for (let i = pairs.length - 1; i >= 0; i -= 1) {
    if (gone.has(pairs[i])) {
      pairs.splice(i, 1);
      removed = true;
    }
  }
  if (removed) changed();
}

export function pendingPairs() {
  return pairs.slice();
}

/** Every repo path that is pending (display copy and master). */
export function pendingPaths() {
  return new Set(pairs.flatMap((p) => [p.photo, p.photoFull]));
}

/* ---------- Site photos (TASK-14): one file per target ---------- */

// { target, label, path, out } - out = { blob, width, height, downloaded } from the Site photos panel.
const siteFiles = [];

/** Adds a site photo file. One file per path: a newer "Use for ..." replaces the older pending file. */
export function addPendingSiteFile(entry) {
  const old = siteFiles.findIndex((f) => f.path === entry.path);
  if (old !== -1) siteFiles.splice(old, 1);
  siteFiles.push(entry);
  changed();
}

export function removePendingSiteFile(path) {
  const i = siteFiles.findIndex((f) => f.path === path);
  if (i === -1) return;
  siteFiles.splice(i, 1);
  changed();
}

/** Removes exactly these entries (after a successful publish). A file used again meanwhile stays. */
export function clearPendingSiteFiles(done) {
  const gone = new Set(done);
  const before = siteFiles.length;
  for (let i = siteFiles.length - 1; i >= 0; i -= 1) if (gone.has(siteFiles[i])) siteFiles.splice(i, 1);
  if (siteFiles.length !== before) changed();
}

export function pendingSiteFiles() {
  return siteFiles.slice();
}

/** True while a pending pair or site photo has a file that was neither published nor downloaded. */
export function hasUnsavedFiles() {
  return pairs.some((p) => !(p.item.downloaded.display && p.item.downloaded.master))
    || siteFiles.some((f) => !f.out.downloaded);
}

window.addEventListener('beforeunload', (e) => {
  if (!hasUnsavedFiles()) return;
  e.preventDefault();
  e.returnValue = ''; // older browsers need a value to show the "leave site?" prompt
});
