// TASK-3: Home hall walk-through + guest pass + descending years-only timeline.
const { test, expect } = require('@playwright/test');
const { mockEvents } = require('./helpers');

const EVENTS = [
  { id: '2024-06-01-amg', date: '2024-06-01', short: 'AMG', name: 'Anime Matsuri Gathering' },
  { id: '2026-08-22-oma', date: '2026-08-22', short: 'OMA', name: 'Omatsuri', link: 'https://www.instagram.com/reel/ABC/' },
  { id: '2025-12-13-cf', date: '2025-12-13', short: 'CF', name: 'Comic Fiesta' },
  { id: '2025-05-31-amg', date: '2025-05-31', short: 'AMG', name: 'Anime Matsuri Gathering' },
];

test('guest pass intro', async ({ page }) => {
  await page.goto('index.html');
  const pass = page.locator('.guest-pass');
  await expect(pass.locator('h1')).toHaveText('PUZZ KEZZ');
  await expect(pass).toContainText('COSPLAYER · LOLITA · MALAYSIA');
  await expect(pass).toContainText('Not a beatboxer. Just here to cosplay.');
  await expect(pass.locator('.lace-edge')).toHaveCount(1);
  await expect(pass.getByRole('link', { name: 'Watch my reels' })).toHaveAttribute('href', '#reels');
});

test('hall is built from events.json, newest first, with year markers and hall letters', async ({ page }) => {
  await mockEvents(page, EVENTS);
  await page.goto('index.html');
  const items = page.locator('#hall-list > li');
  await expect(items).toHaveCount(7);
  const kinds = await items.evaluateAll((els) => els.map((el) => (el.dataset.kind === 'year' ? `Y${el.dataset.year}` : el.dataset.id)));
  expect(kinds).toEqual(['Y2026', '2026-08-22-oma', 'Y2025', '2025-12-13-cf', '2025-05-31-amg', 'Y2024', '2024-06-01-amg']);
  await expect(page.locator('.station .hall-sign-label')).toHaveText(['HALL A', 'HALL B', 'HALL C', 'HALL D']);
  await expect(page.locator('.station .hall-sign-name').first()).toHaveText('OMATSURI');
  await expect(page.locator('#hall-2025-12-13-cf .polaroid-photo')).toHaveAttribute('aria-label', 'Comic Fiesta 2025');
  await expect(page.locator('.hall-end')).toContainText('END OF HALL');
  await expect(page.locator('#reels')).toHaveCount(1);
});

test('near polaroids are bigger than far ones', async ({ page }) => {
  await mockEvents(page, EVENTS);
  await page.goto('index.html');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const near = await page.locator('.station.depth-near .polaroid').first().boundingBox();
  const far = await page.locator('.station.depth-far .polaroid').first().boundingBox();
  expect(near.width).toBeGreaterThan(far.width);
});

test('polaroid flips to Watch reel or See event', async ({ page }) => {
  await mockEvents(page, EVENTS);
  await page.goto('index.html');
  const withLink = page.locator('#hall-2026-08-22-oma');
  await withLink.locator('.polaroid').click();
  await expect(withLink.locator('.flip')).toHaveClass(/is-flipped/);
  const watch = withLink.getByRole('link', { name: 'Watch reel' });
  await expect(watch).toBeVisible();
  await expect(watch).toHaveAttribute('href', 'https://www.instagram.com/reel/ABC/');
  await expect(watch).toHaveAttribute('rel', 'noopener');
  await withLink.getByRole('button', { name: 'Flip back' }).click();
  await expect(withLink.locator('.flip')).not.toHaveClass(/is-flipped/);

  const noLink = page.locator('#hall-2025-12-13-cf');
  await noLink.locator('.polaroid').focus();
  await page.keyboard.press('Enter');
  await expect(noLink.getByRole('link', { name: 'See event' })).toHaveAttribute('href', /events\.html#2025-12-13-cf$/);
});

test('timeline shows years only, descending, with one tick per event', async ({ page }) => {
  await mockEvents(page, EVENTS);
  await page.goto('index.html');
  const timeline = page.locator('.timeline');
  await expect(timeline.locator('.tl-year')).toHaveText(['2026', '2025', '2024']);
  await expect(timeline.locator('.tl-tick')).toHaveCount(4);
  const tickText = await timeline.locator('.tl-tick').allInnerTexts();
  expect(tickText.join('').trim()).toBe('');
  await expect(timeline.locator('.tl-tick').first()).toHaveAttribute('aria-label', 'OMA 2026-08-22');
  const visibleText = (await timeline.locator('.timeline-track').innerText()).replace(/\s+/g, ' ').trim();
  expect(visibleText).toBe('2026 2025 2024');
});

test('timeline follows scroll and jumps on click', async ({ page }) => {
  await mockEvents(page, EVENTS);
  await page.goto('index.html');
  await page.locator('.tl-year', { hasText: '2024' }).click();
  await expect(page.locator('.tl-year', { hasText: '2024' })).toHaveClass(/is-current/, { timeout: 5000 });
  await expect(page.locator('.hall-bar')).toBeInViewport();
  await page.locator('.tl-tick').first().click();
  await expect(page.locator('.tl-tick').first()).toHaveClass(/is-current/, { timeout: 5000 });
  await expect(page.locator('.skip-reels')).toHaveAttribute('href', '#reels');
});

test('reduced motion shows a plain stacked list with all events', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockEvents(page, EVENTS);
  await page.goto('index.html');
  await expect(page.locator('.hall-wrap')).toHaveClass(/is-static/);
  await page.mouse.wheel(0, 1500);
  const transforms = await page.locator('.station-inner').evaluateAll((els) => els.map((el) => getComputedStyle(el).transform));
  for (const t of transforms) expect(t).toBe('none');
  await expect(page.locator('.station')).toHaveCount(4);
});

test('only the first two polaroid photos load eagerly', async ({ page }) => {
  await mockEvents(page, EVENTS.map((e) => ({ ...e, photo: 'favicon.svg' })));
  await page.goto('index.html');
  const loading = await page.locator('.polaroid img').evaluateAll((els) => els.map((el) => el.loading));
  expect(loading).toEqual(['eager', 'eager', 'lazy', 'lazy']);
});
