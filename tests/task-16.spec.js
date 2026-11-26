// TASK-16: Publish never commits a broken photo link (events and site photos, closes BUG-4), and
// "Remove from publish" on an event pair puts back the published photo. Uses the strict in-memory fake repo
// from tests/github-mock.js and the fake token only: any unhandled api.github.com call, an unreleased hold()
// or a leaked token fails the test. Buttons are pressed with the keyboard (no lost clicks on the phone layout).
const fs = require('fs');
const path = require('path');
const { test, expect, BRANCH, FAKE_TOKEN, FakeRepo, openFold } = require('./github-mock');
const { showEvent } = require('./helpers');

const ROOT = path.join(__dirname, '..');
const SMALL = path.join(__dirname, 'fixtures', 'flat-800x600.png');
const REPO = '/repos/jiayangwong/MyCosplayWebsite';
const TREE_POST = `POST ${REPO}/git/trees`;
const REF_PATCH = `PATCH ${REPO}/git/refs/heads/${BRANCH}`;
const SUCCESS = 'Published. The site updates in about 1-2 minutes.';
// BUG-11: fixed fixture (portrait null), independent of the real data/site.json.
const SITE_TEXT = fs.readFileSync(path.join(__dirname, 'fixtures', 'site-null.json'), 'utf8');
const REELS_TEXT = fs.readFileSync(path.join(ROOT, 'data', 'reels.json'), 'utf8');
// A publish is many mocked round trips plus image encoding; every wait on a result uses this timeout.
const expectResult = expect.configure({ timeout: 15000 });
test.describe.configure({ timeout: 90000 });

const X = '2026-03-14-cf';
const Y = '2025-08-09-omt';
const Z = '2024-05-01-zz';
const ev = (id, extra = {}) => {
  const [date, short] = [id.slice(0, 10), id.slice(11).toUpperCase()];
  return { id, date, short, name: `${short} Test Con`, ...extra };
};
const OLD = { photo: `media/events/${X}/old.webp`, photoFull: `media/events/${X}/old-full.webp` };
const NEW = { photo: `media/events/${X}/new.webp`, photoFull: `media/events/${X}/new-full.webp` };
const PORTRAIT = 'media/site/portrait.webp';
const webp = (tag) => Buffer.concat([Buffer.from('RIFF\x10\x00\x00\x00WEBP', 'latin1'), Buffer.from(tag)]);

const MSG = {
  missing: (who, p) => `${who} points at a photo that is not on GitHub and not in this publish: ${p}`,
  form: (who, v) => `${who} has a photo path that is not in the usual form: ${v}`,
  eventMissingNext: 'Attach the photo again, or remove it from the event, then publish. Nothing was changed.',
  eventFormNext: 'Attach the photo again or fix the path, then publish. Nothing was changed.',
  siteNext: (clear) => `Make the photo again or press "${clear}", then publish. Nothing was changed.`,
  unchecked: "Could not list all files on GitHub, so the photo links can't be checked.",
  truncatedNote: 'Could not list all old photos, so none were removed this time.',
};
const WHO_X = `Event "CF 2026" (${X})`;

/** Opens /admin/ and saves the fake token, waiting for every panel to be ready. */
async function ready(page) {
  for (const flag of ['manager', 'uploader', 'github', 'publish', 'site-photos']) {
    await expectResult(page.locator('html')).toHaveAttribute(`data-${flag}-ready`, 'true');
  }
}

/**
 * Puts `events`, the site's data/site.json + data/reels.json (same bytes as the site copy) and extra files in
 * the fake repo, serves the same events.json / site.json as the site copy, opens /admin/, saves the fake token.
 */
async function setup(page, github, { events = [ev(X), ev(Y)], files = {}, truncated = false, site = SITE_TEXT } = {}) {
  const text = `${JSON.stringify({ version: 1, events }, null, 2)}\n`;
  github.repo = new FakeRepo({
    files: { 'data/events.json': text, 'data/site.json': site, 'data/reels.json': REELS_TEXT, ...files },
  });
  github.treeTruncated = truncated;
  await page.route('**/data/events.json', (route) => route.fulfill({ contentType: 'application/json', body: text }));
  await page.route('**/data/site.json', (route) => route.fulfill({ contentType: 'application/json', body: site }));
  page.on('dialog', (d) => d.accept()); // window.confirm of "Delete event", and the leave-page prompt on reload
  await page.goto('admin/index.html');
  await ready(page);
  await openFold(page, 'gh');
  await page.fill('#gh-token', FAKE_TOKEN);
  await page.press('#gh-token', 'Enter');
  await expectResult(page.locator('#gh-saved')).toHaveText(`Token saved, ends in ...${FAKE_TOKEN.slice(-4)}`);
  await openFold(page, 'form-panel');
  await openFold(page, 'wm-panel');
}

