// TASK-5: events page grouped by year with click-to-load embeds.
const { test, expect } = require('@playwright/test');
const { mockEvents, noHorizontalScroll } = require('./helpers');

const EVENTS = [
  { id: '2025-12-06-cf', date: '2025-12-06', short: 'CF', name: 'Comic Fiesta', venue: 'KL', activities: ['Stage', 'Booth'], link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', sample: true },
  { id: '2026-05-30-amg', date: '2026-05-30', short: 'AMG', name: 'AMG', activities: [], link: 'https://www.facebook.com/x/videos/1' },
  { id: '2025-08-23-oma', date: '2025-08-23', short: 'OMA', name: 'Omatsuri' },
];

test('years descending, cards with date, short form, name, venue, activities', async ({ page }) => {
  await mockEvents(page, EVENTS);
  await page.goto('events.html');
  await expect(page.locator('.year-heading-num')).toHaveText(['2026', '2025']);
  await expect(page.locator('.year-jump a')).toHaveText(['2026', '2025']);
  await expect(page.locator('#y-2025 .event-card')).toHaveCount(2);
  await expect(page.locator('#y-2025 .event-name')).toHaveText(['Comic Fiesta', 'Omatsuri']);
  const cf = page.locator('[id="2025-12-06-cf"]');
  await expect(cf.locator('time')).toHaveText('6 Dec 2025');
  await expect(cf.locator('time')).toHaveAttribute('datetime', '2025-12-06');
  await expect(cf.locator('.tag-short')).toHaveText('CF');
  await expect(cf.locator('.tag-sample')).toHaveText('Sample');
  await expect(cf.locator('.event-meta')).toContainText('KL');
  await expect(cf.locator('.event-activities li')).toHaveText(['Stage', 'Booth']);
  await expect(page.locator('[id="2026-05-30-amg"] .event-activities')).toHaveCount(0);
  await expect(page.locator('[id="2026-05-30-amg"] .tag-sample')).toHaveCount(0);
  await noHorizontalScroll(page);
});

test('video embeds only load after a click; other links show photo + link', async ({ page }) => {
  await mockEvents(page, EVENTS);
  await page.goto('events.html');
  await expect(page.locator('iframe')).toHaveCount(0);
  const facade = page.locator('[id="2025-12-06-cf"] .media-facade');
  await expect(facade).toContainText('Load video from YouTube');
  await facade.click();
  const frame = page.locator('[id="2025-12-06-cf"] iframe');
  await expect(frame).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  await expect(frame).toHaveAttribute('title', /Comic Fiesta/);
  const fb = page.locator('[id="2026-05-30-amg"] .media-link');
  await expect(fb).toHaveText('Open on Facebook');
  await expect(fb).toHaveAttribute('rel', 'noopener');
  await expect(page.locator('[id="2025-08-23-oma"] .media-placeholder')).toBeVisible();
});

test('events.html#<id> scrolls to that card', async ({ page }) => {
  await mockEvents(page, EVENTS);
  await page.goto('events.html#2025-08-23-oma');
  await expect(page.locator('[id="2025-08-23-oma"]')).toBeInViewport();
});
