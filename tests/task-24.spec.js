// TASK-24: every admin panel folds (only the Events list is open on load) and the Events list is paged (5 / 10).
const path = require('path');
const { test, expect, FakeRepo, saveFakeToken } = require('./github-mock');
const { stubGoogleFonts, mockEvents, mockMoments, noHorizontalScroll, openFold, openBackup, showEvent } = require('./helpers');

// BUG-24: answer only the two Google Fonts hosts so the zero-console-errors checks are not broken by them.
test.beforeEach(async ({ page }) => { await stubGoogleFonts(page); });

test.describe.configure({ timeout: 60000 });
const SMALL = path.join(__dirname, 'fixtures', 'flat-800x600.png');
const SIZE_KEY = 'puzzkezz.admin.eventsPerPage';
const PANELS = [
  ['gh-panel', 'gh-body', 'gh-chip'], ['events-panel', 'events-body', 'event-count'], ['form-panel', 'form-body', 'form-chip'],
  ['publish-panel', 'pub-body', 'pub-chip'], ['moments-panel', 'mo-body', 'mo-count'], ['wm-panel', 'wm-body', 'wm-chip'],
  ['an-panel', 'an-body', 'an-chip'], // TASK-32: Analytics, collapsed on load, the last block
];

/** n events, newest first: 2026-01-n ... Ids "2026-01-NN-eNN". */
const day = (n) => String(n).padStart(2, '0');
const mk = (n, date) => ({ id: `${date || `2026-01-${day(n)}`}-e${day(n)}`, date: date || `2026-01-${day(n)}`, short: `E${day(n)}`, name: `Event ${n}`, activities: ['x'] });
const many = (n) => Array.from({ length: n }, (_, i) => mk(i + 1));
const moments = (n) => Array.from({ length: n }, (_, i) => ({ id: `2025-m${i}`, year: 2025, caption: `Moment ${i}`, link: 'https://www.youtube.com/watch?v=abc' }));

