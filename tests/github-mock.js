// Shared fake GitHub for tests (TASK-11, 12, 13).
// - Every request to api.github.com is intercepted with page.route. Nothing reaches the real GitHub.
// - A request the mock does not handle gets a 501 and is recorded; the `github` fixture then fails the test.
// - GET git/trees/{sha} lists the top level; with ?recursive=1 every path (set treeTruncated for GitHub's
//   truncated: true answer). POST git/trees applies `sha: null` entries as deletions.
// - Only the obviously fake FAKE_TOKEN is accepted. A different Authorization header gets 401, like GitHub.
// - The token-leak watcher records every request and console message and fails the test if the token
//   shows up anywhere except the Authorization header of a request to https://api.github.com.
const base = require('@playwright/test');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { expect } = base;
const FAKE_TOKEN = 'github_pat_TESTONLY_not_a_real_token';
const API = 'https://api.github.com';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'Authorization, Accept, Content-Type, X-GitHub-Api-Version',
  'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'access-control-expose-headers': 'Retry-After, X-RateLimit-Remaining, X-RateLimit-Reset',
};

const sha1 = (data) => crypto.createHash('sha1').update(data).digest('hex');
/** Git blob SHA: SHA-1 of "blob <length>\0<content>". */
function gitBlobSha(content) {
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  return sha1(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf]));
}

/** In-memory repo: blobs, trees and commits keyed by SHA, one branch. */
class FakeRepo {
  constructor({ owner = 'jiayangwong', repo = 'MyCosplayWebsite', branch = 'main', files = {} } = {}) {
    Object.assign(this, { owner, repo, branch });
    this.blobs = new Map(); // sha -> Buffer
    this.trees = new Map(); // sha -> Map(path -> { sha, mode, type })
    this.commits = new Map(); // sha -> { sha, tree, parents, message }
    const entries = new Map();
    for (const [path, content] of Object.entries(files)) entries.set(path, this.addBlob(content));
    const tree = this.addTree(entries);
    this.head = this.addCommit({ tree, parents: [], message: 'Initial commit' });
  }

  addBlob(content) {
    const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const sha = gitBlobSha(buf);
    this.blobs.set(sha, buf);
    return { sha, mode: '100644', type: 'blob' };
  }

  addTree(entries) {
    const sorted = [...entries.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
    const sha = sha1(`tree ${JSON.stringify(sorted)}`);
    this.trees.set(sha, new Map(sorted));
    return sha;
  }

  addCommit({ tree, parents, message }) {
    const sha = sha1(`commit ${tree} ${parents.join(',')} ${message} ${this.commits.size}`);
    this.commits.set(sha, { sha, tree, parents, message });
    return sha;
  }

  /** Files at a commit (default: head) as { path: { sha, mode, type } }. */
  filesAt(commitSha = this.head) {
    return this.trees.get(this.commits.get(commitSha).tree);
  }

  /** Text of a file at head, or null. */
  read(path) {
    const entry = this.filesAt().get(path);
    return entry ? this.blobs.get(entry.sha).toString('utf8') : null;
  }

  /** Simulates a push from somewhere else (for stale tests). */
  pushOutside(files, message = 'Outside change') {
    const entries = new Map(this.filesAt());
    for (const [path, content] of Object.entries(files)) {
      if (content === null) entries.delete(path);
      else entries.set(path, this.addBlob(content));
    }
    this.head = this.addCommit({ tree: this.addTree(entries), parents: [this.head], message });
    return this.head;
  }
}

const TREE_MODES = { blob: ['100644', '100755', '120000'], tree: ['040000'], commit: ['160000'] };
/** Why a POST /git/trees entry would be refused by GitHub (422), or '' if it is fine. */
function treeEntryProblem(e) {
  if (!e || typeof e.path !== 'string' || !e.path || e.path.startsWith('/') || e.path.endsWith('/')) return 'bad path';
  if (!TREE_MODES[e.type]) return `bad type ${e.type}`;
  if (!TREE_MODES[e.type].includes(e.mode)) return `mode ${e.mode} does not fit type ${e.type}`;
  if (e.sha !== null && typeof e.sha !== 'string') return 'sha must be a string or null';
  return '';
}

function json(route, status, body, headers = {}) {
  return route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
}

class FakeGitHub {
  constructor(options = {}) {
    this.token = options.token || FAKE_TOKEN;
    // By default the fake repo holds the real data/events.json from this checkout.
    const files = options.files || { 'data/events.json': fs.readFileSync(path.join(__dirname, '..', 'data', 'events.json')) };
    this.repo = new FakeRepo({ ...options, files });
    this.requests = []; // { method, path, query, headers, body }
    this.unhandled = [];
    this.overrides = []; // { method, test, response, once }
    this.holds = []; // from hold(): { match, arrived, released, release }
    this.treeTruncated = Boolean(options.treeTruncated); // GET git/trees?recursive=1 answers truncated: true
  }

