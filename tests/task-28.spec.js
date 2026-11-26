// TASK-28: Hall PC (768px and wider): a neat peek pile that spreads when the station is about 60% visible.
const { test, expect } = require('@playwright/test');
const { mockEvents, noHorizontalScroll } = require('./helpers');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const IMG = (id, n) => Array.from({ length: n }, (_, i) => ({ photo: `media/events/${id}/p${i + 1}.webp` }));
const EVENTS = [
  { id: '2026-08-01-aaa', date: '2026-08-01', short: 'AAA', name: 'Alpha Fest', activities: ['cosplay as Dorothy', 'Stage'], link: 'https://example.com/r', photos: IMG('aaa', 3) },
  { id: '2026-07-01-bbb', date: '2026-07-01', short: 'BBB', name: 'Beta Meet', activities: ['Photo spot'], photos: IMG('bbb', 2) },
  { id: '2026-06-01-ccc', date: '2026-06-01', short: 'CCC', name: 'Gamma Con', sample: true, photo: 'media/events/ccc/p1.webp' },
  { id: '2026-05-01-ddd', date: '2026-05-01', short: 'DDD', name: 'Delta Day', activities: ['x'], photos: IMG('ddd', 3) },
  { id: '2026-04-01-eee', date: '2026-04-01', short: 'EEE', name: 'Eps Expo', photos: IMG('eee', 3) },
];
const st = (page, id) => page.locator(`#hall-${id}`);
const pile = (page, id) => st(page, id).locator('.pile');
const toggle = (page, id) => st(page, id).locator('.pile-toggle');

test.beforeEach(async ({ page }, info) => {
  await page.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.scrollBehavior = 'auto'; }); });
  test.skip(info.project.name !== 'desktop', 'PC pile: desktop project (phone mode is TASK-29)');
  await page.route('**/media/events/**', (r) => r.fulfill({ contentType: 'image/png', body: PNG }));
  await mockEvents(page, EVENTS);
});

async function openHall(page) {
  await page.goto('index.html');
  await page.locator('.pile').first().waitFor();
}

/** Scroll (instantly) so that about `f` of the stage is visible, entering from below or above. */
async function scrollToRatio(page, id, f, from = 'below') {
  for (let i = 0; i < 4; i += 1) {
    await page.evaluate(({ id, f, from }) => {
      const r = document.querySelector(`#hall-${id} .pile-stage`).getBoundingClientRect();
      const vh = window.innerHeight;
      const top = from === 'below' ? vh - f * r.height : f * r.height - r.height;
      window.scrollTo({ top: window.scrollY + r.top - top, behavior: 'instant' });
    }, { id, f, from });
  }
  await page.waitForTimeout(120);
}
const ratioOf = (page, id) => page.evaluate((id) => {
  const r = document.querySelector(`#hall-${id} .pile-stage`).getBoundingClientRect();
  const vis = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
  return vis / r.height;
}, id);
const farAway = (page) => page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));

test('markup: 3 polaroids in order with day labels, alt, caption and activity line; 1 photo has no pile', async ({ page }) => {
  await openHall(page);
  const s = st(page, EVENTS[0].id);
  await expect(s.locator('.pile')).toHaveCount(1);
  const pl = s.locator('.pile-stage .pl');
  await expect(pl).toHaveCount(3);
  for (let i = 0; i < 3; i += 1) {
    const p = pl.nth(i);
    await expect(p.locator('.polaroid-daylabel')).toHaveText(`D${i + 1}`);
    await expect(p.locator('.polaroid-daylabel')).toHaveAttribute('aria-hidden', 'true');
    await expect(p.locator('.polaroid-photo')).toHaveAttribute('alt', `Alpha Fest 2026, day ${i + 1}`);
    await expect(p.locator('.polaroid-caption')).toHaveText('1 Aug 2026 · AAA');
    await expect(p.locator('.polaroid-activity')).toHaveText('cosplay as Dorothy');
    await expect(p.locator('.polaroid-back-name')).toHaveText('Alpha Fest');
    await expect(p.locator('.polaroid-back .eyebrow')).toContainText(`Day ${i + 1}`);
    await expect(p.locator('.flip-close')).toHaveCount(1);
  }
  const single = st(page, EVENTS[2].id);
  await expect(single.locator('.pile')).toHaveCount(0);
  await expect(single.locator('.polaroid')).toHaveCount(1);
  await expect(single.locator('.polaroid-daylabel')).toHaveCount(0);
  await expect(page.locator('#hall-bangai .pile')).toHaveCount(0);
  // photos without an activity keep the reserved space on every polaroid
  await expect(st(page, EVENTS[4].id).locator('.polaroid-activity-space')).toHaveCount(3);
});

