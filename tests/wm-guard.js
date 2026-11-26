// Watermark repo guard (TASK-15): every image file in the repo, and every image the site references, must
// carry the hidden uploader marker (js/admin/wm-marker.js) or be on tests/wm-allowlist.json with a matching
// SHA-256 (TASK-17: an allowlisted file whose hash is stale but which now carries a valid marker passes, and
// the entry is reported in `stale`). Files under tests/fixtures/ may instead be synthetic (flat colours); that part needs a browser to
// decode, so checkRepo returns those files in `needsColourCheck` for the test to check.
// Used by tests/task-15.spec.js on the real repo and on temporary folders (self-test).
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const IMAGE_RE = /\.(webp|png|jpe?g|gif|avif|heic)$/i;
/** Folders (at the repo root) the scan skips. Everything else is scanned, storyboard/ included (it is public). */
const SKIP = new Set(['.git', 'node_modules', '.claude', 'test-results', 'playwright-report']);
const FIXTURES = 'tests/fixtures/';
const ALLOWLIST = 'tests/wm-allowlist.json';

/** The pure marker module, loaded from its source so Node does not need "type": "module" for js/admin/. */
async function loadMarker(root = ROOT) {
  const source = fs.readFileSync(path.join(root, 'js/admin/wm-marker.js'), 'utf8');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/** Every image file under `root` as a repo-relative POSIX path, sorted. */
function listImages(root) {
  const out = [];
  const walk = (dir, rel) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!rel && SKIP.has(entry.name)) continue;
        walk(path.join(dir, entry.name), relPath);
      } else if (entry.isFile() && IMAGE_RE.test(entry.name)) {
        out.push(relPath);
      }
    }
  };
  walk(root, '');
  return out.sort();
}