/** Reloads /admin/: pending files (memory only) are gone, the drafts (localStorage) and the token stay. */
async function reload(page) {
  await page.reload();
  await ready(page);
  await openFold(page, 'form-panel');
  await openFold(page, 'wm-panel');
  await expectResult(page.locator('#gh-saved')).toContainText('Token saved');
}

const card = (page, i) => page.locator('.wm-card').nth(i);
const row = (page, id) => page.locator(`.event-row[data-id="${id}"]`);

async function edit(page, id) {
  await showEvent(page, id); // TASK-24: the row may be on a later page
  await row(page, id).getByRole('button', { name: /^Edit/ }).press('Enter');
  await expect(page.locator('#wm-event-id')).toHaveText(id);
}

/** Uploads the small fixture through the TASK-7 pipeline and attaches the new card to event `id`. */
async function attach(page, id) {
  const i = await page.locator('.wm-card').count();
  await page.setInputFiles('#wm-files', SMALL);
  await expectResult(card(page, i)).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
  await edit(page, id);
  await card(page, i).getByRole('button', { name: 'Attach to selected event' }).press('Enter');
  // TASK-27: the pair fills the next empty slot (D1 for an event without a photo, D2 after a published one).
  await expect.poll(() => page.evaluate(() => ['f-photo', 'f-photo-2', 'f-photo-3'].map((x) => document.getElementById(x).value))).toContain(`media/events/${id}/flat-800x600.webp`);
}

/** Saves the open event after changing fields (Enter in the name field submits the form). */
async function saveForm(page) {
  await page.press('#f-name', 'Enter');
  await expectResult(page.locator('#save-status')).toContainText('Saved');
}

async function rename(page, id, name) {
  await edit(page, id);
  await page.fill('#f-name', name);
  await saveForm(page);
}

/** Imports an events.json as the draft (the base, i.e. what is published, stays). */
async function importDraft(page, events) {
  const buffer = Buffer.from(JSON.stringify({ version: 1, events }));
  await page.setInputFiles('#import-file', { name: 'events.json', mimeType: 'application/json', buffer });
  await expectResult(page.locator('#save-status')).toContainText('Imported');
}

/** Site photos panel: make a photo for `target` and press "Use for <label>". */
async function useSitePhoto(page, target, label) {
  await page.selectOption('#sp-target', { label: target });
  await page.setInputFiles('#sp-file', SMALL);
  await expectResult(page.locator('#sp-card')).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
  await expect(page.locator('#sp-use')).toHaveText(`Use for ${label}`);
  await page.locator('#sp-use').press('Enter');
  await expectResult(page.locator('#sp-status')).toHaveText('Added to Publish');
}

async function publish(page) {
  await expectResult(page.locator('#publish-btn')).toBeEnabled();
  await page.locator('#publish-btn').press('Enter');
}

const writes = (github) => github.calls().filter((c) => !c.startsWith('GET '));
const newCommits = (github) => github.repo.commits.size - 1;
const treeBody = (github) => github.requests.filter((r) => `${r.method} ${r.path}` === TREE_POST).pop().body;
const draftEvent = (page, id) => page.evaluate(async (eid) => {
  const m = await import('/js/admin/manager.js');
  return JSON.parse(m.draftText()).events.find((e) => e.id === eid) || null;
}, id);
const committed = (github, p) => JSON.parse(github.repo.read(p));

/** The stop: error text + next line, no POST/PATCH, repo head and files unchanged, no removal dialog. */
async function expectStopped(page, github, before, text, next) {
  await expectResult(page.locator('#pub-err')).toBeVisible();
  await expect(page.locator('#pub-err-text')).toHaveText(text);
  await expect(page.locator('#pub-err-next')).toHaveText(next);
  await expect(page.locator('#pub-confirm')).toBeHidden();
  await expect(page.locator('#pub-retry')).toBeVisible();
  await expect(page.locator('#publish-btn')).toBeEnabled();
  await expect(page.locator('#import-file')).toBeEnabled();
  await expect(page.locator('#discard-draft')).toBeEnabled();
  expect(writes(github)).toEqual([]);
  expect(github.repo.head).toBe(before.head);
  expect([...github.repo.filesAt().keys()]).toEqual(before.files);
}
const snapshot = (github) => ({ head: github.repo.head, files: [...github.repo.filesAt().keys()] });

