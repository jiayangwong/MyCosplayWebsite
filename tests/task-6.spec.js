// TASK-6: admin event manager.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { mockEvents, SAMPLE_EVENTS } = require('./helpers');

test.beforeEach(async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  // Fixed published data: the 8 SAMPLE events (data/events.json now holds the real events, BUG-8).
  await mockEvents(page, SAMPLE_EVENTS);
  await page.goto('admin/index.html');
  await expect(page.locator('html')).toHaveAttribute('data-manager-ready', 'true');
});

test('noindex, not linked from public pages, loads published data first', async ({ page }) => {
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  await expect(page.locator('#source-banner')).toContainText('published data/events.json');
  await expect(page.locator('.event-row')).toHaveCount(8);
  // Help text replaced by TASK-12 (Publish to GitHub).
  await expect(page.locator('.help-box')).toContainText('Changes stay on this browser until you press Publish to GitHub. Export events.json is a backup you can commit by hand.');
  for (const p of ['index.html', 'events.html', 'gallery.html']) {
    await page.goto(p);
    await expect(page.locator('a[href*="admin"]')).toHaveCount(0);
  }
});

test('validation errors block saving', async ({ page }) => {
  await page.fill('#f-date', '');
  await page.fill('#f-short', 'TOOLONGSHORTFORM');
  await page.click('#save-event');
  await expect(page.locator('#err-date')).toBeVisible();
  await expect(page.locator('#err-name')).toBeVisible();
  await expect(page.locator('.event-row')).toHaveCount(8);
});

test('add an event: saved to draft, survives reload, gets an id, appears in order', async ({ page }) => {
  await page.fill('#f-date', '2026-12-12');
  await page.fill('#f-short', 'CF');
  await page.fill('#f-name', 'Comic Fiesta');
  await page.fill('#f-venue', 'KL');
  await page.locator('#activity-list input').first().fill('Frieren');
  await page.click('#add-activity');
  await page.locator('#activity-list input').nth(1).fill('Stage');
  await page.fill('#f-link', 'https://www.instagram.com/reel/ABC123/');
  await expect(page.locator('#embed-preview .media-facade')).toContainText('Instagram');
  await page.click('#save-event');
  await expect(page.locator('#save-status')).toContainText('Saved CF');
  await page.reload();
  await expect(page.locator('#source-banner')).toContainText('browser draft');
  await expect(page.locator('.event-row').first()).toContainText('CF · Comic Fiesta');
  await expect(page.locator('.event-row')).toHaveCount(9);
  const draft = await page.evaluate(() => JSON.parse(localStorage.getItem('puzzkezz.events.draft')).events[0]);
  expect(draft).toMatchObject({ id: '2026-12-12-cf', activities: ['Frieren', 'Stage'], venue: 'KL' });
  expect(draft.sample).toBeUndefined();
});

test('editing a sample removes the sample flag; move buttons only for same date; delete asks', async ({ page }) => {
  await page.locator('.event-row').first().getByRole('button', { name: /^Edit/ }).click();
  await page.fill('#f-name', 'Omatsuri (edited)');
  await page.click('#save-event');
  const first = await page.evaluate(() => JSON.parse(localStorage.getItem('puzzkezz.events.draft')).events[0]);
  expect(first.name).toBe('Omatsuri (edited)');
  expect(first.sample).toBeUndefined();
  await expect(page.locator('.event-row').first().getByRole('button', { name: /up$/ })).toBeDisabled();
  await page.locator('.event-row').last().getByRole('button', { name: /^Delete/ }).click();
  await expect(page.locator('.event-row')).toHaveCount(7);
});

test('export downloads a sorted events.json', async ({ page }) => {
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#export-events')]);
  expect(download.suggestedFilename()).toBe('events.json');
  const data = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  expect(data.version).toBe(1);
  expect(data.events).toHaveLength(8);
  expect(data.events.every((e, i) => i === 0 || data.events[i - 1].date >= e.date)).toBe(true);
});

test('import replaces the draft; a bad file is rejected without changes', async ({ page }) => {
  await page.setInputFiles('#import-file', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"events":[{"id":"x","date":"2025-02-30","short":"X","name":"X"}]}') });
  await expect(page.locator('#import-error')).toContainText('Import failed');
  await expect(page.locator('.event-row')).toHaveCount(8);
  const good = { version: 1, events: [{ id: '2023-12-01-cf', date: '2023-12-01', short: 'CF', name: 'Comic Fiesta' }] };
  await page.setInputFiles('#import-file', { name: 'good.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(good)) });
  await expect(page.locator('.event-row')).toHaveCount(1);
  await page.click('#discard-draft');
  await expect(page.locator('.event-row')).toHaveCount(8);
  await expect(page.locator('#source-banner')).toContainText('published');
});

test('BUG-1: no sideways scroll at 375px; View site button stays on screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw).toBeLessThanOrEqual(cw);
  const box = await page.locator('.site-header-inner > .btn').boundingBox();
  expect(box.x + box.width).toBeLessThanOrEqual(cw);
});
