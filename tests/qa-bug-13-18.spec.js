// Regression tests for BUG-13 to BUG-18 (QA of TASK-25 to TASK-29 on v1.2.0).
// The admin tests use the strict in-memory fake GitHub from tests/github-mock.js and the fake token only.
const path = require('path');
const { test, expect, FakeRepo, openFold, saveFakeToken } = require('./github-mock');
const { PAGES, mockEvents, noHorizontalScroll, showEvent } = require('./helpers');

const SMALL = path.join(__dirname, 'fixtures', 'flat-800x600.png');
const REPO = '/repos/jiayangwong/MyCosplayWebsite';
const expectResult = expect.configure({ timeout: 15000 });
const X = '2026-03-14-cf';
const Y = '2025-08-09-omt';
const ev = (id, extra = {}) => ({ id, date: id.slice(0, 10), short: id.slice(11).toUpperCase(), name: `${id.slice(11).toUpperCase()} Test Con`, ...extra });
const webp = (tag) => Buffer.concat([Buffer.from('RIFF\x10\x00\x00\x00WEBP', 'latin1'), Buffer.from(tag)]);
const ONE = { photo: `media/events/${X}/one.webp`, photoFull: `media/events/${X}/one-full.webp` };
const ONE_FILES = { [ONE.photo]: webp(ONE.photo), [ONE.photoFull]: webp(ONE.photoFull) };
const draftEvent = (page, id) => page.evaluate(async (eid) => {
  const m = await import('/js/admin/manager.js');
  return JSON.parse(m.draftText()).events.find((e) => e.id === eid) || null;
}, id);

async function setupAdmin(page, github, { events = [ev(X), ev(Y)], repoFiles = {} } = {}) {
  const text = `${JSON.stringify({ version: 1, events }, null, 2)}\n`;
  github.repo = new FakeRepo({ files: { 'data/events.json': text, ...repoFiles } });
  await page.route('**/data/events.json', (route) => route.fulfill({ contentType: 'application/json', body: text }));
  page.on('dialog', (d) => d.accept());
  await page.goto('admin/index.html');
  for (const flag of ['manager', 'uploader', 'github', 'publish']) {
    await expectResult(page.locator('html')).toHaveAttribute(`data-${flag}-ready`, 'true');
  }
  await openFold(page, 'form-panel');
  await openFold(page, 'wm-panel');
  await saveFakeToken(page);
}

async function edit(page, id) {
  await showEvent(page, id);
  await page.locator(`.event-row[data-id="${id}"]`).getByRole('button', { name: /^Edit/ }).press('Enter');
  await expect(page.locator('#wm-event-id')).toHaveText(id);
}

async function uploadAndAttach(page, n) {
  for (let i = 0; i < n; i += 1) {
    await page.setInputFiles('#wm-files', SMALL);
    const card = page.locator('.wm-card').nth(i);
    await expectResult(card).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
    await card.getByRole('button', { name: 'Attach to selected event' }).press('Enter');
  }
}