// Every tree ever posted: each `sha: null` path is under media/events/, ends in .webp and is not used by any
// event in the events.json of that same tree (when it carries one).
test.afterEach(async ({ github }) => {
  for (const r of github.requests.filter((q) => `${q.method} ${q.path}` === TREE_POST)) {
    const entries = r.body.tree;
    const eventsEntry = entries.find((e) => e.path === 'data/events.json');
    const deletes = entries.filter((x) => x.sha === null);
    if (!eventsEntry) {
      expect(deletes).toEqual([]);
      continue;
    }
    const data = JSON.parse(github.repo.blobs.get(eventsEntry.sha).toString('utf8'));
    const used = new Set(data.events.flatMap((e) => [e.photo, e.photoFull]).filter(Boolean));
    for (const e of deletes) {
      expect(e.path.startsWith('media/events/'), e.path).toBe(true);
      expect(e.path.endsWith('.webp'), e.path).toBe(true);
      expect(used.has(e.path), `${e.path} is used by an event`).toBe(false);
    }
  }
});

/* ---------- (2) Remove from publish puts back the published photo ---------- */

test('IDEA-11: Remove from publish sets X back to its published photo; the next publish keeps and removes nothing', async ({ page, github }) => {
  await setup(page, github, {
    events: [ev(X, OLD), ev(Y)],
    files: { [OLD.photo]: webp('old'), [OLD.photoFull]: webp('old-full') },
  });
  await attach(page, X);
  // TASK-27: the new pair is D2; the published photo (D1) stays in use, so nothing is listed for removal.
  await expectResult(page.locator('#pub-pending')).not.toContainText('(no event uses it)');
  await expect(page.locator('#pub-note')).toBeHidden();

  await openFold(page, 'pub');
  await page.locator('#pub-pending .pend-remove').press('Enter');
  await expectResult(page.locator('#pub-note')).toHaveText('Photo D2 removed from CF 2026 (not published yet).');
  await expect(page.locator('#pub-note')).toHaveAttribute('role', 'status');
  expect(await draftEvent(page, X)).toMatchObject(OLD);
  await expect(page.locator('#pub-pending')).toHaveText('No pending changes.');
  await expect(page.locator('#publish-btn')).toHaveText('Nothing to publish');
  // The draft is saved like any edit: it survives a reload.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('puzzkezz.events.draft')).events
    .find((e) => e.id === '2026-03-14-cf').photo)).toBe(OLD.photo);

  await rename(page, Y, 'Renamed Con');
  await publish(page);
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  await expect(page.locator('#pub-ok')).toContainText(SUCCESS);
  await expect(page.locator('#pub-confirm')).toBeHidden();
  await expect(page.locator('#pub-note')).toBeHidden(); // cleared by the publish
  expect(treeBody(github).tree.map((e) => e.path)).toEqual(['data/events.json']);
  expect(committed(github, 'data/events.json').events.find((e) => e.id === X)).toMatchObject(OLD);
  const live = github.repo.filesAt();
  expect(live.has(OLD.photo)).toBe(true);
  expect(live.has(OLD.photoFull)).toBe(true);
  expect(newCommits(github)).toBe(1);
});

test('new event (not published): Remove from publish clears both fields and says it has no published photo', async ({ page, github }) => {
  await setup(page, github);
  await importDraft(page, [ev(X), ev(Y), ev(Z)]);
  await attach(page, Z);
  await openFold(page, 'pub');
  await page.locator('#pub-pending .pend-remove').press('Enter');
  await expectResult(page.locator('#pub-note')).toHaveText('Photo for ZZ 2024 removed from the event (it has no published photo).');
  const z = await draftEvent(page, Z);
  expect(z.photo).toBeUndefined();
  expect(z.photoFull).toBeUndefined();
  await expect(page.locator('#f-photo')).toHaveValue('');
  await expect(page.locator('#f-photo-full')).toHaveValue('');
  expect(writes(github)).toEqual([]);
});

