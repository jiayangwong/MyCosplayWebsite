// TASK-22: Moment photos. The "Moment photo" uploader target, Publish of media/moments/<id>.webp with
// data/moments.json, removal of unused moment photos, the moment photo link check, "Remove from publish",
// and the repo guard for data/moments.json. Uses the strict in-memory fake repo from tests/github-mock.js and
// the fake token only: any unhandled api.github.com call, an unreleased hold() or a leaked token fails the test.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect, BRANCH, FAKE_TOKEN, FakeRepo, openFold } = require('./github-mock');
const guard = require('./wm-guard');

const BIG = path.join(__dirname, 'fixtures', 'flat-2400x1600.png');
const SMALL = path.join(__dirname, 'fixtures', 'flat-800x600.png');
const REPO = '/repos/jiayangwong/MyCosplayWebsite';
const REF_PATCH = `PATCH ${REPO}/git/refs/heads/${BRANCH}`;
const TREE_POST = `${REPO}/git/trees`;
const SUCCESS = 'Published. The site updates in about 1-2 minutes.';
const expectResult = expect.configure({ timeout: 15000 });
test.describe.configure({ timeout: 90000 });

const EVENTS_TEXT = `${JSON.stringify({ version: 1, events: [{ id: '2026-03-14-cf', date: '2026-03-14', short: 'CF', name: 'CF Test Con' }] }, null, 2)}\n`;
const OLD = 'media/moments/2025-a.webp';
const SHARED = 'media/events/2026-03-14-cf/keep.webp'; // used by a moment only, never by an event
const PUBLISHED = [
  { id: '2025-a', year: 2025, caption: 'Has a photo', photo: OLD },
  { id: '2024-shared', year: 2024, caption: 'Shares an event folder file', photo: SHARED },
  { id: 'x-link', link: 'https://example.com/x' },
];
const MOMENTS_TEXT = `${JSON.stringify({ version: 1, moments: PUBLISHED }, null, 2)}\n`;
const UNTOUCHABLE = ['media/moments/notes.txt', 'media/moments/sub/a.webp', 'media/moments/photo.jpg', SHARED];

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

async function open(page) {
  await page.goto('admin/index.html');
  for (const flag of ['manager', 'uploader', 'github', 'publish', 'moments', 'moment-photo']) {
    await expectResult(page.locator('html')).toHaveAttribute(`data-${flag}-ready`, 'true');
  }
}

async function setup(page, github) {
  page.on('dialog', (d) => d.accept()); // window.confirm (Delete) and the leave-page prompt on reload
  github.repo = new FakeRepo({
    files: {
      'data/events.json': EVENTS_TEXT,
      'data/moments.json': MOMENTS_TEXT,
      [OLD]: Buffer.from('old moment photo'),
      'media/moments/notes.txt': 'notes',
      'media/moments/sub/a.webp': Buffer.from('in a sub-folder'),
      'media/moments/photo.jpg': Buffer.from('jpg'),
      [SHARED]: Buffer.from('shared'),
    },
  });
  await page.route('**/data/events.json', (route) => route.fulfill({ contentType: 'application/json', body: EVENTS_TEXT }));
  await page.route('**/data/moments.json', (route) => route.fulfill({ contentType: 'application/json', body: MOMENTS_TEXT }));
  await page.addInitScript(PAGE_HELPERS);
  await open(page);
  await openFold(page, 'gh');
  await page.fill('#gh-token', FAKE_TOKEN);
  await page.press('#gh-token', 'Enter');
  await expectResult(page.locator('#gh-saved')).toHaveText(`Token saved, ends in ...${FAKE_TOKEN.slice(-4)}`);
}

const draft = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('puzzkezz.moments.draft') || 'null'));
const draftMoment = async (page, id) => ((await draft(page)) || { moments: [] }).moments.find((m) => m.id === id);
const writes = (github) => github.calls().filter((c) => c.startsWith('POST ') || c.startsWith('PATCH '));
const trees = (github) => github.requests.filter((r) => r.method === 'POST' && r.path === TREE_POST);

async function newMomentForm(page, { year = '', caption = '', link = '' }) {
  await page.press('#new-moment', 'Enter');
  await page.fill('#m-year', String(year));
  await page.fill('#m-caption', caption);
  await page.fill('#m-link', link);
}

async function editMoment(page, id) {
  await page.getByRole('button', { name: `Edit moment ${id}`, exact: true }).press('Enter');
  await expect(page.locator('#mo-form-title')).toHaveText(`Edit moment ${id}`);
}

