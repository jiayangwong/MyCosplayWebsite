// TASK-20: Events page - last section "Hall ??? 番外" that opens the same album as Home.
const { test, expect } = require('@playwright/test');
const { mockEvents, mockMoments, noHorizontalScroll, trackErrors } = require('./helpers');

const EVENTS = [
  { id: '2025-12-06-cf', date: '2025-12-06', short: 'CF', name: 'Comic Fiesta' },
  { id: '2026-05-30-amg', date: '2026-05-30', short: 'AMG', name: 'AMG' },
  { id: '2024-08-23-oma', date: '2024-08-23', short: 'OMA', name: 'Omatsuri' },
];

const MOMENTS = [
  { id: '2024-photo', year: 2024, caption: 'Old photo', photo: 'favicon.svg' },
  { id: '2025-clip', year: 2025, caption: 'Clip', link: 'https://www.youtube.com/watch?v=abcdefghijk' },
];

test('Hall ??? is the last section, after the oldest year; not an event', async ({ page }) => {
  await mockEvents(page, EVENTS);
  await page.goto('events.html');
  await expect(page.locator('#events-root > section')).toHaveCount(4);
  const ids = await page.locator('#events-root > section').evaluateAll((els) => els.map((el) => el.id));
  expect(ids).toEqual(['y-2026', 'y-2025', 'y-2024', 'hall-bangai']);
  const section = page.locator('section#hall-bangai');
  await expect(section.locator('h2')).toContainText('Hall ???');
  await expect(section.locator('h2 [lang="ja"] ruby')).toContainText('番外');
  await expect(section.locator('h2 rt')).toHaveText('ばんがい');
  // Pronunciation block for 番外.
  await expect(section.locator('.pron-romaji')).toHaveText('ban-gai');
  await expect(section.locator('.pron-en')).toHaveText('"Extra, outside the numbering"');
  await expect(section.getByRole('button', { name: 'Play pronunciation: ban-gai' })).toHaveCount(1);
  // One card: kaomoji, line, button. No date, no Sample tag, not an event card.
  const card = section.locator('.bangai-card');
  await expect(card).toHaveCount(1);
  await expect(card.locator('.bangai-card-kao')).toHaveText('(*/ω＼*)');
  await expect(card).toContainText('Funny and special moments, all years');
  await expect(card.getByRole('button', { name: 'Open album' })).toHaveCount(1);
  await expect(section.locator('time, .tag-sample, .event-card')).toHaveCount(0);
  // Real events keep their order and count.
  await expect(page.locator('.event-card')).toHaveCount(3);
  await expect(page.locator('.event-name')).toHaveText(['AMG', 'Comic Fiesta', 'Omatsuri']);
  await expect(page.locator('#bangai')).toHaveJSProperty('tagName', 'DIALOG');
  await noHorizontalScroll(page);
});

test('year jump row ends with ??? that links to the section', async ({ page }) => {
  await mockEvents(page, EVENTS);
  await page.goto('events.html');
  const row = page.getByRole('navigation', { name: 'Jump to year' });
  await expect(row.locator('a')).toHaveText(['2026', '2025', '2024', '???']);
  const q = row.locator('a').last();
  await expect(q).toHaveAttribute('href', '#hall-bangai');
  await q.click();
  await expect(page.locator('section#hall-bangai h2')).toBeInViewport();
});

test('events.html#hall-bangai deep link scrolls to the section', async ({ page }) => {
  await mockEvents(page, EVENTS);
  await page.goto('events.html#hall-bangai');
  await expect(page.locator('section#hall-bangai h2')).toBeInViewport();
});

test('Open album opens the shared pop-up with the moments; Esc closes and focus returns', async ({ page }) => {
  const errors = trackErrors(page);
  await mockEvents(page, EVENTS);
  const requests = await mockMoments(page, MOMENTS);
  await page.goto('events.html');
  await page.waitForLoadState('networkidle');
  expect(requests).toHaveLength(0);
  const button = page.getByRole('button', { name: 'Open album' });
  await expect(button).toHaveAttribute('aria-controls', 'bangai');
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  await button.scrollIntoViewIfNeeded();
  await button.click();
  const dialog = page.locator('dialog#bangai');
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((d) => d.matches(':modal'))).toBe(true);
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  await expect(dialog.getByRole('button', { name: 'Close the Hall ??? album' })).toBeFocused();
  await expect(dialog.locator('.eyebrow')).toHaveText('HALL ??? · ALL YEARS');
  await expect(dialog.locator('.bm-cap')).toHaveText(['2025 · Clip', '2024 · Old photo']);
  await expect(dialog.getByRole('button', { name: 'Play pronunciation: ban-gai' })).toHaveCount(1);
  await expect(dialog.locator('iframe')).toHaveCount(0);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe('hidden');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(button).toBeFocused();
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  expect(requests).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('empty album message on the Events page', async ({ page }) => {
  await mockEvents(page, EVENTS);
  await mockMoments(page, []);
  await page.goto('events.html');
  await page.getByRole('button', { name: 'Open album' }).click();
  await expect(page.locator('dialog#bangai .bm-empty')).toHaveText('Nothing here yet. (>///<) Come back later.');
});

test('no events: "Events coming soon." and no Hall ??? section', async ({ page }) => {
  await mockEvents(page, []);
  await page.goto('events.html');
  await expect(page.locator('#events-root')).toContainText('Events coming soon.');
  await expect(page.locator('#hall-bangai')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open album' })).toHaveCount(0);
});

test('no horizontal scroll at 360px, with the album open too', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await mockEvents(page, EVENTS);
  await mockMoments(page, MOMENTS);
  await page.goto('events.html');
  await noHorizontalScroll(page);
  await page.getByRole('button', { name: 'Open album' }).click();
  const dialog = page.locator('dialog#bangai');
  await expect(dialog.locator('.bm-item')).toHaveCount(2);
  const box = await dialog.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(360);
});
