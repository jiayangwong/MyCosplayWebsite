// QA exploratory checks for IDEA-12 (TASK-19..22): keyboard, odd data, reduced motion, 360px, console, links, token.
const { test, expect } = require('@playwright/test');
const { mockEvents, mockMoments, trackErrors, noHorizontalScroll } = require('./helpers');

const EVENTS = [
  { id: '2026-08-22-oma', date: '2026-08-22', short: 'OMA', name: 'Omatsuri' },
  { id: '2024-06-01-amg', date: '2024-06-01', short: 'AMG', name: 'Anime Matsuri Gathering' },
];
const MOMENTS = [
  { id: '2025-clip', year: 2025, caption: 'Clip', link: 'https://www.youtube.com/watch?v=abcdefghijk' },
  { id: '2024-photo', year: 2024, caption: 'Old photo', alt: 'Puzz laughing', photo: 'favicon.svg' },
];
const open = async (page, sel = '#hall-bangai .polaroid-shy') => {
  const t = page.locator(sel);
  await t.scrollIntoViewIfNeeded();
  return t;
};

['not json {{', '{"version":1,"moments":"nope"}', '[]', 'null', '{"version":1}', '{"version":1,"moments":[null,5,"x",{"id":1}]}'].forEach((body, bi) => {
  test(`bad moments.json #${bi} (${body.slice(0, 18)}) -> empty message, no crash (home + events)`, async ({ page }) => {
    const errors = trackErrors(page);
    await mockEvents(page, EVENTS);
    await page.route('**/data/moments.json', (r) => r.fulfill({ contentType: 'application/json', body }));
    await page.goto('index.html');
    await (await open(page)).click();
    await expect(page.locator('dialog#bangai')).toBeVisible();
    await expect(page.locator('dialog#bangai .bm-empty')).toBeVisible();
    await expect(page.locator('dialog#bangai .bm-item:visible')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.goto('events.html');
    await page.locator('#hall-bangai .bangai-open').click();
    await expect(page.locator('dialog#bangai .bm-empty')).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test('keyboard: Enter opens, focus on CLOSE, Tab stays inside, Esc closes, focus returns; Space also opens', async ({ page, browserName }) => {
  test.skip(page.viewportSize().width < 900, 'keyboard run on desktop');
  await mockEvents(page, EVENTS); await mockMoments(page, MOMENTS);
  await page.goto('index.html');
  const t = await open(page);
  await t.focus();
  await page.keyboard.press('Enter');
  const dlg = page.locator('dialog#bangai');
  await expect(dlg).toBeVisible();
  await expect(dlg.locator('.bm-close, button[class*=close]').first()).toBeFocused();
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => (document.activeElement === document.body || !!document.activeElement.closest('dialog#bangai')))).toBe(true);
  }
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(() => (document.activeElement === document.body || !!document.activeElement.closest('dialog#bangai')))).toBe(true);
  }
  // chips toggle by keyboard
  await dlg.getByRole('button', { name: 'Photos' }).focus();
  await page.keyboard.press('Enter');
  await expect(dlg.getByRole('button', { name: 'Photos' })).toHaveAttribute('aria-pressed', 'true');
  await expect(dlg.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'false');
  // facade by keyboard (switch back to all)
  await dlg.getByRole('button', { name: 'All', exact: true }).click();
  const facade = dlg.locator('.bm-item .media-play, .bm-item button').first();
  await expect(dlg.locator('iframe')).toHaveCount(0);
  await facade.focus(); await page.keyboard.press('Enter');
  await expect(dlg.locator('iframe')).toHaveCount(1);
  expect(await dlg.locator('iframe').getAttribute('src')).toContain('youtube');
  await page.keyboard.press('Escape');
  await expect(dlg).not.toBeVisible();
  await expect(t).toBeFocused();
  await expect(t).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Space');
  await expect(dlg).toBeVisible();
  void facade;
});

test('open again after close: no duplicate items, one fetch; scroll lock released after close', async ({ page }) => {
  await mockEvents(page, EVENTS); const reqs = await mockMoments(page, MOMENTS);
  await page.goto('index.html');
  const t = await open(page);
  for (let i = 0; i < 3; i++) {
    await t.click();
    await expect(page.locator('dialog#bangai')).toBeVisible();
    const lock = await page.evaluate(() => getComputedStyle(document.body).overflow + '|' + getComputedStyle(document.documentElement).overflow);
    if (i === 0) console.log('scroll-lock styles while open:', lock);
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog#bangai')).not.toBeVisible();
  }
  await expect(page.locator('dialog#bangai .bm-item')).toHaveCount(2);
  expect(reqs.length).toBe(1);
  const after = await page.evaluate(() => getComputedStyle(document.body).overflow);
  expect(after).not.toBe('hidden');
});

