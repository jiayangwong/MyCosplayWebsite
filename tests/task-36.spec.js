// TASK-36: admin shell - one gap value, Backup menu, one pink primary, panel order (IDEA-18, plan section 13).
// Fake repo + fake token from tests/github-mock.js; api.github.com is never reached.
const fs = require('fs');
const { test, expect, BRANCH, FakeRepo, FAKE_TOKEN, openFold, openBackup } = require('./github-mock');
const { SAMPLE_EVENTS } = require('./helpers');

const REPO = '/repos/jiayangwong/MyCosplayWebsite';
const PINK = 'rgb(244, 167, 192)';
const RESULT_TIMEOUT = 15000;
const expectResult = expect.configure({ timeout: RESULT_TIMEOUT });
test.describe.configure({ timeout: 60000 });

const eventsText = `${JSON.stringify({ version: 1, events: SAMPLE_EVENTS }, null, 2)}\n`;

async function load(page, github, { dialog = 'accept' } = {}) {
  page.on('dialog', (d) => (dialog === 'accept' ? d.accept() : d.dismiss()));
  github.repo = new FakeRepo({ files: { 'data/events.json': eventsText } });
  await page.route('**/data/events.json', (route) => route.fulfill({ contentType: 'application/json', body: eventsText }));
  await page.goto('admin/index.html');
  await expectResult(page.locator('html')).toHaveAttribute('data-manager-ready', 'true');
  await expectResult(page.locator('html')).toHaveAttribute('data-github-ready', 'true');
  await expectResult(page.locator('html')).toHaveAttribute('data-publish-ready', 'true');
}

async function saveToken(page) {
  await openFold(page, 'gh');
  await page.fill('#gh-token', FAKE_TOKEN);
  await page.press('#gh-token', 'Enter');
  await expectResult(page.locator('#gh-saved')).toHaveText(`Token saved, ends in ...${FAKE_TOKEN.slice(-4)}`);
}

async function addEvent(page, short = 'PNK', name = 'Pink Test Con') {
  await openFold(page, 'form-panel');
  await page.press('#new-event', 'Enter');
  await page.fill('#f-date', '2026-12-20');
  await page.fill('#f-short', short);
  await page.fill('#f-name', name);
  await page.press('#f-name', 'Enter');
  await expectResult(page.locator('#save-status')).toContainText(`Saved ${short}`);
}

const box = async (page, sel) => {
  const b = await page.locator(sel).boundingBox();
  expect(b, `${sel} has a box`).not.toBeNull();
  return { ...b, bottom: b.y + b.height, right: b.x + b.width };
};
const near = (a, b, msg) => expect(Math.abs(a - b), msg).toBeLessThanOrEqual(1);

async function openAll(page) {
  for (const id of ['gh-panel', 'form-panel', 'moments-panel', 'wm-panel', 'publish-panel']) await openFold(page, id);
}

/** Measures every H3 gap in the layout the viewport gives. */
async function expectGaps(page, gap, twoColumns) {
  const tb = await box(page, '.toolbar');
  const grid = await box(page, '.admin-grid');
  near(grid.y - tb.bottom, gap, 'toolbar -> grid');
  const gh = await box(page, '#gh-panel');
  const ev = await box(page, '#events-panel');
  const fm = await box(page, '#form-panel');
  const pub = await box(page, '#publish-panel');
  near(ev.y - gh.bottom, gap, 'GitHub -> Events');
  if (twoColumns) {
    near(gh.y, pub.y, 'columns start at the same height');
    near(fm.y - pub.bottom, gap, 'Publish -> Event form');
    const left = Math.max(gh.right, ev.right);
    near(Math.min(pub.x, fm.x) - left, gap, 'column gap');
    near(Math.max(ev.bottom, fm.bottom), grid.bottom, 'grid ends at its tallest column');
  } else {
    near(fm.y - ev.bottom, gap, 'Events -> Event form');
    near(pub.y - fm.bottom, gap, 'Event form -> Publish');
    near(pub.bottom, grid.bottom, 'grid ends at Publish');
  }
  const mo = await box(page, '#moments-panel');
  const wm = await box(page, '#wm-panel');
  near(mo.y - grid.bottom, gap, 'grid -> Moments');
  near(wm.y - mo.bottom, gap, 'Moments -> Media uploader');
}

