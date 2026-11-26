// TASK-25: Hall polaroid shows the first activity under "date · short".
const { test, expect } = require('@playwright/test');
const { mockEvents, noHorizontalScroll } = require('./helpers');

const LONG = 'A very long activity text that goes on and on about cosplaying at the convention with friends and many photos taken all day long';
const WORD = 'W'.repeat(60);

function ev(i, extra) {
  return { id: `2026-0${i + 1}-10-e${i}`, date: `2026-0${9 - i}-10`, short: `E${i}`, name: `Event ${i}`, photo: '', ...extra };
}
// Indexes 0, 3 and 6 share depth "near": none / short / long.
const SEVEN = [
  ev(0, { activities: [] }), ev(1, { activities: ['x'] }), ev(2, { activities: ['y'] }),
  ev(3, { activities: ['Short one'] }), ev(4, { activities: ['z'] }), ev(5, { activities: ['q'] }),
  ev(6, { activities: [LONG, 'Second'] }),
];
const station = (page, e) => page.locator(`#hall-${e.id}`);

test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }); });

test('first activity only under the caption; back unchanged', async ({ page }) => {
  const e = ev(0, { activities: ['cosplay as Dorothy', 'Stage'] });
  await mockEvents(page, [e]);
  await page.goto('index.html');
  const s = station(page, e);
  await expect(s.locator('.polaroid-activity')).toHaveText('cosplay as Dorothy');
  await expect(s.locator('.polaroid-caption + .polaroid-activity')).toHaveCount(1);
  await expect(s.locator('.polaroid-back-meta')).toHaveText('cosplay as Dorothy · Stage');
  await expect(s.locator('.polaroid')).toHaveAccessibleName(/cosplay as Dorothy/);
  await expect(s.locator('.polaroid-activity')).toHaveAttribute('title', 'cosplay as Dorothy');
});

test('no activity element for missing, empty or blank; space still reserved', async ({ page }) => {
  const list = [ev(0, {}), ev(1, { activities: [] }), ev(2, { activities: ['   ', 'Second'] })];
  await mockEvents(page, list);
  await page.goto('index.html');
  for (const e of list) {
    await expect(station(page, e).locator('.polaroid')).toBeVisible();
    await expect(station(page, e).locator('.polaroid-activity')).toHaveCount(0);
    await expect(station(page, e).locator('.polaroid-activity-space')).toHaveCount(1);
  }
  await expect(station(page, list[2]).locator('.polaroid')).not.toContainText('Second');
  await expect(station(page, list[1]).locator('.polaroid-back-meta')).toHaveCount(0);
});

test('sample keeps SAMPLE on line 1 only; Hall ??? has no activity line; escaped text', async ({ page }) => {
  const e = ev(0, { sample: true, activities: ['<b>x</b>'] });
  await mockEvents(page, [e]);
  await page.goto('index.html');
  const s = station(page, e);
  await expect(s.locator('.polaroid-caption')).toContainText(/ · SAMPLE$/);
  await expect(s.locator('.polaroid-activity')).toHaveText('<b>x</b>');
  await expect(s.locator('.polaroid-activity b')).toHaveCount(0);
  await expect(s.locator('.polaroid-activity')).not.toContainText('SAMPLE');
  await expect(page.locator('#hall-bangai .polaroid-activity')).toHaveCount(0);
});

for (const text of [LONG, WORD]) {
  test(`long text clamps to 2 lines (${text.length} chars)`, async ({ page }) => {
    const e = ev(0, { activities: [text] });
    await mockEvents(page, [e]);
    await page.goto('index.html');
    const a = station(page, e).locator('.polaroid-activity');
    await expect(a).toHaveText(text);
    await expect(a).toHaveAttribute('title', text);
    const m = await a.evaluate((el) => {
      const cs = getComputedStyle(el);
      const p = el.closest('.polaroid').getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return { h: r.height, lh: parseFloat(cs.lineHeight), clamp: cs.webkitLineClamp, right: r.right, pr: p.right, left: r.left, pl: p.left, over: el.scrollHeight > el.clientHeight };
    });
    expect(m.clamp).toBe('2');
    expect(m.h).toBeLessThanOrEqual(m.lh * 2 + 1);
    expect(m.right).toBeLessThanOrEqual(m.pr + 0.5);
    expect(m.left).toBeGreaterThanOrEqual(m.pl - 0.5);
    if (text === LONG) expect(m.over).toBe(true);
  });
}

for (const reduced of [true, false]) {
  test(`same-depth polaroids have equal heights (reduced motion ${reduced})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await mockEvents(page, SEVEN);
    await page.goto('index.html');
    await expect(page.locator('.station')).toHaveCount(8);
    const hs = [];
    for (const i of [0, 3, 6]) hs.push(await station(page, SEVEN[i]).locator('.polaroid').evaluate((el) => el.offsetHeight));
    expect(Math.abs(hs[0] - hs[1])).toBeLessThanOrEqual(1);
    expect(Math.abs(hs[0] - hs[2])).toBeLessThanOrEqual(1);
  });
}

test('flip works with a long activity; back unchanged; no horizontal scroll', async ({ page }) => {
  await mockEvents(page, SEVEN);
  await page.goto('index.html');
  const s = station(page, SEVEN[6]);
  await s.locator('.polaroid').click();
  await expect(s.locator('.flip')).toHaveClass(/is-flipped/);
  await expect(s.locator('.polaroid-back-meta')).toHaveText(`${LONG} · Second`);
  const back = await s.locator('.polaroid-back').boundingBox();
  for (const loc of [s.getByRole('link', { name: 'See event' }), s.getByRole('button', { name: 'Flip back' })]) {
    await expect(loc).toBeVisible();
    const b = await loc.boundingBox();
    expect(b.y).toBeGreaterThanOrEqual(back.y - 1);
    expect(b.y + b.height).toBeLessThanOrEqual(back.y + back.height + 1);
  }
  await noHorizontalScroll(page);
});