  /**
   * Overrides the answer for matching requests. `match` is "METHOD /path" (exact path) or a function(req).
   * `response` is { status, body, headers }, { abort: true }, or a function(req, route). Add { delay } (ms) to wait first.
   */
  respond(match, response, { once = true } = {}) {
    let test = match;
    if (typeof match === 'string') {
      const [method, path] = match.split(' ');
      test = (req) => req.method === method && req.path === path;
    }
    this.overrides.push({ test, response, once });
  }

  /**
   * Holds the next matching request open until the test calls release(), then answers it like normal.
   * `arrived` resolves when the request reaches the mock. Use it to check a busy state without timing.
   * Strict: a held request that is never released fails the test (expectAllHandled).
   */
  hold(match) {
    let release;
    const gate = new Promise((done) => { release = done; });
    let reached;
    const arrived = new Promise((done) => { reached = done; });
    const h = { match: String(match), arrived: false, released: false, release };
    this.holds.push(h);
    this.respond(match, async (req, route) => {
      h.arrived = true;
      reached(req);
      await gate;
      return this.route(route, req);
    });
    return { arrived, release: () => { h.released = true; release(); } };
  }

  /** Calls whose path is under the repo, e.g. ['GET /repos/o/r', 'POST /repos/o/r/git/blobs']. */
  calls() {
    return this.requests.filter((r) => r.method !== 'OPTIONS').map((r) => `${r.method} ${r.path}`);
  }

  async install(page) {
    await page.route((url) => url.hostname === 'api.github.com' || url.hostname.endsWith('.api.github.com'), (route) => this.handle(route));
  }