test('pile on load: toggle collapsed, photos inert, 14px slivers', async ({ page }) => {
  await openHall(page);
  const id = EVENTS[0].id;
  await expect(toggle(page, id)).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle(page, id)).toHaveAttribute('aria-controls', `pile-${id}`);
  await expect(toggle(page, id)).toHaveAttribute('aria-label', 'Alpha Fest 2026: 3 photos, day 1 to day 3. Show all photos');
  const inert = await pile(page, id).locator('.pl').evaluateAll((els) => els.map((e) => e.inert));
  expect(inert).toEqual([true, true, true]);
  const tops = await pile(page, id).locator('.pl .polaroid').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
  expect(Math.abs((tops[0] - tops[1]) - (tops[1] - tops[2]))).toBeLessThan(1.5);
  const dy = tops[0] - tops[1];
  // 14px sliver in the storyboard; the camera scale (page scroll) changes it a little
  expect(dy).toBeGreaterThan(10);
  expect(dy).toBeLessThan(16);
  await expect(pile(page, id).locator('.pl[data-d="1"] .polaroid')).toBeVisible();
  const rot = await pile(page, id).locator('.pl').evaluateAll((els) => els.map((e) => getComputedStyle(e).transform));
  for (const t of rot) {
    const m = /matrix\(([^)]+)\)/.exec(t);
    const [a, b] = m[1].split(',').map(Number);
    expect(Math.abs(Math.atan2(b, a) * 180 / Math.PI)).toBeLessThanOrEqual(2);
  }
});

test('scroll automation: spread at 60%, hold in between, pile below 25%, both directions', async ({ page }) => {
  await openHall(page);
  const id = EVENTS[3].id;
  const t = toggle(page, id);
  await scrollToRatio(page, id, 0.4, 'below');
  await expect(t).toHaveAttribute('aria-expanded', 'false');
  await scrollToRatio(page, id, 0.8, 'below');
  expect(await ratioOf(page, id)).toBeGreaterThan(0.6);
  await expect(t).toHaveAttribute('aria-expanded', 'true');
  await expect(t).toHaveAttribute('aria-label', /Stack the photos$/);
  const inert = await pile(page, id).locator('.pl').evaluateAll((els) => els.map((e) => e.inert));
  expect(inert).toEqual([false, false, false]);
  // between 25% and 60%: nothing changes
  await scrollToRatio(page, id, 0.4, 'below');
  await expect(t).toHaveAttribute('aria-expanded', 'true');
  await scrollToRatio(page, id, 0.1, 'below');
  await expect(t).toHaveAttribute('aria-expanded', 'false');
  // going up: enters from above
  await scrollToRatio(page, id, 0.4, 'above');
  await expect(t).toHaveAttribute('aria-expanded', 'false');
  await scrollToRatio(page, id, 0.8, 'above');
  await expect(t).toHaveAttribute('aria-expanded', 'true');
  await scrollToRatio(page, id, 0.4, 'above');
  await expect(t).toHaveAttribute('aria-expanded', 'true');
  await scrollToRatio(page, id, 0.1, 'above');
  await expect(t).toHaveAttribute('aria-expanded', 'false');
});