test('changed meanwhile: a typed path in the pair\'s slot after the attach is kept, no note', async ({ page, github }) => {
  await setup(page, github, {
    events: [ev(X, OLD), ev(Y)],
    files: { [OLD.photo]: webp('old'), [OLD.photoFull]: webp('old-full') },
  });
  await attach(page, X); // D2
  const typed = `media/events/${X}/typed.webp`;
  await page.fill('#f-photo-2', typed);
  await saveForm(page);
  const typedEvent = await draftEvent(page, X);
  expect(typedEvent.photos[1].photo).toBe(typed);
  // The pair stays listed (its full-size file is still used).
  await expectResult(page.locator('#pub-pending .pend-remove')).toHaveCount(1);
  await openFold(page, 'pub');
  await page.locator('#pub-pending .pend-remove').press('Enter');
  await expectResult(page.locator('#pub-pending .pend-pair')).toHaveCount(0);
  const x = await draftEvent(page, X);
  expect(x.photos[1].photo).toBe(typed); // the event no longer holds the pair's display path: draft unchanged
  expect(x.photos[1].photoFull).toBe(`media/events/${X}/flat-800x600-full.webp`);
  await expect(page.locator('#pub-note')).toBeHidden();
  await expect(page.locator('#f-photo-2')).toHaveValue(typed);
});

test('form open: Remove from publish updates the open form\'s photo slots and previews', async ({ page, github }) => {
  await setup(page, github, {
    events: [ev(X, OLD), ev(Y)],
    files: { [OLD.photo]: webp('old'), [OLD.photoFull]: webp('old-full') },
  });
  const png = fs.readFileSync(SMALL);
  await page.route('**/media/events/**', (route) => route.fulfill({ contentType: 'image/png', body: png }));
  await attach(page, X); // leaves X open in the form, the pair is D2
  await expect(page.locator('#slot-th-2 img')).toBeVisible();
  await expect(page.locator('#f-photo-2')).toHaveValue(`media/events/${X}/flat-800x600.webp`);
  await openFold(page, 'pub');
  await page.locator('#pub-pending .pend-remove').press('Enter');
  await expectResult(page.locator('#f-photo-2')).toHaveValue('');
  await expect(page.locator('#f-photo-full-2')).toHaveValue('');
  await expect(page.locator('#f-photo')).toHaveValue(OLD.photo);
  await expect(page.locator('#f-photo-full')).toHaveValue(OLD.photoFull);
  await expect(page.locator('#slot-th-2')).toHaveText('No photo');
  await expect(page.locator('#embed-preview img')).toHaveAttribute('src', /media\/events\/2026-03-14-cf\/old\.webp$/);
  await expect(page.locator('#wm-event-id')).toHaveText(X); // still editing X
});

test('BUG-5: Remove from publish on a published SAMPLE event puts back the "Sample" tag; nothing to publish', async ({ page, github }) => {
  await setup(page, github, {
    events: [ev(X, { ...OLD, sample: true }), ev(Y, { sample: true })],
    files: { [OLD.photo]: webp('old'), [OLD.photoFull]: webp('old-full') },
  });
  await expect(row(page, X)).toContainText('SAMPLE');
  await attach(page, X);
  await expectResult(row(page, X)).not.toContainText('SAMPLE'); // attaching drops the tag
  await openFold(page, 'pub');
  await page.locator('#pub-pending .pend-remove').press('Enter');
  await expectResult(page.locator('#pub-note')).toHaveText('Photo D2 removed from CF 2026 (not published yet).');
  expect(await draftEvent(page, X)).toEqual(ev(X, { ...OLD, sample: true }));
  await expect(row(page, X)).toContainText('SAMPLE');
  await expect(page.locator('#pub-pending')).toHaveText('No pending changes.');
  await expect(page.locator('#publish-btn')).toHaveText('Nothing to publish');
  await expect(page.locator('#publish-btn')).toBeDisabled();
  expect(await page.evaluate(async () => (await import('/js/admin/manager.js')).draftDiffersFromBase())).toBe(false);
  expect(writes(github)).toEqual([]);
});

test('BUG-5: a published event with no photo gets its "Sample" tag back when the photo is removed', async ({ page, github }) => {
  await setup(page, github, { events: [ev(X, { sample: true }), ev(Y)] });
  await attach(page, X);
  await openFold(page, 'pub');
  await page.locator('#pub-pending .pend-remove').press('Enter');
  await expectResult(page.locator('#pub-note')).toHaveText('Photo for CF 2026 removed from the event (it has no published photo).');
  expect(await draftEvent(page, X)).toEqual(ev(X, { sample: true }));
  await expect(row(page, X)).toContainText('SAMPLE');
  await expect(page.locator('#publish-btn')).toHaveText('Nothing to publish');
});