/** Uploads one image to "Moment photo" and waits for the preview. Returns { width, height, bytes }. */
async function upload(page, file) {
  await page.setInputFiles('#mp-file', file);
  await expectResult(page.locator('#mp-card')).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
  const fig = page.locator('#mp-figure');
  return {
    width: Number(await fig.getAttribute('data-width')),
    height: Number(await fig.getAttribute('data-height')),
    bytes: Number(await fig.getAttribute('data-bytes')),
  };
}

async function download(page) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#mp-download').press('Enter')]);
  return { name: dl.suggestedFilename(), bytes: fs.readFileSync(await dl.path()) };
}

async function use(page) {
  await page.locator('#mp-use').press('Enter');
  await expectResult(page.locator('#mp-status')).toHaveText('Added to Publish');
}

async function publish(page) {
  await expect(page.locator('#publish-btn')).toBeEnabled();
  await page.locator('#publish-btn').press('Enter');
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

/* ---------- Uploader target + Publish ---------- */

test('new moment: 2400x1600 -> one 1200x800 WebP with marker and lattice; Use saves the moment; Publish = one commit with data/moments.json', async ({ page, github }) => {
  await setup(page, github);
  const head = github.repo.head;
  await newMomentForm(page, { year: 2025, caption: 'Wig fell off' });
  await expect(page.locator('#mp-for')).toHaveText('For a new moment: 2025-wig-fell-off (saved when you press "Use for moment")');
  const size = await upload(page, BIG);
  expect(size).toMatchObject({ width: 1200, height: 800 });
  await expect(page.locator('#mp-path')).toHaveText('media/moments/2025-wig-fell-off.webp');
  // Same pipeline as the other uploads (no second copy of the watermark rule).
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'admin', 'moment-photo.js'), 'utf8');
  expect(source).toContain('makeSitePhoto');
  expect(source).not.toMatch(/\/\s*80\b|WM_DIVISOR\s*=|Math\.round\(\s*Math\.min/);

  const file = await download(page);
  expect(file.name).toBe('2025-wig-fell-off.webp');
  expect(file.bytes.length).toBe(size.bytes);
  expect(file.bytes.toString('latin1', 0, 4)).toBe('RIFF');
  expect(file.bytes.toString('latin1', 8, 12)).toBe('WEBP');
  const want = await page.evaluate(async () => {
    const wm = await import('/js/admin/watermark.js');
    return { wm: 'puzzkezz-lattice', v: 1, f: wm.watermarkLayout(1200, 800).f, div: wm.WM_DIVISOR };
  });
  expect(marker.readWatermarkMarker(file.bytes)).toEqual(want);
  const decoded = await decode(page, file.bytes);
  expect([decoded.width, decoded.height]).toEqual([1200, 800]);
  for (const [i, n] of decoded.cells.entries()) expect(n, `cell ${i} has watermark pixels`).toBeGreaterThan(0);

  await use(page);
  expect(await draftMoment(page, '2025-wig-fell-off')).toEqual({ id: '2025-wig-fell-off', year: 2025, caption: 'Wig fell off', photo: 'media/moments/2025-wig-fell-off.webp' });
  await expect(page.locator('#m-photo')).toHaveValue('media/moments/2025-wig-fell-off.webp');
  await expect(page.locator('#pub-pending')).toContainText('Moment 2025-wig-fell-off -> media/moments/2025-wig-fell-off.webp (');
  await expect(page.locator('#pub-pending')).toContainText('data/moments.json changed');
  await expect(page.locator('#pub-total')).toHaveText(/^Adds 1 photo, 1 file, /); // counts towards the 20-photo limit
  expect(await page.evaluate(async () => {
    const p = await import('/js/admin/pending.js');
    const f = p.pendingSiteFiles()[0];
    return [f.target, f.path, p.isPipelineFile(f.out.blob), await window.__b64(f.out.blob)];
  })).toEqual(['moment', 'media/moments/2025-wig-fell-off.webp', true, file.bytes.toString('base64')]);

  await publish(page);
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  await expect(page.locator('#pub-ok')).toContainText(SUCCESS);
  expect(trees(github)).toHaveLength(1);
  expect(trees(github)[0].body.tree.map((e) => e.path).sort()).toEqual(['data/moments.json', 'media/moments/2025-wig-fell-off.webp']);
  expect(trees(github)[0].body.tree.every((e) => typeof e.sha === 'string')).toBe(true); // nothing removed
  expect(github.calls().filter((c) => c === REF_PATCH)).toHaveLength(1);
  const commit = github.repo.commits.get(github.repo.head);
  expect(commit.parents).toEqual([head]);
  expect(commit.message).toBe('Update moments from /admin/ (4 moments, 1 photos)');
  const live = github.repo.filesAt();
  expect(github.repo.blobs.get(live.get('media/moments/2025-wig-fell-off.webp').sha).equals(file.bytes)).toBe(true);
  expect(JSON.parse(github.repo.read('data/moments.json')).moments.find((m) => m.id === '2025-wig-fell-off')).toEqual({ id: '2025-wig-fell-off', year: 2025, caption: 'Wig fell off', photo: 'media/moments/2025-wig-fell-off.webp' });
  for (const p of [OLD, ...UNTOUCHABLE]) expect(live.has(p), p).toBe(true);
  await expect(page.locator('#pub-pending')).toHaveText('No pending changes.');
});

