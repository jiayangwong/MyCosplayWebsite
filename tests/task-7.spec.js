// TASK-7 (revised for IDEA-9 / IDEA-10): media uploader. Every photo becomes two watermarked WebP files,
// a full-resolution master and a 1200px display copy, with the white dashed diagonal lattice watermark.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { noHorizontalScroll } = require('./helpers');

const BIG = path.join(__dirname, 'fixtures', 'flat-2400x1600.png');
const SMALL = path.join(__dirname, 'fixtures', 'flat-800x600.png');
const SRC = [247, 211, 223]; // the flat colour of both fixtures

// Encoding a 2400 x 1600 master and reading every pixel back is slow on a busy machine.
test.describe.configure({ timeout: 60000 });

/** Opens the event manager. Google Fonts are aborted (they can hang and are not needed here). */
async function open(page) {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  await page.goto('admin/index.html');
  await expect(page.locator('html')).toHaveAttribute('data-uploader-ready', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-manager-ready', 'true');
}

const card = (page, i = 0) => page.locator('.wm-card').nth(i);

async function waitReady(page, i = 0) {
  await expect(card(page, i)).toHaveAttribute('data-state', 'ready', { timeout: 20000 });
}

/** Reads one output file of a card back from its blob URL: size, first bytes, coverage and brightest pixel. */
async function readOutput(page, i, which) {
  const src = await card(page, i).locator(`.wm-thumb-${which} img`).getAttribute('src');
  return page.evaluate(async ({ src, base }) => {
    const blob = await (await fetch(src)).blob();
    const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    const ascii = (a, b) => String.fromCharCode(...head.slice(a, b));
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    c.width = bmp.width;
    c.height = bmp.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(bmp, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const baseSum = base[0] + base[1] + base[2];
    const grid = new Array(9).fill(0);
    let best = -1;
    let brightest = null;
    for (let y = 0; y < c.height; y += 1) {
      for (let x = 0; x < c.width; x += 1) {
        const k = (y * c.width + x) * 4;
        const sum = d[k] + d[k + 1] + d[k + 2];
        if (sum > baseSum + 20) grid[Math.min(2, Math.floor((3 * y) / c.height)) * 3 + Math.min(2, Math.floor((3 * x) / c.width))] += 1;
        if (sum > best) { best = sum; brightest = [d[k], d[k + 1], d[k + 2]]; }
      }
    }
    return { type: blob.type, riff: ascii(0, 4), webp: ascii(8, 12), width: bmp.width, height: bmp.height, grid, brightest };
  }, { src, base: SRC });
}

function expectBrightest(out, opacity) {
  out.brightest.forEach((v, ch) => {
    const want = SRC[ch] + opacity * (255 - SRC[ch]);
    expect(Math.abs(v - want), `channel ${ch}: got ${v}, want ${want.toFixed(1)}`).toBeLessThanOrEqual(12);
  });
}

test('makes a full-size master and a 1200px display copy, both watermarked WebP, without any upload', async ({ page }) => {
  await open(page);
  const origin = new URL(page.url()).origin;
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.setInputFiles('#wm-files', BIG);
  await waitReady(page);

  const master = await readOutput(page, 0, 'master');
  const display = await readOutput(page, 0, 'display');
  expect([master.width, master.height]).toEqual([2400, 1600]);
  expect([display.width, display.height]).toEqual([1200, 800]);
  for (const out of [master, display]) {
    expect(out.type).toBe('image/webp');
    expect(out.riff).toBe('RIFF');
    expect(out.webp).toBe('WEBP');
    // Lattice covers the whole image: every cell of a 3 x 3 grid has watermark pixels.
    out.grid.forEach((hits, cell) => expect(hits, `grid cell ${cell}`).toBeGreaterThan(0));
    // One layer at 40%: the brightest pixels are 40% white over the source, overlaps are not brighter.
    expectBrightest(out, 0.4);
  }

  await expect(card(page).locator('.wm-thumb-master figcaption')).toContainText('MASTER');
  await expect(card(page).locator('.wm-thumb-master figcaption')).toContainText(/2400 x 1600 · \d+(\.\d)? (KB|MB)/);
  await expect(card(page).locator('.wm-thumb-display figcaption')).toContainText('DISPLAY');
  await expect(card(page).locator('.wm-thumb-display figcaption')).toContainText(/1200 x 800 · \d+(\.\d)? (KB|MB)/);
  await expect(card(page).locator('.wm-name')).toContainText('flat-2400x1600.png');
  await expect(card(page).locator('.wm-status')).toContainText('Ready');
  await expect(card(page).locator('.wm-path')).toContainText('flat-2400x1600.webp');
  await expect(card(page).locator('.wm-path')).toContainText('flat-2400x1600-full.webp');

  // Only same-origin page assets (and local blob/data URLs) were requested while processing.
  const outside = requests.filter((u) => !u.startsWith('blob:') && !u.startsWith('data:') && !u.startsWith(`${origin}/`));
  expect(outside).toEqual([]);
});

test('a photo smaller than 1200px is not enlarged, and files are processed one per card', async ({ page }) => {
  await open(page);
  await page.setInputFiles('#wm-files', [SMALL, BIG]);
  await expect(page.locator('.wm-card')).toHaveCount(2);
  await waitReady(page, 0);
  await waitReady(page, 1);
  const master = await readOutput(page, 0, 'master');
  const display = await readOutput(page, 0, 'display');
  expect([master.width, master.height]).toEqual([800, 600]);
  expect([display.width, display.height]).toEqual([800, 600]);
  display.grid.forEach((hits) => expect(hits).toBeGreaterThan(0));
  expectBrightest(display, 0.4);
});

test('watermarkLayout and WM_DIVISOR follow the 2x density rule', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(async () => {
    const m = await import('/js/admin/watermark.js');
    return {
      divisor: m.WM_DIVISOR,
      a: m.watermarkLayout(1200, 800),
      b: m.watermarkLayout(2400, 1600),
      c: m.watermarkLayout(6000, 4000),
      d: m.watermarkLayout(400, 300),
      e: m.watermarkLayout(800, 1200),
    };
  });
  expect(r.divisor).toBe(80);
  expect(r.a.f).toBe(10);
  expect(r.a.cell).toBe(140);
  expect(r.a.lineWidth).toBeCloseTo(1, 2);
  expect(r.a.dash[0]).toBeCloseTo(5, 2);
  expect(r.a.dash[1]).toBeCloseTo(3.5, 2);
  expect(r.a.gap).toBeCloseTo(5, 2);
  expect(r.a.heart).toBeCloseTo(3, 2);
  expect(r.b.f).toBe(20);
  expect(r.b.cell).toBe(280);
  expect(r.b.cell / r.b.f).toBe(14);
  expect(r.c.f).toBe(50);
  expect(r.c.cell).toBe(700);
  expect(r.d.f).toBe(8);
  expect(r.d.lineWidth).toBe(1);
  expect(r.e.f).toBe(10); // the shorter side counts, also for portrait photos
});

test('defaults, and changing the opacity or text re-renders both files', async ({ page }) => {
  await open(page);
  await expect(page.locator('#wm-text')).toHaveValue('@notpuzzkezz');
  await expect(page.locator('#wm-opacity')).toHaveValue('40');
  await expect(page.locator('#wm-opacity')).toHaveAttribute('min', '10');
  await expect(page.locator('#wm-opacity')).toHaveAttribute('max', '100');
  await expect(page.locator('#wm-pos')).toHaveCount(0); // no position choices any more
  await page.setInputFiles('#wm-files', BIG);
  await waitReady(page);

  await page.locator('#wm-opacity').fill('80');
  await expect(page.locator('#wm-opacity-out')).toHaveText('80%');
  // A re-render revokes the old blob URL, so a read can race it; such a read just counts as "not yet".
  await expect.poll(async () => readOutput(page, 0, 'display').then((o) => o.brightest[1], () => 0), { timeout: 20000 }).toBeGreaterThan(240);
  await waitReady(page);
  expectBrightest(await readOutput(page, 0, 'display'), 0.8);
  expectBrightest(await readOutput(page, 0, 'master'), 0.8);

  const before = await card(page).locator('.wm-thumb-master img').getAttribute('src');
  await page.locator('#wm-text').fill('@test');
  await expect.poll(() => card(page).locator('.wm-thumb-master img').getAttribute('src'), { timeout: 20000 }).not.toBe(before);
  await waitReady(page);
});

test('toBlob returning nothing shows "Too large" on that card only; the next photo still works', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (cb, ...rest) {
      if (this.width === 2400) { setTimeout(() => cb(null), 0); return; } // the big photo's master only
      original.call(this, cb, ...rest);
    };
  });
  await open(page);
  await page.setInputFiles('#wm-files', [BIG, SMALL]);
  await expect(card(page, 0)).toHaveAttribute('data-state', 'error', { timeout: 20000 });
  await expect(card(page, 0).locator('.wm-error')).toContainText('Too large for this browser. Please use a desktop browser (Chrome, Edge or Firefox).');
  await expect(card(page, 0)).toHaveClass(/is-err/);
  await expect(card(page, 0).getByRole('button', { name: 'Remove' })).toBeVisible();
  await expect(card(page, 0).getByRole('button', { name: 'Attach to selected event' })).toBeDisabled();
  await waitReady(page, 1);
  const display = await readOutput(page, 1, 'display');
  expect([display.width, display.height]).toEqual([800, 600]);

  await card(page, 0).getByRole('button', { name: 'Remove' }).click();
  await expect(page.locator('.wm-card')).toHaveCount(1);
});

