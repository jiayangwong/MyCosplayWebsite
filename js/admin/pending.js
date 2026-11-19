// In-memory list of photo pairs that were attached to an event but are not published yet.
// The uploader (TASK-7) adds pairs here; Publish (TASK-13) reads them. Nothing is stored on disk:
// the files only live in this tab, so the page warns before it is closed while a pair is unsaved.

const pairs = []; // { eventId, photo, photoFull, item } - item holds the current blobs (re-rendered on changes)

/** Adds a pair. An event shows one photo, so a newer attach replaces an older pending pair for the same event. */
export function addPendingPair(pair) {
  const old = pairs.findIndex((p) => p.eventId === pair.eventId);
  if (old !== -1) pairs.splice(old, 1);
  pairs.push(pair);
}

export function removePendingItem(item) {
  for (let i = pairs.length - 1; i >= 0; i -= 1) if (pairs[i].item === item) pairs.splice(i, 1);
}

export function pendingPairs() {
  return pairs.slice();
}

/** Every repo path that is pending (display copy and master). */
export function pendingPaths() {
  return new Set(pairs.flatMap((p) => [p.photo, p.photoFull]));
}

/** True while a pending pair has a file that was neither published nor downloaded. */
export function hasUnsavedFiles() {
  return pairs.some((p) => !(p.item.downloaded.display && p.item.downloaded.master));
}

window.addEventListener('beforeunload', (e) => {
  if (!hasUnsavedFiles()) return;
  e.preventDefault();
  e.returnValue = ''; // older browsers need a value to show the "leave site?" prompt
});
