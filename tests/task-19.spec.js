// TASK-19: Home - Hall ??? 番外 station, ??? on the timeline, album pop-up from data/moments.json.
const { test, expect } = require('@playwright/test');
const { mockEvents, mockMoments, trackErrors, noHorizontalScroll } = require('./helpers');

const EVENTS = [
  { id: '2024-06-01-amg', date: '2024-06-01', short: 'AMG', name: 'Anime Matsuri Gathering' },
  { id: '2026-08-22-oma', date: '2026-08-22', short: 'OMA', name: 'Omatsuri' },
  { id: '2025-12-13-cf', date: '2025-12-13', short: 'CF', name: 'Comic Fiesta' },
];

const MOMENTS = [
  { id: 'no-year', caption: 'No year', photo: 'favicon.svg' },
  { id: '2024-photo', year: 2024, caption: 'Old photo', alt: 'Puzz laughing', photo: 'favicon.svg' },
  { id: '2025-clip', year: 2025, caption: 'Clip', link: 'https://www.youtube.com/watch?v=abcdefghijk' },
  { id: '2025-fb', year: 2025, caption: 'FB post', photo: 'favicon.svg', link: 'https://www.facebook.com/somepost' },
];

async function openAlbum(page) {
  const trigger = page.locator('#hall-bangai .polaroid-shy');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  const dialog = page.locator('dialog#bangai');
  await expect(dialog).toBeVisible();
  return { trigger, dialog };
}

test('Hall ??? is placed after the oldest year, before END OF HALL, with no letter', async ({ page }) => {
  await mockEvents(page, EVENTS);
  await page.goto('index.html');
  const kinds = await page.locator('#hall-list > li').evaluateAll((els) => els.map((el) => el.id));
  expect(kinds).toEqual(['year-2026', 'hall-2026-08-22-oma', 'year-2025', 'hall-2025-12-13-cf', 'year-2024', 'hall-2024-06-01-amg', 'year-bangai', 'hall-bangai']);
  await expect(page.locator('#year-bangai .year-sign-num')).toHaveText('???');
  await expect(page.locator('.station .hall-sign-label')).toHaveText(['HALL A', 'HALL B', 'HALL C', 'HALL ???']);
  await expect(page.locator('#hall-summary')).toHaveText('3 events · 2026 → 2024');
  // The hall ends right after Hall ???.
  const lastIsBangai = await page.evaluate(() => document.getElementById('hall-list').lastElementChild.id === 'hall-bangai'
    && document.getElementById('hall-list').nextElementSibling.classList.contains('hall-end'));
  expect(lastIsBangai).toBe(true);
});

test('no events: "Events coming soon." and no Hall ???', async ({ page }) => {
  await mockEvents(page, []);
  await page.goto('index.html');
  await expect(page.locator('#hall-list')).toContainText('Events coming soon.');
  await expect(page.locator('#hall-bangai')).toHaveCount(0);
  await expect(page.locator('.tl-year')).toHaveCount(0);
});

test('sign, pronunciation and polaroid markup', async ({ page }) => {
  await mockEvents(page, EVENTS);
  await page.goto('index.html');
  const station = page.locator('#hall-bangai');
  const sign = station.locator('.hall-sign-special');
  await expect(sign.locator('.hall-sign-label')).toHaveText('HALL ???');
  await expect(sign.locator('[lang="ja"] ruby rt')).toHaveText('ばんがい');
  await expect(sign).toContainText('bangai · the extra one');
  const border = await sign.evaluate((el) => getComputedStyle(el).borderTopStyle);
  expect(border).toBe('dashed');

  const pron = station.locator('.pron');
  await expect(pron.locator('.pron-jp ruby rt')).toHaveText('ばんがい');
  await expect(pron.locator('.pron-romaji')).toHaveText('ban-gai');
  await expect(pron.locator('.pron-en')).toHaveText('"Extra, outside the numbering"');
  await expect(pron.getByRole('button', { name: 'Play pronunciation: ban-gai' })).toHaveCount(1);

  const trigger = station.locator('.polaroid-shy');
  await expect(trigger).toHaveJSProperty('tagName', 'BUTTON');
  await expect(trigger.locator('.kao')).toHaveText('(*/ω＼*)');
  await expect(trigger.locator('.kao')).toHaveAttribute('aria-hidden', 'true');
  await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
  await expect(trigger).toHaveAttribute('aria-controls', 'bangai');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toHaveAttribute('aria-label', /^Hall \?\?\?, bangai\. Open the special album/);
});

