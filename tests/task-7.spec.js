// TASK-7: media uploader with automatic watermark.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FIXTURE = path.join(__dirname, 'fixtures', 'flat-2400x1600.png');

test.beforeEach(async ({ page }) => {
  await page.goto('admin/index.html');
  await expect(page.locator('html')).toHaveAttribute('data-uploader-ready', 'true');
});

test('watermarks, resizes to max 2000px and stays in the browser', async ({ page }) => {
  const requests = [];
  page.on('request', (r) => { if (!r.url().startsWith('blob:') && !r.url().startsWith('data:')) requests.push(r.url()); });
  const before = requests.length;
  await page.setInputFiles('#wm-files', FIXTURE);
  const card = page.locator('.wm-card');
  await expect(card).toHaveAttribute('data-width', '2000');
  await expect(card).toHaveAttribute('data-height', '1333');
  await expect(card.locator('.wm-name')).toHaveText('flat-2400x1600-wm.webp');
  await expect(card.locator('.wm-meta')).toContainText('WEBP');
  // Only the uploader may have caused requests after the file was picked; none should carry the image.
  expect(requests.slice(before).filter((u) => !u.includes('fonts.g'))).toEqual([]);

  // Compare pixels: the bottom-right corner (watermark) differs from the flat source colour, the top-left does not.
  const pixels = await page.evaluate(async () => {
    const img = document.querySelector('.wm-card img');
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const region = (x, y, w, h) => {
      const d = ctx.getImageData(x, y, w, h).data;
      let diff = 0;
      for (let i = 0; i < d.length; i += 4) diff += Math.abs(d[i] - 247) + Math.abs(d[i + 1] - 211) + Math.abs(d[i + 2] - 223);
      return diff / (d.length / 4);
    };
    return { topLeft: region(0, 0, 300, 120), bottomRight: region(c.width - 900, c.height - 140, 880, 120) };
  });
  expect(pixels.topLeft).toBeLessThan(8);
  expect(pixels.bottomRight).toBeGreaterThan(20);
});

test('controls re-render, download works, path and attach use the selected event', async ({ page }) => {
  await expect(page.locator('#wm-text')).toHaveValue('PUZZ KEZZ · @notpuzzkezz');
  await expect(page.locator('#wm-pos')).toHaveValue('br');
  await expect(page.locator('#wm-opacity')).toHaveValue('60');
  await page.setInputFiles('#wm-files', FIXTURE);
  await expect(page.locator('.wm-card')).toHaveAttribute('data-width', '2000');
  const firstSrc = await page.locator('.wm-card img').getAttribute('src');
  await page.selectOption('#wm-pos', 'tl');
  await expect.poll(() => page.locator('.wm-card img').getAttribute('src')).not.toBe(firstSrc);

  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('.wm-card').getByRole('button', { name: 'Download' }).click()]);
  expect(download.suggestedFilename()).toBe('flat-2400x1600-wm.webp');
  const bytes = fs.readFileSync(await download.path());
  expect(bytes.subarray(8, 12).toString()).toBe('WEBP');

  await page.locator('.event-row').first().getByRole('button', { name: /^Edit/ }).click();
  await expect(page.locator('.wm-path')).toHaveText('media/events/2026-08-22-oma/flat-2400x1600-wm.webp');
  await page.getByRole('button', { name: 'Attach to selected event' }).click();
  await expect(page.locator('#f-photo')).toHaveValue('media/events/2026-08-22-oma/flat-2400x1600-wm.webp');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('puzzkezz.events.draft')).events[0].photo);
  expect(saved).toBe('media/events/2026-08-22-oma/flat-2400x1600-wm.webp');
  await expect(page.locator('.uploader')).toContainText('removes the photo\'s location and camera data');
});
