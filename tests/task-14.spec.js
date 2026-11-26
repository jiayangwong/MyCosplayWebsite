// TASK-14: Site photos (portrait, reel covers, share image) through the uploader and Publish, and the
// portrait / reel covers on the public pages. Uses the strict in-memory fake repo from tests/github-mock.js
// and the fake token only: any unhandled api.github.com call, an unreleased hold() or a leaked token fails.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect, BRANCH, FAKE_TOKEN, FakeRepo, openFold } = require('./github-mock');
const guard = require('./wm-guard');

const ROOT = path.join(__dirname, '..');
const BIG = path.join(__dirname, 'fixtures', 'flat-2400x1600.png');
const TALL = path.join(__dirname, 'fixtures', 'flat-1080x1920.png');
const SMALL = path.join(__dirname, 'fixtures', 'flat-800x600.png');
const REPO = '/repos/jiayangwong/MyCosplayWebsite';
const SUCCESS = 'Published. The site updates in about 1-2 minutes.';
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const TARGETS = ['Portrait', 'Reel cover: さ sa', 'Reel cover: し shi', 'Reel cover: す su', 'Reel cover: せ se', 'Reel cover: そ so', 'Share image'];
const expectResult = expect.configure({ timeout: 15000 });
test.describe.configure({ timeout: 90000 });

const EVENTS_TEXT = `${JSON.stringify({ version: 1, events: [{ id: '2026-03-14-cf', date: '2026-03-14', short: 'CF', name: 'CF Test Con' }] }, null, 2)}\n`;
// BUG-11: fixed fixture (portrait null), independent of the real data/site.json.
const SITE_TEXT = fs.readFileSync(path.join(__dirname, 'fixtures', 'site-null.json'), 'utf8');
const REELS_TEXT = fs.readFileSync(path.join(ROOT, 'data', 'reels.json'), 'utf8');
const OG = fs.readFileSync(path.join(ROOT, 'og-image.png'));

let marker; // js/admin/wm-marker.js, loaded in Node
test.beforeAll(async () => {
  marker = await guard.loadMarker();
});

const PAGE_HELPERS = `
  window.__b64 = async (blob) => {
    const u = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
    return btoa(s);
  };
  window.__bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
`;

/** Opens /admin/ with a fake repo holding the same data files the site serves, and saves the fake token. */
async function setup(page, github) {
  github.repo = new FakeRepo({
    files: { 'data/events.json': EVENTS_TEXT, 'data/site.json': SITE_TEXT, 'data/reels.json': REELS_TEXT, 'og-image.png': OG },
  });
  await page.route('**/data/events.json', (route) => route.fulfill({ contentType: 'application/json', body: EVENTS_TEXT }));
  await page.route('**/data/site.json', (route) => route.fulfill({ contentType: 'application/json', body: SITE_TEXT }));
  await page.addInitScript(PAGE_HELPERS);
  await page.goto('admin/index.html');
  for (const flag of ['manager', 'uploader', 'github', 'publish', 'site-photos']) {
    await expectResult(page.locator('html')).toHaveAttribute(`data-${flag}-ready`, 'true');
  }
  await openFold(page, 'gh');
  await page.fill('#gh-token', FAKE_TOKEN);
  await page.press('#gh-token', 'Enter'); // keyboard: no lost clicks on the phone layout
  await expectResult(page.locator('#gh-saved')).toHaveText(`Token saved, ends in ...${FAKE_TOKEN.slice(-4)}`);
  await openFold(page, 'form-panel');
  await openFold(page, 'wm-panel');
}

/** Picks a target, uploads one image and waits for the preview. Returns { width, height, bytes }. */
async function make(page, target, file) {
  await page.selectOption('#sp-target', { label: target });
  await page.setInputFiles('#sp-file', file);
  await expectResult(page.locator('#sp-card')).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
  const fig = page.locator('#sp-figure');
  return {
    width: Number(await fig.getAttribute('data-width')),
    height: Number(await fig.getAttribute('data-height')),
    bytes: Number(await fig.getAttribute('data-bytes')),
  };
}

/** Bytes of the Download button's file (keyboard). */
async function download(page) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#sp-download').press('Enter')]);
  return { name: dl.suggestedFilename(), bytes: fs.readFileSync(await dl.path()) };
}

