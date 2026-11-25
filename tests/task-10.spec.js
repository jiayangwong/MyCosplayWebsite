// TASK-10: photo + photoFull data model, admin Full-size photo field, full-size Gallery viewer.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { mockEvents, trackErrors, openFold, SAMPLE_EVENTS } = require('./helpers');

const PNG = fs.readFileSync(path.join(__dirname, 'fixtures', 'flat-2400x1600.png'));
const SVG = fs.readFileSync(path.join(__dirname, '..', 'favicon.svg'));

const DISPLAY = 'media/events/2026-02-01-amg/cover.webp';
const FULL = 'media/events/2026-02-01-amg/cover-full.webp';
const EVENTS = [
  { id: '2026-02-01-amg', date: '2026-02-01', short: 'AMG', name: 'Anime Matsuri', photo: DISPLAY, photoFull: FULL },
  { id: '2025-12-06-cf', date: '2025-12-06', short: 'CF', name: 'Comic Fiesta', photo: 'favicon.svg' },
];

/** Serves the display copy at once; the full-size file waits for `release()` (or fails). */
async function routePhotos(page, { fullStatus = 200 } = {}) {
  let release;
  const gate = new Promise((r) => { release = r; });
  await page.route(`**/${DISPLAY}`, (route) => route.fulfill({ contentType: 'image/svg+xml', body: SVG }));
  await page.route(`**/${FULL}`, async (route) => {
    await gate;
    if (fullStatus !== 200) return route.fulfill({ status: fullStatus, body: 'missing' });
    return route.fulfill({ contentType: 'image/png', body: PNG });
  });
  return { release };
}

function logRequests(page) {
  const urls = [];
  page.on('request', (r) => urls.push(r.url()));
  return urls;
}

test('validateEvent accepts photo pairs and refuses bad paths', async ({ page }) => {
  await page.goto('index.html');
  const r = await page.evaluate(async () => {
    const d = await import('./js/events-data.js');
    const base = { date: '2025-12-06', short: 'CF', name: 'Comic Fiesta' };
    const v = (extra) => d.validateEvent({ ...base, ...extra }).map((x) => x.field);
    return {
      both: v({ photo: 'media/events/a/cover.webp', photoFull: 'media/events/a/cover-full.webp' }),
      onlyPhoto: v({ photo: 'media/events/a/cover.webp' }),
      fullOnly: v({ photoFull: 'media/events/a/cover-full.webp' }),
      fullEmptyPhoto: v({ photo: '', photoFull: 'media/events/a/cover-full.webp' }),
      absPhoto: v({ photo: '/abs.webp' }),
      urlPhoto: v({ photo: 'https://x/y.webp' }),
      dotsPhoto: v({ photo: '../x.webp' }),
      absFull: v({ photo: 'a.webp', photoFull: '/abs.webp' }),
      urlFull: v({ photo: 'a.webp', photoFull: 'https://x/y.webp' }),
      dotsFull: v({ photo: 'a.webp', photoFull: '../x.webp' }),
      notString: v({ photo: 'a.webp', photoFull: 42 }),
      backslashPhoto: v({ photo: 'https:\\\\evil.com\\x.webp' }),
      backslashFull: v({ photo: 'a.webp', photoFull: 'media\\events\\a.webp' }),
      dataPhoto: v({ photo: 'data:image/png;base64,AAAA' }),
      jsPhoto: v({ photo: 'javascript:alert(1)' }),
      httpNoSlashes: v({ photo: 'http:evil.com/x.webp' }),
      schemeFull: v({ photo: 'a.webp', photoFull: 'data:image/webp;base64,AAAA' }),
      colonLater: v({ photo: 'media/events/a/b:c.webp' }),
    };
  });
  expect(r.both).toEqual([]);
  expect(r.onlyPhoto).toEqual([]);
  expect(r.fullOnly).toEqual(['photoFull']);
  expect(r.fullEmptyPhoto).toEqual(['photoFull']);
  expect(r.absPhoto).toEqual(['photo']);
  expect(r.urlPhoto).toEqual(['photo']);
  expect(r.dotsPhoto).toEqual(['photo']);
  expect(r.absFull).toEqual(['photoFull']);
  expect(r.urlFull).toEqual(['photoFull']);
  expect(r.dotsFull).toEqual(['photoFull']);
  expect(r.notString).toEqual(['photoFull']);
  expect(r.backslashPhoto).toEqual(['photo']);
  expect(r.backslashFull).toEqual(['photoFull']);
  expect(r.dataPhoto).toEqual(['photo']);
  expect(r.jsPhoto).toEqual(['photo']);
  expect(r.httpNoSlashes).toEqual(['photo']);
  expect(r.schemeFull).toEqual(['photoFull']);
  expect(r.colonLater).toEqual([]);
});