test('a browser that cannot make WebP gets a clear message', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (cb) { original.call(this, cb, 'image/png'); };
  });
  await open(page);
  await page.setInputFiles('#wm-files', SMALL);
  await expect(card(page)).toHaveAttribute('data-state', 'error', { timeout: 20000 });
  await expect(card(page).locator('.wm-error')).toContainText("This browser can't make WebP files. Please use Chrome, Edge or Firefox.");
});

test('a file that is not an image shows the "Could not read" message', async ({ page }) => {
  await open(page);
  await page.setInputFiles('#wm-files', { name: 'notes.heic', mimeType: 'image/heic', buffer: Buffer.from('not really an image') });
  await expect(card(page)).toHaveAttribute('data-state', 'error', { timeout: 20000 });
  await expect(card(page).locator('.wm-error')).toContainText('Could not read this file. Is it a JPG, PNG or WebP?');
});

test('download buttons give the display copy and the full-size master', async ({ page }) => {
  await open(page);
  await page.setInputFiles('#wm-files', BIG);
  await waitReady(page);
  const [d1] = await Promise.all([page.waitForEvent('download'), card(page).getByRole('button', { name: 'Download display' }).click()]);
  expect(d1.suggestedFilename()).toBe('flat-2400x1600.webp');
  const [d2] = await Promise.all([page.waitForEvent('download'), card(page).getByRole('button', { name: 'Download full size' }).click()]);
  expect(d2.suggestedFilename()).toBe('flat-2400x1600-full.webp');
  for (const d of [d1, d2]) {
    const bytes = fs.readFileSync(await d.path());
    expect(bytes.subarray(0, 4).toString()).toBe('RIFF');
    expect(bytes.subarray(8, 12).toString()).toBe('WEBP');
  }

  const names = [];
  page.on('download', (d) => names.push(d.suggestedFilename()));
  await page.getByRole('button', { name: 'Download all' }).click();
  await expect.poll(() => names.length).toBe(2);
  expect(names.sort()).toEqual(['flat-2400x1600-full.webp', 'flat-2400x1600.webp']);
});