test('BUG-6: an unsaved typed path in the open form\'s D1 is kept; the pair\'s slot D2 is removed from the draft and the form', async ({ page, github }) => {
  await setup(page, github, {
    events: [ev(X, OLD), ev(Y)],
    files: { [OLD.photo]: webp('old'), [OLD.photoFull]: webp('old-full') },
  });
  await attach(page, X); // leaves X open in the form, the pair is D2
  await expect(page.locator('#f-photo-full-2')).toHaveValue(`media/events/${X}/flat-800x600-full.webp`);
  const typed = `media/events/${X}/typed.webp`;
  await page.fill('#f-photo', typed); // not saved
  await openFold(page, 'pub');
  await page.locator('#pub-pending .pend-remove').press('Enter');
  await expectResult(page.locator('#pub-note')).toHaveText('Photo D2 removed from CF 2026 (not published yet).');
  expect(await draftEvent(page, X)).toMatchObject(OLD);
  await expect(page.locator('#f-photo')).toHaveValue(typed);
  await expect(page.locator('#f-photo-2')).toHaveValue('');
  await expect(page.locator('#wm-event-id')).toHaveText(X); // still editing X
  expect(writes(github)).toEqual([]);
});

/* ---------- (1) Event photo link check ---------- */

test('broken link (the reload / import case): stops naming X and the path; no POST/PATCH, repo unchanged, no dialog', async ({ page, github }) => {
  await setup(page, github, {
    events: [ev(X, OLD), ev(Y)],
    files: { [OLD.photo]: webp('old'), [OLD.photoFull]: webp('old-full') },
  });
  await importDraft(page, [ev(X, NEW), ev(Y)]);
  await expect(page.locator('#pub-pending .pend-pair')).toHaveCount(0);
  const before = snapshot(github);
  await publish(page);
  await expectStopped(page, github, before, `${MSG.missing(WHO_X, NEW.photo)}.`, MSG.eventMissingNext);
  expect(await draftEvent(page, X)).toMatchObject(NEW); // the draft is kept
  expect(github.repo.filesAt().has(OLD.photo)).toBe(true);
});

test('two broken events: the message names the first in display order and says "(and 1 more)"', async ({ page, github }) => {
  await setup(page, github);
  await importDraft(page, [ev(Y, { photo: `media/events/${Y}/gone.webp` }), ev(X, NEW)]);
  const before = snapshot(github);
  await publish(page);
  await expectStopped(page, github, before, `${MSG.missing(WHO_X, NEW.photo)} (and 1 more).`, MSG.eventMissingNext);
});

test('non-plain path: ./media/events/X/old.webp (file exists) stops with "not in the usual form", no write', async ({ page, github }) => {
  const form = `./${OLD.photo}`;
  await setup(page, github, {
    events: [ev(X, { photo: form, photoFull: OLD.photoFull }), ev(Y)],
    files: { [OLD.photo]: webp('old'), [OLD.photoFull]: webp('old-full') },
  });
  await rename(page, Y, 'Plain Check Con');
  const before = snapshot(github);
  await publish(page);
  await expectStopped(page, github, before, `${MSG.form(WHO_X, form)}.`, MSG.eventFormNext);
});

test('truncated tree with an existing photo reference: "can\'t be checked" stop, no write', async ({ page, github }) => {
  await setup(page, github, {
    events: [ev(X, OLD), ev(Y)],
    files: { [OLD.photo]: webp('old'), [OLD.photoFull]: webp('old-full') },
    truncated: true,
  });
  await rename(page, Y, 'Truncated Con');
  const before = snapshot(github);
  await publish(page);
  await expectStopped(page, github, before, MSG.unchecked, 'Nothing was changed.');
});

test('truncated tree where the only media/events/ paths are new files of this publish: publishes with the note', async ({ page, github }) => {
  const stray = `media/events/${X}/stray.webp`;
  await setup(page, github, { files: { [stray]: webp('s') }, truncated: true });
  await attach(page, X);
  await publish(page);
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  await expect(page.locator('#pub-ok-note')).toHaveText(MSG.truncatedNote);
  await expect(page.locator('#pub-confirm')).toBeHidden();
  expect(treeBody(github).tree.filter((e) => e.sha === null)).toEqual([]);
  expect(github.repo.filesAt().has(stray)).toBe(true);
  expect(github.repo.filesAt().has(`media/events/${X}/flat-800x600.webp`)).toBe(true);
  expect(newCommits(github)).toBe(1);
});

