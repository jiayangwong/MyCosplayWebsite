// Publish to GitHub: commits the draft's data/events.json, the pending photo pairs (TASK-13) and the removal
// of old, unused photo files as ONE commit through the Git Data API.
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
  lockFileActions, exportEvents, isDraftLoading, draftEventIds,
} from './manager.js';
import { pendingPairs, onPendingChange, clearPendingPairs, removePendingItem, isPipelineFile } from './pending.js';
import { MAX_FILE_BYTES, formatBytes } from './watermark.js';

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
 * TASK-15 registers the watermark marker check here (readWatermarkMarker), see addFileCheck.
 */
const fileChecks = [];
export function addFileCheck(check) {
  fileChecks.push(check);
}

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

/** Every `photo` / `photoFull` used by an event in an events.json text. */
export function usedPathsIn(text) {
  const used = new Set();
  let events = [];
  try {
    const data = JSON.parse(text);
    events = Array.isArray(data.events) ? data.events : [];
  } catch {
    return used;
  }
  for (const event of events) {
    if (event && typeof event.photo === 'string') used.add(event.photo);
    if (event && typeof event.photoFull === 'string') used.add(event.photoFull);
  }
  return used;
}

/**
 * True only for a path Publish may remove: under media/events/, ending in ".webp" (exact, lowercase),
 * no empty, "." or ".." segment, not used by any event in the committed events.json, and not a new file
 * of this publish. Exact string match, so a file used by any event is never removed.
 */
export function isRemovable(path, used, newPaths) {
  if (typeof path !== 'string' || !path.startsWith(MEDIA_PREFIX) || !path.endsWith('.webp')) return false;
  if (path === EVENTS_PATH) return false;
  const rest = path.slice(MEDIA_PREFIX.length).split('/');
  if (rest.length < 1 || rest.some((seg) => seg === '' || seg === '.' || seg === '..')) return false;
  if (rest[rest.length - 1] === '.webp') return false;
  return !used.has(path) && !newPaths.has(path);
}

/** Paths in a recursive tree listing that no event uses any more (see isRemovable). */
export function removalCandidates(treeEntries, used, newPaths) {
  return treeEntries
    .filter((e) => e && e.type === 'blob' && isRemovable(e.path, used, newPaths))
    .map((e) => e.path)
    .sort();
}

const PAIR_RE = /^media\/events\/([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9-]*)\.webp$/;

/** '' if a pending pair's paths fit `media/events/<event-id>/<name>.webp` + `<name>-full.webp`, else the bad path. */
export function pairPathProblem(pair, eventIds) {
  const m = PAIR_RE.exec(pair.photo || '');
  if (!m || m[1] !== pair.eventId || !eventIds.has(m[1])) return pair.photo || '(empty path)';
  if (pair.photoFull !== `${MEDIA_PREFIX}${m[1]}/${m[2]}-full.webp`) return pair.photoFull || '(empty path)';
  return '';
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
  return { pairs, files };
}

/** Limit problems that keep the button disabled: { message, next } or null. */
function limitProblem({ pairs, files }) {
  if (pairs.length > MAX_PHOTOS) return { message: PUBLISH_MESSAGES.tooMany, next: PUBLISH_MESSAGES.tooManyNext };
  const big = files.find((f) => f.blob && f.blob.size > MAX_FILE_BYTES);
  if (big) return { message: PUBLISH_MESSAGES.tooBig(big.path), next: PUBLISH_MESSAGES.tooBigNext };
  return null;
}