test('replace a moment photo: new path -2, not enlarged; the removal dialog lists the old file; Cancel changes nothing; confirm removes it in the same commit', async ({ page, github }) => {
  await setup(page, github);
  await editMoment(page, '2025-a');
  await expect(page.locator('#mp-for')).toHaveText('For moment: 2025-a');
  expect(await upload(page, SMALL)).toMatchObject({ width: 800, height: 600 }); // smaller than 1200: never enlarged
  await expect(page.locator('#mp-path')).toHaveText('media/moments/2025-a-2.webp');
  await use(page);
  expect((await draftMoment(page, '2025-a')).photo).toBe('media/moments/2025-a-2.webp');
  await expect(page.locator('#pub-pending')).toContainText(`${OLD} (no moment uses it)`);

  const head = github.repo.head;
  await publish(page);
  const dialog = page.locator('#pub-confirm');
  await expectResult(dialog).toBeVisible();
  await expect(page.locator('#pub-confirm-title')).toHaveText('This 1 old file will be removed');
  await expect(page.locator('#pub-confirm-list li')).toHaveCount(1);
  await expect(page.locator('#pub-confirm-list li')).toContainText(OLD);
  await page.locator('#pub-confirm-no').press('Enter');
  await expectResult(page.locator('#pub-cancel')).toBeVisible();
  expect(writes(github)).toEqual([]);
  expect(github.repo.head).toBe(head);
  await expect(page.locator('#pub-pending')).toContainText('media/moments/2025-a-2.webp');

  await publish(page);
  await expectResult(dialog).toBeVisible();
  await page.locator('#pub-confirm-yes').press('Enter');
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  await expect(page.locator('#pub-ok-note')).toHaveText('Removed 1 old file.');
  expect(trees(github)).toHaveLength(1);
  const entries = trees(github)[0].body.tree;
  expect(entries.filter((e) => e.sha !== null).map((e) => e.path).sort()).toEqual(['data/moments.json', 'media/moments/2025-a-2.webp']);
  expect(entries.filter((e) => e.sha === null).map((e) => e.path)).toEqual([OLD]);
  expect(github.calls().filter((c) => c === REF_PATCH)).toHaveLength(1);
  expect(github.repo.commits.get(github.repo.head).message).toBe('Update moments from /admin/ (3 moments, 1 photos, 1 old files removed)');
  const live = github.repo.filesAt();
  expect(live.has(OLD)).toBe(false);
  expect(live.has('media/moments/2025-a-2.webp')).toBe(true);
  for (const p of UNTOUCHABLE) expect(live.has(p), `${p} is never removed`).toBe(true);
});