test('Home, Events and Gallery tiles never request photoFull before the viewer opens', async ({ page }) => {
  test.setTimeout(60000);
  // Google Fonts can hang on a slow connection and block 'networkidle'; fonts don't matter here.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  await mockEvents(page, EVENTS);
  await routePhotos(page);
  const urls = logRequests(page);
  for (const p of ['index.html', 'events.html', 'gallery.html']) {
    await page.goto(p);
    await page.waitForLoadState('networkidle');
    // Scroll through the page so lazy images would load too.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); }
    });
    await page.waitForLoadState('networkidle');
  }
  expect(urls.some((u) => u.endsWith(DISPLAY))).toBe(true);
  expect(urls.filter((u) => u.endsWith(FULL))).toEqual([]);
});

test('viewer shows the display copy, then swaps in the full-size master', async ({ page }) => {
  const errors = trackErrors(page);
  await mockEvents(page, EVENTS);
  const { release } = await routePhotos(page);
  const urls = logRequests(page);
  await page.goto('gallery.html');
  const tiles = page.locator('.gallery-tile');
  await expect(tiles).toHaveCount(2);
  await tiles.first().click();

  const dialog = page.locator('dialog.viewer');
  const img = dialog.locator('img.v-img:not(.v-full)');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close photo' })).toBeFocused();
  await expect(img).toHaveAttribute('src', new RegExp(`${DISPLAY}$`));
  await expect(img).toHaveAttribute('alt', 'Anime Matsuri 2026');
  await expect(dialog.locator('.vlabel')).toBeVisible();
  await expect(dialog.locator('.vlabel')).toHaveText(/Loading full size/i);
  await expect(dialog.locator('.vtag')).toHaveText('Preview');
  await expect.poll(() => urls.some((u) => u.endsWith(FULL))).toBe(true);

  release();
  // After release the 2400x1600 master is fetched, decoded, cross-faded, then put on the main <img>.
  // Under full-suite load that chain can take more than the default 5s, so this one wait is longer.
  await expect(img).toHaveAttribute('src', new RegExp(`${FULL}$`), { timeout: 15000 });
  await expect(img).toHaveAttribute('alt', 'Anime Matsuri 2026');
  await expect(dialog.locator('.vlabel')).toBeHidden();
  await expect(dialog.locator('.vbar')).toBeHidden();
  await expect(dialog.locator('.vtag')).toHaveText('Full size');
  await expect(dialog).toHaveAttribute('aria-labelledby', 'viewer-caption');
  await expect(dialog.locator('#viewer-caption')).toContainText('AMG · Anime Matsuri · 2026');

  // Next photo has no photoFull: it stays on the display copy, no loading label.
  await page.keyboard.press('ArrowRight');
  await expect(img).toHaveAttribute('alt', 'Comic Fiesta 2025');
  await expect(img).toHaveAttribute('src', /favicon\.svg$/);
  await expect(dialog.locator('.vlabel')).toBeHidden();
  await expect(dialog.getByRole('button', { name: 'Next photo' })).toBeHidden();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(tiles.first()).toBeFocused();
  expect(errors).toEqual([]);
});