test.describe('TASK-36 spacing', () => {
  test('phone project (Pixel 7) and 360px: every gap is 24px, one column', async ({ page, github }, info) => {
    await load(page, github);
    await openAll(page);
    if (info.project.name === 'phone') await expectGaps(page, 24, false);
    await page.setViewportSize({ width: 360, height: 800 });
    await expectGaps(page, 24, false);
    await page.setViewportSize({ width: 899, height: 800 });
    await expectGaps(page, 24, false);
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('.admin')).getPropertyValue('--admin-gap').trim())).toBe('24px');
  });

  test('900px: one column with 32px gaps; 1280px: two columns, 32px, tops aligned', async ({ page, github }, info) => {
    test.skip(info.project.name !== 'desktop', 'sets its own widths');
    await load(page, github);
    await openAll(page);
    await page.setViewportSize({ width: 900, height: 800 });
    await expectGaps(page, 32, false);
    await page.setViewportSize({ width: 1280, height: 800 });
    await expectGaps(page, 32, true);
  });

  test('Publish button is 12px under the Publish header, collapsed and open', async ({ page, github }) => {
    await load(page, github);
    for (const open of [false, true]) {
      if (open) await openFold(page, 'publish-panel');
      const head = await box(page, '#publish-panel .fold-head');
      const btn = await box(page, '#publish-btn');
      near(btn.y - head.bottom, 12, `Publish button under header (open: ${open})`);
    }
  });
});

