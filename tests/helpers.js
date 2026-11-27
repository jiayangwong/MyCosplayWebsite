// Shared test helpers.
const { expect } = require('@playwright/test');

const PAGES = ['index.html', 'gallery.html', 'reels.html', 'events.html', 'about.html', 'contact.html'];

function isPhone(page) {
  return page.viewportSize().width < 900;
}

/** Fails the test on uncaught page errors; returns the list of console errors for checks. */
function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

async function noHorizontalScroll(page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw).toBeLessThanOrEqual(cw);
}

/** Replace data/events.json for one test. */
async function mockEvents(page, events) {
  await page.route('**/data/events.json', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ version: 1, events }),
  }));
}

/** Replace data/moments.json (Hall ??? album) for one test. Returns a list that counts the requests. */
async function mockMoments(page, moments, { status = 200 } = {}) {
  const requests = [];
  await page.route('**/data/moments.json', (route) => {
    requests.push(route.request().url());
    if (status !== 200) return route.fulfill({ status, body: 'not found' });
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 1, moments }) });
  });
  return requests;
}

/**
 * The 8 placeholder SAMPLE events that were in data/events.json before the real events went in (commit 8b057d5).
 * Tests that need a fixed, known event list (counts, "Sample" tags, Omatsuri first) mock with these.
 */
const SAMPLE_EVENTS = require('./fixtures/sample-events.json').events;

/** TASK-24: opens an admin panel ('form-panel', 'moments-panel', 'wm-panel', ...) if it is collapsed. Safe to call twice. */
async function openFold(page, panelId) {
  panelId = { gh: 'gh-panel', pub: 'publish-panel' }[panelId] || panelId;
  const btn = page.locator(`#${panelId} > .fold-head .fold-btn`);
  if ((await btn.getAttribute('aria-expanded')) === 'false') await btn.click();
  await expect(page.locator(`#${await btn.getAttribute('aria-controls')}`)).toBeVisible();
}

/** TASK-36: opens the admin Backup menu (Import / Export / Discard) if it is closed. Safe to call twice.
 *  The menu closes after every Export / Import / Discard, so call it before every click on Export or Discard. */
async function openBackup(page) {
  const menu = page.locator('#backup-menu');
  if (!(await menu.evaluate((el) => el.open))) await page.locator('#backup-menu > summary').click();
  await expect(page.locator('#export-events')).toBeVisible();
}

/** TASK-24: pages the Events list until the row of event `id` is shown (starts at page 1). */
async function showEvent(page, id) {
  const row = page.locator(`.event-row[data-id="${id}"]`);
  while (!(await row.count())) {
    const prev = page.locator('#event-prev');
    if (await prev.isEnabled()) await prev.click(); else break;
  }
  for (let i = 0; i < 50 && !(await row.count()); i += 1) {
    const next = page.locator('#event-next');
    if (!(await next.isEnabled())) break;
    await next.click();
  }
  await expect(row).toHaveCount(1);
}

module.exports = { openFold, openBackup, showEvent, PAGES, isPhone, trackErrors, noHorizontalScroll, mockEvents, mockMoments, SAMPLE_EVENTS };
