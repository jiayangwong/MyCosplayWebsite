// TASK-15: the hidden watermark marker in every uploader file, the Publish check, and the repo guard.
// Uses the strict in-memory fake repo from tests/github-mock.js and the fake token only: any unhandled
// api.github.com call, an unreleased hold() or a leaked token fails the test.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect, FAKE_TOKEN, FakeRepo } = require('./github-mock');
const guard = require('./wm-guard');

const BIG = path.join(__dirname, 'fixtures', 'flat-2400x1600.png');
const SMALL = path.join(__dirname, 'fixtures', 'flat-800x600.png');
const REPO = '/repos/jiayangwong/MyCosplayWebsite';
const SUCCESS = 'Published. The site updates in about 1-2 minutes.';
const NOT_MARKED = (p) => `This file is not a watermarked file from the uploader: ${p}. Please process it again with the uploader.`;
const HELP = 'Only commit photo files that came out of the uploader.';
// Every wait on a result (encoding, a publish) uses this timeout.
const expectResult = expect.configure({ timeout: 15000 });
test.describe.configure({ timeout: 90000 });

const X = '2026-03-14-cf';
const Y = '2025-08-09-omt';
const ev = (id, extra = {}) => {
  const [date, short] = [id.slice(0, 10), id.slice(11).toUpperCase()];
  return { id, date, short, name: `${short} Test Con`, ...extra };
};

let marker; // js/admin/wm-marker.js, loaded in Node
test.beforeAll(async () => {
  marker = await guard.loadMarker();
});

/* ---------- Helpers ---------- */

/** The RIFF chunk names of a WebP file, in order. */
function webpChunkNames(buf) {
  const names = [];
  const end = buf.readUInt32LE(4) + 8;
  for (let at = 12; at + 8 <= end;) {
    const size = buf.readUInt32LE(at + 4);
    names.push(buf.toString('latin1', at, at + 4));
    at += 8 + size + (size & 1);
  }
  return names;
}

/** Runs in the page: base64 of a Blob (chunked, no huge argument lists). */
const PAGE_HELPERS = `
  window.__b64 = async (blob) => {
    const u = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
    return btoa(s);
  };
  window.__bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
`;

/** Number of distinct colours in an image, decoded by the browser (stops counting at 17). */
async function distinctColours(page, buf) {
  return page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bytes]));
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bmp, 0, 0);
    const data = new Uint32Array(ctx.getImageData(0, 0, bmp.width, bmp.height).data.buffer);
    const seen = new Set();
    for (let i = 0; i < data.length && seen.size <= 16; i += 1) seen.add(data[i]);
    canvas.width = 0;
    bmp.close();
    return seen.size;
  }, buf.toString('base64'));
}

/** A real, unmarked WebP straight from the browser's encoder (a small canvas with a few shapes). */
async function encoderWebp(page, { width = 64, height = 48 } = {}) {
  const b64 = await page.evaluate(async ({ width: w, height: h }) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#F4A7C0';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#5B4A8B';
    ctx.fillRect(w / 4, h / 4, w / 2, h / 2);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.85));
    return window.__b64(blob);
  }, { width, height });
  return Buffer.from(b64, 'base64');
}

/** Opens /admin/ with `events` in the fake repo and the site copy, and saves the fake token (keyboard). */
async function setup(page, github, { events }) {
  const text = `${JSON.stringify({ version: 1, events }, null, 2)}\n`;
  github.repo = new FakeRepo({ files: { 'data/events.json': text } });
  await page.route('**/data/events.json', (route) => route.fulfill({ contentType: 'application/json', body: text }));
  await page.addInitScript(PAGE_HELPERS);
  await page.goto('admin/index.html');
  for (const flag of ['manager', 'uploader', 'github', 'publish']) {
    await expectResult(page.locator('html')).toHaveAttribute(`data-${flag}-ready`, 'true');
  }
  await page.fill('#gh-token', FAKE_TOKEN);
  await page.press('#gh-token', 'Enter'); // keyboard, not a click: no lost clicks on the phone layout
  await expectResult(page.locator('#gh-saved')).toHaveText(`Token saved, ends in ...${FAKE_TOKEN.slice(-4)}`);
}

const card = (page, i) => page.locator('.wm-card').nth(i);
const row = (page, id) => page.locator(`.event-row[data-id="${id}"]`);

async function edit(page, id) {
  await row(page, id).getByRole('button', { name: /^Edit/ }).press('Enter');
  await expect(page.locator('#wm-event-id')).toHaveText(id);
}