async function use(page, label) {
  await expect(page.locator('#sp-use')).toHaveText(`Use for ${label}`);
  await page.locator('#sp-use').press('Enter');
  await expectResult(page.locator('#sp-status')).toHaveText('Added to Publish');
}

async function expectedMarker(page, width, height) {
  return page.evaluate(async ({ w, h }) => {
    const wm = await import('/js/admin/watermark.js');
    return { wm: 'puzzkezz-lattice', v: 1, f: wm.watermarkLayout(w, h).f, div: wm.WM_DIVISOR };
  }, { w: width, h: height });
}

/** Decodes `buf` in the browser: size, and per 3x3 cell the number of pixels brighter than the fixture colour. */
async function decode(page, buf) {
  const source = fs.readFileSync(BIG).toString('base64');
  return page.evaluate(async ({ b64, src }) => {
    const pixels = async (data) => {
      const bmp = await createImageBitmap(new Blob([window.__bytes(data)]));
      const c = document.createElement('canvas');
      c.width = bmp.width;
      c.height = bmp.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(bmp, 0, 0);
      const out = { w: bmp.width, h: bmp.height, data: ctx.getImageData(0, 0, bmp.width, bmp.height).data };
      bmp.close();
      return out;
    };
    const fixture = await pixels(src);
    const base = fixture.data[0] + fixture.data[1] + fixture.data[2];
    const img = await pixels(b64);
    const cells = [];
    for (let cy = 0; cy < 3; cy += 1) {
      for (let cx = 0; cx < 3; cx += 1) {
        let bright = 0;
        for (let y = Math.floor((cy * img.h) / 3); y < Math.floor(((cy + 1) * img.h) / 3); y += 1) {
          for (let x = Math.floor((cx * img.w) / 3); x < Math.floor(((cx + 1) * img.w) / 3); x += 1) {
            const i = (y * img.w + x) * 4;
            if (img.data[i] + img.data[i + 1] + img.data[i + 2] > base + 30) bright += 1;
          }
        }
        cells.push(bright);
      }
    }
    return { width: img.w, height: img.h, cells };
  }, { b64: buf.toString('base64'), src: source });
}

const siteDraft = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('puzzkezz.site.draft') || 'null'));
const reelsDraftText = (page) => page.evaluate(async () => (await import('/js/admin/site-draft.js')).reelsText());
const writes = (github) => github.calls().filter((c) => c.startsWith('POST ') || c.startsWith('PATCH '));

/* ---------- Admin panel ---------- */