test('spread: photos side by side inside the page, final transforms, 650 ms with 90 ms stagger', async ({ page }) => {
  await openHall(page);
  const id = EVENTS[0].id;
  await scrollToRatio(page, id, 0.8);
  await expect(toggle(page, id)).toHaveAttribute('aria-expanded', 'true');
  const timing = await pile(page, id).locator('.pl').evaluateAll((els) => els.map((e) => {
    const c = getComputedStyle(e);
    return [c.transitionDuration, c.transitionDelay];
  }));
  expect(timing).toEqual([['0.65s', '0s'], ['0.65s', '0.09s'], ['0.65s', '0.18s']]);
  await page.waitForTimeout(1100);
  const boxes = await pile(page, id).locator('.pl .polaroid-photo').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.right]; }));
  // a loose fan like the storyboard: D1, D2, D3 left to right, each one mostly visible
  expect(boxes[0][0]).toBeLessThan(boxes[1][0]);
  expect(boxes[1][0]).toBeLessThan(boxes[2][0]);
  expect(boxes[2][0]).toBeGreaterThan(boxes[0][1] - 80);
  expect(boxes[0][0]).toBeGreaterThanOrEqual(0);
  expect(boxes[2][1]).toBeLessThanOrEqual(1280);
  // collapse is about 400 ms, all together
  await scrollToRatio(page, id, 0.05);
  await expect(toggle(page, id)).toHaveAttribute('aria-expanded', 'false');
  const back = await pile(page, id).locator('.pl').evaluateAll((els) => els.map((e) => { const c = getComputedStyle(e); return [c.transitionDuration, c.transitionDelay]; }));
  expect(back).toEqual([['0.4s', '0s'], ['0.4s', '0s'], ['0.4s', '0s']]);
});

test('no layout shift: station height and scroll position stay the same', async ({ page }) => {
  await openHall(page);
  const id = EVENTS[0].id;
  await scrollToRatio(page, id, 0.45);
  await expect(toggle(page, id)).toHaveAttribute('aria-expanded', 'false');
  const before = { h: (await st(page, id).boundingBox()).height, y: await page.evaluate(() => scrollY), sh: await page.evaluate(() => document.documentElement.scrollHeight) };
  await toggle(page, id).evaluate((el) => el.focus({ preventScroll: true }));
  await page.keyboard.press('Enter');
  await expect(toggle(page, id)).toHaveAttribute('aria-expanded', 'true');
  await page.waitForTimeout(900);
  const after = { h: (await st(page, id).boundingBox()).height, y: await page.evaluate(() => scrollY), sh: await page.evaluate(() => document.documentElement.scrollHeight) };
  expect(after).toEqual(before);
});

test('keyboard and manual toggle: Enter / Space, held until the station leaves the viewport', async ({ page }) => {
  await openHall(page);
  const id = EVENTS[0].id;
  const t = toggle(page, id);
  await scrollToRatio(page, id, 0.45);
  await t.evaluate((el) => el.focus({ preventScroll: true }));
  await page.keyboard.press('Enter');
  await expect(t).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Space');
  await expect(t).toHaveAttribute('aria-expanded', 'false');
  // piled by hand: scrolling to 80% does not spread
  await scrollToRatio(page, id, 0.8);
  await page.waitForTimeout(300);
  await expect(t).toHaveAttribute('aria-expanded', 'false');
  // leave the viewport, come back: automation is back
  await farAway(page);
  await page.waitForTimeout(200);
  await scrollToRatio(page, id, 0.8);
  await expect(t).toHaveAttribute('aria-expanded', 'true');
  // click on the pile toggles too
  await scrollToRatio(page, id, 0.1);
  await expect(t).toHaveAttribute('aria-expanded', 'false');
  await scrollToRatio(page, id, 0.45);
  await expect(t).toHaveAttribute('aria-expanded', 'false');
  await t.click();
  await expect(t).toHaveAttribute('aria-expanded', 'true');
});

test('a spread photo flips on click; piling flips it back and puts focus on the toggle', async ({ page }) => {
  await openHall(page);
  const id = EVENTS[0].id;
  await scrollToRatio(page, id, 0.8);
  await expect(toggle(page, id)).toHaveAttribute('aria-expanded', 'true');
  await page.waitForTimeout(900);
  const second = pile(page, id).locator('.pl[data-d="2"]');
  await second.locator('.polaroid').click();
  await expect(second.locator('.flip')).toHaveClass(/is-flipped/);
  await expect(second.locator('.polaroid-back .btn')).toHaveText('Watch reel');
  await expect(second.locator('.polaroid-back .btn')).toBeFocused();
  await scrollToRatio(page, id, 0.05);
  await expect(toggle(page, id)).toHaveAttribute('aria-expanded', 'false');
  await expect(second.locator('.flip')).not.toHaveClass(/is-flipped/);
  await expect(toggle(page, id)).toBeFocused();
});