/** Uploads a fixture and waits until its card is ready. Returns the card index. */
async function upload(page, file) {
  const i = await page.locator('.wm-card').count();
  await page.setInputFiles('#wm-files', file);
  await expectResult(card(page, i)).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
  return i;
}

async function attach(page, i, id) {
  await edit(page, id);
  await card(page, i).getByRole('button', { name: 'Attach to selected event' }).press('Enter');
  await expectResult(page.locator('#f-photo')).toHaveValue(new RegExp(`^media/events/${id}/`));
}

/** Bytes of a Download button's file (pressed with the keyboard). */
async function downloaded(page, i, name) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    card(page, i).getByRole('button', { name }).press('Enter'),
  ]);
  return fs.readFileSync(await download.path());
}

/** Bytes of the pending files of the first pending pair: { display, master } as Buffers. */
async function pendingFiles(page) {
  const out = await page.evaluate(async () => {
    const pair = (await import('/js/admin/pending.js')).pendingPairs()[0];
    return { display: await window.__b64(pair.item.display.blob), master: await window.__b64(pair.item.master.blob) };
  });
  return { display: Buffer.from(out.display, 'base64'), master: Buffer.from(out.master, 'base64') };
}

/** The expected marker for a file of this size, read from the app's own watermarkLayout and WM_DIVISOR. */
async function expectedMarker(page, width, height) {
  return page.evaluate(async ({ w, h }) => {
    const wm = await import('/js/admin/watermark.js');
    return { wm: 'puzzkezz-lattice', v: 1, f: wm.watermarkLayout(w, h).f, div: wm.WM_DIVISOR };
  }, { w: width, h: height });
}

const calls = (github) => github.calls();

/* ---------- The marker module ---------- */

test('wm-marker.js: round trip for an encoder WebP and a PNG; null for unmarked, JPEG, truncated and random bytes', async ({ page }) => {
  await page.addInitScript(PAGE_HELPERS);
  await page.goto('index.html');
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'admin', 'wm-marker.js'), 'utf8');
  expect(source, 'no DOM code in the pure module').not.toMatch(/\b(document|window|navigator|HTMLElement|Image)\b/);

  const info = { f: 13, div: 80 };
  const want = { wm: 'puzzkezz-lattice', v: 1, ...info };
  const webp = await encoderWebp(page);
  const png = fs.readFileSync(BIG);

  // Unmarked inputs and junk: null, never a throw.
  expect(marker.readWatermarkMarker(webp)).toBeNull();
  expect(marker.readWatermarkMarker(png)).toBeNull();
  expect(marker.readWatermarkMarker(fs.readFileSync(SMALL))).toBeNull();
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9]);
  expect(marker.readWatermarkMarker(jpeg)).toBeNull();
  const random = Buffer.alloc(100);
  for (let i = 0; i < random.length; i += 1) random[i] = Math.floor(Math.random() * 256);
  expect(marker.readWatermarkMarker(random)).toBeNull();
  for (const junk of [null, undefined, 'RIFF', {}, new Uint8Array(0), Buffer.from('RIFF\xff\xff\xff\xffWEBP', 'latin1')]) {
    expect(marker.readWatermarkMarker(junk)).toBeNull();
  }

  // WebP: extended (VP8X first), the PZWM chunk, RIFF size updated, readable again.
  const markedWebp = Buffer.from(marker.addWatermarkMarker(webp, info));
  expect(marker.readWatermarkMarker(markedWebp)).toEqual(want);
  expect(webpChunkNames(markedWebp)[0]).toBe('VP8X');
  expect(webpChunkNames(markedWebp)).toContain('PZWM');
  expect(markedWebp.readUInt32LE(4)).toBe(markedWebp.length - 8);
  expect(markedWebp.toString('latin1')).toContain('{"wm":"puzzkezz-lattice","v":1,"f":13,"div":80}');
  // PNG: tEXt "puzzkezz-wm" before the first IDAT.
  const markedPng = Buffer.from(marker.addWatermarkMarker(png, info));
  expect(marker.readWatermarkMarker(markedPng)).toEqual(want);
  const text = markedPng.indexOf('tEXtpuzzkezz-wm\0', 0, 'latin1');
  expect(text).toBeGreaterThan(0);
  expect(text).toBeLessThan(markedPng.indexOf('IDAT', 0, 'latin1'));
  // Marking twice replaces the marker (one chunk only).
  const again = Buffer.from(marker.addWatermarkMarker(markedWebp, { f: 9, div: 80 }));
  expect(marker.readWatermarkMarker(again)).toEqual({ wm: 'puzzkezz-lattice', v: 1, f: 9, div: 80 });
  expect(webpChunkNames(again).filter((n) => n === 'PZWM')).toHaveLength(1);
  // Truncated marked files: null.
  expect(marker.readWatermarkMarker(markedWebp.subarray(0, markedWebp.length - 10))).toBeNull();
  expect(marker.readWatermarkMarker(markedWebp.subarray(0, 30))).toBeNull();
  expect(marker.readWatermarkMarker(markedPng.subarray(0, markedPng.length - 20))).toBeNull();
  // A broken PNG text CRC: null. Wrong marker contents: null.
  const badCrc = Buffer.from(markedPng);
  badCrc[text + 20] ^= 0xff;
  expect(marker.readWatermarkMarker(badCrc)).toBeNull();
  expect(() => marker.addWatermarkMarker(jpeg, info)).toThrow();
  expect(() => marker.addWatermarkMarker(webp, { f: 0, div: 80 })).toThrow();

  // The marker changes only metadata: same size and the same pixels as the unmarked encoder output.
  const same = await page.evaluate(async ([a, b]) => {
    const pixels = async (b64) => {
      const bmp = await createImageBitmap(new Blob([window.__bytes(b64)], { type: 'image/webp' }));
      const c = document.createElement('canvas');
      c.width = bmp.width;
      c.height = bmp.height;
      c.getContext('2d').drawImage(bmp, 0, 0);
      return { w: bmp.width, h: bmp.height, data: Array.from(c.getContext('2d').getImageData(0, 0, bmp.width, bmp.height).data) };
    };
    const [x, y] = [await pixels(a), await pixels(b)];
    return { size: [x.w, x.h, y.w, y.h], equal: x.data.length === y.data.length && x.data.every((v, i) => v === y.data[i]) };
  }, [webp.toString('base64'), markedWebp.toString('base64')]);
  expect(same.size).toEqual([64, 48, 64, 48]);
  expect(same.equal).toBe(true);
  // The marked PNG still decodes to the same flat image.
  expect(await distinctColours(page, markedPng)).toBe(await distinctColours(page, png));
});

