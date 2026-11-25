// QA re-test BUG-9: gallery viewer image has a meaningful alt before and after opening a photo.
const { test, expect } = require('@playwright/test');

test('BUG-9: viewer img alt is set closed, and equals the tile alt when opened', async ({ page }) => {
  await page.goto('gallery.html');
  const tiles = page.locator('.gallery-tile');
  await expect(tiles.first()).toBeVisible();
  const closed = await page.evaluate(() => [...document.images].map((i) => i.getAttribute('alt')));
  expect(closed.every((a) => a !== null)).toBe(true);
  expect(await page.locator('.lightbox-img.v-img').first().getAttribute('alt')).toMatch(/\S/);
  for (const n of [0, 1]) {
    const tileAlt = await tiles.nth(n).locator('img').getAttribute('alt');
    expect(tileAlt).toMatch(/^.+ \d{4}$/);
    await tiles.nth(n).click();
    await expect(page.locator('.lightbox-img.v-img').first()).toHaveAttribute('alt', tileAlt);
    await page.keyboard.press('Escape');
  }
});