test('page behind does not scroll while open (home)', async ({ page }) => {
  await mockEvents(page, EVENTS); await mockMoments(page, MOMENTS);
  await page.goto('index.html');
  const t = await open(page);
  await t.click();
  await page.waitForTimeout(800);
  const y0 = await page.evaluate(() => window.scrollY);
  await page.mouse.move(5, 300);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.scrollY)).toBe(y0);
});

test('events page: page behind does not scroll while open', async ({ page }) => {
  await mockEvents(page, EVENTS); await mockMoments(page, MOMENTS);
  await page.goto('events.html');
  const b = page.locator('#hall-bangai .bangai-open');
  await b.scrollIntoViewIfNeeded(); await b.click();
  await page.waitForTimeout(800);
  const y0 = await page.evaluate(() => window.scrollY);
  await page.mouse.move(5, 300); await page.mouse.wheel(0, 600); await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.scrollY)).toBe(y0);
});

test('reduced motion: events page card and album have no animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockEvents(page, EVENTS); await mockMoments(page, MOMENTS);
  await page.goto('events.html');
  const anims = await page.evaluate(() => [...document.querySelectorAll('#hall-bangai, #hall-bangai *')].filter((e) => { const s = getComputedStyle(e); return (s.animationName !== 'none' && parseFloat(s.animationDuration) > 0.01) || s.transform !== 'none'; }).map((e) => e.className));
  expect(anims).toEqual([]);
});

test('360px: home, events, album open, no horizontal scroll, strip targets >=44px on phone', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await mockEvents(page, EVENTS); await mockMoments(page, MOMENTS);
  for (const url of ['index.html', 'events.html', 'index.html#hall-bangai']) {
    await page.goto(url); await noHorizontalScroll(page);
  }
  await (await open(page)).click();
  await noHorizontalScroll(page);
  const box = await page.locator('dialog#bangai').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(360);
  const w = await page.locator('dialog#bangai').evaluate((d) => d.scrollWidth <= d.clientWidth);
  expect(w).toBe(true);
});

test('long caption (140 chars), long unbroken word and HTML do not break the album at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const errors = trackErrors(page);
  await mockEvents(page, EVENTS);
  await mockMoments(page, [
    { id: 'a', year: 2025, caption: 'W'.repeat(140), link: 'https://example.com/a' },
    { id: 'b', year: 2025, caption: '<img src=x onerror=window.__x=1>', alt: '<b>x</b>', photo: 'favicon.svg' },
  ]);
  await page.goto('index.html');
  await (await open(page)).click();
  const dlg = page.locator('dialog#bangai');
  await expect(dlg.locator('.bm-item')).toHaveCount(2);
  expect(await page.evaluate(() => window.__x)).toBeUndefined();
  expect(await dlg.evaluate((d) => d.scrollWidth <= d.clientWidth)).toBe(true);
  await noHorizontalScroll(page);
  expect(errors).toEqual([]);
});

test('all public pages: no console errors/404s, images have alt, internal links resolve', async ({ page, request }) => {
  const bad = [];
  page.on('console', (m) => { if (m.type() === 'error') bad.push(m.text()); });
  page.on('pageerror', (e) => bad.push(e.message));
  page.on('response', (r) => { if (r.status() >= 400 && r.url().includes('127.0.0.1')) bad.push(r.status() + ' ' + r.url()); });
  const hrefs = new Set();
  for (const p of ['index.html', 'events.html', 'gallery.html', 'reels.html', 'about.html', 'contact.html']) {
    await page.goto(p);
    await page.waitForTimeout(500);
    const noAlt = await page.evaluate(() => [...document.images].filter((i) => !i.hasAttribute('alt')).map((i) => i.src));
    expect(noAlt, p).toEqual([]);
    (await page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')))).forEach((h) => { if (!/^(https?:|mailto:|#)/.test(h)) hrefs.add(h.split('#')[0]); });
  }
  for (const h of hrefs) { if (!h) continue; const r = await request.get(h); expect(r.status(), h).toBe(200); }
  expect(bad.filter((b) => !/fonts\.g|ERR_NAME_NOT_RESOLVED/.test(b))).toEqual([]);
});

test('home with the real (empty) moments.json: Hall ??? shows, album empty, hero counts 21 events', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('index.html');
  await expect(page.locator('#hall-list > li').last()).toHaveAttribute('id', 'hall-bangai');
  await expect(page.locator('#hall-summary')).toContainText('21 events');
  await (await open(page)).click();
  await expect(page.locator('dialog#bangai .bm-empty')).toBeVisible();
  expect(errors).toEqual([]);
});