/** Old photos that this draft no longer uses (a preview; the real list comes from the repo tree at publish). */
function expectedRemovals(text, newPaths) {
  const used = usedPathsIn(text);
  return [...usedPathsIn(baseEvents().text)].filter((p) => isRemovable(p, used, newPaths)).sort();
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
  return { text, ...set };
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
function showProgress(step, sub = null) {
  const box = $('pub-progress');
  box.hidden = step === 0;
  if (!step) return;
  const part = sub ? (sub.n - 1) / sub.total : 0;
  const pct = Math.round(((step - 1 + part) / STEPS) * 100);
  const what = sub ? `Uploading file ${sub.n} of ${sub.total}` : STEP_TEXT[step - 1];
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
    remove.addEventListener('click', () => removePendingItem(pair.item));
    li.append(paths, remove);
    list.append(li);
  }
  if (changed) list.append(pendRow('~', 'changed', `${EVENTS_PATH} changed`));
  for (const path of removals) list.append(pendRow('-', 'removed', `${path} (no event uses it)`));
  if (!list.children.length) list.append(make('li', 'pend-empty', 'No pending changes.'));

  const total = $('pub-total');
  if (set.pairs.length) {
    const bytes = set.files.reduce((sum, f) => sum + (f.blob ? f.blob.size : 0), 0);
    const n = set.pairs.length;
    const k = set.files.length;
    total.textContent = `Adds ${n} ${n === 1 ? 'photo' : 'photos'}, ${k} ${k === 1 ? 'file' : 'files'}, ${formatBytes(bytes)}`;
    total.hidden = false;
  } else {
    total.textContent = '';
    total.hidden = true;
  }

  const token = readToken() !== '';
  const something = changed || set.pairs.length > 0;
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
    const finish = (ok) => {
      yes.removeEventListener('click', onYes);
      no.removeEventListener('click', onNo);
      dialog.removeEventListener('cancel', onCancel);
      if (dialog.open) dialog.close();
      resolve(ok);
    };
    const onYes = () => finish(true);
    const onNo = () => finish(false);
    const onCancel = (e) => { e.preventDefault(); finish(false); }; // Esc = Cancel
    yes.addEventListener('click', onYes);
    no.addEventListener('click', onNo);
    dialog.addEventListener('cancel', onCancel);
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
async function run(token, { text, files, pairs }) {
  const base = baseEvents();
  const branch = encodeURIComponent(GITHUB.branch);

  showProgress(1);
  const ref = await api(token, `${REPO}/git/ref/heads/${branch}`);
  const head = ref.object.sha;

  showProgress(2);
  const commit = await api(token, `${REPO}/git/commits/${head}`);
  const baseTree = commit.tree.sha;

  showProgress(3);
  let current;
  try {
    current = await api(token, `${REPO}/contents/${EVENTS_PATH}?ref=${head}`);
  } catch (error) {
    // No events.json on the branch any more: someone else changed the repo.
    if (error.status === 404) throw staleError(404);
    throw error;
  }

  let tree = null;
  const readTree = async () => {
    showProgress(4);
    const listing = await api(token, `${REPO}/git/trees/${baseTree}?recursive=1`);
    return { entries: Array.isArray(listing.tree) ? listing.tree : [], truncated: Boolean(listing.truncated) };
  };
  // GitHub already has exactly this text (and these photos), for example a Try again after an unsure
  // result: done, no writes.
  const done = { commitSha: head, blobSha: current.sha, text, pairs, removed: 0, truncated: false };
  if (current.sha && current.sha === await gitBlobSha(text)) {
    if (!files.length) return done;
    tree = await readTree();
    if (!tree.truncated && await allOnGitHub(tree.entries, files)) return done;
  }
  if (!base.sha || current.sha !== base.sha) {
    throw staleError();
  }
  if (!tree) tree = await readTree();

  // Old photo files no event uses any more (never when the listing is incomplete).
  const used = usedPathsIn(text);
  const newPaths = new Set(files.map((f) => f.path));
  let removals = tree.truncated ? [] : removalCandidates(tree.entries, used, newPaths);
  if (typeof publishHooks.editRemovals === 'function') removals = publishHooks.editRemovals(removals.slice());
  const guard = () => {
    for (const path of removals) {
      if (!isRemovable(path, used, newPaths)) throw new PublishError('guard', PUBLISH_MESSAGES.guard(path));
    }
  };
  guard(); // before the dialog and before any write
  if (removals.length && !(await confirmRemovals(removals))) {
    throw new PublishError('cancelled', PUBLISH_MESSAGES.cancelled);
  }

  // Blobs, one at a time: the photos, then events.json.
  const total = files.length + 1;
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
  showProgress(UPLOAD_STEP, { n: total, total });
  const eventsBlob = await api(token, `${REPO}/git/blobs`, { method: 'POST', body: { content: text, encoding: 'utf-8' } });

  guard(); // again, right before the tree is built
  showProgress(6);
  const newTree = await api(token, `${REPO}/git/trees`, {
    method: 'POST',
    body: {
      base_tree: baseTree,
      tree: [
        { path: EVENTS_PATH, mode: '100644', type: 'blob', sha: eventsBlob.sha },
        ...entries,
        ...removals.map((path) => ({ path, mode: '100644', type: 'blob', sha: null })),
      ],
    },
  });

  showProgress(7);
  const k = removals.length;
  const message = `Update events from /admin/ (${eventCount()} events, ${pairs.length} photos${k ? `, ${k} old files removed` : ''})`;
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
  return { commitSha: made.sha, blobSha: eventsBlob.sha, text, pairs, removed: k, truncated: tree.truncated };
}

function hasSomethingToPublish() {
  return draftDiffersFromBase() || publishSet().pairs.length > 0;
}

export async function publish() {
  // `busy` is set before the first await, so a second click (or Try again) cannot start a second publish.
  if (busy || isDraftLoading()) return;
  const token = readToken();
  if (!token || !hasSomethingToPublish()) return;
  setBusy(true);
  showResult('');
  try {
    const prepared = await prepare(); // no request is made before this passes
    const result = await run(token, prepared);
    setBase(result.blobSha, result.text);
    clearPendingPairs(result.pairs); // published: no more "unsaved files" warning for them
    showResult('ok', { sha: result.commitSha, removed: result.removed, truncated: result.truncated });
  } catch (error) {
    if (error instanceof PublishError && error.kind === 'stale') showResult('stale');
    else if (error instanceof PublishError && error.kind === 'cancelled') showResult('cancel');
    else if (error instanceof PublishError) showResult('err', { message: error.message, next: error.next });
    else showResult('err', { message: PUBLISH_MESSAGES.other('error'), next: PUBLISH_MESSAGES.nothingChanged });
  } finally {
    showProgress(0);
    setBusy(false);
  }
}

async function init() {
  if (!$('publish-panel')) return;
  await managerReady;
  $('publish-btn').addEventListener('click', publish);
  $('pub-retry').addEventListener('click', publish);
  $('pub-export').addEventListener('click', exportEvents);
  $('pub-reload').addEventListener('click', () => window.location.reload());
  onDraftChange(render);
  onPendingChange(render);
  window.addEventListener(TOKEN_EVENT, render);
  window.addEventListener('storage', (e) => {
    if (e.key === null || e.key === TOKEN_KEY) render();
  });
  render();
  document.documentElement.dataset.publishReady = 'true';
}

init();
