// GitHub panel in /admin/: save, test and forget the token. States: none / saved / testing / ok / err.
// All text is set with textContent. The token itself is never shown, only its last 4 characters.
import { readToken, saveToken, forgetToken, tokenTail, testConnection, TOKEN_EVENT, TOKEN_KEY } from './github-token.js';

const $ = (id) => document.getElementById(id);
const ICONS = { none: '–', saved: '–', testing: '...', ok: '✓', err: '!' };
/** Sent by publish.js when a publish starts or ends (detail.busy). Forget token is locked meanwhile. */
export const PUBLISH_BUSY_EVENT = 'publish-busy-change';
let testing = false;
let publishing = false;

/** Shows one status box. `kind` is none | saved | testing | ok | err. */
function showStatus(kind, text) {
  const isErr = kind === 'err';
  const box = isErr ? $('gh-alert') : $('gh-status');
  const other = isErr ? $('gh-status') : $('gh-alert');
  other.hidden = true;
  box.hidden = false;
  box.dataset.state = kind;
  box.querySelector('.msg-icon').textContent = ICONS[kind];
  box.querySelector('.msg-text').textContent = text;
  const bar = box.querySelector('.ibar');
  if (bar) bar.hidden = kind !== 'testing';
}

function showTokenError(text) {
  const err = $('gh-token-error');
  err.textContent = text;
  err.hidden = !text;
  $('gh-token').setAttribute('aria-invalid', text ? 'true' : 'false');
}

function syncButtons() {
  const saved = readToken() !== '';
  $('gh-save').disabled = testing;
  $('gh-test').disabled = !saved || testing;
  $('gh-forget').disabled = !saved || testing || publishing;
  const tail = $('gh-saved');
  tail.hidden = !saved;
  tail.textContent = saved ? `Token saved, ends in ...${tokenTail(readToken())}` : '';
}

function idleState() {
  if (readToken()) showStatus('saved', 'Token saved. Press Test connection to check it.');
  else showStatus('none', 'No token saved. Paste one above.');
}

function onSave() {
  const input = $('gh-token');
  const result = saveToken(input.value);
  if (result.error) {
    showTokenError(result.error);
    input.focus();
    return;
  }
  input.value = '';
  showTokenError('');
  syncButtons();
  idleState();
}

async function onTest() {
  if (testing || !readToken()) return;
  testing = true;
  syncButtons();
  showStatus('testing', 'Testing...');
  const result = await testConnection();
  testing = false;
  syncButtons();
  showStatus(result.ok ? 'ok' : 'err', result.message);
}

function onForget() {
  if (!readToken() || publishing) return;
  if (!window.confirm('Forget the GitHub token on this browser? You will need to paste it again to publish.')) return;
  forgetToken();
  syncButtons();
  idleState();
}

export function initGithubPanel() {
  if (!$('gh-panel')) return;
  $('gh-save').addEventListener('click', onSave);
  $('gh-token').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSave();
    }
  });
  $('gh-test').addEventListener('click', onTest);
  $('gh-forget').addEventListener('click', onForget);
  window.addEventListener(TOKEN_EVENT, syncButtons);
  window.addEventListener(PUBLISH_BUSY_EVENT, (e) => {
    publishing = Boolean(e.detail && e.detail.busy);
    syncButtons();
  });
  // Another tab saved or forgot the token.
  window.addEventListener('storage', (e) => {
    if (e.key !== null && e.key !== TOKEN_KEY) return;
    syncButtons();
    if (!testing) idleState();
  });
  syncButtons();
  idleState();
  document.documentElement.dataset.githubReady = 'true';
}

initGithubPanel();