/* ---------- The uploader marks every file ---------- */

test('upload the fixture: both Download files and both pending files carry the marker (f from watermarkLayout, div = WM_DIVISOR)', async ({ page, github }) => {
  await setup(page, github, { events: [ev(X), ev(Y)] });
  expect(await page.evaluate(async () => (await import('/js/admin/watermark.js')).WM_DIVISOR)).toBe(80);
  await expect(page.locator('.help-box')).toContainText(HELP);
  const fixture = fs.readFileSync(BIG);
  const i = await upload(page, BIG);

  const sizes = {};
  for (const which of ['display', 'master']) {
    const fig = card(page, i).locator(`.wm-thumb-${which}`);
    sizes[which] = { w: Number(await fig.getAttribute('data-width')), h: Number(await fig.getAttribute('data-height')) };
  }
  expect(sizes.display).toEqual({ w: 1200, h: 800 });
  expect(sizes.master).toEqual({ w: 2400, h: 1600 });

  // Download buttons (backup path) give marked files.
  const files = {
    display: await downloaded(page, i, 'Download display'),
    master: await downloaded(page, i, 'Download full size'),
  };
  for (const which of ['display', 'master']) {
    const want = await expectedMarker(page, sizes[which].w, sizes[which].h);
    expect(marker.readWatermarkMarker(files[which]), `${which} download`).toEqual(want);
    expect(webpChunkNames(files[which])[0]).toBe('VP8X');
    expect(files[which].equals(fixture)).toBe(false);
  }
  expect(marker.readWatermarkMarker(files.display).f).not.toBe(marker.readWatermarkMarker(files.master).f);

  // The preview shows the same marked file (its byte size is the marked size).
  await expect(card(page, i).locator('.wm-thumb-display')).toHaveAttribute('data-bytes', String(files.display.length));
  await expect(card(page, i).locator('.wm-thumb-master')).toHaveAttribute('data-bytes', String(files.master.length));

  // Attach: the pending files are the same marked bytes, and they are pipeline files (WeakSet).
  await attach(page, i, X);
  const pending = await pendingFiles(page);
  for (const which of ['display', 'master']) {
    expect(pending[which].equals(files[which]), `${which} pending = download`).toBe(true);
    expect(marker.readWatermarkMarker(pending[which])).toEqual(await expectedMarker(page, sizes[which].w, sizes[which].h));
  }
  expect(await page.evaluate(async () => {
    const p = await import('/js/admin/pending.js');
    const pair = p.pendingPairs()[0];
    return [p.isPipelineFile(pair.item.display.blob), p.isPipelineFile(pair.item.master.blob)];
  })).toEqual([true, true]);

  // Round trip on a WebP made by the uploader.
  const info = { f: 21, div: 80 };
  expect(marker.readWatermarkMarker(marker.addWatermarkMarker(pending.display, info))).toEqual({ wm: 'puzzkezz-lattice', v: 1, ...info });

  // Publish: the committed image blobs are exactly these marked files.
  await page.locator('#publish-btn').press('Enter');
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  await expect(page.locator('#pub-ok')).toContainText(SUCCESS);
  const live = github.repo.filesAt();
  const display = `media/events/${X}/flat-2400x1600.webp`;
  expect(github.repo.blobs.get(live.get(display).sha).equals(files.display)).toBe(true);
  expect(github.repo.blobs.get(live.get(`media/events/${X}/flat-2400x1600-full.webp`).sha).equals(files.master)).toBe(true);
});