test('events with no photo and a photo outside media/events/ are not stopped by this check', async ({ page, github }) => {
  await setup(page, github, { events: [ev(X), ev(Y, { photo: 'img/placeholder.webp' })] });
  await rename(page, X, 'No Photo Con');
  await publish(page);
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  expect(treeBody(github).tree.map((e) => e.path)).toEqual(['data/events.json']);
  expect(newCommits(github)).toBe(1);
});

test('deleted event: no link error; the removal dialog lists its 2 files as in TASK-13', async ({ page, github }) => {
  await setup(page, github, {
    events: [ev(X, OLD), ev(Y)],
    files: { [OLD.photo]: webp('old'), [OLD.photoFull]: webp('old-full') },
  });
  await row(page, X).getByRole('button', { name: /^Delete/ }).press('Enter');
  await expectResult(row(page, X)).toHaveCount(0);
  await publish(page);
  await expectResult(page.locator('#pub-confirm-title')).toHaveText('These 2 old files will be removed');
  await expect(page.locator('#pub-err')).toBeHidden();
  await page.locator('#pub-confirm-yes').press('Enter');
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  expect(treeBody(github).tree.filter((e) => e.sha === null).map((e) => e.path).sort()).toEqual([OLD.photo, OLD.photoFull].sort());
  expect(newCommits(github)).toBe(1);
});

test('Try again after a broken-link stop: fix the draft (remove the photo), Try again publishes one commit', async ({ page, github }) => {
  await setup(page, github);
  await importDraft(page, [ev(X, NEW), ev(Y, { name: 'Fixed Later Con' })]);
  const before = snapshot(github);
  await publish(page);
  await expectStopped(page, github, before, `${MSG.missing(WHO_X, NEW.photo)}.`, MSG.eventMissingNext);

  // A second press with nothing fixed stops the same way (the check also runs on Try again).
  await page.locator('#pub-retry').press('Enter');
  await expectStopped(page, github, before, `${MSG.missing(WHO_X, NEW.photo)}.`, MSG.eventMissingNext);

  await edit(page, X);
  await page.fill('#f-photo', '');
  await page.fill('#f-photo-full', '');
  await saveForm(page);
  await page.locator('#pub-retry').press('Enter');
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  expect(newCommits(github)).toBe(1);
  expect(github.calls().filter((c) => c === REF_PATCH)).toHaveLength(1);
  const x = committed(github, 'data/events.json').events.find((e) => e.id === X);
  expect(x.photo).toBeUndefined();
  expect(committed(github, 'data/events.json').events.find((e) => e.id === Y).name).toBe('Fixed Later Con');
});

