// TASK-1: site shell (tokens, fonts, header tabs, phone MENU, footer, skeleton pages).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { PAGES, isPhone, trackErrors, noHorizontalScroll } = require('./helpers');

const ROOT = path.join(__dirname, '..');

test('every public page has a unique title, one h1, fonts and no page errors', async ({ page }) => {
  const titles = new Set();
  for (const p of PAGES) {
    const errors = trackErrors(page);
    await page.goto(p);
    await expect(page.locator('.site-header')).toBeVisible();
    titles.add(await page.title());
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('link[href*="Zen+Kaku+Gothic+New"][href*="Space+Mono"][href*="display=swap"]')).toHaveCount(1);
    await expect(page.locator('.site-footer')).toContainText(`© ${new Date().getFullYear()} Puzz Kezz`);
    expect(errors).toEqual([]);
  }
  expect(titles.size).toBe(PAGES.length);
});

test('brand hex colours only appear in tokens.css', () => {
  const brand = ['#F3F1F6', '#1D1A24', '#F4A7C0', '#B9A3E3', '#5B4A8B'];
  const cssDir = path.join(ROOT, 'css');
  for (const file of fs.readdirSync(cssDir)) {
    if (file === 'tokens.css') continue;
    const text = fs.readFileSync(path.join(cssDir, file), 'utf8').toUpperCase();
    for (const hex of brand) expect(text, `${file} uses ${hex}`).not.toContain(hex);
  }
});

test('PC header shows the six tabs in order with the active tab marked', async ({ page }) => {
  test.skip(isPhone(page), 'desktop only');
  await page.goto('events.html');
  const tabs = page.locator('.tabs a');
  await expect(tabs).toHaveText(['HOME', 'GALLERY', 'REELS', 'EVENTS', 'ABOUT', 'CONTACT']);
  await expect(page.locator('.tabs a[aria-current="page"]')).toHaveText('EVENTS');
  const insta = page.locator('.header-insta');
  await expect(insta).toBeVisible();
  await expect(insta).toHaveAttribute('rel', 'noopener');
  await expect(insta).toHaveAttribute('target', '_blank');
  await expect(page.locator('.menu-button')).toBeHidden();
});

test('phone MENU opens a full-screen menu with subtitles and closes correctly', async ({ page }) => {
  test.skip(!isPhone(page), 'phone only');
  await page.goto('about.html');
  const button = page.locator('.menu-button');
  await expect(page.locator('.tabs')).toBeHidden();
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  await button.click();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  const menu = page.locator('#site-menu');
  await expect(menu).toBeVisible();
  const box = await menu.boundingBox();
  const vp = page.viewportSize();
  expect(Math.round(box.width)).toBe(vp.width);
  expect(Math.round(box.height)).toBeGreaterThanOrEqual(vp.height - 1);
  await expect(menu.locator('.menu-label')).toHaveText(['HOME', 'GALLERY', 'REELS', 'EVENTS', 'ABOUT', 'CONTACT']);
  await expect(menu.locator('.menu-sub')).toHaveText([
    'Walk the hall', 'Cosplay photos', 'さしすせそ · sa shi su se so', 'Meet me at the con', 'Who is Puzz', 'Collabs & bookings',
  ]);
  await expect(menu.locator('.menu-socials a').first()).toHaveAttribute('rel', 'noopener');

  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  await expect(button).toBeFocused();

  await button.click();
  await menu.locator('.menu-close').click();
  await expect(menu).toBeHidden();

  await button.click();
  await menu.locator('a.menu-link', { hasText: 'EVENTS' }).click();
  await expect(page).toHaveURL(/events\.html$/);
});

test('no horizontal scroll on any page', async ({ page }) => {
  test.setTimeout(120000); // 18 page loads
  for (const width of [360, 412, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    for (const p of PAGES) {
      await page.goto(p, { waitUntil: 'load' });
      await expect(page.locator('.site-footer')).toBeVisible();
      await noHorizontalScroll(page);
    }
  }
});

test('robots.txt blocks /admin/', async ({ request }) => {
  const res = await request.get('robots.txt');
  expect(await res.text()).toContain('Disallow: /admin/');
});