test('the marked display copy decodes with createImageBitmap to the same size as before marking', async ({ page, github }) => {
  await setup(page, github, { events: [ev(X), ev(Y)] });
  const i = await upload(page, BIG);
  const fig = card(page, i).locator('.wm-thumb-display');
  const before = [Number(await fig.getAttribute('data-width')), Number(await fig.getAttribute('data-height'))];
  await attach(page, i, X);
  const decoded = await page.evaluate(async () => {
    const pair = (await import('/js/admin/pending.js')).pendingPairs()[0];
    const out = [];
    for (const blob of [pair.item.display.blob, pair.item.master.blob]) {
      const bmp = await createImageBitmap(blob);
      out.push([bmp.width, bmp.height]);
      bmp.close();
    }
    return out;
  });
  expect(decoded[0]).toEqual(before);
  expect(decoded[1]).toEqual([2400, 1600]);
  // The preview <img> also loaded the marked file.
  expect(await card(page, i).locator('.wm-thumb-display img').evaluate((img) => img.complete && img.naturalWidth)).toBe(before[0]);
});

/* ---------- The Publish check ---------- */

test('Publish refuses an unmarked WebP in the pending list, names the path, sends nothing; also on Try again', async ({ page, github }) => {
  await setup(page, github, { events: [ev(X), ev(Y)] });
  const i = await upload(page, SMALL);
  await attach(page, i, X);
  const display = `media/events/${X}/flat-800x600.webp`;
  const master = `media/events/${X}/flat-800x600-full.webp`;
  const unmarked = await encoderWebp(page, { width: 800, height: 600 });

  // An unmarked WebP that IS registered as a pipeline file, so only the marker check can stop it.
  await page.evaluate(async (b64) => {
    const pending = await import('/js/admin/pending.js');
    const pair = pending.pendingPairs()[0];
    pair.item.realDisplay = pair.item.display;
    const blob = pending.markPipelineFile(new Blob([window.__bytes(b64)], { type: 'image/webp' }));
    pair.item.display = { blob, width: 800, height: 600 };
    pending.addPendingPair(pair);
  }, unmarked.toString('base64'));
  await page.locator('#publish-btn').press('Enter');
  await expectResult(page.locator('#pub-err-text')).toHaveText(NOT_MARKED(display));
  await expect(page.locator('#pub-err-next')).toHaveText('Nothing was sent to GitHub.');
  await expect(page.locator('#pub-err')).toHaveAttribute('role', /alert|status/);
  expect(calls(github)).toEqual([]);

  // Try again runs the check again.
  await page.locator('#pub-retry').press('Enter');
  await expectResult(page.locator('#publish-btn')).toHaveText('Publish to GitHub');
  await expect(page.locator('#pub-err-text')).toHaveText(NOT_MARKED(display));
  expect(calls(github)).toEqual([]);

  // The original PNG bytes passed off as the master: refused with the master's path.
  await page.evaluate(async (b64) => {
    const pending = await import('/js/admin/pending.js');
    const pair = pending.pendingPairs()[0];
    pair.item.display = pair.item.realDisplay;
    pair.item.realMaster = pair.item.master;
    const blob = pending.markPipelineFile(new Blob([window.__bytes(b64)], { type: 'image/webp' }));
    pair.item.master = { blob, width: 800, height: 600 };
    pending.addPendingPair(pair);
  }, fs.readFileSync(SMALL).toString('base64'));
  await page.locator('#pub-retry').press('Enter');
  await expectResult(page.locator('#pub-err-text')).toHaveText(NOT_MARKED(master));
  expect(calls(github)).toEqual([]);

  // A marked copy that the pipeline did not make: the WeakSet check still refuses it first.
  await page.evaluate(async () => {
    const pending = await import('/js/admin/pending.js');
    const pair = pending.pendingPairs()[0];
    const copy = new Blob([await pair.item.realMaster.blob.arrayBuffer()], { type: 'image/webp' });
    pair.item.master = { blob: copy, width: 800, height: 600 };
    pending.addPendingPair(pair);
  });
  await page.locator('#pub-retry').press('Enter');
  await expectResult(page.locator('#pub-err-text')).toHaveText(`This file did not come from the uploader: ${master}`);
  expect(calls(github)).toEqual([]);

  // Back to the uploader's files: Try again publishes one commit. Hold the ref update to see the busy state.
  await page.evaluate(async () => {
    const pending = await import('/js/admin/pending.js');
    const pair = pending.pendingPairs()[0];
    pair.item.master = pair.item.realMaster;
    pending.addPendingPair(pair);
  });
  const refUpdate = github.hold(`PATCH ${REPO}/git/refs/heads/main`);
  await page.locator('#pub-retry').press('Enter');
  await refUpdate.arrived;
  await expect(page.locator('#publish-btn')).toHaveText('Publishing...');
  refUpdate.release();
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  await expect(page.locator('#pub-ok')).toContainText(SUCCESS);
  const live = github.repo.filesAt();
  for (const p of [display, master]) {
    expect(marker.readWatermarkMarker(github.repo.blobs.get(live.get(p).sha)), p).not.toBeNull();
  }
  expect(calls(github).filter((c) => c.startsWith('PATCH '))).toHaveLength(1);
});