test('deleting a moment removes only its unused photo; a stray .webp under media/moments/ goes too, nothing else', async ({ page, github }) => {
  await setup(page, github);
  github.repo.pushOutside({ 'media/moments/stray.webp': Buffer.from('stray') }); // data/moments.json unchanged: not stale
  await page.getByRole('button', { name: 'Delete moment 2025-a', exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Delete moment 2024-shared', exact: true }).press('Enter');
  await publish(page);
  await expectResult(page.locator('#pub-confirm')).toBeVisible();
  await expect(page.locator('#pub-confirm-title')).toHaveText('These 2 old files will be removed');
  await expect(page.locator('#pub-confirm-list')).toContainText(OLD);
  await expect(page.locator('#pub-confirm-list')).toContainText('media/moments/stray.webp');
  await page.locator('#pub-confirm-yes').press('Enter');
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  const removed = trees(github)[0].body.tree.filter((e) => e.sha === null).map((e) => e.path).sort();
  expect(removed).toEqual([OLD, 'media/moments/stray.webp']);
  for (const p of removed) expect(p.startsWith('media/moments/') && p.endsWith('.webp') && !p.slice(14).includes('/')).toBe(true);
  for (const p of UNTOUCHABLE) expect(github.repo.filesAt().has(p), `${p} is never removed`).toBe(true);
  expect(writes(github).filter((c) => c === `POST ${REPO}/git/blobs`)).toHaveLength(1); // only data/moments.json
});

test('an events-only publish never removes a file that a moment uses', async ({ page, github }) => {
  await setup(page, github);
  await page.press('#new-event', 'Enter');
  await page.fill('#f-date', '2026-12-20');
  await page.fill('#f-short', 'EVT');
  await page.fill('#f-name', 'Events Only Con');
  await page.press('#f-name', 'Enter');
  await expectResult(page.locator('#save-status')).toContainText('Saved EVT');
  await expect(page.locator('#pub-pending')).not.toContainText(SHARED);
  await publish(page);
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  await expect(page.locator('#pub-confirm')).toBeHidden();
  expect(trees(github)[0].body.tree.map((e) => e.path)).toEqual(['data/events.json']);
  expect(github.repo.filesAt().has(SHARED)).toBe(true);
});

/* ---------- Broken links and "Remove from publish" ---------- */

test('a moment photo that is not on GitHub and not in this publish stops the publish with no write; a non-plain path too', async ({ page, github }) => {
  await setup(page, github);
  const head = github.repo.head;
  await newMomentForm(page, { year: 2025, caption: 'Typed path' });
  await page.fill('#m-photo', 'media/moments/missing.webp');
  await page.press('#m-caption', 'Enter');
  await expectResult(page.locator('#mo-status')).toHaveText('Saved moment 2025-typed-path to the draft.');
  await publish(page);
  await expectResult(page.locator('#pub-err-text')).toHaveText('Moment "Typed path" (2025-typed-path) points at a photo that is not on GitHub and not in this publish: media/moments/missing.webp.');
  await expect(page.locator('#pub-err-next')).toHaveText('Make the photo again with "Moment photo", or remove it from the moment, then publish. Nothing was changed.');
  await expect(page.locator('#pub-confirm')).toBeHidden();
  expect(writes(github)).toEqual([]);

  // Fix: a not-plain way to write an existing file still stops (it could hide a file in use from the removal rules).
  await page.fill('#m-photo', `./${OLD}`);
  await page.press('#m-caption', 'Enter');
  await page.locator('#pub-retry').press('Enter');
  await expectResult(page.locator('#pub-err-text')).toHaveText(`Moment "Typed path" (2025-typed-path) has a photo path that is not in the usual form: ./${OLD}.`);
  expect(writes(github)).toEqual([]);
  expect(github.repo.head).toBe(head);

  // Try again after the fix (a plain path of a file on GitHub): one commit.
  await page.fill('#m-photo', OLD);
  await page.press('#m-caption', 'Enter');
  await page.locator('#pub-retry').press('Enter');
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  expect(github.calls().filter((c) => c === REF_PATCH)).toHaveLength(1);
});

test('"Remove from publish" on a moment photo puts back the published photo, or clears it', async ({ page, github }) => {
  await setup(page, github);
  // Published moment: back to its published photo, nothing left to publish.
  await editMoment(page, '2025-a');
  await upload(page, SMALL);
  await use(page);
  await openFold(page, 'pub');
  await page.getByRole('button', { name: 'Remove media/moments/2025-a-2.webp from publish', exact: true }).press('Enter');
  await expect(page.locator('#pub-note')).toHaveText('Photo for moment 2025-a set back to the published photo.');
  expect((await draftMoment(page, '2025-a')).photo).toBe(OLD);
  await expect(page.locator('#pub-pending')).toHaveText('No pending changes.');
  await expect(page.locator('#publish-btn')).toHaveText('Nothing to publish');

  // New moment with a link: the photo is cleared, the moment stays.
  await newMomentForm(page, { year: 2026, caption: 'With link', link: 'https://example.com/l' });
  await upload(page, SMALL);
  await use(page);
  await openFold(page, 'pub');
  await page.getByRole('button', { name: 'Remove media/moments/2026-with-link.webp from publish', exact: true }).press('Enter');
  await expect(page.locator('#pub-note')).toHaveText('Photo for moment 2026-with-link removed (it has no published photo).');
  expect(await draftMoment(page, '2026-with-link')).toEqual({ id: '2026-with-link', year: 2026, caption: 'With link', link: 'https://example.com/l' });

  // New moment with only a photo: cleared, so Publish refuses it before any request until it is fixed.
  await newMomentForm(page, { year: 2026, caption: 'Photo only' });
  await upload(page, SMALL);
  await use(page);
  await openFold(page, 'pub');
  await page.getByRole('button', { name: 'Remove media/moments/2026-photo-only.webp from publish', exact: true }).press('Enter');
  await publish(page);
  await expectResult(page.locator('#pub-err-text')).toHaveText("Moment 2026-photo-only can't be published: needs a photo or a link.");
  expect(github.calls()).toEqual([]);
  await page.getByRole('button', { name: 'Delete moment 2026-photo-only', exact: true }).press('Enter');
  await page.locator('#pub-retry').press('Enter');
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  expect(trees(github)[0].body.tree.map((e) => e.path)).toEqual(['data/moments.json']);
});

test('Use for moment with form errors: nothing saved, no pending file', async ({ page, github }) => {
  await setup(page, github);
  await newMomentForm(page, { year: 'abc', caption: 'Bad year' });
  await upload(page, SMALL);
  await page.locator('#mp-use').press('Enter');
  await expect(page.locator('#mp-error')).toContainText('The moment form has errors');
  await expect(page.locator('#err-m-year')).toBeVisible();
  await expect(page.locator('#m-photo')).toHaveValue('');
  await expect(page.locator('#pub-pending')).toHaveText('No pending changes.');
  expect(await draft(page)).toBeNull();
});

test('path guard: a pending moment file at a path no draft moment owns is refused with no network call', async ({ page, github }) => {
  await setup(page, github);
  for (const bad of [
    { momentId: '2025-a', path: 'media/moments/not-a-moment.webp' },
    { momentId: '2025-a', path: 'media/moments/2024-shared.webp' },
    { momentId: '2025-a', path: 'media/events/2026-03-14-cf/x.webp' },
  ]) {
    await page.evaluate(async (entry) => {
      const p = await import('/js/admin/pending.js');
      for (const f of p.pendingSiteFiles()) p.removePendingSiteFile(f.path);
      const { addWatermarkMarker } = await import('/js/admin/wm-marker.js');
      const canvas = document.createElement('canvas');
      canvas.width = 80;
      canvas.height = 60;
      canvas.getContext('2d').fillRect(0, 0, 40, 30);
      const webp = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.85));
      const bytes = addWatermarkMarker(new Uint8Array(await webp.arrayBuffer()), { f: 8, div: 80 });
      const out = { blob: p.markPipelineFile(new Blob([bytes], { type: 'image/webp' })), width: 80, height: 60, downloaded: true };
      p.addPendingSiteFile({ target: 'moment', label: 'Moment x', ...entry, out });
    }, bad);
    await publish(page);
    await expectResult(page.locator('#pub-err-text')).toHaveText(`This path is not allowed in a publish: ${bad.path}`);
  }
  expect(github.calls()).toEqual([]);
});

