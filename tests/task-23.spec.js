// TASK-23: admin polish. (1) X remove button on uploader cards, (2) GitHub + Publish panels collapsed on every
// load and opened by themselves only for progress / results / errors, (3) phone row layout (buttons below the
// name) in Events and Moments, (4) one-column order GitHub, Events, Event form, Publish.
// Uses the strict in-memory fake GitHub from tests/github-mock.js and the fake token only.
const fs = require('fs');
const path = require('path');
const { test, expect, FAKE_TOKEN, FakeRepo, openFold, saveFakeToken } = require('./github-mock');
const { noHorizontalScroll, mockMoments, showEvent } = require('./helpers');

const ROOT = path.join(__dirname, '..');
const SMALL = path.join(__dirname, 'fixtures', 'flat-800x600.png');
const BIG = path.join(__dirname, 'fixtures', 'flat-2400x1600.png');
const REPO = '/repos/jiayangwong/MyCosplayWebsite';
const expectResult = expect.configure({ timeout: 15000 });
test.describe.configure({ timeout: 60000 });

const X = '2026-03-14-cf';
const Z = '2024-05-01-zz';
const ev = (id, extra = {}) => ({ id, date: id.slice(0, 10), short: id.slice(11).toUpperCase(), name: `${id.slice(11).toUpperCase()} Test Con`, ...extra });
const OLD = { photo: `media/events/${X}/old.webp`, photoFull: `media/events/${X}/old-full.webp` };
const webp = (tag) => Buffer.concat([Buffer.from('RIFF\x10\x00\x00\x00WEBP', 'latin1'), Buffer.from(tag)]);
const MOMENTS = [
  { id: '2025-a', year: 2025, caption: 'First of 2025', link: 'https://www.instagram.com/reel/AAA/' },
  { id: '2024-old', year: 2024, caption: 'Old one', link: 'https://www.youtube.com/watch?v=abc' },
];

const card = (page, i) => page.locator('.wm-card').nth(i);
const xBtn = (page, i, name) => card(page, i).getByRole('button', { name: `Remove ${name}`, exact: true });
const fold = (page, which) => page.locator(which === 'gh' ? '#gh-panel .fold-btn' : '#publish-panel .fold-btn');

async function ready(page) {
  for (const flag of ['manager', 'uploader', 'github', 'publish']) {
    await expectResult(page.locator('html')).toHaveAttribute(`data-${flag}-ready`, 'true');
  }
}

async function plain(page) {
  page.on('dialog', (d) => d.accept());
  await page.goto('admin/index.html');
  await ready(page);
  await openFold(page, 'form-panel'); // TASK-24: these panels start collapsed
  await openFold(page, 'wm-panel');
  await openFold(page, 'moments-panel');
}

/** Fake repo + same events.json on the site; opens /admin/ with the fake token saved. */
async function setup(page, github, { events = [ev(X), ev('2025-08-09-omt')], files = {}, token = true } = {}) {
  const text = `${JSON.stringify({ version: 1, events }, null, 2)}\n`;
  github.repo = new FakeRepo({ files: { 'data/events.json': text, ...files } });
  await page.route('**/data/events.json', (route) => route.fulfill({ contentType: 'application/json', body: text }));
  await plain(page);
  if (token) await saveFakeToken(page);
}

async function edit(page, id) {
  await showEvent(page, id); // TASK-24: the row may be on a later page
  await page.locator(`.event-row[data-id="${id}"]`).getByRole('button', { name: /^Edit/ }).press('Enter');
  await expect(page.locator('#wm-event-id')).toHaveText(id);
}

async function attach(page, id) {
  const i = await page.locator('.wm-card').count();
  await page.setInputFiles('#wm-files', SMALL);
  await expectResult(card(page, i)).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
  await edit(page, id);
  await card(page, i).getByRole('button', { name: 'Attach to selected event' }).press('Enter');
  // TASK-27: the pair fills the next empty slot (D1 for an event without a photo, D2 after a published one).
  await expect.poll(() => page.evaluate(() => ['f-photo', 'f-photo-2', 'f-photo-3'].map((x) => document.getElementById(x).value))).toContain(`media/events/${id}/flat-800x600.webp`);
  return i;
}

