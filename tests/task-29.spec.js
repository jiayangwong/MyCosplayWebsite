// TASK-29: Hall phone (under 768px): one polaroid, story tabs D1 D2 D3 that fill and flip by themselves for two rounds.
const { test, expect } = require('@playwright/test');
const { mockEvents, noHorizontalScroll } = require('./helpers');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const IMG = (id, n) => Array.from({ length: n }, (_, i) => ({ photo: `media/events/${id}/p${i + 1}.webp` }));
const EVENTS = [
  { id: '2026-08-01-aaa', date: '2026-08-01', short: 'AAA', name: 'Alpha Fest', activities: ['cosplay as Dorothy'], link: 'https://example.com/r', photos: IMG('aaa', 3) },
  { id: '2026-07-01-bbb', date: '2026-07-01', short: 'BBB', name: 'Beta Meet', activities: ['Photo spot'], photos: IMG('bbb', 2) },
  { id: '2026-06-01-ccc', date: '2026-06-01', short: 'CCC', name: 'Gamma Con', activities: ['Photo spot'], photo: 'media/events/ccc/p1.webp' },
  { id: '2026-05-01-ddd', date: '2026-05-01', short: 'DDD', name: 'Delta Day', activities: ['Photo spot'], photos: IMG('ddd', 3) },
  { id: '2026-04-01-eee', date: '2026-04-01', short: 'EEE', name: 'Eps Expo', activities: ['Photo spot'], photo: 'media/events/eee/p1.webp' },
  { id: '2026-03-01-fff', date: '2026-03-01', short: 'FFF', name: 'Fox Fair', photos: IMG('fff', 3) },
];
const T = EVENTS[5].id; // far down the hall: out of view on load
const TWO = EVENTS[1].id;
const pile = (page, id = T) => page.locator(`#hall-${id} .pile`);
const tab = (page, d, id = T) => page.locator(`#hall-${id} .dtab`).nth(d - 1);

test.beforeEach(async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'phone story: phone project (the PC pile is TASK-28)');
  await page.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.scrollBehavior = 'auto'; }); });
  await page.route('**/media/events/**', (r) => r.fulfill({ contentType: 'image/png', body: PNG }));
});

async function pauseClock(page) {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 10000);
}

/** Fake clock that only moves with runFor, and the hall rendered. */
async function open(page, events = EVENTS) {
  await page.clock.install();
  await mockEvents(page, events);
  await page.goto('index.html');
  await page.locator('.pile').first().waitFor();
  await pauseClock(page);
}
async function scrollToRatio(page, id, f) {
  for (let i = 0; i < 4; i += 1) {
    await page.evaluate(({ id, f }) => {
      const r = document.querySelector(`#hall-${id} .pile-stage`).getBoundingClientRect();
      window.scrollTo({ top: window.scrollY + r.top - (window.innerHeight - f * r.height), behavior: 'instant' });
    }, { id, f });
  }
  await page.waitForTimeout(100);
}
const scrollAway = (page) => page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
async function view(page, id = T) {
  await scrollToRatio(page, id, 0.9);
  await expect(pile(page, id)).toHaveAttribute('data-story-state', 'playing');
}
const ms = async (page, id = T) => Number((await pile(page, id).getAttribute('data-story-ms')) || 0);
/** Advance the fake clock until the in-view play time reaches `t` ms (lands within one frame). */
async function playTo(page, t, id = T) {
  for (let i = 0; i < 6 && (await ms(page, id)) < t; i += 1) await page.clock.runFor(Math.max(16, t - (await ms(page, id))));
}
async function snap(page, id = T) {
  return page.evaluate((id) => {
    const p = document.querySelector(`#hall-${id} .pile`);
    return {
      state: p.dataset.storyState,
      round: p.dataset.storyRound,
      day: Number(p.querySelector('.pl.on').dataset.d),
      selected: [...p.querySelectorAll('.dtab')].map((t) => t.getAttribute('aria-selected')),
      fills: [...p.querySelectorAll('.dtab')].map((t) => Number(t.style.getPropertyValue('--p') || 0)),
    };
  }, id);
}
const near = (a, b, tol = 0.06) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