/* ---------- Pure rules ---------- */

test('pure rules: brokenMomentPhotoLinks, isRemovableMoment, momentPathProblem', async ({ page, github }) => {
  await setup(page, github);
  const r = await page.evaluate(async () => {
    const pub = await import('/js/admin/publish.js');
    const text = JSON.stringify({ version: 1, moments: [
      { id: 'a', photo: 'media/moments/a.webp' }, { id: 'b', caption: 'B', photo: 'media/moments/b.webp' },
      { id: 'c', photo: './media/moments/c.webp' }, { id: 'd', photo: 'img/other.webp' }, { id: 'e', link: 'https://x.y/' },
    ] });
    const tree = [{ path: 'media/moments/a.webp', type: 'blob' }];
    const used = new Set(['media/moments/a.webp']);
    const none = new Set();
    return {
      broken: pub.brokenMomentPhotoLinks(text, tree, false, new Set()).map((p) => [p.kind, p.who, p.value]),
      fresh: pub.brokenMomentPhotoLinks(text, tree, false, new Set(['media/moments/b.webp'])).map((p) => p.id),
      truncated: pub.brokenMomentPhotoLinks(text, tree, true, new Set()).map((p) => [p.id, p.kind]),
      badJson: pub.brokenMomentPhotoLinks('{oops', tree, false, none),
      notInCommit: pub.brokenMomentPhotoLinks(null, tree, false, none),
      removable: ['media/moments/x.webp', 'media/moments/a.webp', 'media/moments/sub/x.webp', 'media/moments/x.jpg',
        'media/moments/.webp', 'media/moments/x.WEBP', 'media/events/x/y.webp', 'data/moments.json', 'media/moments/new.webp']
        .map((p) => [p, pub.isRemovableMoment(p, used, new Set(['media/moments/new.webp']))]),
      paths: [
        pub.momentPathProblem({ momentId: 'a', path: 'media/moments/a.webp' }, [{ id: 'a', photo: 'media/moments/a.webp' }]),
        pub.momentPathProblem({ momentId: 'a', path: 'media/moments/a-2.webp' }, [{ id: 'a', photo: 'media/moments/a-2.webp' }]),
        pub.momentPathProblem({ momentId: 'a', path: 'media/moments/a-2.webp' }, [{ id: 'a', photo: 'media/moments/a.webp' }]),
        pub.momentPathProblem({ momentId: 'a', path: 'media/moments/b.webp' }, [{ id: 'a', photo: 'media/moments/b.webp' }]),
      ],
    };
  });
  expect(r.broken).toEqual([
    ['missing', 'Moment "B" (b)', 'media/moments/b.webp'],
    ['form', 'Moment c', './media/moments/c.webp'],
  ]);
  expect(r.fresh).toEqual(['c']);
  expect(r.truncated).toEqual([['a', 'unchecked'], ['b', 'unchecked'], ['c', 'form']]);
  expect(r.badJson).toEqual([]);
  expect(r.notInCommit).toEqual([]);
  expect(Object.fromEntries(r.removable)).toEqual({
    'media/moments/x.webp': true,
    'media/moments/a.webp': false,
    'media/moments/sub/x.webp': false,
    'media/moments/x.jpg': false,
    'media/moments/.webp': false,
    'media/moments/x.WEBP': false,
    'media/events/x/y.webp': false,
    'data/moments.json': false,
    'media/moments/new.webp': false,
  });
  expect(r.paths).toEqual(['', '', 'media/moments/a-2.webp', 'media/moments/b.webp']);
});

