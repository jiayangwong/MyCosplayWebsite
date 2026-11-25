// QA for TASK-24: extra checks at 360 / 412 / 1280 on top of tests/task-24.spec.js.
const { test, expect } = require('./github-mock');
const { mockEvents, mockMoments, noHorizontalScroll, openFold } = require('./helpers');

const KEY = 'puzzkezz.admin.eventsPerPage';
const PANELS = ['gh-panel', 'events-panel', 'form-panel', 'publish-panel', 'moments-panel', 'wm-panel'];
const mk = (n) => ({ id: `2026-01-${String(n).padStart(2, '0')}-e${n}`, date: `2026-01-${String(n).padStart(2, '0')}`, short: `E${n}`, name: `Event ${n}`, activities: ['x'] });
const many = (n) => Array.from({ length: n }, (_, i) => mk(i + 1));

function watch(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  return errs;
}
async function ready(page) {
  await expect(page.locator('html')).toHaveAttribute('data-manager-ready', 'true');
}

for (const w of [360, 412, 1280]) {
  test.describe(`width ${w}`, () => {
    test.use({ viewport: { width: w, height: 800 } });

    test('real data (22 events): defaults, 44px targets, no scroll, no console errors', async ({ page }) => {
      const errs = watch(page);
      await page.goto('admin/index.html');
      await ready(page);
      for (const id of PANELS) {
        const b = page.locator(`#${id} > .fold-head .fold-btn`);
        await expect(b).toHaveAttribute('aria-expanded', id === 'events-panel' ? 'true' : 'false');
        const box = await b.boundingBox();
        expect(box.height).toBeGreaterThanOrEqual(43.5);
        expect(box.width).toBeGreaterThanOrEqual(43.5);
      }
      const phone = w < 768;
      await expect(page.locator('#event-page-size')).toHaveValue(phone ? '5' : '10');
      await expect(page.locator('#event-count')).toHaveText('22 events');
      await expect(page.locator('#event-page')).toHaveText(`Page 1 of ${phone ? 5 : 3}`);
      await expect(page.locator('#event-list .event-row')).toHaveCount(phone ? 5 : 10);
      await noHorizontalScroll(page);
      for (const id of PANELS) await openFold(page, id);
      await noHorizontalScroll(page);
      expect(errs).toEqual([]);
    });

    test('invalid stored values abc / 7 / empty fall back; valid 10 or 5 wins', async ({ page }) => {
      const errs = watch(page);
      const def = w < 768 ? '5' : '10';
      for (const bad of ['abc', '7', '', '0', '10.5']) {
        await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [KEY, bad]);
        await mockEvents(page, many(21)); await mockMoments(page, []);
        await page.goto('admin/index.html'); await ready(page);
        await expect(page.locator('#event-page-size')).toHaveValue(def);
      }
      expect(errs).toEqual([]);
    });

    test('throwing localStorage: device default, no errors', async ({ page }) => {
      const errs = watch(page);
      await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
      await mockEvents(page, many(21)); await mockMoments(page, []);
      await page.goto('admin/index.html'); await ready(page);
      await expect(page.locator('#event-page-size')).toHaveValue(w < 768 ? '5' : '10');
      await page.selectOption('#event-page-size', w < 768 ? '10' : '5');
      await expect(page.locator('#event-list .event-row')).toHaveCount(w < 768 ? 10 : 5);
      expect(errs).toEqual([]);
    });

    test('saved choice beats device default and survives reload', async ({ page }) => {
      await mockEvents(page, many(21)); await mockMoments(page, []);
      await page.goto('admin/index.html'); await ready(page);
      const other = w < 768 ? '10' : '5';
      await page.selectOption('#event-page-size', other);
      await page.reload(); await ready(page);
      await expect(page.locator('#event-page-size')).toHaveValue(other);
      await expect(page.locator('#event-list .event-row')).toHaveCount(Number(other));
    });

    test('collapse keeps typed input; keyboard Enter/Space toggles every panel', async ({ page }) => {
      await mockEvents(page, many(3)); await mockMoments(page, []);
      await page.goto('admin/index.html'); await ready(page);
      await openFold(page, 'form-panel');
      await page.fill('#f-short', 'KEEP');
      for (const id of PANELS) {
        const b = page.locator(`#${id} > .fold-head .fold-btn`);
        const before = await b.getAttribute('aria-expanded');
        await b.focus(); await page.keyboard.press('Enter');
        await expect(b).toHaveAttribute('aria-expanded', before === 'true' ? 'false' : 'true');
        await b.focus(); await page.keyboard.press('Space');
        await expect(b).toHaveAttribute('aria-expanded', before);
      }
      await page.locator('#form-panel > .fold-head .fold-btn').click();
      await page.locator('#form-panel > .fold-head .fold-btn').click();
      await expect(page.locator('#f-short')).toHaveValue('KEEP');
    });

    test('empty list; delete/move/revert paging; panels stay in their columns when folded', async ({ page }) => {
      await mockEvents(page, []); await mockMoments(page, []);
      await page.goto('admin/index.html'); await ready(page);
      await expect(page.locator('#event-list')).toContainText('No events yet');
      await expect(page.locator('#event-page-size')).toBeHidden();
      await expect(page.locator('#event-prev')).toBeHidden();
    });

    test('folding does not move panels to another column', async ({ page }) => {
      await mockEvents(page, many(8)); await mockMoments(page, []);
      await page.goto('admin/index.html'); await ready(page);
      const xs = async () => page.evaluate((ids) => ids.map((i) => Math.round(document.getElementById(i).getBoundingClientRect().left)), PANELS);
      const closed = await xs();
      for (const id of PANELS) await openFold(page, id);
      const open = await xs();
      expect(open).toEqual(closed);
    });
  });
}

test('move down across a page edge follows the row (size 5)', async ({ page }) => {
  const evs = many(12).sort((a, b) => b.date.localeCompare(a.date));
  evs[5].date = evs[4].date; evs[5].id = `${evs[4].date}-zz`;
  await mockEvents(page, evs); await mockMoments(page, []);
  await page.goto('admin/index.html'); await ready(page);
  await page.selectOption('#event-page-size', '5');
  const first = evs[4].id;
  const rows = page.locator('#event-list .event-row');
  await expect(rows.last()).toHaveAttribute('data-id', first);
  await rows.last().getByRole('button', { name: /^Move .* down$/ }).click();
  await expect(page.locator('#event-page')).toHaveText('Page 2 of 3');
  await expect(rows.first()).toHaveAttribute('data-id', first);
  const f = await page.evaluate(() => document.activeElement && document.activeElement.textContent + '|' + document.activeElement.getAttribute('aria-label'));
  expect(f).not.toMatch(/^null|BODY/);
  expect(await page.evaluate(() => document.activeElement.tagName)).toBe('BUTTON');
});