test('hold: the check runs after the tree read, before any write (no POST while the tree read is held)', async ({ page, github }) => {
  await setup(page, github);
  await importDraft(page, [ev(X, NEW), ev(Y)]);
  const treeRead = github.hold((req) => req.method === 'GET' && /\/git\/trees\//.test(req.path));
  await publish(page);
  await treeRead.arrived;
  await expect(page.locator('#pub-step')).toHaveText('Step 4 of 8: Listing the photo files on GitHub');
  expect(writes(github)).toEqual([]);
  treeRead.release();
  await expectResult(page.locator('#pub-err-text')).toHaveText(`${MSG.missing(WHO_X, NEW.photo)}.`);
  expect(writes(github)).toEqual([]);
});

test('pure brokenPhotoLinks: [] when all files exist, missing / non-plain / truncated problems, [] for bad JSON', async ({ page, github }) => {
  await setup(page, github);
  const out = await page.evaluate(async ({ x, old, fresh }) => {
    const m = await import('/js/admin/publish.js');
    const text = (events) => JSON.stringify({ version: 1, events });
    const ev = (photo, photoFull) => ({ id: x, date: '2026-03-14', short: 'CF', name: 'n', photo, photoFull });
    const tree = [{ path: old.photo, type: 'blob' }, { path: old.photoFull, type: 'blob' }, { path: 'media/events', type: 'tree' }];
    const strip = (list) => list.map(({ kind, field, value, who }) => ({ kind, field, value, who }));
    return {
      ok: m.brokenPhotoLinks(text([ev(old.photo, old.photoFull)]), tree, false, new Set()),
      okNew: m.brokenPhotoLinks(text([ev(fresh, '')]), tree, false, new Set([fresh])),
      none: m.brokenPhotoLinks(text([{ id: x, date: '2026-03-14', short: 'CF', name: 'n' }, ev('', '')]), [], false, new Set()),
      outside: m.brokenPhotoLinks(text([ev('img/placeholder.webp')]), [], false, new Set()),
      missing: strip(m.brokenPhotoLinks(text([ev(fresh, old.photoFull)]), tree, false, new Set())),
      folder: strip(m.brokenPhotoLinks(text([ev('media/events', '')]), tree, false, new Set())),
      form: strip(m.brokenPhotoLinks(text([ev(`./${old.photo}`, old.photoFull)]), tree, false, new Set())),
      truncated: strip(m.brokenPhotoLinks(text([ev(old.photo, '')]), tree, true, new Set())),
      truncatedNew: m.brokenPhotoLinks(text([ev(fresh, '')]), [], true, new Set([fresh])),
      bad: [m.brokenPhotoLinks('{not json', tree, false, new Set()), m.brokenPhotoLinks('null', tree, false, new Set()), m.brokenPhotoLinks(undefined, null, false, null)],
    };
  }, { x: X, old: OLD, fresh: NEW.photo });
  expect(out.ok).toEqual([]);
  expect(out.okNew).toEqual([]);
  expect(out.none).toEqual([]);
  expect(out.outside).toEqual([]);
  expect(out.missing).toEqual([{ kind: 'missing', field: 'photo', value: NEW.photo, who: WHO_X }]);
  expect(out.folder).toEqual([]); // "media/events" does not start with "media/events/": not checked here
  expect(out.form).toEqual([{ kind: 'form', field: 'photo', value: `./${OLD.photo}`, who: WHO_X }]);
  expect(out.truncated).toEqual([{ kind: 'unchecked', field: 'photo', value: OLD.photo, who: WHO_X }]);
  expect(out.truncatedNew).toEqual([]);
  expect(out.bad).toEqual([[], [], []]);
});

/* ---------- (3) Site photo link check (BUG-4) ---------- */

test('BUG-4 repro: Use for Portrait, reload, Publish -> stops naming media/site/portrait.webp, no write', async ({ page, github }) => {
  await setup(page, github);
  await useSitePhoto(page, 'Portrait', 'Portrait');
  await reload(page);
  await expect(page.locator('#pub-pending')).toContainText('data/site.json changed');
  await expect(page.locator('#pub-pending .pend-pair')).toHaveCount(0); // the file is gone with the reload
  const before = snapshot(github);
  await publish(page);
  await expectStopped(page, github, before, `${MSG.missing('Portrait', PORTRAIT)}.`, MSG.siteNext('Clear portrait'));
});

test('reel cover: Use for Reel cover す, reload, Publish -> stops naming "Reel cover す (sugoi)", no write', async ({ page, github }) => {
  await setup(page, github);
  await useSitePhoto(page, 'Reel cover: す su', 'Reel cover す');
  await reload(page);
  await expect(page.locator('#pub-pending')).toContainText('data/reels.json changed');
  const before = snapshot(github);
  await publish(page);
  await expectStopped(page, github, before, `${MSG.missing('Reel cover す (sugoi)', 'media/reels/sugoi.webp')}.`, MSG.siteNext('Clear cover'));
});

test('without the reload the portrait file is in the publish: one commit', async ({ page, github }) => {
  await setup(page, github);
  await useSitePhoto(page, 'Portrait', 'Portrait');
  await publish(page);
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  expect(treeBody(github).tree.map((e) => e.path).sort()).toEqual(['data/site.json', PORTRAIT]);
  expect(committed(github, 'data/site.json').portrait).toBe(PORTRAIT);
  expect(newCommits(github)).toBe(1);
});

test('portrait set to a file already on GitHub, no pending file: publishes', async ({ page, github }) => {
  await setup(page, github, { files: { [PORTRAIT]: webp('portrait') } });
  await useSitePhoto(page, 'Portrait', 'Portrait');
  await reload(page);
  await publish(page);
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  expect(treeBody(github).tree.map((e) => e.path)).toEqual(['data/site.json']);
  expect(committed(github, 'data/site.json').portrait).toBe(PORTRAIT);
  expect(newCommits(github)).toBe(1);
});

test('"Clear portrait" after the reload, then Try again: one commit with portrait null', async ({ page, github }) => {
  // The published site.json already has a portrait, so clearing it is a change to publish.
  const site = `${JSON.stringify({ version: 1, portrait: 'media/site/old-portrait.webp' }, null, 2)}\n`;
  await setup(page, github, { site, files: { 'media/site/old-portrait.webp': webp('op') } });
  await useSitePhoto(page, 'Portrait', 'Portrait');
  await reload(page);
  const before = snapshot(github);
  await publish(page);
  await expectStopped(page, github, before, `${MSG.missing('Portrait', PORTRAIT)}.`, MSG.siteNext('Clear portrait'));
  await page.selectOption('#sp-target', { label: 'Portrait' });
  await expect(page.locator('#sp-clear')).toHaveText('Clear portrait');
  await page.locator('#sp-clear').press('Enter');
  await page.locator('#pub-retry').press('Enter');
  await expectResult(page.locator('#pub-ok')).toBeVisible();
  expect(newCommits(github)).toBe(1);
  expect(treeBody(github).tree.map((e) => e.path)).toEqual(['data/site.json']);
  expect(committed(github, 'data/site.json').portrait).toBeNull();
});

test('non-plain portrait ./media/site/portrait.webp stops with "not in the usual form", no write', async ({ page, github }) => {
  await setup(page, github, { files: { [PORTRAIT]: webp('portrait') } });
  await page.evaluate(async () => (await import('/js/admin/site-draft.js')).setPortrait('./media/site/portrait.webp'));
  const before = snapshot(github);
  await publish(page);
  await expectStopped(page, github, before, `${MSG.form('Portrait', `./${PORTRAIT}`)}.`, MSG.siteNext('Clear portrait'));
});

test('an event problem and a site problem together: the message names the event and says "(and 1 more)"', async ({ page, github }) => {
  await setup(page, github);
  await importDraft(page, [ev(X, NEW), ev(Y)]);
  await page.evaluate(async (p) => (await import('/js/admin/site-draft.js')).setPortrait(p), PORTRAIT);
  const before = snapshot(github);
  await publish(page);
  await expectStopped(page, github, before, `${MSG.missing(WHO_X, NEW.photo)} (and 1 more).`, MSG.eventMissingNext);
});

test('pure brokenSitePhotoLinks: [] when in the tree or new, missing portrait / reel cover, [] for bad JSON', async ({ page, github }) => {
  await setup(page, github);
  const out = await page.evaluate(async ({ reels, portrait }) => {
    const m = await import('/js/admin/publish.js');
    const site = (p) => JSON.stringify({ version: 1, portrait: p });
    const withThumb = (id, thumb) => {
      const data = JSON.parse(reels);
      data.reels.find((r) => r.id === id).thumb = thumb;
      return JSON.stringify(data);
    };
    const tree = [{ path: portrait, type: 'blob' }, { path: 'media/reels/sugoi.webp', type: 'blob' }];
    const strip = (list) => list.map(({ kind, value, who }) => ({ kind, value, who }));
    return {
      inTree: m.brokenSitePhotoLinks(site(portrait), withThumb('sugoi', 'media/reels/sugoi.webp'), tree, false, new Set()),
      isNew: m.brokenSitePhotoLinks(site(portrait), withThumb('sasuga', 'media/reels/sasuga.webp'), [], false, new Set([portrait, 'media/reels/sasuga.webp'])),
      empty: m.brokenSitePhotoLinks(site(null), reels, [], false, new Set()),
      notInCommit: m.brokenSitePhotoLinks(null, null, [], false, new Set()),
      portrait: strip(m.brokenSitePhotoLinks(site(portrait), reels, [], false, new Set())),
      reel: strip(m.brokenSitePhotoLinks(site(null), withThumb('sugoi', 'media/reels/sugoi.webp'), [], false, new Set())),
      form: strip(m.brokenSitePhotoLinks(site(`./${portrait}`), null, tree, false, new Set())),
      truncated: strip(m.brokenSitePhotoLinks(site(portrait), null, tree, true, new Set())),
      bad: [m.brokenSitePhotoLinks('{bad', '[1,', [], false, new Set()), m.brokenSitePhotoLinks('[]', '{"reels": 3}', [], false, new Set())],
    };
  }, { reels: REELS_TEXT, portrait: PORTRAIT });
  expect(out.inTree).toEqual([]);
  expect(out.isNew).toEqual([]);
  expect(out.empty).toEqual([]);
  expect(out.notInCommit).toEqual([]);
  expect(out.portrait).toEqual([{ kind: 'missing', value: PORTRAIT, who: 'Portrait' }]);
  expect(out.reel).toEqual([{ kind: 'missing', value: 'media/reels/sugoi.webp', who: 'Reel cover す (sugoi)' }]);
  expect(out.form).toEqual([{ kind: 'form', value: `./${PORTRAIT}`, who: 'Portrait' }]);
  expect(out.truncated).toEqual([{ kind: 'unchecked', value: PORTRAIT, who: 'Portrait' }]);
  expect(out.bad).toEqual([[], []]);
});