test('the marker check covers .webp/.png/.jpg/.jpeg paths only and never throws on a broken Blob', async ({ page }) => {
  await page.addInitScript(PAGE_HELPERS);
  await page.goto('admin/index.html');
  await expectResult(page.locator('html')).toHaveAttribute('data-publish-ready', 'true');
  const marked = Buffer.from(marker.addWatermarkMarker(fs.readFileSync(SMALL), { f: 8, div: 80 }));
  const result = await page.evaluate(async ({ plain, good }) => {
    const { watermarkMarkerCheck } = await import('/js/admin/publish.js');
    const blob = (b64) => new Blob([window.__bytes(b64)]);
    const broken = { arrayBuffer: () => Promise.reject(new Error('gone')) };
    return {
      webp: await watermarkMarkerCheck('media/events/a/x.webp', blob(plain)),
      png: await watermarkMarkerCheck('og-image.PNG', blob(plain)),
      jpg: await watermarkMarkerCheck('media/x.jpg', blob(plain)),
      jpeg: await watermarkMarkerCheck('media/x.jpeg', blob(plain)),
      json: await watermarkMarkerCheck('data/events.json', blob(plain)),
      good: await watermarkMarkerCheck('og-image.png', blob(good)),
      broken: await watermarkMarkerCheck('media/events/a/y.webp', broken),
    };
  }, { plain: fs.readFileSync(SMALL).toString('base64'), good: marked.toString('base64') });
  expect(result).toEqual({
    webp: NOT_MARKED('media/events/a/x.webp'),
    png: NOT_MARKED('og-image.PNG'),
    jpg: NOT_MARKED('media/x.jpg'),
    jpeg: NOT_MARKED('media/x.jpeg'),
    json: null,
    good: null,
    broken: NOT_MARKED('media/events/a/y.webp'),
  });
});

/* ---------- The repo guard ---------- */