test('timeline: ??? is the last label with one tick; clicks scroll and highlight', async ({ page }) => {
  await mockEvents(page, EVENTS);
  await page.goto('index.html');
  const track = page.locator('.timeline-track');
  expect((await track.innerText()).replace(/\s+/g, ' ').trim()).toBe('2026 2025 2024 ???');
  const last = track.locator('button').last();
  await expect(last).toHaveClass(/tl-tick/);
  await expect(last).toHaveAttribute('aria-label', 'Hall ???, bangai');

  const q = page.locator('.tl-year', { hasText: '???' });
  const box = await q.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  await q.click();
  await expect(page.locator('#year-bangai')).toBeInViewport();
  await expect(q).toHaveClass(/is-current/, { timeout: 5000 });
  await last.click();
  await expect(page.locator('#hall-bangai')).toBeInViewport();
  await expect(last).toHaveClass(/is-current/, { timeout: 5000 });
});

test('moments.json is not fetched before the first open, and only once', async ({ page }) => {
  await mockEvents(page, EVENTS);
  const requests = await mockMoments(page, MOMENTS);
  await page.goto('index.html');
  await page.waitForLoadState('networkidle');
  expect(requests).toHaveLength(0);
  const { dialog } = await openAlbum(page);
  await expect(dialog.locator('.bm-item')).toHaveCount(4);
  await page.keyboard.press('Escape');
  await openAlbum(page);
  await page.keyboard.press('Escape');
  expect(requests).toHaveLength(1);
});

