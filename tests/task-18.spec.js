// TASK-18: /admin/ layout from the approved storyboard (v3). GitHub + Events on the left, Publish + Event form
// on the right; GitHub and Publish fold; the Publish button and its hint are always visible.
const { test, expect, saveFakeToken, openFold } = require('./github-mock');

test.beforeEach(async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  page.on('dialog', (d) => d.accept());
  await page.goto('admin/index.html');
  await expect(page.locator('html')).toHaveAttribute('data-manager-ready', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-github-ready', 'true');
});

const box = async (loc) => (await loc.boundingBox());

test('two columns on desktop: GitHub over Events, Publish over Event form; one column on phones', async ({ page }, info) => {
  const gh = await box(page.locator('#gh-panel')), ev = await box(page.locator('#list-title'));
  const pub = await box(page.locator('#publish-panel')), form = await box(page.locator('#form-title'));
  expect(ev.y).toBeGreaterThan(gh.y);       // Events below GitHub
  if (info.project.name === 'desktop') {
    expect(form.y).toBeGreaterThan(pub.y);  // Event form below Publish (desktop only; phones: Publish is last)
    expect(pub.x).toBeGreaterThan(gh.x + gh.width - 1); // Publish column is to the right
    expect(Math.abs(gh.y - pub.y)).toBeLessThan(4);     // both columns start at the same height
  } else {
    expect(Math.abs(pub.x - gh.x)).toBeLessThan(4);     // stacked
    expect(form.y).toBeGreaterThan(ev.y);               // TASK-23: one column: GitHub, Events, Event form ...
    expect(pub.y).toBeGreaterThan(form.y);              // ... then Publish
  }
});

test('GitHub folds: collapsed on load with chip "Not connected" (no token); chip follows the state; toggles by title or arrow', async ({ page }) => {
  const btn = page.locator('#gh-panel .fold-btn');
  await expect(page.locator('#gh-title')).toHaveText('GitHub');
  await expect(page.locator('#gh-chip')).toHaveText('Not connected');
  await expect(btn).toHaveAttribute('aria-expanded', 'false'); // TASK-23: collapsed on every load
  await expect(page.locator('#gh-token')).toBeHidden();
  await btn.click();
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#gh-token')).toBeVisible();
  await btn.click();
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#gh-token')).toBeHidden();
  await page.locator('#gh-title').click();
  await expect(page.locator('#gh-token')).toBeVisible();
  await saveFakeToken(page);
  await expect(page.locator('#gh-chip')).toHaveText('Token saved');
});

test('Publish folds, but the button and its hint stay visible; chip counts pending changes; Save does not open it, a click does', async ({ page, github }) => {
  const btn = page.locator('#publish-panel .fold-btn');
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#publish-btn')).toBeVisible();
  await expect(page.locator('#publish-hint')).toBeVisible();
  await expect(page.locator('#pub-chip')).toHaveText('Nothing pending');
  await expect(page.locator('#pub-pending')).toBeHidden();
  await openFold(page, 'form-panel'); // TASK-24: the Event form starts collapsed
  await page.fill('#f-date', '2026-03-14');
  await page.fill('#f-short', 'CF');
  await page.fill('#f-name', 'Comic Fiesta');
  await page.click('#save-event');
  await expect(page.locator('#pub-chip')).toHaveText('1 pending');
  await expect(btn).toHaveAttribute('aria-expanded', 'false'); // TASK-23: a pending change alone does not open it
  await expect(page.locator('#pub-pending')).toBeHidden();
  await openFold(page, 'pub');
  await expect(page.locator('#pub-pending')).toContainText('data/events.json');
  expect(github.calls()).toEqual([]);
});

test('no sideways scroll, and fold buttons are keyboard-operable', async ({ page }) => {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(0);
  const btn = page.locator('#publish-panel .fold-btn');
  await btn.focus();
  await page.keyboard.press('Enter');
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Space');
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
});