test('guard self-test on a temporary folder: reports exactly the 3 bad files, each message names the file', async ({ page }) => {
  await page.addInitScript(PAGE_HELPERS);
  await page.goto('index.html');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-guard-'));
  try {
    const write = (rel, data) => {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), data);
    };
    const webp = await encoderWebp(page);
    write('media/events/x/a.webp', webp); // unmarked: bad
    write('media/events/x/b.webp', Buffer.from(marker.addWatermarkMarker(webp, { f: 8, div: 80 }))); // marked: ok
    write('img/shot.png', fs.readFileSync(SMALL)); // allowlisted with a wrong hash: bad
    write('img/ok.png', fs.readFileSync(BIG)); // allowlisted with the right hash: ok
    write('tests/wm-allowlist.json', JSON.stringify({
      files: [
        { path: 'img/shot.png', sha256: '0'.repeat(64), reason: 'test' },
        { path: 'img/ok.png', sha256: guard.sha256(fs.readFileSync(BIG)), reason: 'test' },
      ],
    }));
    write('data/events.json', JSON.stringify({
      version: 1,
      events: [ev(X, { photo: 'media/events/x/b.webp', photoFull: 'media/events/x/missing.webp' })], // missing: bad
    }));
    write('index.html', '<meta property="og:image" content="img/ok.png"><img src="favicon.svg" alt="">');
    write('node_modules/pkg/photo.png', fs.readFileSync(SMALL)); // skipped folder
    write('.claude/x/photo.webp', webp); // skipped folder

    const result = guard.checkRepo(root, { readMarker: marker.readWatermarkMarker });
    expect(result.problems.map((p) => p.path).sort()).toEqual(['img/shot.png', 'media/events/x/a.webp', 'media/events/x/missing.webp']);
    for (const p of result.problems) expect(p.message.startsWith(`${p.path}: `), p.message).toBe(true);
    expect(result.problems.find((p) => p.path === 'img/shot.png').message).toContain('SHA-256');
    expect(result.problems.find((p) => p.path.endsWith('missing.webp')).message).toContain('does not exist');
    expect(result.checked).not.toContain('node_modules/pkg/photo.png');
    expect(result.checked).not.toContain('.claude/x/photo.webp');

    // A "fixture" that is a photo (many colours) fails the synthetic check.
    const noisy = Buffer.from(await page.evaluate(async () => {
      const c = document.createElement('canvas');
      c.width = 32;
      c.height = 32;
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(32, 32);
      for (let i = 0; i < img.data.length; i += 4) {
        img.data[i] = (i * 7) % 256; img.data[i + 1] = (i * 13) % 256; img.data[i + 2] = (i * 29) % 256; img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      return window.__b64(await new Promise((r) => c.toBlob(r, 'image/png')));
    }), 'base64');
    write('tests/fixtures/photo.png', noisy);
    const again = guard.checkRepo(root, { readMarker: marker.readWatermarkMarker });
    expect(again.needsColourCheck).toEqual(['tests/fixtures/photo.png']);
    expect(await distinctColours(page, noisy)).toBeGreaterThan(16);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the real repo scan passes: every image is marked or allowlisted, fixtures are synthetic, references exist', async ({ page }) => {
  await page.goto('index.html');
  const result = guard.checkRepo(guard.ROOT, { readMarker: marker.readWatermarkMarker });
  expect(result.problems.map((p) => p.message)).toEqual([]);
  expect(result.checked).toContain('og-image.png');

  // Fixtures without the marker must be flat synthetic images (at most 16 colours), not photos.
  for (const rel of result.needsColourCheck) {
    expect(rel.startsWith('tests/fixtures/')).toBe(true);
    const colours = await distinctColours(page, fs.readFileSync(path.join(guard.ROOT, rel)));
    expect(colours, `${rel}: an unmarked fixture must be synthetic (at most 16 colours), found more`).toBeLessThanOrEqual(16);
  }

  // The allowlist: exact paths, SHA-256 and a reason each; no photo of Puzz.
  const allow = JSON.parse(fs.readFileSync(path.join(guard.ROOT, guard.ALLOWLIST), 'utf8')).files;
  for (const entry of allow) {
    expect(entry.sha256, entry.path).toMatch(/^[0-9a-f]{64}$/);
    expect(entry.reason, entry.path).toMatch(/no photo of Puzz/);
  }
  expect(allow.map((e) => e.path)).toContain('og-image.png');
  expect(allow.every((e) => !e.path.startsWith('media/') && !e.path.startsWith('storyboard/'))).toBe(true);

  // og:image of every public page is a checked file.
  const refs = guard.siteReferences(guard.ROOT);
  expect(refs.filter((r) => r.where.endsWith('og:image')).map((r) => r.path)).toContain('og-image.png');
});