test('attach fills both photo fields, saves the draft, and adds a pending pair', async ({ page }) => {
  await open(page);
  await page.setInputFiles('#wm-files', BIG);
  await waitReady(page);
  await page.locator('.event-row').first().getByRole('button', { name: /^Edit/ }).click();
  const id = await page.locator('.event-row').first().getAttribute('data-id');
  await expect(page.locator('#wm-event-id')).toHaveText(id);
  await expect(card(page).locator('.wm-path')).toContainText(`media/events/${id}/flat-2400x1600.webp`);
  await expect(card(page).locator('.wm-path')).toContainText(`media/events/${id}/flat-2400x1600-full.webp`);

  await card(page).getByRole('button', { name: 'Attach to selected event' }).click();
  await expect(page.locator('#f-photo')).toHaveValue(`media/events/${id}/flat-2400x1600.webp`);
  await expect(page.locator('#f-photo-full')).toHaveValue(`media/events/${id}/flat-2400x1600-full.webp`);
  const saved = await page.evaluate((eventId) => JSON.parse(localStorage.getItem('puzzkezz.events.draft')).events.find((e) => e.id === eventId), id);
  expect(saved.photo).toBe(`media/events/${id}/flat-2400x1600.webp`);
  expect(saved.photoFull).toBe(`media/events/${id}/flat-2400x1600-full.webp`);

  const pending = await page.evaluate(async () => {
    const m = await import('/js/admin/pending.js');
    return { pairs: m.pendingPairs().map((p) => [p.eventId, p.photo, p.photoFull]), unsaved: m.hasUnsavedFiles() };
  });
  expect(pending.pairs).toEqual([[id, `media/events/${id}/flat-2400x1600.webp`, `media/events/${id}/flat-2400x1600-full.webp`]]);
  expect(pending.unsaved).toBe(true);

  // The same photo again for the same event gets "-2" on both names; the attached card keeps its names.
  await page.setInputFiles('#wm-files', BIG);
  await waitReady(page, 1);
  await expect(card(page, 1).locator('.wm-path')).toContainText(`media/events/${id}/flat-2400x1600-2.webp`);
  await expect(card(page, 1).locator('.wm-path')).toContainText(`media/events/${id}/flat-2400x1600-2-full.webp`);
  await expect(card(page, 0).locator('.wm-path')).toContainText(`media/events/${id}/flat-2400x1600.webp`);

  // Downloading both files of the pending pair ends the "unsaved files" warning.
  for (const name of ['Download display', 'Download full size']) {
    await Promise.all([page.waitForEvent('download'), card(page, 0).getByRole('button', { name }).click()]);
  }
  expect(await page.evaluate(async () => (await import('/js/admin/pending.js')).hasUnsavedFiles())).toBe(false);
});

test('the uploader explains privacy and fits the screen', async ({ page }) => {
  await open(page);
  await expect(page.locator('#wm-files')).toHaveAttribute('accept', 'image/*');
  await expect(page.locator('#wm-files')).toHaveAttribute('multiple', '');
  await expect(page.locator('.uploader')).toContainText("removes the photo's location and camera data");
  await expect(page.locator('.uploader')).toContainText('best processed on a computer');
  await page.setInputFiles('#wm-files', BIG);
  await waitReady(page);
  await noHorizontalScroll(page);
  const boxes = await page.evaluate(() => [...document.querySelectorAll('.wm-card img')].map((i) => {
    const r = i.getBoundingClientRect();
    return { h: r.height, ratio: r.width / r.height };
  }));
  for (const b of boxes) {
    expect(b.h).toBeLessThanOrEqual(220.5);
    expect(b.ratio).toBeCloseTo(1.5, 1); // the photo's real ratio
  }
});