test('markup: tablist, 3 tabs 44px and a third wide, hidden fills, no pause button, no live region, no extra meter', async ({ page }) => {
  await open(page);
  const p = pile(page);
  await expect(p.locator('[role="tablist"]')).toHaveAttribute('aria-label', 'Fox Fair 2026: choose the day');
  const tabs = p.locator('[role="tab"]');
  await expect(tabs).toHaveCount(3);
  await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'false');
  for (let i = 0; i < 3; i += 1) {
    await expect(tabs.nth(i)).toHaveAttribute('aria-controls', `${T}-p${i + 1}`);
    await expect(p.locator('.fill').nth(i)).toHaveAttribute('aria-hidden', 'true');
    await expect(tabs.nth(i)).toHaveAccessibleName(`D${i + 1}`);
  }
  const pol = await p.locator('.pl.on .polaroid').boundingBox();
  for (let i = 0; i < 3; i += 1) {
    const b = await tabs.nth(i).boundingBox();
    expect(b.height).toBe(44);
    expect(Math.abs(b.width - pol.width / 3)).toBeLessThanOrEqual(2);
  }
  await expect(p.locator('.pl[role="tabpanel"]')).toHaveCount(3);
  await expect(p.locator('.pl.on')).toHaveAttribute('aria-labelledby', `${T}-t1`);
  await expect(p.locator('.pl:not(.on)').first()).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator(`#hall-${T} [aria-live]`)).toHaveCount(0);
  await expect(page.locator(`#hall-${T} .pile-toggle`)).toBeHidden();
  await expect(p.getByRole('button', { name: /pause|play/i })).toHaveCount(0);
  await expect(p.locator('progress, [role="progressbar"], [role="timer"]')).toHaveCount(0);
});

test('not in view: nothing moves after 3000 ms', async ({ page }) => {
  await open(page);
  await page.clock.runFor(3000);
  const s = await snap(page);
  expect(s).toMatchObject({ state: 'idle', day: 1 });
  expect(s.fills).toEqual([0, 0, 0]);
});

test('round 1: D1 fills in 1.5 s, then D2, then D3', async ({ page }) => {
  await open(page);
  await view(page);
  await playTo(page, 750);
  let s = await snap(page);
  near(s.fills[0], 0.5); expect(s.day).toBe(1);
  await playTo(page, 1500);
  s = await snap(page);
  expect(s.day).toBe(2);
  expect(s.selected).toEqual(['false', 'true', 'false']);
  near(s.fills[0], 1, 0); expect(s.fills[2]).toBe(0);
  await playTo(page, 3000);
  s = await snap(page);
  expect(s.day).toBe(3);
  expect(s.fills[0]).toBe(1); expect(s.fills[1]).toBe(1); near(s.fills[2], 0, 0.02);
});

test('round 2: at 4500 ms all tabs reset to empty and D1 is shown, then it plays again and stops on D3 at 9000 ms', async ({ page }) => {
  await open(page);
  await view(page);
  await playTo(page, 4500);
  let s = await snap(page);
  expect(s.day).toBe(1);
  expect(s.round).toBe('2');
  expect(s.selected).toEqual(['true', 'false', 'false']);
  near(s.fills[0], 0, 0.02); expect(s.fills[1]).toBe(0); expect(s.fills[2]).toBe(0);
  await playTo(page, 5250);
  s = await snap(page);
  near(s.fills[0], 0.5); expect(s.fills[1]).toBe(0);
  await playTo(page, 6000);
  s = await snap(page);
  expect(s.day).toBe(2); expect(s.fills[0]).toBe(1);
  await playTo(page, 7500);
  expect((await snap(page)).day).toBe(3);
  await playTo(page, 9000);
  s = await snap(page);
  expect(s).toMatchObject({ state: 'done', day: 3, fills: [1, 1, 1] });
  await page.clock.runFor(6000);
  expect(await snap(page)).toMatchObject({ state: 'done', day: 3, fills: [1, 1, 1] });
});

test('the reset has no flash: every frame of the round change has empty fills (no CSS transition on the fill)', async ({ page }) => {
  await open(page);
  await view(page);
  const tr = await pile(page).locator('.dtab .fill').evaluateAll((els) => els.map((e) => getComputedStyle(e).transitionDuration));
  expect(tr).toEqual(['0s', '0s', '0s']);
});