const draftEvent = (page, id) => page.evaluate(async (eid) => {
  const m = await import('/js/admin/manager.js');
  return JSON.parse(m.draftText()).events.find((e) => e.id === eid);
}, id);

async function addEvent(page, short = 'PUB', name = 'Publish Test Con') {
  await page.press('#new-event', 'Enter');
  await page.fill('#f-date', '2026-12-20');
  await page.fill('#f-short', short);
  await page.fill('#f-name', name);
  await page.press('#f-name', 'Enter');
  await expectResult(page.locator('#save-status')).toContainText(`Saved ${short}`);
}

/* ---------- (1) X on uploader cards ---------- */

test.describe('X remove button', () => {
  test('every card has an X with the file name in its label; no text "Remove" button; X removes only its card', async ({ page }) => {
    await plain(page);
    await page.setInputFiles('#wm-files', [SMALL, BIG]);
    await expect(page.locator('.wm-card')).toHaveCount(2);
    // From the moment the card appears (still processing), not only when ready.
    await expect(xBtn(page, 0, 'flat-800x600.png')).toBeVisible();
    await expect(xBtn(page, 1, 'flat-2400x1600.png')).toBeVisible();
    await expect(xBtn(page, 0, 'flat-800x600.png')).toHaveJSProperty('type', 'button');
    await expect(xBtn(page, 0, 'flat-800x600.png').locator('[aria-hidden="true"]')).toHaveText('×');
    await expectResult(card(page, 1)).toHaveAttribute('data-state', 'ready', { timeout: 40000 });
    for (let i = 0; i < 2; i += 1) {
      await expect(card(page, i).locator('button', { hasText: /^Remove$/ })).toHaveCount(0);
      expect(await card(page, i).locator('button[aria-label^="Remove "]').count()).toBe(1); // one remove control per card
      const b = await xBtn(page, i, i ? 'flat-2400x1600.png' : 'flat-800x600.png').boundingBox();
      expect(b.width).toBeGreaterThanOrEqual(44);
      expect(b.height).toBeGreaterThanOrEqual(44);
      const c = await card(page, i).boundingBox();
      expect(b.x + b.width).toBeGreaterThan(c.x + c.width - 20); // top-right corner
      expect(b.y).toBeLessThan(c.y + 20);
    }
    await xBtn(page, 0, 'flat-800x600.png').click();
    await expect(page.locator('.wm-card')).toHaveCount(1);
    await expect(card(page, 0)).toContainText('flat-2400x1600.png');
    await expect(page.locator('#wm-download-all')).toBeEnabled();
    await xBtn(page, 0, 'flat-2400x1600.png').click();
    await expect(page.locator('.wm-card')).toHaveCount(0);
    await expect(page.locator('#wm-download-all')).toBeDisabled();
  });

  test('X has a visible focus style and works from the keyboard', async ({ page }) => {
    await plain(page);
    await page.setInputFiles('#wm-files', SMALL);
    await expectResult(card(page, 0)).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
    const b = xBtn(page, 0, 'flat-800x600.png');
    await page.keyboard.press('Shift'); // keyboard use, so the focus ring (:focus-visible) shows after the earlier mouse clicks
    await b.focus();
    const outline = await b.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');
    await page.keyboard.press('Enter');
    await expect(page.locator('.wm-card')).toHaveCount(0);
  });

  test('focus after X: next card, else previous card, else the file input (never body)', async ({ page }) => {
    await plain(page);
    await page.setInputFiles('#wm-files', [SMALL, SMALL, BIG]);
    await expect(page.locator('.wm-card')).toHaveCount(3);
    await expectResult(card(page, 2)).toHaveAttribute('data-state', 'ready', { timeout: 40000 });
    const focusedLabel = () => page.evaluate(() => document.activeElement.getAttribute('aria-label') || document.activeElement.id || document.activeElement.tagName);
    // Middle card: focus goes to the X of the card that took its place (the last one).
    await xBtn(page, 1, 'flat-800x600.png').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.wm-card')).toHaveCount(2);
    expect(await focusedLabel()).toBe('Remove flat-2400x1600.png');
    // Last card: focus goes to the previous card's X.
    await page.keyboard.press('Enter');
    await expect(page.locator('.wm-card')).toHaveCount(1);
    expect(await focusedLabel()).toBe('Remove flat-800x600.png');
    // No cards left: the file input.
    await page.keyboard.press('Enter');
    await expect(page.locator('.wm-card')).toHaveCount(0);
    await expect(page.locator('#wm-files')).toBeFocused();
  });

  test('focus after X + Remove in the confirm dialog on a pending card is not lost', async ({ page, github }) => {
    await setup(page, github);
    await page.setInputFiles('#wm-files', BIG);
    await expectResult(card(page, 0)).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
    const i = await attach(page, X); // second card, attached
    expect(i).toBe(1);
    await xBtn(page, 1, 'flat-800x600.png').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#wm-remove-confirm')).toBeVisible();
    await page.locator('#wm-remove-yes').click();
    await expect(page.locator('.wm-card')).toHaveCount(1);
    await expect(xBtn(page, 0, 'flat-2400x1600.png')).toBeFocused();
    // Only card left is plain; a pending card alone: remove it through the dialog -> file input.
    await xBtn(page, 0, 'flat-2400x1600.png').click();
    await expect(page.locator('.wm-card')).toHaveCount(0);
    await attach(page, X);
    await xBtn(page, 0, 'flat-800x600.png').press('Enter');
    await page.locator('#wm-remove-yes').click();
    await expect(page.locator('.wm-card')).toHaveCount(0);
    await expect(page.locator('#wm-files')).toBeFocused();
  });

  test('X on an errored card removes it; no text Remove button there', async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function (cb, ...rest) {
        if (this.width === 2400) { setTimeout(() => cb(null), 0); return; }
        original.call(this, cb, ...rest);
      };
    });
    await plain(page);
    await page.setInputFiles('#wm-files', [BIG, SMALL]);
    await expectResult(card(page, 0)).toHaveAttribute('data-state', 'error', { timeout: 30000 });
    await expect(card(page, 0).locator('button', { hasText: /^Remove$/ })).toHaveCount(0);
    await xBtn(page, 0, 'flat-2400x1600.png').click();
    await expect(page.locator('.wm-card')).toHaveCount(1);
    await expect(card(page, 0)).toContainText('flat-800x600.png');
  });

  test('suggested names are re-checked after X (-2 drops back)', async ({ page, github }) => {
    await setup(page, github, { events: [ev(X), ev('2025-08-09-omt')] });
    await edit(page, X);
    await page.setInputFiles('#wm-files', [SMALL, SMALL]);
    await expectResult(card(page, 1)).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
    await expect(card(page, 1).locator('.wm-path')).toContainText('flat-800x600-2.webp');
    await xBtn(page, 0, 'flat-800x600.png').click();
    await expect(page.locator('.wm-card')).toHaveCount(1);
    await expect(card(page, 0).locator('.wm-path')).toContainText(`media/events/${X}/flat-800x600.webp`);
    await expect(card(page, 0).locator('.wm-path')).not.toContainText('-2');
  });

  test('X on a card still processing: it never comes back and adds no pending pair; no console error', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await plain(page);
    await page.setInputFiles('#wm-files', BIG);
    await expect(card(page, 0)).toHaveAttribute('data-state', 'processing');
    await xBtn(page, 0, 'flat-2400x1600.png').click();
    await expect(page.locator('.wm-card')).toHaveCount(0);
    // A second photo goes through the same queue; once it is ready the removed one has had its turn.
    await page.setInputFiles('#wm-files', SMALL);
    await expectResult(card(page, 0)).toHaveAttribute('data-state', 'ready', { timeout: 40000 });
    await expect(page.locator('.wm-card')).toHaveCount(1);
    await expect(card(page, 0)).toContainText('flat-800x600.png');
    await expect(page.locator('#pub-chip')).toHaveText('Nothing pending');
    const left = await page.evaluate(async () => (await import('/js/admin/pending.js')).pendingPairs().length);
    expect(left).toBe(0);
    expect(errors).toEqual([]);
  });

  test('X on an attached card asks first; Cancel changes nothing; confirm = Remove from publish (the pair\'s slot goes, the published photo stays)', async ({ page, github }) => {
    await setup(page, github, { events: [ev(X, OLD), ev('2025-08-09-omt')], files: { [OLD.photo]: webp('old'), [OLD.photoFull]: webp('old-full') } });
    const i = await attach(page, X);
    const before = await draftEvent(page, X);
    expect(before.photos[1].photo).toBe(`media/events/${X}/flat-800x600.webp`); // TASK-27: D2
    await openFold(page, 'pub');
    await expect(page.locator('#pub-pending .pend-pair')).toHaveCount(1);

    await xBtn(page, i, 'flat-800x600.png').click();
    const dialog = page.locator('#wm-remove-confirm');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Remove flat-800x600.png? It is attached to CF 2026 and will be taken out of the publish.');
    await expect(page.locator('#wm-remove-no')).toBeFocused();
    await page.locator('#wm-remove-no').click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('.wm-card')).toHaveCount(1);
    await expect(page.locator('#pub-pending .pend-pair')).toHaveCount(1);
    expect(await draftEvent(page, X)).toEqual(before);
    await expect(page.locator('#f-photo-2')).toHaveValue(before.photos[1].photo);

    await xBtn(page, i, 'flat-800x600.png').click();
    await page.keyboard.press('Escape'); // Esc = Cancel
    await expect(dialog).toBeHidden();
    await expect(page.locator('.wm-card')).toHaveCount(1);

    await xBtn(page, i, 'flat-800x600.png').click();
    await page.locator('#wm-remove-yes').click();
    await expect(page.locator('.wm-card')).toHaveCount(0);
    await expect(page.locator('#pub-pending .pend-pair')).toHaveCount(0);
    expect(await draftEvent(page, X)).toMatchObject(OLD);
    await expect(page.locator('#f-photo')).toHaveValue(OLD.photo);
    await expect(page.locator('#f-photo-full')).toHaveValue(OLD.photoFull);
    await expect(page.locator('#pub-note')).toHaveText('Photo D2 removed from CF 2026 (not published yet).');
    await expect(page.locator('#f-photo-2')).toHaveValue('');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puzzkezz.events.draft')).events.find((e) => e.id === '2026-03-14-cf').photo)).toBe(OLD.photo);
    // No pending files left: the leave-page warning stops.
    expect(await page.evaluate(async () => (await import('/js/admin/pending.js')).hasUnsavedFiles())).toBe(false);
    expect(github.calls()).toEqual([]);
  });

  test('X on an attached card of a new (unpublished) event clears both photo fields', async ({ page, github }) => {
    await setup(page, github, { events: [ev(X), ev('2025-08-09-omt'), ev(Z)] });
    const i = await attach(page, Z);
    await xBtn(page, i, 'flat-800x600.png').click();
    await page.locator('#wm-remove-yes').click();
    await expect(page.locator('.wm-card')).toHaveCount(0);
    await expect(page.locator('#pub-note')).toHaveText('Photo for ZZ 2024 removed from the event (it has no published photo).');
    const z = await draftEvent(page, Z);
    expect(z.photo).toBeUndefined();
    expect(z.photoFull).toBeUndefined();
    await expect(page.locator('#f-photo')).toHaveValue('');
    await expect(page.locator('#f-photo-full')).toHaveValue('');
    expect(await page.evaluate(async () => (await import('/js/admin/pending.js')).hasUnsavedFiles())).toBe(false);
  });

  test('X on a card that was attached but is already published: removed at once, the published event is untouched', async ({ page, github }) => {
    await setup(page, github, { events: [ev(X), ev('2025-08-09-omt')] });
    const i = await attach(page, X);
    await page.locator('#publish-btn').press('Enter');
    await expectResult(page.locator('#pub-ok')).toBeVisible();
    const published = await draftEvent(page, X);
    await xBtn(page, i, 'flat-800x600.png').click();
    await expect(page.locator('#wm-remove-confirm')).toBeHidden();
    await expect(page.locator('.wm-card')).toHaveCount(0);
    expect(await draftEvent(page, X)).toEqual(published);
    expect(published.photo).toBe(`media/events/${X}/flat-800x600.webp`);
  });

  test('Site photo and Moment photo cards are unchanged (no X)', async ({ page }) => {
    await plain(page);
    await page.setInputFiles('#sp-file', SMALL);
    await expectResult(page.locator('#sp-card')).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
    await expect(page.locator('#sp-card .wm-x')).toHaveCount(0);
    await expect(page.locator('#sp-card')).not.toContainText('×');
    await expect(page.locator('#mp-card .wm-x')).toHaveCount(0);
  });
});