test.describe('TASK-36 Backup menu', () => {
  test('toolbar shows only New event and the Backup summary; menu closed; summary is 44px+', async ({ page, github }) => {
    await load(page, github);
    await expect(page.locator('#new-event')).toBeVisible();
    await expect(page.locator('#backup-menu > summary')).toBeVisible();
    await expect(page.locator('#backup-menu')).not.toHaveJSProperty('open', true);
    for (const sel of ['#export-events', '#discard-draft', 'label[for="import-file"]']) await expect(page.locator(sel)).toBeHidden();
    expect((await box(page, '#backup-menu > summary')).height).toBeGreaterThanOrEqual(44);
    await expect(page.locator('.toolbar')).toHaveAttribute('role', 'toolbar');
    for (const id of ['new-event', 'import-file', 'export-events', 'discard-draft', 'import-error']) await expect(page.locator(`#${id}`)).toHaveCount(1);
  });

  test('click opens: items in order, 44px+, same width; Esc closes and focuses the summary; Enter / Space open', async ({ page, github }) => {
    await load(page, github);
    const summary = page.locator('#backup-menu > summary');
    await summary.click();
    const imp = await box(page, 'label[for="import-file"]');
    const exp = await box(page, '#export-events');
    const dis = await box(page, '#discard-draft');
    expect(imp.y).toBeLessThan(exp.y);
    expect(exp.y).toBeLessThan(dis.y);
    for (const b of [imp, exp, dis]) { expect(b.height).toBeGreaterThanOrEqual(44); near(b.width, imp.width, 'full menu width'); }
    await expect(page.locator('label[for="import-file"]')).toHaveText('Import events.json');
    await expect(page.locator('#export-events')).toHaveText('Export events.json');
    await expect(page.locator('#discard-draft')).toHaveText('Discard draft');
    await page.locator('#export-events').focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('#backup-menu')).not.toHaveJSProperty('open', true);
    await expect(summary).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#export-events')).toBeVisible();
    await page.keyboard.press('Space');
    await expect(page.locator('#export-events')).toBeHidden();
    await page.keyboard.press('Space');
    await expect(page.locator('#export-events')).toBeVisible();
  });

  test('a click outside closes it', async ({ page, github }) => {
    await load(page, github);
    await openBackup(page);
    await page.locator('h1').click();
    await expect(page.locator('#export-events')).toBeHidden();
  });

  test('Export downloads events.json, closes the menu and focuses the summary; it can be reopened for a second export', async ({ page, github }) => {
    await load(page, github);
    for (let i = 0; i < 2; i += 1) {
      await openBackup(page);
      const [download] = await Promise.all([page.waitForEvent('download'), page.click('#export-events')]);
      expect(download.suggestedFilename()).toBe('events.json');
      const text = fs.readFileSync(await download.path(), 'utf8');
      expect(JSON.parse(text).events.length).toBe(SAMPLE_EVENTS.length);
      expect(text.endsWith('}\n')).toBe(true);
      await expect(page.locator('#export-events')).toBeHidden();
      await expect(page.locator('#backup-menu > summary')).toBeFocused();
    }
  });

  test('Import: good file replaces the draft, bad file shows #import-error outside the menu; both close the menu', async ({ page, github }) => {
    await load(page, github);
    const good = { version: 1, events: [{ id: '2026-01-01-imp', date: '2026-01-01', short: 'IMP', name: 'Imported Con', activities: ['Cosplay'] }] };
    await openBackup(page);
    await page.setInputFiles('#import-file', { name: 'good.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(good)) });
    await expect(page.locator('#event-count')).toHaveText('1 event');
    await expect(page.locator('#export-events')).toBeHidden();
    await expect(page.locator('#backup-menu > summary')).toBeFocused();
    await openBackup(page);
    await page.setInputFiles('#import-file', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"events":[{"id":"x","date":"2025-02-30","short":"X","name":"X"}]}') });
    await expect(page.locator('#import-error')).toBeVisible();
    await expect(page.locator('#import-error')).toContainText('Import failed');
    await expect(page.locator('#export-events')).toBeHidden();
    await expect(page.locator('#backup-menu > summary')).toBeFocused();
    await expect(page.locator('#event-count')).toHaveText('1 event');
  });

  test('BUG-25: focus moved elsewhere right after Import / Export stays there; it is not pulled back to Backup', async ({ page, github }) => {
    await load(page, github);
    const good = { version: 1, events: [{ id: '2026-01-01-imp', date: '2026-01-01', short: 'IMP', name: 'Imported Con', activities: ['Cosplay'] }] };
    // When the action ends, move focus at once (well inside the 50 ms delay) and report where it is 300 ms later.
    const moveOnDone = () => page.evaluate(() => new Promise((resolve) => {
      document.addEventListener('backup:done', () => {
        document.getElementById('new-event').focus();
        setTimeout(() => resolve(document.activeElement && document.activeElement.id), 300);
      }, { once: true });
    }));
    await openBackup(page);
    const afterImport = moveOnDone();
    await page.setInputFiles('#import-file', { name: 'good.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(good)) });
    expect(await afterImport).toBe('new-event');
    await expect(page.locator('#event-count')).toHaveText('1 event');
    await expect(page.locator('#export-events')).toBeHidden();
    await expect(page.locator('#new-event')).toBeFocused();
    await openBackup(page);
    const afterExport = moveOnDone();
    await Promise.all([page.waitForEvent('download'), page.click('#export-events')]);
    expect(await afterExport).toBe('new-event');
    await expect(page.locator('#new-event')).toBeFocused();
  });

  test('Discard is danger red and asks first: cancel keeps the draft, accept restores the published list', async ({ page, github }) => {
    await load(page, github, { dialog: 'dismiss' });
    await addEvent(page);
    const count = await page.locator('#event-count').textContent();
    await openBackup(page);
    await expect(page.locator('#discard-draft')).toHaveClass(/is-danger/);
    const [border, text, error] = await page.evaluate(() => {
      const el = document.getElementById('discard-draft');
      const cs = getComputedStyle(el);
      const probe = document.createElement('i');
      probe.style.color = getComputedStyle(document.documentElement).getPropertyValue('--color-error');
      document.body.append(probe);
      const err = getComputedStyle(probe).color;
      probe.remove();
      return [cs.borderTopColor, cs.color, err];
    });
    expect(border).toBe(error);
    expect(text).toBe(error);
    let asked = 0;
    page.removeAllListeners('dialog');
    page.on('dialog', (d) => { asked += 1; d.dismiss(); });
    await page.click('#discard-draft');
    expect(asked).toBe(1);
    await expect(page.locator('#event-count')).toHaveText(count);
    await expect(page.locator('#export-events')).toBeHidden();
    await expect(page.locator('#backup-menu > summary')).toBeFocused();
    page.removeAllListeners('dialog');
    page.on('dialog', (d) => d.accept());
    await openBackup(page);
    await page.click('#discard-draft');
    await expect(page.locator('#event-count')).toHaveText(`${SAMPLE_EVENTS.length} events`);
    await expect(page.locator('#backup-menu > summary')).toBeFocused();
  });

  test('busy lock reaches the items: Discard reading GitHub disables Import and Discard, the summary still opens', async ({ page, github }) => {
    await load(page, github);
    await saveToken(page);
    await addEvent(page);
    const read = github.hold(`GET ${REPO}/contents/data/events.json`);
    await openBackup(page);
    await page.click('#discard-draft');
    await read.arrived;
    await expect(page.locator('#import-file')).toBeDisabled();
    await expect(page.locator('#discard-draft')).toBeDisabled();
    await expect(page.locator('label[for="import-file"]')).toHaveAttribute('aria-disabled', 'true');
    await openBackup(page);
    await expect(page.locator('#export-events')).toBeEnabled();
    read.release();
    await expectResult(page.locator('#discard-draft')).toBeEnabled();
  });

  test('360px: the open menu is fully on screen and the page does not scroll sideways', async ({ page, github }) => {
    await load(page, github);
    await page.setViewportSize({ width: 360, height: 800 });
    await openBackup(page);
    const menu = await box(page, '.backup-items');
    expect(menu.x).toBeGreaterThanOrEqual(0);
    expect(menu.right).toBeLessThanOrEqual(360);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  for (const w of [700, 1280]) {
    test(`${w}px: menu is at least 220px wide, items stay inside and on one line`, async ({ page, github }) => {
      await load(page, github);
      await page.setViewportSize({ width: w, height: 800 });
      await openBackup(page);
      const menu = await box(page, '.backup-items');
      expect(menu.width).toBeGreaterThanOrEqual(219.5);
      for (const sel of ['#export-events', 'label[for="import-file"]', '#discard-draft']) {
        const b = await box(page, sel);
        expect(b.right).toBeLessThanOrEqual(menu.right + 0.5);
        expect(b.height).toBeLessThan(60);
      }
    });
  }

  test('Tab out of the open Backup menu closes it', async ({ page, github }) => {
    await load(page, github);
    await openBackup(page);
    await page.locator('#discard-draft').focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('#backup-menu')).not.toHaveJSProperty('open', true);
  });

  test('stale box step 2 points at the Backup menu', async ({ page, github }) => {
    await load(page, github);
    await expect(page.locator('#pub-stale')).toContainText('Discard draft (in the Backup menu; this loads the newest events.json from GitHub).');
  });
});

test.describe('TASK-36 one pink primary', () => {
  const only = async (page, id) => {
    const pink = page.locator('.btn-accent:visible');
    await expect(pink).toHaveCount(1);
    await expect(pink).toHaveId(id);
    await expect(pink).toHaveCSS('background-color', PINK);
  };

  test('nothing pending: New event is the one pink button, Publish is disabled and not pink', async ({ page, github }) => {
    await load(page, github);
    await only(page, 'new-event');
    await expect(page.locator('#publish-btn')).toBeDisabled();
    await expect(page.locator('#publish-btn')).not.toHaveClass(/btn-accent/);
    await expect(page.locator('#export-events')).not.toHaveClass(/btn-accent/);
    await expect(page.locator('#new-event')).not.toHaveClass(/btn-primary/);
  });

  test('pending change + token: Publish is pink and New event is secondary; no token: New event stays pink', async ({ page, github }) => {
    await load(page, github);
    await addEvent(page);
    await only(page, 'new-event'); // pending, but no token
    await expect(page.locator('#publish-btn')).toBeDisabled();
    await saveToken(page);
    await expect(page.locator('#publish-btn')).toBeEnabled();
    await only(page, 'publish-btn');
    await expect(page.locator('#new-event')).toHaveClass(/btn-secondary/);
    await expect(page.locator('#new-event')).not.toHaveClass(/btn-accent/);
  });

  test('while publishing and after success New event is pink; after Discard (nothing pending) too', async ({ page, github }) => {
    await load(page, github);
    await saveToken(page);
    await addEvent(page);
    await only(page, 'publish-btn');
    const gate = github.hold(`GET ${REPO}/git/ref/heads/${BRANCH}`);
    await page.click('#publish-btn');
    await gate.arrived;
    await expect(page.locator('#publish-btn')).toBeDisabled();
    await only(page, 'new-event');
    gate.release();
    await expectResult(page.locator('#publish-btn')).toHaveText('Nothing to publish');
    await only(page, 'new-event');
    await addEvent(page, 'TWO', 'Second Con');
    await only(page, 'publish-btn');
    await openBackup(page);
    await page.click('#discard-draft');
    await expectResult(page.locator('#publish-btn')).toHaveText('Nothing to publish');
    await only(page, 'new-event');
  });
});

test.describe('TASK-36 panel order', () => {
  const order = ['.page-head', '.help-box', '#source-banner', '.toolbar', '#import-error', '.admin-grid', '#moments-panel', '#wm-panel'];

  test('DOM order of the blocks; one column order is GitHub, Events, Event form, Publish', async ({ page, github }) => {
    await load(page, github);
    const ok = await page.evaluate((sels) => {
      const els = sels.map((s) => document.querySelector(s));
      return els.every((el, i) => i === 0 || (els[i - 1].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0);
    }, order);
    expect(ok).toBe(true);
    const panels = await page.evaluate(() => [...document.querySelectorAll('.admin-grid > .adm-side > section, .admin-grid > section')].map((s) => s.id));
    expect(panels).toEqual(['gh-panel', 'events-panel', 'form-panel', 'publish-panel']);
  });

  test('phone (under 900px): the blocks are stacked in that order on screen', async ({ page, github }) => {
    await load(page, github);
    await page.setViewportSize({ width: 412, height: 900 });
    const ids = ['gh-panel', 'events-panel', 'form-panel', 'publish-panel', 'moments-panel', 'wm-panel'];
    let last = -1;
    for (const id of ids) {
      const y = (await box(page, `#${id}`)).y;
      expect(y, id).toBeGreaterThan(last);
      last = y;
    }
    const toolbarY = (await box(page, '.toolbar')).y;
    expect(toolbarY).toBeLessThan((await box(page, '#gh-panel')).y);
  });

  test('desktop: GitHub over Events on the left, Publish over Event form on the right', async ({ page, github }, info) => {
    test.skip(info.project.name !== 'desktop', 'needs the 1280px layout');
    await load(page, github);
    const gh = await box(page, '#gh-panel');
    const ev = await box(page, '#events-panel');
    const pub = await box(page, '#publish-panel');
    const fm = await box(page, '#form-panel');
    expect(gh.y).toBeLessThan(ev.y);
    expect(pub.y).toBeLessThan(fm.y);
    expect(pub.x).toBeGreaterThan(gh.right);
    near(gh.x, ev.x, 'left column');
    near(pub.x, fm.x, 'right column');
  });

  test('other ink buttons stay black', async ({ page, github }) => {
    await load(page, github);
    await openFold(page, 'form-panel');
    await expect(page.locator('#event-form button[type="submit"]')).toHaveClass(/btn-primary/);
    await expect(page.locator('#gh-save')).toHaveClass(/btn-primary/);
  });
});
