// Publish to GitHub: commits the draft's data/events.json as ONE commit through the Git Data API.
// Order: read ref -> read commit -> read contents (stale check) -> blob -> tree -> commit -> move ref (force: false).
// The ref is the only write that changes the live site, and it is always the last call, so a failure at any
// earlier step leaves GitHub as it was. The token is only ever sent by githubFetch (github-token.js).
import { GITHUB } from './github-config.js';
import { githubFetch, readToken, MESSAGES as TOKEN_MESSAGES, TOKEN_EVENT, TOKEN_KEY } from './github-token.js';
import { PUBLISH_BUSY_EVENT } from './github-panel.js';
import {
  managerReady, draftText, eventCount, baseEvents, draftDiffersFromBase, setBase, onDraftChange,
  lockFileActions, exportEvents,
} from './manager.js';

export const EVENTS_PATH = 'data/events.json';
const REPO = `/repos/${GITHUB.owner}/${GITHUB.repo}`;
const STEPS = 7;
const REQUEST_TIMEOUT_MS = 30000;

export const PUBLISH_MESSAGES = Object.freeze({
  noToken: 'Add a GitHub token to publish',
  nothing: 'The draft is the same as the published events.json.',
  ready: `Makes one commit on ${GITHUB.owner}/${GITHUB.repo} (${GITHUB.branch}).`,
  success: 'Published. The site updates in about 1-2 minutes.',
  stale: 'The site changed since you started editing (maybe from another device). Export a backup, then reload this page.',
  staleNext: 'Nothing was changed on GitHub.',
  nothingChanged: 'Nothing was changed on GitHub.',
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
});

const STEP_TEXT = [
  'Reading the branch',
  'Reading the latest commit',
  'Checking events.json on GitHub',
  'Uploading events.json',
  'Building the file tree',
  'Making the commit',
  'Updating the site',
];

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
  if (refUpdate && (status === 409 || status === 422)) return new PublishError('stale', PUBLISH_MESSAGES.stale, PUBLISH_MESSAGES.staleNext, status);
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

/* ---------- UI ---------- */
function setBusy(value) {
  busy = value;
  lockFileActions(value);
  window.dispatchEvent(new CustomEvent(PUBLISH_BUSY_EVENT, { detail: { busy: value } }));
  render();
}

function showProgress(step) {
  const box = $('pub-progress');
  box.hidden = step === 0;
  if (!step) return;
  const pct = Math.round(((step - 1) / STEPS) * 100);
  $('pub-step').textContent = `Step ${step} of ${STEPS}: ${STEP_TEXT[step - 1]}`;
  const bar = $('pub-bar');
  bar.setAttribute('aria-valuenow', String(pct));
  bar.firstElementChild.style.width = `${pct}%`;
}

/** Shows one result box: '' (none) | 'ok' | 'err' | 'stale'. */
function showResult(kind, detail = {}) {
  $('pub-ok').hidden = kind !== 'ok';
  $('pub-err').hidden = kind !== 'err';
  $('pub-stale').hidden = kind !== 'stale';
  if (kind === 'ok') {
    const link = $('pub-commit');
    link.href = `https://github.com/${GITHUB.owner}/${GITHUB.repo}/commit/${detail.sha}`;
    link.textContent = `View commit ${detail.sha.slice(0, 7)}`;
  }
  if (kind === 'err') {
    $('pub-err-text').textContent = detail.message;
    $('pub-err-next').textContent = detail.next;
  }
}

function render() {
  const btn = $('publish-btn');
  const hint = $('publish-hint');
  const changed = draftDiffersFromBase();
  const list = $('pub-pending');
  list.replaceChildren();
  if (changed) {
    const li = document.createElement('li');
    const mark = document.createElement('b');
    mark.textContent = '~';
    mark.setAttribute('aria-label', 'changed');
    li.append(mark, ` ${EVENTS_PATH} changed`);
    list.append(li);
  } else {
    const li = document.createElement('li');
    li.className = 'pend-empty';
    li.textContent = 'No pending changes.';
    list.append(li);
  }

  const token = readToken() !== '';
  if (busy) {
    btn.disabled = true;
    btn.textContent = 'Publishing...';
    hint.textContent = 'Publishing... Keep this page open.';
  } else if (!token) {
    btn.disabled = true;
    btn.textContent = 'Publish to GitHub';
    hint.textContent = PUBLISH_MESSAGES.noToken;
  } else if (!changed) {
    btn.disabled = true;
    btn.textContent = 'Nothing to publish';
    hint.textContent = PUBLISH_MESSAGES.nothing;
  } else {
    btn.disabled = false;
    btn.textContent = 'Publish to GitHub';
    hint.textContent = PUBLISH_MESSAGES.ready;
  }
}

/* ---------- Publish ---------- */
async function run(token) {
  const text = draftText();
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
    if (error.status === 404) throw new PublishError('stale', PUBLISH_MESSAGES.stale, PUBLISH_MESSAGES.staleNext);
    throw error;
  }
  if (!base.sha || current.sha !== base.sha) {
    throw new PublishError('stale', PUBLISH_MESSAGES.stale, PUBLISH_MESSAGES.staleNext);
  }

  showProgress(4);
  const blob = await api(token, `${REPO}/git/blobs`, { method: 'POST', body: { content: text, encoding: 'utf-8' } });

  showProgress(5);
  const tree = await api(token, `${REPO}/git/trees`, {
    method: 'POST',
    body: { base_tree: baseTree, tree: [{ path: EVENTS_PATH, mode: '100644', type: 'blob', sha: blob.sha }] },
  });

  showProgress(6);
  const photos = 0; // photo pairs join the same commit in TASK-13
  const made = await api(token, `${REPO}/git/commits`, {
    method: 'POST',
    body: { message: `Update events from /admin/ (${eventCount()} events, ${photos} photos)`, tree: tree.sha, parents: [head] },
  });

  showProgress(7);
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
    if (now.object.sha !== made.sha) throw error;
  }
  return { commitSha: made.sha, blobSha: blob.sha, text };
}

export async function publish() {
  // `busy` is set before the first await, so a second click (or Try again) cannot start a second publish.
  if (busy) return;
  const token = readToken();
  if (!token || !draftDiffersFromBase()) return;
  setBusy(true);
  showResult('');
  try {
    const result = await run(token);
    setBase(result.blobSha, result.text);
    showResult('ok', { sha: result.commitSha });
  } catch (error) {
    if (error instanceof PublishError && error.kind === 'stale') showResult('stale');
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
  window.addEventListener(TOKEN_EVENT, render);
  window.addEventListener('storage', (e) => {
    if (e.key === null || e.key === TOKEN_KEY) render();
  });
  render();
  document.documentElement.dataset.publishReady = 'true';
}

init();
