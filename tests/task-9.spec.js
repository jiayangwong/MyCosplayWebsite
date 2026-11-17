// TASK-9: polish (meta tags, 404, basic accessibility, no third-party video requests before a click).
const { test, expect } = require('@playwright/test');
const { PAGES } = require('./helpers');

test('every public page has description, Open Graph tags, lang and a favicon', async ({ page }) => {
  for (const p of PAGES) {
    await page.goto(p);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.{20,}/);
    for (const prop of ['og:title', 'og:description', 'og:image']) {
      await expect(page.locator(`meta[property="${prop}"]`)).toHaveCount(1);
    }
    await expect(page.locator('link[rel="icon"]')).toHaveCount(1);
  }
});

test('404 page links back home', async ({ page }) => {
  await page.goto('404.html');
  await expect(page.locator('h1')).toHaveText('Lost in the hall');
  await expect(page.getByRole('link', { name: 'Back to the hall' })).toHaveAttribute('href', '/index.html');
});

test('no images without alt, no unnamed buttons, no skipped heading levels', async ({ page }) => {
  test.setTimeout(120000); // visits 8 pages; slow on the phone project
  // Google Fonts can hang on a slow connection and block 'networkidle'; fonts don't affect this check.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  for (const p of [...PAGES, 'admin/index.html']) {
    await page.goto(p);
    await page.waitForLoadState('networkidle');
    const problems = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('img').forEach((img) => { if (!img.hasAttribute('alt')) out.push(`img without alt: ${img.src}`); });
      document.querySelectorAll('button, a[href]').forEach((el) => {
        const name = (el.getAttribute('aria-label') || el.textContent || '').trim();
        if (!name) out.push(`unnamed ${el.tagName}: ${el.outerHTML.slice(0, 80)}`);
      });
      let last = 0;
      document.querySelectorAll('main h1, main h2, main h3, main h4').forEach((h) => {
        const level = Number(h.tagName[1]);
        if (last && level > last + 1) out.push(`heading jump h${last} -> h${level}: ${h.textContent.trim()}`);
        last = level;
      });
      return out;
    });
    expect(problems, p).toEqual([]);
  }
});

test('Home makes no youtube/instagram/tiktok requests before interaction', async ({ page }) => {
  const hits = [];
  page.on('request', (r) => { if (/youtube|instagram|tiktok/.test(new URL(r.url()).hostname)) hits.push(r.url()); });
  await page.goto('index.html');
  await page.waitForLoadState('networkidle');
  expect(hits).toEqual([]);
});
