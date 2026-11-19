// GitHub token: kept only in this browser's localStorage, sent only as an Authorization header
// to https://api.github.com. Never logged, never put in a URL, the draft or an exported file.
import { GITHUB, GITHUB_API_VERSION } from './github-config.js';

export const TOKEN_KEY = 'puzzkezz.github.token';
export const TOKEN_EVENT = 'github-token-change';
const TEST_TIMEOUT_MS = 20000;

const REPO = `${GITHUB.owner}/${GITHUB.repo}`;

export const MESSAGES = Object.freeze({
  empty: 'Paste a token first.',
  classic: 'This is a classic token that can reach all your repos. Please make a fine-grained token for this repo only.',
  badChars: "This doesn't look like a GitHub token. Copy it again from GitHub (letters, numbers and _ only).",
  storage: 'This browser could not save the token (storage is full or blocked).',
  ok: `Connected to ${REPO} (${GITHUB.branch}). Write access is checked when you publish.`,
  unauthorized: 'This token is wrong or has expired.',
  noRepo: `This token can't see the repo. Check that it is for ${REPO}.`,
  network: "Can't reach GitHub. Check your internet connection.",
  other: (status) => `GitHub said no (${status}). Try again in a few minutes.`,
});

export function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function hasToken() {
  return readToken() !== '';
}

/** Last 4 characters, the only part of the token the page ever shows. */
export function tokenTail(token) {
  return token.slice(-4);
}

/** Returns { token } for a usable token, or { error } with the message to show. */
export function checkToken(raw) {
  const token = String(raw ?? '').trim();
  if (!token) return { error: MESSAGES.empty };
  if (token.startsWith('ghp_')) return { error: MESSAGES.classic };
  if (!/^[A-Za-z0-9_]+$/.test(token)) return { error: MESSAGES.badChars };
  return { token };
}

function announce() {
  window.dispatchEvent(new CustomEvent(TOKEN_EVENT, { detail: { hasToken: hasToken() } }));
}

/** Saves a valid token. Returns { tail } or { error }. A refused token is never stored. */
export function saveToken(raw) {
  const result = checkToken(raw);
  if (result.error) return result;
  try {
    localStorage.setItem(TOKEN_KEY, result.token);
  } catch {
    return { error: MESSAGES.storage };
  }
  announce();
  return { tail: tokenTail(result.token) };
}

export function forgetToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nothing stored, or storage blocked: either way there is no token to use.
  }
  announce();
}

export function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
  };
}

/**
 * The only place that sends the token. `path` is an API path such as `/repos/o/r`; the host is
 * always GITHUB.apiBase, so the token cannot be sent anywhere else.
 */
export function githubFetch(path, { token, method = 'GET', body, signal } = {}) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) {
    throw new Error('githubFetch needs an API path that starts with "/"');
  }
  const headers = githubHeaders(token);
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(`${GITHUB.apiBase}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });
}

/** GET /repos/{owner}/{repo}. Returns { ok: true|false, message }. */
export async function testConnection(token = readToken()) {
  if (!token) return { ok: false, message: MESSAGES.empty };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);
  let response;
  try {
    response = await githubFetch(`/repos/${GITHUB.owner}/${GITHUB.repo}`, { token, signal: controller.signal });
  } catch {
    return { ok: false, message: MESSAGES.network };
  } finally {
    clearTimeout(timer);
  }
  if (response.ok) return { ok: true, message: MESSAGES.ok };
  if (response.status === 401) return { ok: false, message: MESSAGES.unauthorized };
  if (response.status === 403 || response.status === 404) return { ok: false, message: MESSAGES.noRepo };
  return { ok: false, message: MESSAGES.other(response.status) };
}