test('Site photos panel: a labelled picker with exactly the 7 targets, a file input and the shared watermark controls', async ({ page, github }) => {
  await setup(page, github);
  const select = page.getByLabel('Site photo target');
  await expect(select).toBeVisible();
  expect(await select.locator('option').allTextContents()).toEqual(TARGETS);
  await expect(page.locator('#sp-file')).toHaveAttribute('accept', 'image/*');
  expect(await page.locator('#sp-file').evaluate((el) => el.multiple)).toBe(false);
  await expect(page.locator('#sp-now')).toHaveText('Now: placeholder (no photo)');
  await expect(page.locator('#sp-clear')).toHaveText('Clear portrait');
  await expect(page.locator('#sp-clear')).toBeDisabled();
  await page.selectOption('#sp-target', { label: 'Share image' });
  await expect(page.locator('#sp-clear')).toBeHidden();
  // One watermark rule: the panel uses watermark.js (no second copy of the size rule).
  const source = fs.readFileSync(path.join(ROOT, 'js', 'admin', 'site-photos.js'), 'utf8');
  expect(source).not.toMatch(/\/\s*80\b|WM_DIVISOR|Math\.round\(\s*Math\.min/);
  expect(source).toContain('makeSitePhoto');
});

test('Portrait: 2400x1600 -> WebP 1200x800 with the marker and the lattice everywhere; Use / Clear update the draft and Publish list', async ({ page, github }) => {
  await setup(page, github);
  const size = await make(page, 'Portrait', BIG);
  expect(size).toMatchObject({ width: 1200, height: 800 });
  await expect(page.locator('#sp-size')).toContainText('1200 x 800 · ');
  await expect(page.locator('#sp-path')).toHaveText('media/site/portrait.webp');
  expect(await page.locator('#sp-img').evaluate((img) => img.complete && img.naturalWidth)).toBe(1200);

  const file = await download(page);
  expect(file.name).toBe('portrait.webp');
  expect(file.bytes.length).toBe(size.bytes);
  expect(file.bytes.toString('latin1', 0, 4)).toBe('RIFF');
  expect(file.bytes.toString('latin1', 8, 12)).toBe('WEBP');
  expect(marker.readWatermarkMarker(file.bytes)).toEqual(await expectedMarker(page, 1200, 800));
  const decoded = await decode(page, file.bytes);
  expect([decoded.width, decoded.height]).toEqual([1200, 800]);
  for (const [i, n] of decoded.cells.entries()) expect(n, `cell ${i} has watermark pixels`).toBeGreaterThan(0);

  await use(page, 'Portrait');
  expect((await siteDraft(page)).portrait).toBe('media/site/portrait.webp');
  await expect(page.locator('#pub-pending')).toContainText(`Portrait -> media/site/portrait.webp (`);
  await expect(page.locator('#pub-pending')).toContainText('data/site.json changed');
  await expect(page.locator('#pub-total')).toHaveText(/^Adds 1 photo, 1 file, /);
  await expect(page.locator('#sp-now')).toHaveText('Now: media/site/portrait.webp');
  // The pending file is the same marked file as the download, and a pipeline file.
  expect(await page.evaluate(async () => {
    const p = await import('/js/admin/pending.js');
    const f = p.pendingSiteFiles()[0];
    return [f.path, p.isPipelineFile(f.out.blob), await window.__b64(f.out.blob)];
  })).toEqual(['media/site/portrait.webp', true, file.bytes.toString('base64')]);

  // Clear portrait: back to null, the file leaves the Publish list.
  await page.locator('#sp-clear').press('Enter');
  expect((await siteDraft(page)).portrait).toBeNull();
  await expect(page.locator('#pub-pending')).toHaveText('No pending changes.');
  await expect(page.locator('#publish-btn')).toBeDisabled();
});

test('Reel cover す: 1080x1920 -> 675x1200, sugoi thumb set, no other part of data/reels.json changes; Remove from publish puts it back', async ({ page, github }) => {
  await setup(page, github);
  const size = await make(page, 'Reel cover: す su', TALL);
  expect(size).toMatchObject({ width: 675, height: 1200 });
  const file = await download(page);
  expect(file.name).toBe('sugoi.webp');
  expect(marker.readWatermarkMarker(file.bytes)).toEqual(await expectedMarker(page, 675, 1200));

  await use(page, 'Reel cover す');
  expect((await siteDraft(page)).thumbs.sugoi).toBe('media/reels/sugoi.webp');
  const before = JSON.parse(REELS_TEXT);
  const after = JSON.parse(await reelsDraftText(page));
  const want = JSON.parse(REELS_TEXT);
  want.reels.find((r) => r.id === 'sugoi').thumb = 'media/reels/sugoi.webp';
  expect(after).toEqual(want);
  expect(after.reels.map((r) => r.id)).toEqual(before.reels.map((r) => r.id));
  await expect(page.locator('#pub-pending')).toContainText(`Reel cover す -> media/reels/sugoi.webp (`);
  await expect(page.locator('#pub-pending')).toContainText('data/reels.json changed');
  await expect(page.locator('#pub-pending')).not.toContainText('data/site.json');

  // Remove from publish: the file goes and the cover goes back to the published value ("").
  await openFold(page, 'pub');
  await page.getByRole('button', { name: 'Remove media/reels/sugoi.webp from publish' }).press('Enter');
  await expect(page.locator('#pub-pending')).toHaveText('No pending changes.');
  expect((await siteDraft(page)).thumbs.sugoi).toBe('');
  expect(await reelsDraftText(page)).toBe(REELS_TEXT); // byte for byte the published file
});

test('Share image: 2400x1600 -> PNG exactly 1200x630, centre-cropped, puzzkezz-wm marker, lattice in every cell', async ({ page, github }) => {
  await setup(page, github);
  const size = await make(page, 'Share image', BIG);
  expect(size).toMatchObject({ width: 1200, height: 630 });
  await expect(page.locator('#sp-path')).toHaveText('og-image.png');
  const file = await download(page);
  expect(file.name).toBe('og-image.png');
  expect(file.bytes.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
  expect(file.bytes.indexOf('tEXtpuzzkezz-wm\0', 0, 'latin1')).toBeGreaterThan(0);
  expect(marker.readWatermarkMarker(file.bytes)).toEqual(await expectedMarker(page, 1200, 630));
  const decoded = await decode(page, file.bytes);
  expect([decoded.width, decoded.height]).toEqual([1200, 630]);
  for (const [i, n] of decoded.cells.entries()) expect(n, `cell ${i} has watermark pixels`).toBeGreaterThan(0);
  // A 9:16 photo is centre-cropped too (no stretching): same 1200x630 output.
  expect(await make(page, 'Share image', TALL)).toMatchObject({ width: 1200, height: 630 });
  // "Use for Share image" only adds the file: no JSON changes.
  await use(page, 'Share image');
  await expect(page.locator('#pub-pending')).toContainText('Share image -> og-image.png (');
  await expect(page.locator('#pub-pending')).not.toContainText('changed');
  // Over 5 MB: refused with the message (checked on the pure rule with a fake size).
  expect(await page.evaluate(async () => {
    const w = await import('/js/admin/watermark.js');
    return [w.SHARE_MAX_BYTES, (await import('/js/admin/site-photos.js')).SITE_MESSAGES.shareTooBig];
  })).toEqual([5 * 1024 * 1024, 'This share image is too big (over 5 MB). Try another photo.']);
});

/* ---------- Publish ---------- */

test('Publish all three: one commit with exactly the 5 paths, no removals, blobs = the Download files; guard passes on the fake repo', async ({ page, github }) => {
  await setup(page, github);
  const head = github.repo.head;
  const files = {};
  await make(page, 'Portrait', BIG);
  files['media/site/portrait.webp'] = (await download(page)).bytes;
  await use(page, 'Portrait');
  await make(page, 'Reel cover: す su', TALL);
  files['media/reels/sugoi.webp'] = (await download(page)).bytes;
  await use(page, 'Reel cover す');
  await make(page, 'Share image', BIG);
  files['og-image.png'] = (await download(page)).bytes;
  await use(page, 'Share image');
  await expect(page.locator('#pub-total')).toHaveText(/^Adds 3 photos, 3 files, /);

  const refUpdate = github.hold(`PATCH ${REPO}/git/refs/heads/${BRANCH}`);
  await page.locator('#publish-btn').press('Enter');
  await refUpdate.arrived;
  await expect(page.locator('#publish-btn')).toHaveText('Publishing...');
  await expect(page.locator('#sp-use')).toBeDisabled();
  refUpdate.release();
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  await expect(page.locator('#pub-ok')).toContainText(SUCCESS);

  const trees = github.requests.filter((r) => r.method === 'POST' && r.path === `${REPO}/git/trees`);
  expect(trees).toHaveLength(1);
  const entries = trees[0].body.tree;
  expect(entries.map((e) => e.path).sort()).toEqual(['data/reels.json', 'data/site.json', 'media/reels/sugoi.webp', 'media/site/portrait.webp', 'og-image.png']);
  expect(entries.every((e) => typeof e.sha === 'string')).toBe(true);
  expect(github.calls().filter((c) => c === `PATCH ${REPO}/git/refs/heads/${BRANCH}`)).toHaveLength(1);
  const commit = github.repo.commits.get(github.repo.head);
  expect(commit.parents).toEqual([head]);
  expect(commit.message).toBe('Update site photos from /admin/ (3 photos)');

  const live = github.repo.filesAt();
  const fixtures = [fs.readFileSync(BIG), fs.readFileSync(TALL)];
  for (const [p, bytes] of Object.entries(files)) {
    const blob = github.repo.blobs.get(live.get(p).sha);
    expect(blob.equals(bytes), `${p} = Download file`).toBe(true);
    expect(fixtures.some((f) => f.equals(blob)), `${p} is not the fixture`).toBe(false);
  }
  expect(JSON.parse(github.repo.read('data/site.json'))).toEqual({ version: 1, portrait: 'media/site/portrait.webp' });
  const want = JSON.parse(REELS_TEXT);
  want.reels.find((r) => r.id === 'sugoi').thumb = 'media/reels/sugoi.webp';
  expect(JSON.parse(github.repo.read('data/reels.json'))).toEqual(want);
  expect(github.repo.read('data/events.json')).toBe(EVENTS_TEXT);

  // After the publish nothing is pending, and the drafts' bases are the new files.
  await expect(page.locator('#pub-pending')).toHaveText('No pending changes.');
  const draft = await siteDraft(page);
  expect(draft.base.site.sha).toBe(live.get('data/site.json').sha);
  expect(draft.base.reels.sha).toBe(live.get('data/reels.json').sha);

  // The TASK-15 repo guard on the fake repo's files: no problems.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'task14-repo-'));
  try {
    fs.mkdirSync(path.join(root, 'js', 'admin'), { recursive: true });
    for (const [p, entry] of live) {
      fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true });
      fs.writeFileSync(path.join(root, p), github.repo.blobs.get(entry.sha));
    }
    const result = guard.checkRepo(root, { readMarker: marker.readWatermarkMarker });
    expect(result.problems.map((x) => x.message)).toEqual([]);
    expect(result.checked.sort()).toEqual(['media/reels/sugoi.webp', 'media/site/portrait.webp', 'og-image.png']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Path guard: an injected media/reels/not-a-reel.webp or media/site/other.webp is refused with no network call', async ({ page, github }) => {
  await setup(page, github);
  for (const bad of [{ target: 'reel', label: 'Reel cover x', path: 'media/reels/not-a-reel.webp' }, { target: 'portrait', label: 'Portrait', path: 'media/site/other.webp' }]) {
    await page.evaluate(async (entry) => {
      const p = await import('/js/admin/pending.js');
      for (const f of p.pendingSiteFiles()) p.removePendingSiteFile(f.path);
      // A marked WebP registered as a pipeline file: only the path rule can stop it.
      const { addWatermarkMarker } = await import('/js/admin/wm-marker.js');
      const canvas = document.createElement('canvas');
      canvas.width = 80;
      canvas.height = 60;
      canvas.getContext('2d').fillRect(0, 0, 40, 30);
      const webp = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.85));
      const bytes = addWatermarkMarker(new Uint8Array(await webp.arrayBuffer()), { f: 8, div: 80 });
      const out = { blob: p.markPipelineFile(new Blob([bytes], { type: 'image/webp' })), width: 80, height: 60, downloaded: false };
      p.addPendingSiteFile({ ...entry, out });
    }, bad);
    await expect(page.locator('#publish-btn')).toBeEnabled();
    await page.locator('#publish-btn').press('Enter');
    await expectResult(page.locator('#pub-err-text')).toHaveText(`This path is not allowed in a publish: ${bad.path}`);
    await expect(page.locator('#pub-err-next')).toHaveText('Nothing was sent to GitHub.');
  }
  expect(github.calls()).toEqual([]);
});