test('leaving mid-sequence pauses; coming back continues and the stop still comes after 9000 ms of in-view time', async ({ page }) => {
  await open(page);
  await view(page);
  await playTo(page, 2000);
  const at = await ms(page);
  await scrollAway(page);
  await expect(pile(page)).toHaveAttribute('data-story-state', 'paused');
  await page.clock.runFor(3000);
  expect(await ms(page)).toBe(at);
  await view(page);
  await playTo(page, 9000);
  expect(await snap(page)).toMatchObject({ state: 'done', day: 3, fills: [1, 1, 1] });
  expect(await ms(page)).toBeLessThan(9040);
});

test('pressing a tab in round 1 stops it for good on that photo', async ({ page }) => {
  await open(page);
  await view(page);
  await playTo(page, 500);
  await tab(page, 2).click();
  let s = await snap(page);
  expect(s).toMatchObject({ state: 'stopped', day: 2 });
  expect(s.selected).toEqual(['false', 'true', 'false']);
  await expect(pile(page)).toHaveClass(/stopped/);
  await expect(page.locator(`#hall-${T} .dtab .fill`).first()).toBeHidden();
  await page.clock.runFor(9000);
  expect((await snap(page)).day).toBe(2);
  await scrollAway(page);
  await scrollToRatio(page, T, 0.9);
  await page.clock.runFor(4000);
  expect(await snap(page)).toMatchObject({ state: 'stopped', day: 2 });
  await tab(page, 3).click();
  await page.clock.runFor(4000);
  expect(await snap(page)).toMatchObject({ state: 'stopped', day: 3 });
});

test('pressing a tab in round 2 stops it: no reset, no change', async ({ page }) => {
  await open(page);
  await view(page);
  await playTo(page, 6000);
  await tab(page, 1).click();
  await page.clock.runFor(9000);
  expect(await snap(page)).toMatchObject({ state: 'stopped', day: 1 });
});

test('a reload plays again from D1, after a press and after a finished run', async ({ page }) => {
  await open(page);
  await view(page);
  await tab(page, 3).click();
  await page.reload();
  await page.locator('.pile').first().waitFor();
  await pauseClock(page);
  expect((await snap(page)).state).toBe('idle');
  await view(page);
  await playTo(page, 9000);
  expect((await snap(page)).state).toBe('done');
  await page.reload();
  await page.locator('.pile').first().waitFor();
  await pauseClock(page);
  await view(page);
  await playTo(page, 1500);
  expect(await snap(page)).toMatchObject({ state: 'playing', day: 2 });
});

test('flipping the photo pauses (it does not stop); Flip back continues', async ({ page }) => {
  await open(page);
  await view(page);
  await playTo(page, 1000);
  await page.locator(`#hall-${T} .pl.on .polaroid`).click();
  await expect(page.locator(`#hall-${T} .pl.on .flip`)).toHaveClass(/is-flipped/);
  await expect(pile(page)).toHaveAttribute('data-story-state', 'paused');
  const at = await ms(page);
  await page.clock.runFor(3000);
  expect(await ms(page)).toBe(at);
  await page.locator(`#hall-${T} .pl.on .flip-close`).click();
  await expect(pile(page)).toHaveAttribute('data-story-state', 'playing');
  await playTo(page, at + 600);
  expect(await ms(page)).toBeGreaterThan(at + 500);
});

