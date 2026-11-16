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

module.exports = { PAGES, isPhone, trackErrors, noHorizontalScroll, mockEvents };