async function load(page, events, { mo = [] } = {}) {
  page.on('dialog', (d) => d.accept());
  await mockEvents(page, events);
  await mockMoments(page, mo);
  await page.goto('admin/index.html');
  await expect(page.locator('html')).toHaveAttribute('data-manager-ready', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-moments-ready', 'true');
}
const fold = (page, id) => page.locator(`#${id} > .fold-head .fold-btn`);
const rows = (page) => page.locator('#event-list .event-row');
const pageText = (page) => expect(page.locator('#event-page'));
const size = (page) => page.evaluate(() => document.getElementById('event-page-size').value);
const isPhone = (page) => page.viewportSize().width < 768;

test.describe('folds', () => {
  test('seven fold buttons, defaults: only Events open (no token, token, draft)', async ({ page, github }) => {
    await load(page, many(21));
    const check = async () => {
      for (const [panel, body, chip] of PANELS) {
        const btn = fold(page, panel);
        await expect(btn).toHaveAttribute('aria-controls', body);
        await expect(page.locator(`#${body}`)).toHaveCount(1);
        await expect(page.locator(`#${chip}`)).toBeVisible();
        const box = await btn.boundingBox();
        expect(box.width).toBeGreaterThanOrEqual(43.5);
        expect(box.height).toBeGreaterThanOrEqual(43.5);
        const open = panel === 'events-panel';
        await expect(btn).toHaveAttribute('aria-expanded', String(open));
        await expect(page.locator(`#${body}`)).toHaveJSProperty('hidden', !open);
      }
      for (const id of ['event-form', 'moment-form', 'wm-input', 'site-photos', 'moment-photo']) {
        if (await page.locator(`#${id}`).count()) await expect(page.locator(`#${id}`)).toBeHidden();
      }
    };
    await check();
    github.repo = new FakeRepo({ files: { 'data/events.json': '{}' } });
    await saveFakeToken(page);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-manager-ready', 'true');
    await check();
    // a draft with a pending change
    await openFold(page, 'form-panel');
    await page.locator('#event-list .event-row').first().getByRole('button', { name: /^Delete/ }).click();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-manager-ready', 'true');
    await expect(page.locator('#event-count')).toHaveText('20 events');
    await check();
  });

  test('toggle by header click, button click, Enter and Space; reload resets', async ({ page }) => {
    await load(page, many(3));
    for (const [panel] of PANELS) {
      const btn = fold(page, panel);
      const start = (await btn.getAttribute('aria-expanded')) === 'true';
      await page.locator(`#${panel} > .fold-head .panel-title`).click();
      await expect(btn).toHaveAttribute('aria-expanded', String(!start));
      await btn.click();
      await expect(btn).toHaveAttribute('aria-expanded', String(start));
      await btn.focus();
      await page.keyboard.press('Enter');
      await expect(btn).toHaveAttribute('aria-expanded', String(!start));
      await page.keyboard.press('Space');
      await expect(btn).toHaveAttribute('aria-expanded', String(start));
    }
    for (const [panel] of PANELS) await openFold(page, panel);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-manager-ready', 'true');
    for (const [panel] of PANELS) await expect(fold(page, panel)).toHaveAttribute('aria-expanded', panel === 'events-panel' ? 'true' : 'false');
  });

  test('collapsing keeps input and cards; focus moves to the fold button', async ({ page }) => {
    await load(page, many(3), { mo: moments(2) });
    for (const p of ['form-panel', 'moments-panel', 'wm-panel']) await openFold(page, p);
    await page.fill('#f-short', 'KEEP');
    await page.fill('#m-caption', 'My caption');
    await page.setInputFiles('#wm-files', SMALL);
    await expect(page.locator('.wm-card')).toHaveCount(1);
    for (const p of ['form-panel', 'moments-panel', 'wm-panel']) {
      await fold(page, p).click();
      await expect(fold(page, p)).toHaveAttribute('aria-expanded', 'false');
      await fold(page, p).click();
    }
    await expect(page.locator('#f-short')).toHaveValue('KEEP');
    await expect(page.locator('#m-caption')).toHaveValue('My caption');
    await expect(page.locator('.wm-card')).toHaveCount(1);
    await page.locator('#f-short').focus();
    await fold(page, 'form-panel').click();
    await expect(fold(page, 'form-panel')).toBeFocused();
    await openFold(page, 'wm-panel');
    await page.locator('#wm-text').focus();
    await fold(page, 'wm-panel').click();
    await expect(fold(page, 'wm-panel')).toBeFocused();
  });

  test('auto-open: Edit, New event, Attach, Use for moment; load opens nothing else', async ({ page }) => {
    await load(page, many(3));
    await expect(fold(page, 'form-panel')).toHaveAttribute('aria-expanded', 'false');
    await rows(page).first().getByRole('button', { name: /^Edit/ }).click();
    await expect(fold(page, 'form-panel')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#f-date')).toBeFocused();
    await fold(page, 'form-panel').click();
    await page.click('#new-event');
    await expect(fold(page, 'form-panel')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#f-date')).toBeFocused();
    await fold(page, 'form-panel').click();
    await rows(page).first().getByRole('button', { name: /^Edit/ }).click();
    await fold(page, 'form-panel').click();
    await openFold(page, 'wm-panel');
    await page.setInputFiles('#wm-files', SMALL);
    const attach = page.getByRole('button', { name: 'Attach to selected event' });
    await expect(attach).toBeEnabled({ timeout: 30000 });
    await attach.click();
    await expect(fold(page, 'form-panel')).toHaveAttribute('aria-expanded', 'true');
    // Moments stays collapsed until "Use for moment" shows its errors
    await expect(fold(page, 'moments-panel')).toHaveAttribute('aria-expanded', 'false');
    await openFold(page, 'wm-panel');
    await openFold(page, 'moments-panel');
    await page.fill('#m-year', 'abc'); // invalid on purpose; Moments is then collapsed again by the user
    await fold(page, 'moments-panel').click();
    await expect(fold(page, 'moments-panel')).toHaveAttribute('aria-expanded', 'false');
    await page.setInputFiles('#mp-file', SMALL);
    await expect(page.locator('#mp-use')).toBeEnabled({ timeout: 30000 });
    await page.click('#mp-use');
    await expect(fold(page, 'moments-panel')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#err-m-year')).toBeVisible();
    for (const p of ['gh-panel', 'publish-panel']) await expect(fold(page, p)).toHaveAttribute('aria-expanded', 'false');
  });

  test('chips', async ({ page }) => {
    await load(page, many(21), { mo: moments(4) });
    await expect(page.locator('#event-count')).toHaveText('21 events');
    await expect(page.locator('#form-chip')).toHaveText('New');
    await expect(page.locator('#mo-count')).toHaveText('4 moments');
    await expect(page.locator('#wm-chip')).toHaveText('No photos');
    await rows(page).first().getByRole('button', { name: /^Edit/ }).click();
    await expect(page.locator('#form-chip')).toHaveText('Editing');
    await page.click('#cancel-edit');
    await expect(page.locator('#form-chip')).toHaveText('New');
    await openFold(page, 'wm-panel');
    await page.setInputFiles('#wm-files', [SMALL, SMALL]);
    await expect(page.locator('#wm-chip')).toHaveText('2 photos');
    await page.locator('.wm-x').first().click(); // not attached: goes at once
    await expect(page.locator('#wm-chip')).toHaveText('1 photo');
  });

  test('chips: 1 event, no events, 1 moment, no moments', async ({ page }) => {
    await load(page, [mk(1)], { mo: moments(1) });
    await expect(page.locator('#event-count')).toHaveText('1 event');
    await expect(page.locator('#mo-count')).toHaveText('1 moment');
    await rows(page).first().getByRole('button', { name: /^Delete/ }).click();
    await expect(page.locator('#event-count')).toHaveText('No events');
    await openFold(page, 'moments-panel');
    await page.locator('#moment-list .event-row').first().getByRole('button', { name: /^Delete/ }).click();
    await expect(page.locator('#mo-count')).toHaveText('No moments');
  });

  test('no horizontal scroll, all open and all collapsed, at 360 / 412 / 1280', async ({ page }) => {
    await load(page, many(21), { mo: moments(7) });
    for (const w of [360, 412, 1280]) {
      await page.setViewportSize({ width: w, height: 800 });
      for (const [panel] of PANELS) if ((await fold(page, panel).getAttribute('aria-expanded')) === 'false') await fold(page, panel).click();
      await noHorizontalScroll(page);
      for (const [panel] of PANELS) await fold(page, panel).click();
      await noHorizontalScroll(page);
      await fold(page, 'events-panel').click(); // back to the default for the next width
    }
  });
});

test.describe('paging', () => {
  test('device default size and 21 events', async ({ page }) => {
    await load(page, many(21));
    const phone = isPhone(page);
    await expect(page.locator('#event-page-size')).toHaveValue(phone ? '5' : '10');
    await expect(rows(page)).toHaveCount(phone ? 5 : 10);
    await expect(page.locator('#event-page-size option')).toHaveText(['5', '10']);
    const sel = await page.locator('#event-page-size').boundingBox();
    expect(sel.height).toBeGreaterThanOrEqual(43.5);
    await expect(page.locator('#event-page')).toHaveText(`Page 1 of ${phone ? 5 : 3}`);
    await expect(page.locator('#event-prev')).toBeDisabled();
    for (const b of ['#event-prev', '#event-next']) {
      const box = await page.locator(b).boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(43.5);
      expect(box.height).toBeGreaterThanOrEqual(43.5);
    }
    await expect(page.locator('#event-count')).toHaveText('21 events');
  });

  test('size choice is saved, kept after reload; both sizes page correctly', async ({ page }) => {
    await load(page, many(21));
    await page.selectOption('#event-page-size', '5');
    await expect(rows(page)).toHaveCount(5);
    await expect(page.locator('#event-page')).toHaveText('Page 1 of 5');
    expect(await page.evaluate((k) => localStorage.getItem(k), SIZE_KEY)).toBe('5');
    for (let i = 0; i < 4; i += 1) await page.click('#event-next');
    await expect(rows(page)).toHaveCount(1);
    await expect(page.locator('#event-next')).toBeDisabled();
    await page.selectOption('#event-page-size', '10');
    expect(await page.evaluate((k) => localStorage.getItem(k), SIZE_KEY)).toBe('10');
    await expect(page.locator('#event-page')).toHaveText('Page 3 of 3');
    await expect(rows(page)).toHaveCount(1);
    await page.click('#event-prev');
    await page.click('#event-prev');
    await expect(rows(page)).toHaveCount(10);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-manager-ready', 'true');
    await expect(page.locator('#event-page-size')).toHaveValue('10');
    await expect(rows(page)).toHaveCount(10);
  });

  test('invalid stored value and throwing localStorage fall back to the device default', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript((k) => { try { localStorage.setItem(k, '7'); } catch { /* */ } }, SIZE_KEY);
    await load(page, many(21));
    const def = isPhone(page) ? '5' : '10';
    await expect(page.locator('#event-page-size')).toHaveValue(def);
    expect(errors).toEqual([]);
  });

  test('a localStorage that throws does not break the page', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      const boom = () => { throw new Error('storage blocked'); };
      Object.defineProperty(window, 'localStorage', { get: boom });
    });
    await mockEvents(page, many(21));
    await mockMoments(page, []);
    await page.goto('admin/index.html');
    await expect(page.locator('html')).toHaveAttribute('data-manager-ready', 'true');
    await expect(page.locator('#event-page-size')).toHaveValue('10');
    await expect(rows(page)).toHaveCount(10);
    await page.selectOption('#event-page-size', '5');
    await expect(rows(page)).toHaveCount(5);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('pager buttons, text, keyboard order', async ({ page }) => {
    await load(page, many(21));
    await page.selectOption('#event-page-size', '10');
    await expect(page.locator('#event-page')).toHaveText('Page 1 of 3');
    await page.click('#event-next');
    await page.click('#event-next');
    await expect(page.locator('#event-page')).toHaveText('Page 3 of 3');
    await expect(rows(page)).toHaveCount(1);
    await expect(page.locator('#event-next')).toBeDisabled();
    await page.click('#event-prev');
    await expect(page.locator('#event-page')).toHaveText('Page 2 of 3');
    await page.click('#event-prev');
    await page.locator('#event-page-size').focus();
    await page.keyboard.press('Tab');
    await expect(rows(page).first().getByRole('button', { name: /^Edit/ })).toBeFocused();
    await page.locator('#event-list .event-row').last().getByRole('button', { name: /^Delete/ }).focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('#event-prev')).toBeDisabled(); // skipped
    await expect(page.locator('#event-next')).toBeFocused();
  });

  test('10 events at size 10: one page, both disabled', async ({ page }) => {
    await load(page, many(10));
    await page.selectOption('#event-page-size', '10');
    await expect(page.locator('#event-page')).toHaveText('Page 1 of 1');
    await expect(page.locator('#event-prev')).toBeDisabled();
    await expect(page.locator('#event-next')).toBeDisabled();
  });

  test('0 events: message, no select, no pager', async ({ page }) => {
    await load(page, []);
    await expect(page.locator('#event-list')).toContainText('No events yet. Use "New event".');
    await expect(page.locator('#event-page-size')).toBeHidden();
    await expect(page.locator('nav[aria-label="Events pages"]')).toBeHidden();
    await expect(page.locator('#event-count')).toHaveText('No events');
  });

  test('add shows the page of the new event; delete last row goes back; edit date moves', async ({ page }) => {
    await load(page, many(21));
    await page.selectOption('#event-page-size', '5');
    await page.click('#new-event');
    await page.fill('#f-date', '2026-01-02'); // sorts near the end
    await page.fill('#f-short', 'NEW');
    await page.fill('#f-name', 'New one');
    await page.locator('#activity-list input').first().fill('a');
    await page.click('#save-event');
    await expect(page.locator('#event-page')).toHaveText('Page 5 of 5');
    await expect(page.locator('.event-row.is-editing')).toHaveCount(1);
    // edit that moves it to the front
    await page.fill('#f-date', '2026-02-01');
    await page.click('#save-event');
    await expect(page.locator('#event-page')).toHaveText('Page 1 of 5');
    await expect(rows(page).first()).toHaveClass(/is-editing/);
    // delete the only row of the last page (22 events -> 5 pages of 5, last has 2) -> delete two
    await page.click('#event-next');
    await page.click('#event-next');
    await page.click('#event-next');
    await page.click('#event-next');
    await expect(page.locator('#event-page')).toHaveText('Page 5 of 5');
    await rows(page).last().getByRole('button', { name: /^Delete/ }).click();
    await expect(page.locator('#event-page')).toHaveText('Page 5 of 5');
    await rows(page).last().getByRole('button', { name: /^Delete/ }).click();
    await expect(page.locator('#event-page')).toHaveText('Page 4 of 4');
    await page.click('#event-prev');
    await rows(page).first().getByRole('button', { name: /^Delete/ }).click(); // elsewhere: same page
    await expect(page.locator('#event-page')).toHaveText('Page 3 of 4');
  });

  test('move across a page edge follows the row and keeps focus', async ({ page }) => {
    // 12 events; events 6 and 7 (positions) share a date so they can swap across the page-1/2 edge at size 5.
    const evs = many(12);
    const sorted = evs.slice().sort((a, b) => b.date.localeCompare(a.date));
    sorted[5].date = sorted[4].date;
    sorted[5].id = `${sorted[4].date}-zz`;
    await load(page, sorted);
    await page.selectOption('#event-page-size', '5');
    const second = sorted[5].id;
    await page.click('#event-next');
    await expect(rows(page).first()).toHaveAttribute('data-id', second);
    await rows(page).first().getByRole('button', { name: /^Move .* up$/ }).click();
    await expect(page.locator('#event-page')).toHaveText('Page 1 of 3');
    await expect(rows(page).last()).toHaveAttribute('data-id', second);
    // the row is now the first of its date, so "up" is disabled and focus goes to its Edit button
    await expect(rows(page).last().getByRole('button', { name: /^Edit/ })).toBeFocused();
    await rows(page).last().getByRole('button', { name: /^Move .* down$/ }).click();
    await expect(page.locator('#event-page')).toHaveText('Page 2 of 3');
    await expect(rows(page).first()).toHaveAttribute('data-id', second);
  });

  test('size change keeps the first event of the old page; Import and Discard go to page 1', async ({ page }) => {
    await load(page, many(21));
    await page.selectOption('#event-page-size', '5');
    await page.click('#event-next');
    await page.click('#event-next');
    const firstId = await rows(page).first().getAttribute('data-id');
    await page.selectOption('#event-page-size', '10');
    await expect(page.locator('#event-page')).toHaveText('Page 2 of 3');
    await expect(page.locator(`.event-row[data-id="${firstId}"]`)).toHaveCount(1);
    await page.setInputFiles('#import-file', { name: 'e.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, events: many(25) })) });
    await expect(page.locator('#event-count')).toHaveText('25 events');
    await expect(page.locator('#event-page')).toHaveText('Page 1 of 3');
    await page.click('#event-next');
    await openBackup(page);
    await page.click('#discard-draft');
    await expect(page.locator('#event-count')).toHaveText('21 events');
    await expect(page.locator('#event-page')).toHaveText('Page 1 of 3');
    await expect(page.locator('#event-page-size')).toHaveValue('10');
  });

  test('attach photo stays on the current page', async ({ page }) => {
    await load(page, many(21));
    await page.selectOption('#event-page-size', '5');
    await page.click('#event-next');
    await page.click('#event-next');
    await rows(page).first().getByRole('button', { name: /^Edit/ }).click();
    await expect(page.locator('#event-page')).toHaveText('Page 3 of 5');
    await openFold(page, 'wm-panel');
    await page.setInputFiles('#wm-files', SMALL);
    const attach = page.getByRole('button', { name: 'Attach to selected event' });
    await expect(attach).toBeEnabled({ timeout: 30000 });
    await attach.click();
    await expect(page.locator('#event-page')).toHaveText('Page 3 of 5');
  });

  test('paging is display only: Export text is the same on every page', async ({ page }) => {
    await load(page, many(21));
    const exportText = async () => {
      await openBackup(page);
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export-events')]);
      return require('fs').readFileSync(await dl.path(), 'utf8');
    };
    const before = await exportText();
    await page.selectOption('#event-page-size', '5');
    await page.click('#event-next');
    await page.click('#event-next');
    expect(await exportText()).toBe(before);
    expect(JSON.parse(before).events).toHaveLength(21);
  });

  test('showEvent helper finds a row on a later page', async ({ page }) => {
    const evs = many(21);
    await load(page, evs);
    await showEvent(page, evs[0].id);
    await showEvent(page, evs[20].id);
  });

  test('moments: 7 moments, chip while collapsed, 7 rows, no pager', async ({ page }) => {
    await load(page, many(3), { mo: moments(7) });
    await expect(page.locator('#mo-count')).toHaveText('7 moments');
    await openFold(page, 'moments-panel');
    await expect(page.locator('#moment-list .event-row')).toHaveCount(7);
    await expect(page.locator('#moments-panel nav')).toHaveCount(0);
  });
});