test.describe('admin', () => {
  test.describe.configure({ timeout: 90000 });

  test('BUG-14: slot move and remove buttons are disabled while a publish runs, enabled again after', async ({ page, github }) => {
    await setupAdmin(page, github);
    await edit(page, X);
    await uploadAndAttach(page, 2);
    await expect(page.locator('#f-photo-2')).toHaveValue(/flat-800x600/);
    const btn = (name) => page.getByRole('button', { name, exact: true });
    const live = ['Move photo D1 down', 'Move photo D2 up', 'Remove photo D1', 'Remove photo D2'];
    for (const name of live) await expect(btn(name)).toBeEnabled();

    await openFold(page, 'pub');
    const hold = github.hold(`POST ${REPO}/git/blobs`);
    await page.locator('#publish-btn').press('Enter');
    await hold.arrived;
    await expect(page.locator('#pub-progress')).toBeVisible();
    for (const name of live) await expect(btn(name)).toBeDisabled();
    hold.release();
    await expect(page.locator('#pub-ok')).toBeVisible({ timeout: 15000 });
    for (const name of live) await expect(btn(name)).toBeEnabled();
    // both photos went live and the draft still holds both (nothing was taken out during the publish)
    const draft = await draftEvent(page, X);
    expect(draft.photos).toHaveLength(2);
    const committed = JSON.parse(github.repo.read('data/events.json')).events.find((e) => e.id === X);
    expect(committed.photos).toEqual(draft.photos);
  });

  test('BUG-15: a bad D2 / D3 path focuses and marks that field, not D1', async ({ page, github }) => {
    await setupAdmin(page, github, { events: [ev(X, ONE), ev(Y)], repoFiles: ONE_FILES });
    await edit(page, X);
    const err = page.locator('#err-photos');

    await page.locator('#f-photo-2').fill('/abs.webp');
    await page.locator('#save-event').click();
    await expect(page.locator('#save-status')).toContainText('Not saved');
    await expect(err).toBeVisible();
    await expect(err).toHaveText('Photo 2 display photo must be a relative path (no leading /).');
    await expect(page.locator('#f-photo-2')).toBeFocused();
    await expect(page.locator('#f-photo-2')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#f-photo-2')).toHaveAttribute('aria-describedby', /\berr-photos\b/);
    await expect(page.locator('#f-photo')).toHaveAttribute('aria-invalid', 'false');

    // D3 full-size path: its own error box, focus and mark
    await page.locator('#f-photo-2').fill(`media/events/${X}/two.webp`);
    await page.locator('#f-photo-3').fill(`media/events/${X}/three.webp`);
    await page.locator('#f-photo-full-3').fill('/three-full.webp');
    await page.locator('#save-event').click();
    await expect(page.locator('#f-photo-full-3')).toBeFocused();
    await expect(page.locator('#f-photo-full-3')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#err-photoFull3')).toHaveText('Photo 3 full-size photo must be a relative path (no leading /).');
    await expect(page.locator('#f-photo-2')).toHaveAttribute('aria-invalid', 'false');
    await expect(err).toBeHidden();

    // D1 empty, bad D2 (it would become D1 in the data): still D2 gets the focus
    await page.locator('#f-photo-3').fill('');
    await page.locator('#f-photo-full-3').fill('');
    await page.locator('#f-photo').fill('');
    await page.locator('#f-photo-full').fill('');
    await page.locator('#f-photo-2').fill('/abs.webp');
    await page.locator('#save-event').click();
    await expect(page.locator('#f-photo-2')).toBeFocused();
    await expect(page.locator('#f-photo-2')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#f-photo')).toHaveAttribute('aria-invalid', 'false');
    await expect(err).toBeVisible();
    expect(await draftEvent(page, X)).toEqual(ev(X, ONE)); // nothing saved
  });

  test('BUG-16: a D1 full-size path without a D1 display path is an error, not dropped', async ({ page, github }) => {
    await setupAdmin(page, github, { events: [ev(X, ONE), ev(Y)], repoFiles: ONE_FILES });
    await edit(page, X);
    const typed = `media/events/${X}/typed-full.webp`;
    await page.locator('#f-photo').fill('');
    await page.locator('#f-photo-full').fill(typed);
    await page.locator('#f-photo-2').fill(ONE.photo);
    await page.locator('#save-event').click();
    await expect(page.locator('#save-status')).toContainText('Not saved');
    await expect(page.locator('#err-photoFull')).toHaveText('Full-size photo D1 needs a Display photo D1 too.');
    await expect(page.locator('#f-photo-full')).toBeFocused();
    await expect(page.locator('#f-photo-full')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#f-photo-full')).toHaveValue(typed);
    expect(await draftEvent(page, X)).toEqual(ev(X, ONE));
    // D1 alone keeps the old message (validateEvent), shown once
    await page.locator('#f-photo-2').fill('');
    await page.locator('#save-event').click();
    await expect(page.locator('#err-photoFull')).toHaveText('Full-size photo needs a Display photo too.');
  });

  test('BUG-18: right after Attach the preview shows the pending photo and nothing 404s', async ({ page, github }) => {
    const bad = [];
    page.on('response', (r) => { if (r.status() >= 400 && r.url().includes('/media/events/')) bad.push(r.url()); });
    await setupAdmin(page, github);
    await edit(page, X);
    await uploadAndAttach(page, 1);
    await expect(page.locator('#f-photo')).toHaveValue(/flat-800x600/);
    const img = page.locator('#embed-preview img');
    await expect(img).toHaveCount(1);
    await expect(img).toHaveAttribute('src', /^blob:/);
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
    await expect(page.locator('#embed-preview')).not.toContainText('Preview photo (none yet)');
    expect(bad).toEqual([]);
  });
});

test('BUG-17: no horizontal scroll and the Instagram button inside the viewport from 900px to 1100px', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'PC header widths');
  for (const w of [900, 910, 920, 960, 1000, 1099, 1100]) {
    await page.setViewportSize({ width: w, height: 800 });
    for (const p of PAGES) {
      await page.goto(p);
      await expect(page.locator('.header-insta')).toBeVisible();
      await noHorizontalScroll(page);
      const right = await page.locator('.header-insta').evaluate((el) => el.getBoundingClientRect().right);
      expect(right, `${p} at ${w}px`).toBeLessThanOrEqual(w);
    }
  }
});

test.describe('hall pile', () => {
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const IMG = (id, n) => Array.from({ length: n }, (_, i) => ({ photo: `media/events/${id}/p${i + 1}.webp` }));
  const EVENTS = [
    { id: '2026-08-01-aaa', date: '2026-08-01', short: 'AAA', name: 'Alpha Fest', photos: IMG('aaa', 3) },
    { id: '2026-07-01-bbb', date: '2026-07-01', short: 'BBB', name: 'Beta Meet', photos: IMG('bbb', 2) },
    { id: '2026-06-01-ccc', date: '2026-06-01', short: 'CCC', name: 'Gamma Con', photo: 'media/events/ccc/p1.webp' },
  ];

  test('BUG-13: with reduced motion a pile stacked by hand stays stacked after scrolling away and back', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'PC pile');
    await page.route('**/media/events/**', (r) => r.fulfill({ contentType: 'image/png', body: PNG }));
    await mockEvents(page, EVENTS);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('index.html');
    const id = EVENTS[0].id;
    const t = page.locator(`#hall-${id} .pile-toggle`);
    await expect(t).toHaveAttribute('aria-expanded', 'true');
    await t.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await t.evaluate((el) => el.focus({ preventScroll: true }));
    await page.keyboard.press('Enter');
    await expect(t).toHaveAttribute('aria-expanded', 'false');
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(300);
    await expect(t).toHaveAttribute('aria-expanded', 'false');
    await t.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(300);
    await expect(t).toHaveAttribute('aria-expanded', 'false');
    // the toggle still works
    await t.evaluate((el) => el.focus({ preventScroll: true }));
    await page.keyboard.press('Enter');
    await expect(t).toHaveAttribute('aria-expanded', 'true');
  });
});
