// TASK-8: gallery, about, contact.
const { test, expect } = require('@playwright/test');
const { mockEvents } = require('./helpers');

test('gallery shows "Photos coming soon" when no event has a photo', async ({ page }) => {
  // Own data (BUG-10): the real events.json now has photos, so mock events without any.
  await mockEvents(page, [
    { id: '2025-12-06-cf', date: '2025-12-06', short: 'CF', name: 'Comic Fiesta' },
    { id: '2026-02-01-amg', date: '2026-02-01', short: 'AMG', name: 'AMG' },
  ]);
  await page.goto('gallery.html');
  await expect(page.getByText('Photos coming soon.')).toBeVisible();
  await expect(page.locator('.tabs a[aria-current="page"], .menu-link[aria-current="page"]').first()).toContainText('GALLERY');
});

test('gallery tiles open a larger view that closes with Escape', async ({ page }) => {
  await mockEvents(page, [
    { id: '2025-12-06-cf', date: '2025-12-06', short: 'CF', name: 'Comic Fiesta', photo: 'favicon.svg' },
    { id: '2026-01-01-x', date: '2026-01-01', short: 'X', name: 'No photo' },
    { id: '2026-02-01-amg', date: '2026-02-01', short: 'AMG', name: 'AMG', photo: 'favicon.svg' },
  ]);
  await page.goto('gallery.html');
  const tiles = page.locator('.gallery-tile');
  await expect(tiles).toHaveCount(2);
  await expect(tiles.first()).toContainText('AMG · 2026');
  await expect(tiles.first().locator('img')).toHaveAttribute('alt', 'AMG 2026');
  await expect(tiles.first().locator('img')).toHaveAttribute('loading', 'lazy');
  await tiles.first().click();
  await expect(page.locator('dialog.lightbox')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog.lightbox')).toBeHidden();
});

test('about and contact pages', async ({ page }) => {
  await page.route('**/data/site.json', (route) => route.fulfill({ contentType: 'application/json', body: '{ "version": 1, "portrait": null }' }));
  await page.goto('about.html');
  await expect(page.locator('h1')).toHaveText('About');
  await expect(page.locator('.portrait')).toHaveAttribute('aria-label', /Portrait/);
  await expect(page.locator('.prose')).toContainText('[Bio placeholder');

  await page.goto('contact.html');
  await expect(page.locator('h1')).toHaveText('Collabs & bookings');
  await expect(page.locator('#contact-email')).toHaveAttribute('href', /^mailto:/);
  await expect(page.locator('form')).toHaveCount(0);
  const social = page.locator('#contact-socials a').first();
  await expect(social).toHaveAttribute('target', '_blank');
  await expect(social).toHaveAttribute('rel', 'noopener');
});
