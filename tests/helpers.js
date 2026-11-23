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

module.exports = { PAGES, isPhone, trackErrors, noHorizontalScroll, mockEvents, mockMoments, SAMPLE_EVENTS };