test('a hidden document pauses; visible again continues', async ({ page }) => {
  await open(page);
  await view(page);
  await playTo(page, 800);
  const hide = (hidden) => page.evaluate((hidden) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
  await hide(true);
  await expect(pile(page)).toHaveAttribute('data-story-state', 'paused');
  const at = await ms(page);
  await page.clock.runFor(2000);
  expect(await ms(page)).toBe(at);
  await hide(false);
  await expect(pile(page)).toHaveAttribute('data-story-state', 'playing');
});

test('keyboard: arrows, Home and End move focus and selection and stop the story', async ({ page }) => {
  await open(page);
  await view(page);
  await tab(page, 1).focus();
  await page.keyboard.press('ArrowRight');
  await expect(tab(page, 2)).toBeFocused();
  expect(await snap(page)).toMatchObject({ state: 'stopped', day: 2 });
  await expect(tab(page, 2)).toHaveAttribute('tabindex', '0');
  await expect(tab(page, 1)).toHaveAttribute('tabindex', '-1');
  await page.keyboard.press('End');
  await expect(tab(page, 3)).toBeFocused();
  expect((await snap(page)).day).toBe(3);
  await page.keyboard.press('ArrowLeft');
  expect((await snap(page)).day).toBe(2);
  await page.keyboard.press('Home');
  await expect(tab(page, 1)).toBeFocused();
  expect((await snap(page)).day).toBe(1);
  await page.clock.runFor(5000);
  expect((await snap(page)).day).toBe(1);
});

test('reduced motion: D1 shown, no auto-flip, tabs still switch photos', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await scrollToRatio(page, T, 0.9);
  await page.clock.runFor(9000);
  expect(await snap(page)).toMatchObject({ state: 'idle', day: 1, fills: [0, 0, 0] });
  await expect(page.locator(`#hall-${T} .dtab .fill`).first()).toBeHidden();
  await tab(page, 3).click();
  expect((await snap(page)).day).toBe(3);
  await expect(page.locator(`#hall-${T} .pl.on`)).toHaveAttribute('data-d', '3');
});

test('2 photos: two tabs (halves); D1 D2, reset at 3000 ms, D1 D2, stop on D2 with both full at 6000 ms', async ({ page }) => {
  await open(page);
  await view(page, TWO);
  await expect(page.locator(`#hall-${TWO} .dtab`)).toHaveCount(2);
  const pol = await page.locator(`#hall-${TWO} .pl.on .polaroid`).boundingBox();
  const b = await tab(page, 1, TWO).boundingBox();
  expect(Math.abs(b.width - pol.width / 2)).toBeLessThanOrEqual(2);
  await playTo(page, 1500, TWO);
  expect((await snap(page, TWO)).day).toBe(2);
  await playTo(page, 3000, TWO);
  let s = await snap(page, TWO);
  expect(s.day).toBe(1); expect(s.round).toBe('2'); near(s.fills[0], 0, 0.02); expect(s.fills[1]).toBe(0);
  await playTo(page, 6000, TWO);
  s = await snap(page, TWO);
  expect(s).toMatchObject({ state: 'done', day: 2, fills: [1, 1] });
});

test('1 photo: no tablist and no pile; no horizontal scroll at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await open(page);
  await expect(page.locator(`#hall-${EVENTS[2].id} [role="tablist"]`)).toHaveCount(0);
  await expect(page.locator(`#hall-${EVENTS[2].id} .pile`)).toHaveCount(0);
  await expect(page.locator(`#hall-${EVENTS[2].id} .polaroid`)).toHaveCount(1);
  await noHorizontalScroll(page);
  await scrollToRatio(page, T, 0.9);
  await noHorizontalScroll(page);
});

test('station height: 3 photos is the 1-photo height plus at most the tab row (same depth)', async ({ page }) => {
  const f = (i, extra) => ({ id: `2026-0${8 - i}-01-e${i}`, date: `2026-0${8 - i}-01`, short: `E${i}`, name: `Event ${i}`, activities: ['x'], ...extra });
  const list = [f(0, { photos: IMG('e0', 3) }), f(1, { photo: 'media/events/e1/p1.webp' }), f(2, { photo: 'media/events/e2/p1.webp' }), f(3, { photo: 'media/events/e3/p1.webp' })];
  await open(page, list);
  const h = (i) => page.locator(`#hall-${list[i].id}`).evaluate((el) => el.offsetHeight);
  const diff = (await h(0)) - (await h(3)); // indexes 0 and 3 share depth "near"
  expect(diff).toBeLessThanOrEqual(44 + 1); // the 44px tab row (+1px rounding)
  expect(diff).toBeGreaterThanOrEqual(44);
});

test('768px shows the PC pile instead of the tabs', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await open(page);
  await expect(page.locator(`#hall-${T} .pile-toggle`)).toBeVisible();
  await expect(page.locator(`#hall-${T} .dtabs`)).toBeHidden();
});