/* ---------- (2) collapsed panels ---------- */

test.describe('collapsed panels', () => {
  test('no token: both collapsed on load, chips show the state, Publish button and hint stay visible', async ({ page }) => {
    await plain(page);
    await expect(fold(page, 'gh')).toHaveAttribute('aria-expanded', 'false');
    await expect(fold(page, 'pub')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#gh-body')).toBeHidden();
    await expect(page.locator('#pub-body')).toBeHidden();
    await expect(page.locator('#gh-token')).toBeHidden();
    await expect(page.locator('#pub-pending')).toBeHidden();
    await expect(page.locator('#gh-chip')).toHaveText('Not connected');
    await expect(page.locator('#pub-chip')).toHaveText('Nothing pending');
    await expect(page.locator('#publish-btn')).toBeVisible();
    await expect(page.locator('#publish-hint')).toBeVisible();
  });

  test('saved token + draft with a pending change: still collapsed, also after a reload', async ({ page, github }) => {
    await setup(page, github);
    await addEvent(page);
    await expect(page.locator('#pub-chip')).toHaveText('1 pending');
    await page.reload();
    await ready(page);
    await expect(fold(page, 'gh')).toHaveAttribute('aria-expanded', 'false');
    await expect(fold(page, 'pub')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#gh-token')).toBeHidden();
    await expect(page.locator('#pub-pending')).toBeHidden();
    await expect(page.locator('#gh-chip')).toHaveText('Token saved');
    await expect(page.locator('#pub-chip')).toHaveText('1 pending');
    await expect(page.locator('#publish-btn')).toBeVisible();
    await expect(page.locator('#publish-btn')).toBeEnabled();
    // The open choice is not remembered: open both, reload, collapsed again.
    await openFold(page, 'gh');
    await openFold(page, 'pub');
    await page.reload();
    await ready(page);
    await expect(fold(page, 'gh')).toHaveAttribute('aria-expanded', 'false');
    await expect(fold(page, 'pub')).toHaveAttribute('aria-expanded', 'false');
  });

  test('toggle by the title row, the arrow button and the keyboard', async ({ page }) => {
    await plain(page);
    for (const [which, title] of [['gh', '#gh-title'], ['pub', '#pub-title']]) {
      const btn = fold(page, which);
      await page.locator(title).click();
      await expect(btn).toHaveAttribute('aria-expanded', 'true');
      await page.locator(title).click();
      await expect(btn).toHaveAttribute('aria-expanded', 'false');
      await btn.click();
      await expect(btn).toHaveAttribute('aria-expanded', 'true');
      await btn.click();
      await expect(btn).toHaveAttribute('aria-expanded', 'false');
      await btn.focus();
      await page.keyboard.press('Enter');
      await expect(btn).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('Space');
      await expect(btn).toHaveAttribute('aria-expanded', 'false');
    }
  });

  test('saving an event updates the chip but does not open Publish', async ({ page, github }) => {
    await setup(page, github);
    await addEvent(page);
    await expect(page.locator('#pub-chip')).toHaveText('1 pending');
    await expect(fold(page, 'pub')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#pub-pending')).toBeHidden();
  });

  test('a GitHub error opens GitHub by itself (Test connection refused, 401)', async ({ page, github }) => {
    await setup(page, github);
    await expect(fold(page, 'gh')).toHaveAttribute('aria-expanded', 'true'); // opened by saveFakeToken
    await fold(page, 'gh').click();
    await expect(fold(page, 'gh')).toHaveAttribute('aria-expanded', 'false');
    github.respond(`GET ${REPO}`, { status: 401 });
    await page.evaluate(() => document.getElementById('gh-test').click()); // the panel is closed: click from script
    await expectResult(page.locator('#gh-alert')).toBeVisible();
    await expect(fold(page, 'gh')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#gh-chip')).toHaveText('Error');
    await expect(fold(page, 'pub')).toHaveAttribute('aria-expanded', 'false');
    // Once open it only closes when the user closes it.
    await page.waitForTimeout(300);
    await expect(fold(page, 'gh')).toHaveAttribute('aria-expanded', 'true');
  });

  test('a classic ghp_ token is refused in the open panel and the panel stays open', async ({ page }) => {
    await plain(page);
    await openFold(page, 'gh');
    await page.fill('#gh-token', 'ghp_TESTONLY');
    await page.click('#gh-save');
    await expect(page.locator('#gh-token-error')).toBeVisible();
    await expect(fold(page, 'gh')).toHaveAttribute('aria-expanded', 'true');
  });

  test('Publish opens by itself when a publish runs and shows the success box', async ({ page, github }) => {
    await setup(page, github);
    await addEvent(page);
    await expect(fold(page, 'pub')).toHaveAttribute('aria-expanded', 'false');
    await page.locator('#publish-btn').press('Enter');
    await expectResult(page.locator('#pub-ok')).toBeVisible();
    await expect(fold(page, 'pub')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#pub-pending')).toBeVisible();
    // The user can close it again; it stays closed.
    await fold(page, 'pub').click();
    await expect(fold(page, 'pub')).toHaveAttribute('aria-expanded', 'false');
    await page.waitForTimeout(300);
    await expect(fold(page, 'pub')).toHaveAttribute('aria-expanded', 'false');
  });

  test('Publish opens for the progress bar (held request)', async ({ page, github }) => {
    await setup(page, github);
    await addEvent(page);
    const hold = github.hold(`POST ${REPO}/git/blobs`);
    await page.locator('#publish-btn').press('Enter');
    await expectResult(page.locator('#pub-progress')).toBeVisible();
    await expect(fold(page, 'pub')).toHaveAttribute('aria-expanded', 'true');
    hold.release();
    await expectResult(page.locator('#pub-ok')).toBeVisible();
  });

  test('Publish opens by itself on a stale result', async ({ page, github }) => {
    await setup(page, github);
    await addEvent(page);
    github.repo.pushOutside({ 'data/events.json': `${JSON.stringify({ version: 1, events: [ev('2020-01-01-aa')] })}\n` });
    await page.locator('#publish-btn').press('Enter');
    await expectResult(page.locator('#pub-stale')).toBeVisible();
    await expect(fold(page, 'pub')).toHaveAttribute('aria-expanded', 'true');
  });

  test('Publish opens by itself for the over-20-photos message', async ({ page, github }) => {
    await setup(page, github, { events: Array.from({ length: 21 }, (_, n) => ev(`2025-01-${String(n + 1).padStart(2, '0')}-e${n}`)) });
    await expect(fold(page, 'pub')).toHaveAttribute('aria-expanded', 'false');
    for (let n = 0; n < 21; n += 1) {
      await page.setInputFiles('#wm-files', { name: `p${n}.png`, mimeType: 'image/png', buffer: fs.readFileSync(SMALL) });
      await expectResult(page.locator('.wm-card').nth(n)).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
      await edit(page, `2025-01-${String(n + 1).padStart(2, '0')}-e${n}`);
      await page.locator('.wm-card').nth(n).getByRole('button', { name: 'Attach to selected event' }).press('Enter');
    }
    await expectResult(page.locator('#pub-limit')).toBeVisible();
    await expect(fold(page, 'pub')).toHaveAttribute('aria-expanded', 'true');
  });
});

/* ---------- (3) row layout ---------- */

const longestEvent = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'events.json'), 'utf8')).events
  .reduce((a, b) => (`${b.short} · ${b.name}`.length > `${a.short} · ${a.name}`.length ? b : a));

async function rowMetrics(row) {
  return row.evaluate((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const title = el.querySelector('.event-row-title').getBoundingClientRect();
    const buttons = [...el.querySelectorAll('.event-row-actions button')].map((b) => {
      const br = b.getBoundingClientRect();
      return { label: b.textContent, x: br.x, y: br.y, w: br.width, h: br.height };
    });
    const contentLeft = r.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft);
    const contentRight = r.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight);
    return { contentWidth: contentRight - contentLeft, contentLeft, title: { x: title.x, y: title.y, w: title.width, b: title.bottom, r: title.right }, buttons };
  });
}