test('pop-up: polaroid does not flip, focus on CLOSE, Esc / CLOSE / backdrop close, focus returns', async ({ page }) => {
  await mockEvents(page, EVENTS);
  await mockMoments(page, MOMENTS);
  await page.goto('index.html');
  const { trigger, dialog } = await openAlbum(page);
  await expect(page.locator('#hall-bangai .flip')).not.toHaveClass(/is-flipped/);
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  expect(await dialog.evaluate((d) => d.matches(':modal'))).toBe(true);
  await expect(dialog).toHaveAttribute('aria-labelledby', 'bangai-h');
  await expect(dialog.locator('.bm-lace')).toHaveCount(1);
  await expect(dialog.locator('.eyebrow')).toHaveText('HALL ??? · ALL YEARS');
  await expect(dialog.getByRole('button', { name: 'Close the Hall ??? album' })).toBeFocused();
  // The page behind does not scroll.
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe('hidden');

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe('hidden');

  await openAlbum(page);
  await dialog.getByRole('button', { name: 'Close the Hall ??? album' }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  await openAlbum(page);
  await page.waitForTimeout(600);
  await page.mouse.click(3, 3);
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('title 番外 in the pop-up has furigana, romaji, English and a speaker', async ({ page }) => {
  await mockEvents(page, EVENTS);
  await mockMoments(page, []);
  await page.goto('index.html');
  const { dialog } = await openAlbum(page);
  const h2 = dialog.locator('#bangai-h');
  await expect(h2.locator('[lang="ja"] ruby rt')).toHaveText('ばんがい');
  await expect(dialog.locator('.bm-rom')).toHaveText('ban-gai · "extra, outside the numbering"');
  await expect(dialog.getByRole('button', { name: 'Play pronunciation: ban-gai' })).toHaveCount(1);
  // Both 番外 blocks (station + pop-up) have a speaker.
  await expect(page.getByRole('button', { name: 'Play pronunciation: ban-gai', includeHidden: true })).toHaveCount(2);
});

test('album order, captions and filters', async ({ page }) => {
  await mockEvents(page, EVENTS);
  await mockMoments(page, MOMENTS);
  await page.goto('index.html');
  const { dialog } = await openAlbum(page);
  const items = dialog.locator('.bm-item');
  await expect(items).toHaveCount(4);
  expect(await items.evaluateAll((els) => els.map((el) => el.dataset.id))).toEqual(['2025-clip', '2025-fb', '2024-photo', 'no-year']);
  await expect(dialog.locator('.bm-cap')).toHaveText(['2025 · Clip', '2025 · FB post', '2024 · Old photo', 'No year']);
  const img = dialog.locator('[data-id="2024-photo"] img');
  await expect(img).toHaveAttribute('loading', 'lazy');
  await expect(img).toHaveAttribute('alt', 'Puzz laughing');
  const ext = dialog.locator('[data-id="2025-fb"] a.media-link');
  await expect(ext).toHaveAttribute('rel', 'noopener');
  await expect(ext).toHaveAttribute('href', 'https://www.facebook.com/somepost');

  const chip = (name) => dialog.locator('.bm-chip', { hasText: name });
  await chip('Photos').click();
  await expect(chip('Photos')).toHaveAttribute('aria-pressed', 'true');
  await expect(chip('All')).toHaveAttribute('aria-pressed', 'false');
  expect(await dialog.locator('.bm-item:visible').evaluateAll((els) => els.map((el) => el.dataset.id))).toEqual(['2024-photo', 'no-year']);
  await chip('Videos & links').click();
  expect(await dialog.locator('.bm-item:visible').evaluateAll((els) => els.map((el) => el.dataset.id))).toEqual(['2025-clip', '2025-fb']);
  await expect(dialog.locator('.bm-empty')).toBeHidden();
  await chip('All').click();
  await expect(dialog.locator('.bm-item:visible')).toHaveCount(4);
});

test('a filter with nothing in it shows the empty message', async ({ page }) => {
  await mockEvents(page, EVENTS);
  await mockMoments(page, [{ id: 'only-photo', year: 2025, caption: 'Only photo', photo: 'favicon.svg' }]);
  await page.goto('index.html');
  const { dialog } = await openAlbum(page);
  await expect(dialog.locator('.bm-item')).toHaveCount(1);
  await dialog.locator('.bm-chip', { hasText: 'Videos & links' }).click();
  await expect(dialog.locator('.bm-empty')).toHaveText('Nothing here yet. (>///<) Come back later.');
  await expect(dialog.locator('.bm-empty')).toBeVisible();
});

test('bad moments are skipped with one warning each', async ({ page }) => {
  const warnings = [];
  page.on('console', (m) => { if (m.type() === 'warning' && m.text().startsWith('Skipped moment')) warnings.push(m.text()); });
  const errors = trackErrors(page);
  await mockEvents(page, EVENTS);
  await mockMoments(page, [
    { id: 'js-link', caption: 'Bad', link: 'javascript:alert(1)' },
    { id: 'abs-photo', caption: 'Bad', photo: '/abs.webp' },
    { id: 'nothing', caption: 'Bad' },
    { id: 'up-photo', caption: 'Bad', photo: '../x.webp' },
    { id: 'Bad Id', caption: 'Bad', photo: 'favicon.svg' },
    { id: 'good', year: 2025, caption: 'Good', photo: 'favicon.svg' },
    { id: 'good', year: 2024, caption: 'Same id again', photo: 'favicon.svg' },
  ]);
  await page.goto('index.html');
  const { dialog } = await openAlbum(page);
  await expect(dialog.locator('.bm-item')).toHaveCount(1);
  await expect(dialog.locator('.bm-cap')).toHaveText('2025 · Good');
  await expect(dialog.locator('a[href^="javascript"]')).toHaveCount(0);
  await expect.poll(() => warnings.length).toBe(6);
  expect(errors).toEqual([]);
});

test('empty list and a 404 both show the empty message', async ({ page }) => {
  const errors = trackErrors(page);
  await mockEvents(page, EVENTS);
  await mockMoments(page, []);
  await page.goto('index.html');
  let { dialog } = await openAlbum(page);
  await expect(dialog.locator('.bm-empty')).toBeVisible();
  await expect(dialog.locator('.bm-empty')).toHaveText('Nothing here yet. (>///<) Come back later.');

  await page.unroute('**/data/moments.json');
  await mockMoments(page, [], { status: 404 });
  await page.reload();
  ({ dialog } = await openAlbum(page));
  await expect(dialog.locator('.bm-empty')).toBeVisible();
  await expect(dialog.locator('.bm-item')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('video facade loads an iframe only after a click, no third-party request before', async ({ page }) => {
  const thirdParty = [];
  page.on('request', (r) => { if (/youtube|instagram|tiktok/.test(new URL(r.url()).hostname)) thirdParty.push(r.url()); });
  await page.route(/youtube-nocookie\.com/, (route) => route.fulfill({ contentType: 'text/html', body: '<p>video</p>' }));
  await mockEvents(page, EVENTS);
  await mockMoments(page, MOMENTS);
  await page.goto('index.html');
  const { dialog } = await openAlbum(page);
  await expect(dialog.locator('.bm-item')).toHaveCount(4);
  await expect(dialog.locator('iframe')).toHaveCount(0);
  expect(thirdParty).toEqual([]);
  await dialog.locator('[data-id="2025-clip"] .media-facade').click();
  const frame = dialog.locator('[data-id="2025-clip"] iframe');
  await expect(frame).toHaveCount(1);
  await expect(frame).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/abcdefghijk');
});

test('a double click opens the pop-up once, with no error', async ({ page }) => {
  const errors = trackErrors(page);
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  await mockEvents(page, EVENTS);
  const requests = await mockMoments(page, MOMENTS);
  await page.goto('index.html');
  const trigger = page.locator('#hall-bangai .polaroid-shy');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.dblclick();
  const dialog = page.locator('dialog#bangai');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.bm-item')).toHaveCount(4);
  await expect(page.locator('dialog#bangai')).toHaveCount(1);
  await expect(page.locator('dialog[open]')).toHaveCount(1);
  expect(requests).toHaveLength(1);
  expect(errors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('every other polaroid still flips', async ({ page }) => {
  await mockEvents(page, EVENTS);
  await mockMoments(page, []);
  await page.goto('index.html');
  const station = page.locator('#hall-2025-12-13-cf');
  await station.locator('.polaroid').click();
  await expect(station.locator('.flip')).toHaveClass(/is-flipped/);
  await expect(page.locator('dialog#bangai')).toBeHidden();
});

test('reduced motion: Hall ??? is in the stacked list with no transforms', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockEvents(page, EVENTS);
  await page.goto('index.html');
  await expect(page.locator('.hall-wrap')).toHaveClass(/is-static/);
  await page.locator('#hall-bangai').scrollIntoViewIfNeeded();
  const t = await page.locator('#hall-bangai .station-inner').evaluate((el) => getComputedStyle(el).transform);
  expect(t).toBe('none');
  const anim = await page.locator('#hall-bangai .kao').evaluate((el) => getComputedStyle(el).animationName);
  expect(anim).toBe('none');
});

test('no horizontal scroll at 360px, and the pop-up fits', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await mockEvents(page, EVENTS);
  await mockMoments(page, MOMENTS);
  await page.goto('index.html');
  await noHorizontalScroll(page);
  const { dialog } = await openAlbum(page);
  await expect(dialog.locator('.bm-item')).toHaveCount(4);
  const box = await dialog.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(360);
  const overflow = await dialog.evaluate((d) => d.scrollWidth - d.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const cols = await dialog.locator('.bm-grid').evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(' ').length);
  expect(cols).toBe(1);
});

test('album has 3 columns on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await mockEvents(page, EVENTS);
  await mockMoments(page, MOMENTS);
  await page.goto('index.html');
  const { dialog } = await openAlbum(page);
  const cols = await dialog.locator('.bm-grid').evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(' ').length);
  expect(cols).toBe(3);
});

test('album has 1 column on a narrow phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await mockEvents(page, EVENTS);
  await mockMoments(page, [
    { id: 'a', year: 2025, caption: 'A', photo: 'photos/a.jpg' },
    { id: 'b', year: 2024, caption: 'B', photo: 'photos/b.jpg' },
  ]);
  await page.goto('index.html');
  await page.locator('#hall-bangai .polaroid-shy').click();
  const cols = await page.locator('dialog#bangai .bm-grid').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(cols).toBe(1);
});