test('keyboard order: photos are focusable D1, D2, D3 when spread', async ({ page }) => {
  await openHall(page);
  const id = EVENTS[0].id;
  await scrollToRatio(page, id, 0.8);
  await expect(toggle(page, id)).toHaveAttribute('aria-expanded', 'true');
  await toggle(page, id).evaluate((el) => el.focus({ preventScroll: true }));
  await page.keyboard.press('Tab');
  await expect(pile(page, id).locator('.pl[data-d="1"] .polaroid')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(pile(page, id).locator('.pl[data-d="2"] .polaroid')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(pile(page, id).locator('.pl[data-d="3"] .polaroid')).toBeFocused();
});

test('2 photos make a pile of 2; Hall ??? untouched; no horizontal scroll at 768 and 1280', async ({ page }) => {
  for (const w of [768, 1280]) {
    await page.setViewportSize({ width: w, height: 900 });
    await openHall(page);
    await expect(pile(page, EVENTS[1].id).locator('.pl')).toHaveCount(2);
    const id = EVENTS[1].id;
    await scrollToRatio(page, id, 0.8);
    await expect(toggle(page, id)).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle(page, id)).toHaveAttribute('aria-label', 'Beta Meet 2026: 2 photos, day 1 to day 2. Stack the photos');
    await page.waitForTimeout(900);
    const lid = EVENTS[0].id;
    await scrollToRatio(page, lid, 0.8);
    await expect(toggle(page, lid)).toHaveAttribute('aria-expanded', 'true');
    await page.waitForTimeout(900);
    await noHorizontalScroll(page);
    const boxes = await pile(page, lid).locator('.pl .polaroid').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.right]; }));
    expect(Math.min(...boxes.map((b) => b[0]))).toBeGreaterThanOrEqual(0);
    expect(Math.max(...boxes.map((b) => b[1]))).toBeLessThanOrEqual(w);
  }
  await expect(page.locator('#hall-bangai .pile')).toHaveCount(0);
});

test('reduced motion: spread from the start, no transition, toggle still works', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openHall(page);
  const id = EVENTS[0].id;
  await expect(toggle(page, id)).toHaveAttribute('aria-expanded', 'true');
  const dur = await pile(page, id).locator('.pl').evaluateAll((els) => els.map((e) => getComputedStyle(e).transitionDuration));
  expect(dur).toEqual(['0s', '0s', '0s']);
  await scrollToRatio(page, id, 0.05);
  await page.waitForTimeout(200);
  await expect(toggle(page, id)).toHaveAttribute('aria-expanded', 'true');
  await toggle(page, id).evaluate((el) => el.focus({ preventScroll: true }));
  await page.keyboard.press('Enter');
  await expect(toggle(page, id)).toHaveAttribute('aria-expanded', 'false');
});

test('767px is not the pile; resizing to 800px switches without a reload', async ({ page }) => {
  await page.setViewportSize({ width: 767, height: 900 });
  await openHall(page);
  const id = EVENTS[0].id;
  await expect(toggle(page, id)).toBeHidden();
  await page.setViewportSize({ width: 800, height: 900 });
  await expect(toggle(page, id)).toBeVisible();
  await expect(toggle(page, id)).toHaveAttribute('aria-expanded', 'false');
});

test('only the first two stations load the first photo eagerly; later photos are lazy', async ({ page }) => {
  await openHall(page);
  const loading = await page.locator('.station[data-kind="event"]').evaluateAll((els) => els.map((s) => [...s.querySelectorAll('img')].map((i) => i.loading)));
  expect(loading[0]).toEqual(['eager', 'lazy', 'lazy']);
  expect(loading[1]).toEqual(['eager', 'lazy']);
  expect(loading[2]).toEqual(['lazy']);
  expect(loading[3]).toEqual(['lazy', 'lazy', 'lazy']);
});