async function checkPhoneRow(row) {
  const m = await rowMetrics(row);
  expect(Math.abs(m.title.w - m.contentWidth)).toBeLessThanOrEqual(2);
  expect(m.buttons.map((b) => b.label)).toEqual(['Edit', '↑', '↓', 'Delete']);
  for (const b of m.buttons) {
    expect(b.y).toBeGreaterThanOrEqual(m.title.b - 0.5); // below the title (and meta line)
    expect(b.w).toBeGreaterThanOrEqual(44);
    expect(b.h).toBeGreaterThanOrEqual(44);
  }
  const ys = new Set(m.buttons.map((b) => Math.round(b.y)));
  expect(ys.size).toBe(1); // all 4 on one line
  const xs = m.buttons.map((b) => b.x);
  expect([...xs].sort((a, b) => a - b)).toEqual(xs); // in order, left to right
  expect(Math.abs(xs[0] - m.contentLeft)).toBeLessThanOrEqual(2); // left-aligned
}

test.describe('row layout', () => {
  test.beforeEach(async ({ page }) => {
    await mockMoments(page, MOMENTS);
    await plain(page);
    await expect(page.locator('#moment-list .event-row')).toHaveCount(2);
  });

  test('phone: the 4 buttons sit on their own line below the name (Events and Moments), also at 360px', async ({ page }, info) => {
    test.skip(info.project.name !== 'phone', 'phone only');
    const first = page.locator('#event-list .event-row').first();
    const long = page.locator(`#event-list .event-row[data-id="${longestEvent.id}"]`);
    const moment = page.locator('#moment-list .event-row').first();
    for (const size of [null, { width: 360, height: 800 }]) {
      if (size) await page.setViewportSize(size);
      await checkPhoneRow(first);
      await showEvent(page, longestEvent.id); // TASK-24: 5 per page on the phone
      await checkPhoneRow(long);
      await checkPhoneRow(moment);
      await checkPhoneRow(page.locator('#moment-list .event-row').nth(1));
      // The title is whole words: the row title never needs more than the box (no overflow).
      const over = await first.locator('.event-row-title').evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(over).toBeLessThanOrEqual(0);
      await noHorizontalScroll(page);
    }
  });

  test('phone: Comic Fiesta (real event) is not broken in the middle of a word', async ({ page }, info) => {
    test.skip(info.project.name !== 'phone', 'phone only');
    await page.setViewportSize({ width: 360, height: 800 });
    const cf = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'events.json'), 'utf8')).events.find((e) => /Comic Fiesta/.test(e.name));
    await showEvent(page, cf.id); // TASK-24: the list is paged
    const title = page.locator(`#event-list .event-row[data-id="${cf.id}"] .event-row-title`);
    const lines = await title.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return range.getClientRects().length;
    });
    const single = await title.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight) || el.getBoundingClientRect().height);
    const h = (await title.boundingBox()).height;
    expect(lines).toBeGreaterThan(0);
    expect(h).toBeLessThanOrEqual(single * 3 + 2); // wraps at spaces, a few lines at most
  });

  test('desktop: the buttons sit to the right of the name on the same row', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop only');
    for (const row of [page.locator('#event-list .event-row').first(), page.locator('#moment-list .event-row').first()]) {
      const m = await rowMetrics(row);
      for (const b of m.buttons) {
        expect(b.x).toBeGreaterThanOrEqual(m.title.r - 0.5);
        expect(b.y).toBeLessThan(m.title.b);
      }
    }
  });

  test('no horizontal scroll on the admin page at 360, 412 and 1280px', async ({ page }) => {
    for (const width of [360, 412, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await noHorizontalScroll(page);
    }
  });
});