  async handle(route) {
    const request = route.request();
    const url = new URL(request.url());
    const req = {
      method: request.method(),
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      headers: await request.allHeaders(),
      body: null,
    };
    const raw = request.postData();
    if (raw) {
      try { req.body = JSON.parse(raw); } catch { req.body = raw; }
    }
    if (req.method === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    this.requests.push(req);

    if (url.origin !== API) return this.reject(route, req, `wrong origin ${url.origin}`);
    if (req.headers.authorization !== `Bearer ${this.token}`) return json(route, 401, { message: 'Bad credentials' });

    const i = this.overrides.findIndex((o) => o.test(req));
    if (i !== -1) {
      const o = this.overrides[i];
      if (o.once) this.overrides.splice(i, 1);
      const r = o.response;
      if (r.delay) await new Promise((done) => setTimeout(done, r.delay));
      if (typeof r === 'function') return r(req, route);
      if (r.abort) return route.abort('failed');
      if (!r.status) return this.route(route, req);
      return json(route, r.status, r.body ?? { message: `mock ${r.status}` }, r.headers);
    }
    return this.route(route, req);
  }

  reject(route, req, why) {
    this.unhandled.push(`${req.method} ${req.path}${why ? ` (${why})` : ''}`);
    return json(route, 501, { message: 'Not handled by tests/github-mock.js' });
  }

  route(route, req) {
    const repo = this.repo;
    const prefix = `/repos/${repo.owner}/${repo.repo}`;
    if (!req.path.startsWith(prefix)) return this.reject(route, req);
    const sub = req.path.slice(prefix.length);
    const m = (re) => sub.match(re);
    let x;

    if (req.method === 'GET' && sub === '') {
      return json(route, 200, {
        full_name: `${repo.owner}/${repo.repo}`, name: repo.repo, owner: { login: repo.owner },
        default_branch: repo.branch, private: false,
      });
    }
    if (req.method === 'GET' && sub === `/git/ref/heads/${repo.branch}`) {
      return json(route, 200, { ref: `refs/heads/${repo.branch}`, object: { sha: repo.head, type: 'commit' } });
    }
    if (req.method === 'GET' && (x = m(/^\/git\/commits\/([0-9a-f]{40})$/))) {
      const c = repo.commits.get(x[1]);
      if (!c) return json(route, 404, { message: 'Not Found' });
      return json(route, 200, { sha: c.sha, tree: { sha: c.tree }, parents: c.parents.map((sha) => ({ sha })), message: c.message });
    }
    if (req.method === 'GET' && (x = m(/^\/git\/trees\/([0-9a-f]{40})$/))) {
      const t = repo.trees.get(x[1]);
      if (!t) return json(route, 404, { message: 'Not Found' });
      const files = [...t.entries()].map(([path, e]) => ({ path, ...e, size: repo.blobs.get(e.sha).length }));
      if (req.query.recursive === undefined) {
        // Like GitHub without ?recursive: only the top level (files, plus one 'tree' entry per folder).
        const top = new Map();
        for (const f of files) {
          const [first, ...rest] = f.path.split('/');
          if (!rest.length) top.set(first, f);
          else if (!top.has(first)) top.set(first, { path: first, mode: '040000', type: 'tree', sha: sha1(`dir ${x[1]} ${first}`) });
        }
        return json(route, 200, { sha: x[1], tree: [...top.values()], truncated: false });
      }
      // ?recursive=1: every file and folder. With treeTruncated set, GitHub's "too big" answer: part of the list.
      const dirs = new Set();
      for (const f of files) {
        const parts = f.path.split('/');
        for (let i = 1; i < parts.length; i += 1) dirs.add(parts.slice(0, i).join('/'));
      }
      const tree = [
        ...[...dirs].map((d) => ({ path: d, mode: '040000', type: 'tree', sha: sha1(`dir ${x[1]} ${d}`) })),
        ...files,
      ].sort((a, b) => (a.path < b.path ? -1 : 1));
      if (this.treeTruncated) return json(route, 200, { sha: x[1], tree: tree.slice(0, Math.ceil(tree.length / 2)), truncated: true });
      return json(route, 200, { sha: x[1], tree, truncated: false });
    }
    if (req.method === 'GET' && (x = m(/^\/contents\/(.+)$/))) {
      // Like GitHub: no ref or the branch name = head, a known commit SHA = that commit, anything else = 404.
      const ref = req.query.ref;
      let commit;
      if (ref === undefined || ref === repo.branch || ref === `heads/${repo.branch}` || ref === `refs/heads/${repo.branch}`) commit = repo.head;
      else if (repo.commits.has(ref)) commit = ref;
      else return json(route, 404, { message: `No commit found for the ref ${ref}` });
      const filePath = decodeURIComponent(x[1]);
      const entry = repo.filesAt(commit).get(filePath);
      if (!entry) return json(route, 404, { message: 'Not Found' });
      const buf = repo.blobs.get(entry.sha);
      return json(route, 200, { type: 'file', path: filePath, name: filePath.split('/').pop(), sha: entry.sha, size: buf.length, encoding: 'base64', content: buf.toString('base64') });
    }
    if (req.method === 'POST' && sub === '/git/blobs') {
      const b = req.body || {};
      const buf = b.encoding === 'base64' ? Buffer.from(b.content, 'base64') : Buffer.from(String(b.content), 'utf8');
      const { sha } = repo.addBlob(buf);
      return json(route, 201, { sha, url: `${API}${prefix}/git/blobs/${sha}` });
    }
    if (req.method === 'POST' && sub === '/git/trees') {
      const b = req.body || {};
      const entries = b.base_tree ? new Map(repo.trees.get(b.base_tree) || []) : new Map();
      if (b.base_tree && !repo.trees.has(b.base_tree)) return json(route, 422, { message: 'base_tree not found' });
      for (const e of b.tree || []) {
        const bad = treeEntryProblem(e);
        if (bad) return json(route, 422, { message: `Invalid tree entry ${JSON.stringify(e.path)}: ${bad}` });
        if (e.sha === null) entries.delete(e.path);
        else if (!repo.blobs.has(e.sha)) return json(route, 422, { message: `blob ${e.sha} not found` });
        else entries.set(e.path, { sha: e.sha, mode: e.mode, type: e.type });
      }
      const sha = repo.addTree(entries);
      return json(route, 201, { sha });
    }
    if (req.method === 'POST' && sub === '/git/commits') {
      const b = req.body || {};
      if (!repo.trees.has(b.tree)) return json(route, 422, { message: 'tree not found' });
      if (!Array.isArray(b.parents)) return json(route, 422, { message: 'parents must be an array' });
      const missing = b.parents.find((p) => !repo.commits.has(p));
      if (missing !== undefined) return json(route, 422, { message: `parent ${missing} not found` });
      const sha = repo.addCommit({ tree: b.tree, parents: b.parents || [], message: b.message || '' });
      return json(route, 201, { sha, tree: { sha: b.tree }, parents: (b.parents || []).map((p) => ({ sha: p })) });
    }
    if (req.method === 'PATCH' && sub === `/git/refs/heads/${repo.branch}`) {
      const b = req.body || {};
      const c = repo.commits.get(b.sha);
      if (!c) return json(route, 422, { message: 'Object does not exist' });
      if (!b.force && !c.parents.includes(repo.head)) return json(route, 422, { message: 'Update is not a fast forward' });
      repo.head = b.sha;
      return json(route, 200, { ref: `refs/heads/${repo.branch}`, object: { sha: b.sha, type: 'commit' } });
    }
    return this.reject(route, req);
  }

  expectAllHandled() {
    const stuck = this.holds.filter((h) => h.arrived && !h.released).map((h) => h.match);
    this.holds.forEach((h) => h.release()); // never leave a route handler waiting after the test
    expect(stuck, 'requests held with github.hold() that the test never released').toEqual([]);
    expect(this.unhandled, 'requests to api.github.com that tests/github-mock.js does not handle').toEqual([]);
  }
}

/** Installs the fake GitHub on a page. Prefer the `github` fixture, which also checks for unhandled calls. */
async function installGitHubMock(page, options) {
  const gh = new FakeGitHub(options);
  await gh.install(page);
  return gh;
}

/**
 * Records every request and console message. check() fails if `token` appears anywhere except the
 * Authorization header of a request to https://api.github.com.
 */
function watchTokenLeaks(page, token = FAKE_TOKEN) {
  const requests = [];
  const consoleLines = [];
  page.on('request', (r) => requests.push(r));
  page.on('console', (m) => consoleLines.push(m.text()));
  page.on('pageerror', (e) => consoleLines.push(String(e && e.stack ? e.stack : e)));
  return {
    requests,
    async check() {
      const leaks = [];
      for (const r of requests) {
        const url = r.url();
        const origin = new URL(url).origin;
        if (url.includes(token)) leaks.push(`token in URL: ${url}`);
        const headers = await r.allHeaders().catch(() => r.headers());
        for (const [name, value] of Object.entries(headers)) {
          if (!String(value).includes(token)) continue;
          if (name.toLowerCase() === 'authorization' && origin === API) continue;
          leaks.push(`token in header "${name}" of ${r.method()} ${url}`);
        }
        const body = r.postData();
        if (body && body.includes(token)) leaks.push(`token in body of ${r.method()} ${url}`);
      }
      for (const line of consoleLines) if (line.includes(token)) leaks.push(`token in console: ${line.slice(0, 80)}`);
      expect(leaks, 'places the GitHub token leaked to').toEqual([]);
    },
  };
}

/**
 * `test` with an automatic `github` fixture: api.github.com is always faked, unhandled API calls fail the
 * test, and the fake token must never leak. Use it in every spec that touches the admin GitHub code.
 */
const test = base.test.extend({
  github: [async ({ page }, use) => {
    const gh = await installGitHubMock(page);
    const leaks = watchTokenLeaks(page, gh.token);
    await use(gh);
    gh.expectAllHandled();
    await leaks.check();
  }, { auto: true }],
});

/** Saves the fake token through the admin GitHub panel. */
async function saveFakeToken(page, token = FAKE_TOKEN) {
  await page.fill('#gh-token', token);
  await page.click('#gh-save');
}

module.exports = { test, expect, FAKE_TOKEN, API, FakeRepo, FakeGitHub, installGitHubMock, watchTokenLeaks, gitBlobSha, saveFakeToken };