/* ---------- Repo guard ---------- */

test('repo guard: every photo in data/moments.json must exist and carry the marker (self-test)', async ({ page }) => {
  await page.addInitScript(PAGE_HELPERS);
  await page.goto('index.html');
  const webp = Buffer.from(await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 40;
    c.height = 30;
    c.getContext('2d').fillRect(0, 0, 20, 15);
    return window.__b64(await new Promise((r) => c.toBlob(r, 'image/webp', 0.85)));
  }), 'base64');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-guard-moments-'));
  try {
    const write = (rel, data) => {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), data);
    };
    write('media/moments/ok.webp', Buffer.from(marker.addWatermarkMarker(webp, { f: 8, div: 80 })));
    write('media/moments/unmarked.webp', webp);
    write('data/moments.json', JSON.stringify({
      version: 1,
      moments: [
        { id: 'ok', photo: 'media/moments/ok.webp' },
        { id: 'unmarked', photo: 'media/moments/unmarked.webp' },
        { id: 'missing', photo: 'media/moments/missing.webp' },
        { id: 'link-only', link: 'https://example.com/' },
      ],
    }));
    const result = guard.checkRepo(root, { readMarker: marker.readWatermarkMarker });
    expect(result.problems.map((p) => p.path).sort()).toEqual(['media/moments/missing.webp', 'media/moments/unmarked.webp']);
    expect(result.problems.find((p) => p.path.endsWith('missing.webp')).message).toBe('media/moments/missing.webp: is used by data/moments.json (missing photo) but the file does not exist');
    expect(result.problems.find((p) => p.path.endsWith('unmarked.webp')).message).toContain('has no watermark marker');
    expect(guard.siteReferences(root).filter((x) => x.where.startsWith('data/moments.json')).map((x) => x.path))
      .toEqual(['media/moments/ok.webp', 'media/moments/unmarked.webp', 'media/moments/missing.webp']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  // The real repo: data/moments.json is checked too, and passes.
  const real = guard.checkRepo(guard.ROOT, { readMarker: marker.readWatermarkMarker });
  expect(real.problems.filter((p) => p.message.includes('data/moments.json'))).toEqual([]);
});