/* ---------- (4) panel order ---------- */

test.describe('panel order', () => {
  test.beforeEach(async ({ page }) => { await plain(page); });

  test('one column (phone): GitHub, Events, Event form, Publish, then Moments, the uploader and Analytics', async ({ page }, info) => {
    test.skip(info.project.name !== 'phone', 'phone only');
    const y = async (sel) => (await page.locator(sel).boundingBox()).y;
    const order = [await y('#gh-panel'), await y('#list-title'), await y('#form-title'), await y('#publish-panel'), await y('#moments-panel'), await y('#wm-title'), await y('#an-panel')];
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(new Set(order).size).toBe(order.length);
    // DOM order is the same.
    const dom = await page.evaluate(() => ['gh-panel', 'list-title', 'form-title', 'publish-panel', 'moments-panel', 'wm-panel', 'an-panel']
      .map((id) => document.getElementById(id))
      .map((el, i, all) => (i ? Boolean(all[i - 1].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) : true)));
    expect(dom.every(Boolean)).toBe(true);
  });

  test('one column: Tab from the last Events row button reaches the pager, then the Event form, and the form leads on to Publish', async ({ page }, info) => {
    test.skip(info.project.name !== 'phone', 'phone only');
    await page.locator('#event-list .event-row').last().locator('.event-row-actions button').last().focus();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement.closest('#event-pager') !== null)).toBe(true); // TASK-24: the pager comes first
    await page.locator('#event-next').focus();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement === document.querySelector('#form-panel .fold-btn'))).toBe(true);
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement.closest('#event-form') !== null)).toBe(true);
    await page.locator('#cancel-edit').focus();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement.closest('#publish-panel') !== null)).toBe(true);
    // Shift+Tab from the Publish fold button goes back to the form, not to the Events list.
    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(() => document.activeElement.id)).toBe('cancel-edit');
    // Tab from the GitHub fold button goes to the Events list.
    await fold(page, 'gh').focus();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement.closest('#event-list') !== null || document.activeElement.closest('[aria-labelledby="list-title"]') !== null)).toBe(true);
  });

  test('desktop: GitHub over Events (left), Publish over Event form (right), columns start at the same height', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop only');
    const gh = await page.locator('#gh-panel').boundingBox();
    const ev0 = await page.locator('#list-title').boundingBox();
    const pub = await page.locator('#publish-panel').boundingBox();
    const form = await page.locator('#form-title').boundingBox();
    expect(ev0.y).toBeGreaterThan(gh.y);
    expect(form.y).toBeGreaterThan(pub.y);
    expect(pub.x).toBeGreaterThan(gh.x + gh.width - 1);
    expect(Math.abs(gh.x - ev0.x)).toBeLessThan(40);
    expect(Math.abs(pub.x - form.x)).toBeLessThan(40);
    expect(Math.abs(gh.y - pub.y)).toBeLessThan(4);
    const mo = await page.locator('#moments-panel').boundingBox();
    expect(mo.y).toBeGreaterThan(form.y);
  });

  test('no horizontal scroll', async ({ page }) => {
    await noHorizontalScroll(page);
  });
});