function readJson(root, rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * The repo path a site reference points at, or null when it is not a repo file (external URL, data: URL,
 * empty). `from` is the folder of the file that holds the reference ('' = repo root).
 */
function refToPath(value, from, siteHost) {
  if (typeof value !== 'string' || !value.trim() || value.startsWith('data:')) return null;
  let url;
  try {
    url = new URL(value.trim(), `https://site.invalid/${from ? `${from}/` : ''}`);
  } catch {
    return null;
  }
  if (url.host !== 'site.invalid' && url.host !== siteHost) return null; // another site: not a repo file
  try {
    return decodeURIComponent(url.pathname.slice(1));
  } catch {
    return null;
  }
}

/** Every image reference of the site: { where, path }. SVG files are not photos and are skipped. */
function siteReferences(root) {
  const cnameFile = path.join(root, 'CNAME');
  const siteHost = fs.existsSync(cnameFile) ? fs.readFileSync(cnameFile, 'utf8').trim() : '';
  const refs = [];
  const add = (where, value, from = '') => {
    const p = refToPath(value, from, siteHost);
    if (p && !/\.svg$/i.test(p)) refs.push({ where, path: p });
  };
  const events = readJson(root, 'data/events.json');
  for (const e of (events && Array.isArray(events.events) ? events.events : [])) {
    if (!e) continue;
    add(`data/events.json (${e.id} photo)`, e.photo);
    add(`data/events.json (${e.id} photoFull)`, e.photoFull);
    // TASK-27: every slot of `photos` (the mirror D1 repeats the top-level paths; duplicates are harmless).
    (Array.isArray(e.photos) ? e.photos : []).forEach((p, i) => {
      if (!p || typeof p !== 'object') return;
      add(`data/events.json (${e.id} photos[${i}].photo)`, p.photo);
      add(`data/events.json (${e.id} photos[${i}].photoFull)`, p.photoFull);
    });
  }
  const reels = readJson(root, 'data/reels.json');
  for (const r of (reels && Array.isArray(reels.reels) ? reels.reels : [])) {
    if (r) add(`data/reels.json (${r.id} thumb)`, r.thumb);
  }
  const site = readJson(root, 'data/site.json');
  if (site) add('data/site.json (portrait)', site.portrait);
  // TASK-22: Hall ??? moment photos.
  const moments = readJson(root, 'data/moments.json');
  for (const m of (moments && Array.isArray(moments.moments) ? moments.moments : [])) {
    if (m) add(`data/moments.json (${m.id} photo)`, m.photo);
  }
  for (const name of fs.readdirSync(root).filter((n) => n.endsWith('.html')).sort()) {
    const html = fs.readFileSync(path.join(root, name), 'utf8');
    for (const m of html.matchAll(/<img\b[^>]*?\bsrc\s*=\s*["']([^"']*)["']/gi)) add(`${name} <img src>`, m[1]);
    for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
      if (!/\bproperty\s*=\s*["']og:image["']/i.test(m[0])) continue;
      const content = /\bcontent\s*=\s*["']([^"']*)["']/i.exec(m[0]);
      if (content) add(`${name} og:image`, content[1]);
    }
  }
  return refs;
}

/** True only for a real uploader marker: { wm: "puzzkezz-lattice", v: 1, ... } (TASK-17 stale-entry rule). */
const isValidMarker = (m) => !!m && typeof m === 'object' && m.wm === 'puzzkezz-lattice' && m.v === 1;

/**
 * Checks a repo folder. Returns { problems: [{ path, message }], needsColourCheck: [path], checked: [path],
 * stale: [{ path, message }] }. Every problem message starts with the file path, so a failure says what to fix.
 * `stale` lists allowlisted files whose hash no longer matches but which now carry a valid marker (TASK-17):
 * they pass, and the entry is reported so it can be removed. An allowlisted file whose hash no longer matches
 * and that has no valid marker is still a problem.
 * `readMarker` = readWatermarkMarker from js/admin/wm-marker.js.
 */
function checkRepo(root, { readMarker }) {
  const problems = [];
  const needsColourCheck = [];
  const stale = [];
  const problem = (p, message) => problems.push({ path: p, message: `${p}: ${message}` });

  const allowData = readJson(root, ALLOWLIST) || { files: [] };
  const allow = new Map();
  for (const entry of allowData.files || []) {
    if (!entry || typeof entry.path !== 'string') continue;
    if (!entry.reason || !/^[0-9a-f]{64}$/.test(entry.sha256 || '')) {
      problem(entry.path, `the entry in ${ALLOWLIST} needs a sha256 and a reason`);
    }
    allow.set(entry.path, entry);
  }

  const images = listImages(root);
  const ok = new Set();
  for (const rel of images) {
    const bytes = fs.readFileSync(path.join(root, rel));
    const entry = allow.get(rel);
    if (entry) {
      const hash = sha256(bytes);
      if (hash === entry.sha256) {
        ok.add(rel);
      } else if (isValidMarker(readMarker(bytes))) {
        // TASK-17: the file was replaced by a watermarked upload (for example a Share image over og-image.png).
        // It passes on its marker; the old entry is only reported as stale (a note, not a failure).
        ok.add(rel);
        stale.push({ path: rel, message: `Allowlist entry is stale (file changed, now carries the watermark marker): ${rel}. Remove it from ${ALLOWLIST}.` });
      } else problem(rel, `changed since it was put on ${ALLOWLIST} (SHA-256 is ${hash}, the list says ${entry.sha256}). A changed file needs the uploader's watermark, or a new reviewed allowlist entry.`);
    } else if (readMarker(bytes)) {
      ok.add(rel);
    } else if (rel.startsWith(FIXTURES)) {
      needsColourCheck.push(rel); // synthetic test image or a photo: the browser decides
    } else {
      problem(rel, 'has no watermark marker. Only commit photo files that came out of the uploader (or add it to the allowlist with a reason, if it is not a photo).');
    }
  }
  for (const rel of allow.keys()) {
    if (!images.includes(rel)) problem(rel, `is on ${ALLOWLIST} but the file does not exist. Remove the entry.`);
  }

  const imageSet = new Set(images);
  for (const ref of siteReferences(root)) {
    const file = path.join(root, ref.path);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      problem(ref.path, `is used by ${ref.where} but the file does not exist`);
    } else if (!imageSet.has(ref.path)) {
      problem(ref.path, `is used by ${ref.where} as an image, but it is not an image file the guard scans (.webp .png .jpg .jpeg .gif .avif .heic, outside skipped folders)`);
    } // an existing image file was already checked by the scan above
  }
  return { problems, needsColourCheck, checked: images, stale };
}

module.exports = { ROOT, IMAGE_RE, SKIP, ALLOWLIST, loadMarker, sha256, listImages, siteReferences, checkRepo, isValidMarker };