test('if photoFull fails to load, the display copy stays', async ({ page }) => {
  const errors = trackErrors(page);
  await mockEvents(page, EVENTS);
  const { release } = await routePhotos(page, { fullStatus: 404 });
  await page.goto('gallery.html');
  await page.locator('.gallery-tile').first().click();
  const dialog = page.locator('dialog.viewer');
  const img = dialog.locator('img.v-img:not(.v-full)');
  release();
  await expect(dialog.locator('.vfail')).toBeVisible();
  await expect(img).toHaveAttribute('src', new RegExp(`${DISPLAY}$`));
  await expect(img).toHaveAttribute('alt', 'Anime Matsuri 2026');
  await expect(dialog.locator('.vlabel')).toBeHidden();
  await expect(dialog.locator('.vtag')).toHaveText('Preview');
  await expect(dialog.locator('[role="alert"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('keyboard: focus stays in the viewer when Next/Previous hides at the ends', async ({ page }) => {
  await mockEvents(page, EVENTS);
  const { release } = await routePhotos(page);
  release();
  await page.goto('gallery.html');
  await page.locator('.gallery-tile').first().click();
  const dialog = page.locator('dialog.viewer');
  const img = dialog.locator('img.v-img:not(.v-full)');
  const nextBtn = dialog.getByRole('button', { name: 'Next photo' });
  const prevBtn = dialog.getByRole('button', { name: 'Previous photo' });
  await expect(dialog.getByRole('button', { name: 'Close photo' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(nextBtn).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(img).toHaveAttribute('alt', 'Comic Fiesta 2025');
  await expect(nextBtn).toBeHidden();
  // Focus moved to Previous (still inside the dialog), so the arrow keys keep working.
  await expect(prevBtn).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(img).toHaveAttribute('alt', 'Anime Matsuri 2026');
  // Same at the other end: Enter on Previous on the 2nd photo -> first photo, focus goes to Next.
  await page.keyboard.press('ArrowRight');
  await expect(img).toHaveAttribute('alt', 'Comic Fiesta 2025');
  await prevBtn.focus();
  await page.keyboard.press('Enter');
  await expect(img).toHaveAttribute('alt', 'Anime Matsuri 2026');
  await expect(nextBtn).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(img).toHaveAttribute('alt', 'Comic Fiesta 2025');
});

test('the footer watermark note stays', async ({ page }) => {
  await page.goto('gallery.html');
  await expect(page.locator('.site-footer')).toContainText('Photos watermarked. Please ask before reposting.');
});

test('admin: Display photo and Full-size photo are saved, kept after reload and exported', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  // Fixed published data: the 8 SAMPLE events, so the new 2026-09-12 event is first (BUG-8).
  await mockEvents(page, SAMPLE_EVENTS);
  await page.goto('admin/index.html');
  await expect(page.locator('html')).toHaveAttribute('data-manager-ready', 'true');
  await openFold(page, 'form-panel'); // TASK-24
  await expect(page.getByLabel('Display photo')).toHaveAttribute('id', 'f-photo');
  await expect(page.getByLabel('Full-size photo')).toHaveAttribute('id', 'f-photo-full');

  // Full-size without display copy is refused next to the right field.
  await page.fill('#f-date', '2026-09-12');
  await page.fill('#f-short', 'TST');
  await page.fill('#f-name', 'Omake Fest');
  await page.fill('#f-photo-full', 'media/events/2026-09-12-tst/cover-full.webp');
  await page.click('#save-event');
  await expect(page.locator('#err-photoFull')).toBeVisible();
  await expect(page.locator('#event-count')).toHaveText('8 events'); // TASK-24: paged list, the chip counts

  await page.fill('#f-photo', 'media/events/2026-09-12-tst/cover.webp');
  await page.click('#save-event');
  await expect(page.locator('#event-count')).toHaveText('9 events');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-manager-ready', 'true');
  const draft = await page.evaluate(() => JSON.parse(localStorage.getItem('puzzkezz.events.draft')));
  const saved = draft.events.find((e) => e.id === '2026-09-12-tst');
  expect(saved.photo).toBe('media/events/2026-09-12-tst/cover.webp');
  expect(saved.photoFull).toBe('media/events/2026-09-12-tst/cover-full.webp');

  // Editing an event with only a display photo leaves photoFull out (no empty strings).
  await page.locator('.event-row').nth(1).getByRole('button', { name: /^Edit/ }).click();
  await page.fill('#f-photo', 'media/events/x/cover.webp');
  await page.fill('#f-photo-full', '');
  await page.click('#save-event');

  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#export-events')]);
  const raw = fs.readFileSync(await download.path(), 'utf8');
  const data = JSON.parse(raw);
  const out = data.events.find((e) => e.id === '2026-09-12-tst');
  expect(out.photo).toBe('media/events/2026-09-12-tst/cover.webp');
  expect(out.photoFull).toBe('media/events/2026-09-12-tst/cover-full.webp');
  const keys = Object.keys(out);
  expect(keys.indexOf('photoFull')).toBe(keys.indexOf('photo') + 1);
  for (const e of data.events) {
    expect(Object.values(e)).not.toContain('');
  }
  expect(data.events[1].photoFull).toBeUndefined();

  // Import accepts files with and without photoFull.
  const file = { version: 1, events: [
    { id: '2023-12-01-cf', date: '2023-12-01', short: 'CF', name: 'Comic Fiesta', photo: 'a.webp', photoFull: 'a-full.webp' },
    { id: '2023-05-01-amg', date: '2023-05-01', short: 'AMG', name: 'AMG', photo: 'b.webp' },
  ] };
  await page.setInputFiles('#import-file', { name: 'pairs.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await expect(page.locator('.event-row')).toHaveCount(2);
  await expect(page.locator('#import-error')).toBeHidden();
});