test('Stale: data/reels.json changed on GitHub since the draft started -> stale message, no POST or PATCH', async ({ page, github }) => {
  await setup(page, github);
  await make(page, 'Reel cover: す su', TALL);
  await use(page, 'Reel cover す');
  github.repo.pushOutside({ 'data/reels.json': REELS_TEXT.replace('Best cosplay', 'Best cosplay (edited elsewhere)') });
  await page.locator('#publish-btn').press('Enter');
  await expectResult(page.locator('#pub-stale')).toBeVisible();
  expect(writes(github)).toEqual([]);
  expect(github.calls()).toContain(`GET ${REPO}/contents/data/reels.json`);
  expect(github.repo.read('data/reels.json')).toContain('edited elsewhere');
});

/* ---------- Public pages ---------- */

async function mockSite(page, { portrait, thumb = '', portraitStatus = 200 }) {
  const reels = JSON.parse(REELS_TEXT);
  reels.reels.find((r) => r.id === 'sugoi').thumb = thumb;
  await page.route('**/data/site.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 1, portrait }) }));
  await page.route('**/data/reels.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(reels) }));
  const image = fs.readFileSync(SMALL);
  await page.route('**/media/site/portrait.webp', (route) => (portraitStatus === 200
    ? route.fulfill({ contentType: 'image/png', body: image })
    : route.fulfill({ status: 404, body: 'Not found' })));
  await page.route('**/media/reels/sugoi.webp', (route) => route.fulfill({ contentType: 'image/png', body: image }));
}

const PLACEHOLDER = 'Portrait of Puzz Kezz (photo coming soon)';

test('Public pages: the portrait shows on Home and About, a reel card shows its cover', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await mockSite(page, { portrait: 'media/site/portrait.webp', thumb: 'media/reels/sugoi.webp' });
  await page.goto('index.html');
  const pass = page.locator('.pass-photo img');
  await expectResult(pass).toBeVisible();
  await expect(pass).toHaveAttribute('alt', 'Portrait of Puzz Kezz');
  await expect(pass).toHaveAttribute('src', 'media/site/portrait.webp');
  await expect(pass).toHaveAttribute('loading', 'eager');
  expect(await page.evaluate(() => document.querySelector('main img') === document.querySelector('.pass-photo img'))).toBe(true);
  const cover = page.locator('#reel-sugoi .reel-cover img');
  await expect(cover).toHaveAttribute('alt', 'Amazing! reel cover');
  await expect(cover).toHaveAttribute('loading', 'lazy');
  await expect(cover).toHaveAttribute('src', 'media/reels/sugoi.webp');
  await cover.scrollIntoViewIfNeeded();
  await expectResult(cover).toBeVisible();
  await expect(page.locator('#reel-sasuga .reel-cover img')).toHaveCount(0); // empty thumb: placeholder
  await expect(page.locator('#reel-sasuga .reel-cover-label')).toBeVisible();

  await page.goto('about.html');
  const portrait = page.locator('.portrait img');
  await expectResult(portrait).toBeVisible();
  await expect(portrait).toHaveAttribute('alt', 'Portrait of Puzz Kezz');
  await expect(portrait).toHaveAttribute('loading', 'eager');

  await page.goto('reels.html');
  await expect(page.locator('#reel-sugoi .reel-cover img')).toHaveAttribute('alt', 'Amazing! reel cover');
  // og:image is unchanged on every page.
  for (const name of ['index.html', 'about.html', 'reels.html']) {
    expect(fs.readFileSync(path.join(ROOT, name), 'utf8')).toMatch(/property="og:image" content="[^"]*og-image\.png"/);
  }
  expect(errors).toEqual([]);
});

test('Public pages: portrait 404 or portrait null shows the placeholder (same aria-label) and nothing crashes', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await mockSite(page, { portrait: 'media/site/portrait.webp', portraitStatus: 404 });
  const portraitLoad = page.waitForResponse('**/media/site/portrait.webp');
  await page.goto('index.html');
  await portraitLoad;
  await expect(page.locator('.pass-photo img')).toHaveCount(0);
  await expect(page.locator('.pass-photo')).toHaveAttribute('aria-label', PLACEHOLDER);
  await expect(page.locator('.pass-photo')).toHaveText('[Portrait]');

  await page.unroute('**/data/site.json');
  await page.route('**/data/site.json', (route) => route.fulfill({ contentType: 'application/json', body: '{ "version": 1, "portrait": null }' }));
  const site = page.waitForResponse('**/data/site.json');
  await page.goto('about.html');
  await site;
  await expect(page.locator('.portrait')).toHaveAttribute('role', 'img');
  await expect(page.locator('.portrait')).toHaveAttribute('aria-label', PLACEHOLDER);
  await expect(page.locator('.portrait img')).toHaveCount(0);

  await page.unroute('**/data/site.json');
  await page.route('**/data/site.json', (route) => route.fulfill({ status: 404, body: 'Not found' }));
  const missing = page.waitForResponse('**/data/site.json');
  await page.goto('index.html');
  await missing;
  await expect(page.locator('.pass-photo')).toHaveAttribute('aria-label', PLACEHOLDER);
  await expect(page.locator('.pass-photo img')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('site.json fixture: version 1 with portrait null', async () => {
  expect(JSON.parse(SITE_TEXT)).toEqual({ version: 1, portrait: null });
});
