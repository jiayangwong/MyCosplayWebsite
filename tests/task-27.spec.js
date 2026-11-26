// TASK-27: the admin attaches up to 3 photos per event (slots D1 D2 D3), orders and removes them, and Publish
// handles every slot. Uses the strict in-memory fake GitHub from tests/github-mock.js and the fake token only.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect, BRANCH, FakeRepo, openFold, saveFakeToken } = require('./github-mock');
const { noHorizontalScroll, showEvent } = require('./helpers');
const guard = require('./wm-guard');

const SMALL = path.join(__dirname, 'fixtures', 'flat-800x600.png');
const REPO = '/repos/jiayangwong/MyCosplayWebsite';
const TREE_POST = `POST ${REPO}/git/trees`;
const REF_PATCH = `PATCH ${REPO}/git/refs/heads/${BRANCH}`;
const expectResult = expect.configure({ timeout: 15000 });
test.describe.configure({ timeout: 90000 });

const X = '2026-03-14-cf';
const Y = '2025-08-09-omt';
const ev = (id, extra = {}) => ({ id, date: id.slice(0, 10), short: id.slice(11).toUpperCase(), name: `${id.slice(11).toUpperCase()} Test Con`, ...extra });
const webp = (tag) => Buffer.concat([Buffer.from('RIFF\x10\x00\x00\x00WEBP', 'latin1'), Buffer.from(tag)]);
/** A published photo entry: media/events/<id>/<name>.webp + -full.webp. */
const pic = (id, name) => ({ photo: `media/events/${id}/${name}.webp`, photoFull: `media/events/${id}/${name}-full.webp` });
const files = (...pics) => Object.fromEntries(pics.flatMap((p) => [[p.photo, webp(p.photo)], [p.photoFull, webp(p.photoFull)]]));
/** Event with these photos as the admin writes them (E2 / E3). */
const withPhotos = (id, list, extra = {}) => ev(id, {
  photo: list[0].photo, photoFull: list[0].photoFull, ...(list.length > 1 ? { photos: list } : {}), ...extra,
});
const NAMES = ['flat-800x600', 'flat-800x600-2', 'flat-800x600-3'];
const mine = (id) => NAMES.map((n) => pic(id, n));

const card = (page, i) => page.locator('.wm-card').nth(i);
const row = (page, id) => page.locator(`.event-row[data-id="${id}"]`);
const writes = (github) => github.calls().filter((c) => !c.startsWith('GET '));
const newCommits = (github) => github.repo.commits.size - 1;
const treeBody = (github) => github.requests.filter((r) => `${r.method} ${r.path}` === TREE_POST).pop().body;
const committed = (github, p) => JSON.parse(github.repo.read(p));
const draftEvent = (page, id) => page.evaluate(async (eid) => {
  const m = await import('/js/admin/manager.js');
  return JSON.parse(m.draftText()).events.find((e) => e.id === eid) || null;
}, id);
const slotValues = (page) => page.evaluate(() => ['f-photo', 'f-photo-2', 'f-photo-3'].map((x) => document.getElementById(x).value));
const fullValues = (page) => page.evaluate(() => ['f-photo-full', 'f-photo-full-2', 'f-photo-full-3'].map((x) => document.getElementById(x).value));

async function ready(page) {
  for (const flag of ['manager', 'uploader', 'github', 'publish']) {
    await expectResult(page.locator('html')).toHaveAttribute(`data-${flag}-ready`, 'true');
  }
}

async function setup(page, github, { events = [ev(X), ev(Y)], repoFiles = {} } = {}) {
  const text = `${JSON.stringify({ version: 1, events }, null, 2)}\n`;
  github.repo = new FakeRepo({ files: { 'data/events.json': text, ...repoFiles } });
  await page.route('**/data/events.json', (route) => route.fulfill({ contentType: 'application/json', body: text }));
  page.on('dialog', (d) => d.accept());
  await page.goto('admin/index.html');
  await ready(page);
  await openFold(page, 'form-panel');
  await openFold(page, 'wm-panel');
  await saveFakeToken(page);
}

async function edit(page, id) {
  await showEvent(page, id);
  await row(page, id).getByRole('button', { name: /^Edit/ }).press('Enter');
  await expect(page.locator('#wm-event-id')).toHaveText(id);
}

/** Uploads the small fixture n more times (names flat-800x600, -2, -3 ...) and waits until they are ready. */
async function upload(page, n) {
  const first = await page.locator('.wm-card').count();
  for (let i = 0; i < n; i += 1) {
    await page.setInputFiles('#wm-files', SMALL);
    await expectResult(card(page, first + i)).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
  }
}

const attachBtn = (page, i) => card(page, i).getByRole('button', { name: 'Attach to selected event' });

async function attachCards(page, ...indexes) {
  for (const i of indexes) await attachBtn(page, i).press('Enter');
}

async function openPublish(page) {
  await openFold(page, 'pub');
}

test.describe('slots in the Event form', () => {
  test('the form has rows D1 to D3; D1 keeps #f-photo and #f-photo-full; buttons are real, labelled and 44px', async ({ page, github }) => {
    await setup(page, github);
    await edit(page, X);
    const rows = page.locator('#slots .slot');
    await expect(rows).toHaveCount(3);
    await expect(page.locator('#slots legend, fieldset.slots-fs legend')).toHaveText('Photos (up to 3)');
    for (const id of ['f-photo', 'f-photo-full', 'f-photo-2', 'f-photo-full-2', 'f-photo-3', 'f-photo-full-3']) await expect(page.locator(`#${id}`)).toBeVisible();
    for (const n of [1, 2, 3]) {
      for (const name of [`Move photo D${n} up`, `Move photo D${n} down`, `Remove photo D${n}`]) {
        const b = page.getByRole('button', { name, exact: true });
        await expect(b).toHaveJSProperty('type', 'button');
        const box = await b.boundingBox();
        expect(box.width, name).toBeGreaterThanOrEqual(44);
        expect(box.height, name).toBeGreaterThanOrEqual(44);
      }
    }
    await expect(rows.nth(0)).toContainText('D1');
    await expect(page.locator('#slot-th-1')).toHaveText('No photo');
    await expect(page.locator('#slots-sum')).toHaveText('No photos on this event.');
  });

  test('attach x3 fills D1, D2, D3 in order, 3 pending pairs, then Attach is disabled with the hint; draft has photos (3) and D1 mirror', async ({ page, github }) => {
    await setup(page, github);
    await upload(page, 3);
    await edit(page, X);
    const want = mine(X);
    await attachCards(page, 0);
    expect(await slotValues(page)).toEqual([want[0].photo, '', '']);
    await expect(attachBtn(page, 1)).toBeEnabled();
    await attachCards(page, 1);
    expect(await slotValues(page)).toEqual([want[0].photo, want[1].photo, '']);
    await attachCards(page, 2);
    expect(await slotValues(page)).toEqual(want.map((w) => w.photo));
    expect(await fullValues(page)).toEqual(want.map((w) => w.photoFull));
    // One pending pair per slot path (a second attach no longer drops the first).
    const pending = await page.evaluate(async () => (await import('/js/admin/pending.js')).pendingPairs().map((p) => [p.eventId, p.photo, p.photoFull]));
    expect(pending).toEqual(want.map((w) => [X, w.photo, w.photoFull]));
    await openPublish(page);
    await expect(page.locator('#pub-pending .pend-pair')).toHaveCount(3);
    await expect(page.locator('#pub-total')).toContainText('Adds 3 photos, 6 files');
    // Disabled at 3 with the hint.
    for (let i = 0; i < 3; i += 1) {
      await expect(attachBtn(page, i)).toBeDisabled();
      await expect(card(page, i).locator('.wm-attach-msg')).toHaveText('! This event already has 3 photos');
    }
    // The draft: photo / photoFull = D1, photos has 3 entries.
    expect(await draftEvent(page, X)).toEqual(withPhotos(X, want));
    // A fourth card cannot be attached either.
    await upload(page, 1);
    await expect(attachBtn(page, 3)).toBeDisabled();
    // Moving to another event enables Attach again; back to X it is disabled again.
    await edit(page, Y);
    await expect(attachBtn(page, 3)).toBeEnabled();
    await expect(card(page, 3).locator('.wm-attach-msg')).toBeHidden();
    await edit(page, X);
    await expect(attachBtn(page, 3)).toBeDisabled();
  });

  test('an event with a published photo gets the next slot (D2); attaching the same card twice changes nothing', async ({ page, github }) => {
    const old = pic(X, 'old');
    await setup(page, github, { events: [withPhotos(X, [old]), ev(Y)], repoFiles: files(old) });
    await upload(page, 1);
    await edit(page, X);
    await attachCards(page, 0, 0);
    expect(await slotValues(page)).toEqual([old.photo, mine(X)[0].photo, '']);
    const pending = await page.evaluate(async () => (await import('/js/admin/pending.js')).pendingPairs().length);
    expect(pending).toBe(1);
    const e = await draftEvent(page, X);
    expect(e.photo).toBe(old.photo);
    expect(e.photos.map((p) => p.photo)).toEqual([old.photo, mine(X)[0].photo]);
  });

  test('a new unsaved event: attached photos keep their slot when the date changes; Save writes photos only for 2-3 photos', async ({ page, github }) => {
    await setup(page, github);
    await upload(page, 2);
    await page.press('#new-event', 'Enter');
    await page.fill('#f-date', '2026-12-20');
    await page.fill('#f-short', 'NEW');
    await page.fill('#f-name', 'New Con');
    const id = '2026-12-20-new';
    await expect(page.locator('#wm-event-id')).toHaveText(id);
    await attachCards(page, 0, 1);
    expect(await slotValues(page)).toEqual([mine(id)[0].photo, mine(id)[1].photo, '']);
    await page.fill('#f-date', '2026-12-21');
    await expect(page.locator('#wm-event-id')).toHaveText('2026-12-21-new');
    expect(await slotValues(page)).toEqual([mine('2026-12-21-new')[0].photo, mine('2026-12-21-new')[1].photo, '']);
    await page.press('#f-name', 'Enter');
    await expectResult(page.locator('#save-status')).toContainText('Saved NEW');
    expect(await draftEvent(page, '2026-12-21-new')).toMatchObject({ photo: mine('2026-12-21-new')[0].photo, photos: [{}, {}] });
    // Saving with an empty D1 but a filled D2 moves D2 up (no gaps are saved).
    await page.fill('#f-photo', '');
    await page.fill('#f-photo-full', '');
    await page.press('#f-name', 'Enter');
    await expectResult(page.locator('#save-status')).toContainText('Saved NEW');
    const one = await draftEvent(page, '2026-12-21-new');
    expect(one.photo).toBe(mine('2026-12-21-new')[1].photo);
    expect(one.photos).toBeUndefined(); // 1 photo = the old shape (E3)
    expect(await slotValues(page)).toEqual([mine('2026-12-21-new')[1].photo, '', '']);
  });
});

test.describe('order and remove', () => {
  test('down on D1, up on D3: order changes, ends are disabled, the draft follows', async ({ page, github }) => {
    await setup(page, github);
    await upload(page, 3);
    await edit(page, X);
    await attachCards(page, 0, 1, 2);
    const [a, b, c] = mine(X);
    const up = (n) => page.getByRole('button', { name: `Move photo D${n} up`, exact: true });
    const down = (n) => page.getByRole('button', { name: `Move photo D${n} down`, exact: true });
    await expect(up(1)).toBeDisabled();
    await expect(down(3)).toBeDisabled();
    await expect(up(2)).toBeEnabled();
    await expect(down(1)).toBeEnabled();
    await down(1).press('Enter');
    expect(await slotValues(page)).toEqual([b.photo, a.photo, c.photo]);
    expect(await fullValues(page)).toEqual([b.photoFull, a.photoFull, c.photoFull]); // both paths travel together
    await up(3).press('Enter');
    expect(await slotValues(page)).toEqual([b.photo, c.photo, a.photo]);
    expect(await draftEvent(page, X)).toEqual(withPhotos(X, [b, c, a]));
    await expect(up(1)).toBeDisabled();
    await expect(down(3)).toBeDisabled();
    // The row list chip is unchanged by a move.
    await expect(row(page, X).locator('.ph-chip')).toHaveText('3 photos');
  });

  test('X on a pending D2 asks first; Cancel changes nothing; Remove closes the gap and takes the pair out of the publish list', async ({ page, github }) => {
    await setup(page, github);
    await upload(page, 3);
    await edit(page, X);
    await attachCards(page, 0, 1, 2);
    const [a, b, c] = mine(X);
    await openPublish(page);
    await expect(page.locator('#pub-pending .pend-pair')).toHaveCount(3);
    const dialog = page.locator('#wm-remove-confirm');
    await page.getByRole('button', { name: 'Remove photo D2', exact: true }).press('Enter');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Remove photo D2 (flat-800x600.png)? It is attached to CF 2026 and will be taken out of the publish.');
    await expect(page.locator('#wm-remove-no')).toBeFocused();
    await page.locator('#wm-remove-no').click();
    await expect(dialog).toBeHidden();
    expect(await slotValues(page)).toEqual([a.photo, b.photo, c.photo]);
    await expect(page.locator('#pub-pending .pend-pair')).toHaveCount(3);
    expect(await draftEvent(page, X)).toEqual(withPhotos(X, [a, b, c]));

    await page.getByRole('button', { name: 'Remove photo D2', exact: true }).press('Enter');
    await page.locator('#wm-remove-yes').click();
    await expect(dialog).toBeHidden();
    expect(await slotValues(page)).toEqual([a.photo, c.photo, '']); // the gap is closed: D3 became D2
    await expect(page.locator('#pub-pending .pend-pair')).toHaveCount(2);
    await expect(page.locator('#pub-pending')).not.toContainText(b.photo);
    expect(await draftEvent(page, X)).toEqual(withPhotos(X, [a, c]));
    await expect(row(page, X).locator('.ph-chip')).toHaveText('2 photos');
    await expect(card(page, 1)).toBeVisible(); // the uploader card stays
    // Attach is possible again (a free slot) and the removed card fills D3.
    await expect(attachBtn(page, 1)).toBeEnabled();
    await attachCards(page, 1);
    expect(await slotValues(page)).toEqual([a.photo, c.photo, b.photo]);
  });

  test('X on a slot that is not pending removes it at once (no dialog); with one photo left the draft is in the old shape', async ({ page, github }) => {
    const [p1, p2] = [pic(X, 'one'), pic(X, 'two')];
    await setup(page, github, { events: [withPhotos(X, [p1, p2]), ev(Y)], repoFiles: files(p1, p2) });
    await edit(page, X);
    expect(await slotValues(page)).toEqual([p1.photo, p2.photo, '']);
    await page.getByRole('button', { name: 'Remove photo D1', exact: true }).press('Enter');
    await expect(page.locator('#wm-remove-confirm')).toBeHidden();
    expect(await slotValues(page)).toEqual([p2.photo, '', '']);
    expect(await draftEvent(page, X)).toEqual(withPhotos(X, [p2]));
    await expect(row(page, X).locator('.ph-chip')).toHaveText('1 photo');
  });

  test('1 photo: the draft and the Export text of that event have no photos key (TASK-10 shape)', async ({ page, github }) => {
    await setup(page, github);
    await upload(page, 1);
    await edit(page, X);
    await attachCards(page, 0);
    const [a] = mine(X);
    expect(await draftEvent(page, X)).toEqual(ev(X, { photo: a.photo, photoFull: a.photoFull }));
    const text = await page.evaluate(async () => (await import('/js/admin/manager.js')).exportText(JSON.parse((await import('/js/admin/manager.js')).draftText()).events));
    expect(text).not.toContain('"photos"');
    await expect(row(page, X).locator('.ph-chip')).toHaveText('1 photo');
  });

  test('Export text writes photos right after photoFull, only for 2-3 photos', async ({ page, github }) => {
    await setup(page, github);
    await upload(page, 2);
    await edit(page, X);
    await attachCards(page, 0, 1);
    const keys = await page.evaluate(async () => {
      const m = await import('/js/admin/manager.js');
      return Object.keys(JSON.parse(m.draftText()).events.find((e) => e.id === '2026-03-14-cf'));
    });
    expect(keys).toEqual(['id', 'date', 'short', 'name', 'photo', 'photoFull', 'photos']);
  });
});

test.describe('Publish', () => {
  test('3 new photos: one tree with events.json + 6 image blobs, one commit; decoded events.json has photos (3)', async ({ page, github }) => {
    await setup(page, github);
    await upload(page, 3);
    await edit(page, X);
    await attachCards(page, 0, 1, 2);
    const want = mine(X);
    await expectResult(page.locator('#publish-btn')).toBeEnabled();
    await page.locator('#publish-btn').press('Enter');
    await expectResult(page.locator('#pub-ok')).toBeVisible();
    await expect(page.locator('#pub-confirm')).toBeHidden();
    const tree = treeBody(github).tree.map((e) => e.path).sort();
    expect(tree).toEqual(['data/events.json', ...want.flatMap((w) => [w.photo, w.photoFull])].sort());
    expect(tree).toHaveLength(7);
    expect(github.calls().filter((c) => c === TREE_POST)).toHaveLength(1);
    expect(github.calls().filter((c) => c === REF_PATCH)).toHaveLength(1);
    expect(newCommits(github)).toBe(1);
    const live = committed(github, 'data/events.json').events.find((e) => e.id === X);
    expect(live).toEqual(withPhotos(X, want));
    expect(github.repo.commits.get(github.repo.head).message).toBe('Update events from /admin/ (2 events, 3 photos)');
  });

  test('the 20 photo limit counts each photo separately (21 pairs = limited, 20 = fine)', async ({ page, github }) => {
    await setup(page, github);
    // 7 events with 3 photos each = 21 pairs. Fake pairs: only the count matters for the limit rule.
    const ids = Array.from({ length: 7 }, (_, i) => `2026-0${i + 1}-10-e${i + 1}`);
    const events = ids.map((id) => withPhotos(id, mine(id)));
    await page.setInputFiles('#import-file', { name: 'events.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, events })) });
    await expectResult(page.locator('#save-status')).toContainText('Imported 7 events');
    const add = (n) => page.evaluate(async ({ list, n: count }) => {
      const pending = await import('/js/admin/pending.js');
      const all = list.flatMap((id) => ['flat-800x600', 'flat-800x600-2', 'flat-800x600-3'].map((name) => ({ id, name })));
      for (const { id, name } of all.slice(0, count)) {
        const blob = new Blob(['x']);
        pending.addPendingPair({
          eventId: id,
          photo: `media/events/${id}/${name}.webp`,
          photoFull: `media/events/${id}/${name}-full.webp`,
          item: { display: { blob }, master: { blob }, downloaded: { display: true, master: true }, file: { name: `${name}.png` } },
        });
      }
    }, { list: ids, n });
    await add(20);
    await openPublish(page);
    await expect(page.locator('#pub-pending .pend-pair')).toHaveCount(20);
    await expect(page.locator('#pub-limit')).toBeHidden();
    await add(21);
    await expect(page.locator('#pub-pending .pend-pair')).toHaveCount(21);
    await expect(page.locator('#pub-limit')).toContainText('Publish at most 20 photos at a time');
    await expect(page.locator('#publish-btn')).toBeDisabled();
  });

  test('remove a published D2 then Publish: the dialog lists exactly its 2 files; a file shared with another event is never listed', async ({ page, github }) => {
    const [a, b, c] = [pic(X, 'a'), pic(X, 'b'), pic(X, 'c')];
    await setup(page, github, {
      events: [withPhotos(X, [a, b, c]), withPhotos(Y, [c])],
      repoFiles: files(a, b, c),
    });
    await edit(page, X);
    await page.getByRole('button', { name: 'Remove photo D2', exact: true }).press('Enter');
    expect(await slotValues(page)).toEqual([a.photo, c.photo, '']);
    // The pending list previews exactly b's two files; c is still used by X (now D2) and by Y.
    await openPublish(page);
    await expect(page.locator('#pub-pending')).toContainText(`- ${b.photo} (no event uses it)`);
    await expect(page.locator('#pub-pending')).toContainText(`- ${b.photoFull} (no event uses it)`);
    await expect(page.locator('#pub-pending')).not.toContainText(`- ${c.photo}`);
    // Remove X's D2 (c) as well: Y still uses c, so it is never listed.
    await page.getByRole('button', { name: 'Remove photo D2', exact: true }).press('Enter');
    expect(await slotValues(page)).toEqual([a.photo, '', '']);
    await page.locator('#publish-btn').press('Enter');
    await expectResult(page.locator('#pub-confirm')).toBeVisible();
    await expect(page.locator('#pub-confirm-title')).toHaveText('These 2 old files will be removed');
    expect((await page.locator('#pub-confirm-list li').allTextContents()).map((t) => t.replace(/^\W+/, '')).sort()).toEqual([b.photo, b.photoFull].sort());
    // Cancel keeps them.
    await page.locator('#pub-confirm-no').press('Enter');
    await expect(page.locator('#pub-confirm')).toBeHidden();
    expect(writes(github)).toEqual([]);
    await page.locator('#publish-btn').press('Enter');
    await expectResult(page.locator('#pub-confirm')).toBeVisible();
    await page.locator('#pub-confirm-yes').press('Enter');
    await expectResult(page.locator('#pub-ok')).toBeVisible();
    expect(treeBody(github).tree.filter((e) => e.sha === null).map((e) => e.path).sort()).toEqual([b.photo, b.photoFull].sort());
    const live = github.repo.filesAt();
    expect(live.has(c.photo)).toBe(true);
    expect(live.has(a.photo)).toBe(true);
    expect(committed(github, 'data/events.json').events.find((e) => e.id === X)).toEqual(withPhotos(X, [a]));
  });

  test('a file used only by a D3 slot is not removed; deleting the event lists all files of all its slots', async ({ page, github }) => {
    const [a, b, c] = [pic(X, 'a'), pic(X, 'b'), pic(X, 'c')];
    await setup(page, github, { events: [withPhotos(X, [a, b, c]), ev(Y)], repoFiles: files(a, b, c) });
    // Renaming another event: X's D2 and D3 files are used, nothing is removed.
    await edit(page, Y);
    await page.fill('#f-name', 'Renamed Con');
    await page.press('#f-name', 'Enter');
    await expectResult(page.locator('#save-status')).toContainText('Saved');
    await openPublish(page);
    await expect(page.locator('#pub-pending')).not.toContainText('(no event uses it)');
    await row(page, X).getByRole('button', { name: /^Delete/ }).press('Enter');
    await expectResult(page.locator('#pub-pending')).toContainText('(no event uses it)');
    await page.locator('#publish-btn').press('Enter');
    await expectResult(page.locator('#pub-confirm-title')).toHaveText('These 6 old files will be removed');
  });

  test('broken slot link: D3 points at a missing file with no pending pair: stops with the TASK-16 message, no write', async ({ page, github }) => {
    const [a, b] = [pic(X, 'a'), pic(X, 'b')];
    const c = pic(X, 'gone');
    await setup(page, github, { events: [withPhotos(X, [a, b]), ev(Y)], repoFiles: files(a, b) });
    await page.setInputFiles('#import-file', {
      name: 'events.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ version: 1, events: [withPhotos(X, [a, b, c]), ev(Y)] })),
    });
    await expectResult(page.locator('#save-status')).toContainText('Imported');
    const head = github.repo.head;
    await expectResult(page.locator('#publish-btn')).toBeEnabled();
    await page.locator('#publish-btn').press('Enter');
    await expectResult(page.locator('#pub-err')).toBeVisible();
    await expect(page.locator('#pub-err-text')).toHaveText(`Event "CF 2026" (${X}) points at a photo that is not on GitHub and not in this publish: ${c.photo}.`);
    await expect(page.locator('#pub-err-next')).toHaveText('Attach the photo again, or remove it from the event, then publish. Nothing was changed.');
    await expect(page.locator('#pub-confirm')).toBeHidden();
    expect(writes(github)).toEqual([]);
    expect(github.repo.head).toBe(head);
  });

  test('Remove from publish on D3: only that slot goes, note names D3; on D2 the event is back to 1 photo (no photos key)', async ({ page, github }) => {
    const old = pic(X, 'old');
    await setup(page, github, { events: [withPhotos(X, [old]), ev(Y)], repoFiles: files(old) });
    await upload(page, 2);
    await edit(page, X);
    await attachCards(page, 0, 1);
    const [n1, n2] = mine(X);
    expect(await draftEvent(page, X)).toEqual(withPhotos(X, [old, n1, n2]));
    await openPublish(page);
    await expect(page.locator('#pub-pending .pend-pair')).toHaveCount(2);
    await page.locator('#pub-pending .pend-pair').nth(1).locator('.pend-remove').press('Enter');
    await expectResult(page.locator('#pub-note')).toHaveText('Photo D3 removed from CF 2026 (not published yet).');
    expect(await draftEvent(page, X)).toEqual(withPhotos(X, [old, n1]));
    expect(await slotValues(page)).toEqual([old.photo, n1.photo, '']);
    await page.locator('#pub-pending .pend-pair').nth(0).locator('.pend-remove').press('Enter');
    await expectResult(page.locator('#pub-note')).toHaveText('Photo D2 removed from CF 2026 (not published yet).');
    expect(await draftEvent(page, X)).toEqual(withPhotos(X, [old]));
    expect((await draftEvent(page, X)).photos).toBeUndefined();
    await expect(page.locator('#pub-pending')).toHaveText('No pending changes.');
    expect(writes(github)).toEqual([]);
  });

  test('Remove from publish when the event no longer holds the pair in a slot: the draft is not changed, no note', async ({ page, github }) => {
    const old = pic(X, 'old');
    await setup(page, github, { events: [withPhotos(X, [old]), ev(Y)], repoFiles: files(old) });
    await upload(page, 1);
    await edit(page, X);
    await attachCards(page, 0);
    // The slot is edited by hand (the pair's display path leaves the event, its full-size path stays).
    const other = `media/events/${X}/typed.webp`;
    await page.fill('#f-photo-2', other);
    await page.press('#f-name', 'Enter');
    await expectResult(page.locator('#save-status')).toContainText('Saved');
    const before = await draftEvent(page, X);
    await openPublish(page);
    await page.locator('#pub-pending .pend-remove').press('Enter');
    expect(await draftEvent(page, X)).toEqual(before);
    await expect(page.locator('#pub-note')).toBeHidden();
  });
});

test.describe('event rows', () => {
  test('rows show a chip: No photos, 1 photo, 2 photos, 3 photos (storyboard); nothing else in the meta changes', async ({ page, github }) => {
    const [a, b, c] = mine(X);
    const Z = '2024-05-01-zz';
    await setup(page, github, { events: [withPhotos(X, [a, b, c]), withPhotos(Y, [a, b]), withPhotos('2025-01-01-one', [a]), ev(Z)] });
    await expect(row(page, X).locator('.ph-chip')).toHaveText('3 photos');
    await expect(row(page, Y).locator('.ph-chip')).toHaveText('2 photos');
    await expect(row(page, '2025-01-01-one').locator('.ph-chip')).toHaveText('1 photo');
    await expect(row(page, Z).locator('.ph-chip')).toHaveText('No photos');
    await expect(row(page, X).locator('.event-row-meta')).toContainText('14 Mar 2026');
  });

  test('phone rules kept: buttons below the name, 44px, no horizontal scroll at 360px (slot buttons wrap too)', async ({ page, github }) => {
    const [a, b, c] = mine(X);
    await setup(page, github, { events: [withPhotos(X, [a, b, c]), ev(Y)] });
    await page.setViewportSize({ width: 360, height: 800 });
    await edit(page, X);
    await noHorizontalScroll(page);
    const { titleBottom, actionsTop } = await row(page, X).evaluate((el) => ({
      titleBottom: el.querySelector('.event-row-title').getBoundingClientRect().bottom,
      actionsTop: el.querySelector('.event-row-actions').getBoundingClientRect().top,
    }));
    expect(actionsTop).toBeGreaterThanOrEqual(titleBottom - 1);
    for (const b2 of await row(page, X).locator('.event-row-actions button').all()) {
      const box = await b2.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
    for (const b2 of await page.locator('#slots .slot-btn').all()) {
      await b2.scrollIntoViewIfNeeded();
      const box = await b2.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.x + box.width).toBeLessThanOrEqual(360);
    }
    await noHorizontalScroll(page);
  });

  test('panel rules of TASK-23 / TASK-24 stay: collapsed on load except Events', async ({ page, github }) => {
    await setup(page, github);
    await page.reload();
    await ready(page);
    for (const id of ['gh-panel', 'form-panel', 'publish-panel', 'moments-panel', 'wm-panel']) {
      await expect(page.locator(`#${id} > .fold-head .fold-btn`)).toHaveAttribute('aria-expanded', 'false');
    }
    await expect(page.locator('#events-panel > .fold-head .fold-btn')).toHaveAttribute('aria-expanded', 'true');
  });
});

test.describe('repo guard', () => {
  test('a missing and an unmarked path inside photos are both reported', async () => {
    const marker = await guard.loadMarker();
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-guard-27-'));
    try {
      const write = (rel, data) => {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), data);
      };
      write('media/events/x/unmarked.webp', webp('no marker'));
      write('tests/wm-allowlist.json', JSON.stringify({ files: [] }));
      write('data/events.json', JSON.stringify({
        version: 1,
        events: [ev(X, { photo: 'media/events/x/a.webp', photos: [{ photo: 'media/events/x/a.webp' }, { photo: 'media/events/x/unmarked.webp' }, { photo: 'media/events/x/missing.webp', photoFull: 'media/events/x/missing-full.webp' }] })],
      }));
      write('index.html', '<p>x</p>');
      const result = guard.checkRepo(root, { readMarker: marker.readWatermarkMarker });
      const paths = result.problems.map((p) => p.path);
      expect(paths).toContain('media/events/x/unmarked.webp');
      expect(paths).toContain('media/events/x/missing.webp');
      expect(paths).toContain('media/events/x/missing-full.webp');
      expect(result.problems.find((p) => p.path.endsWith('missing.webp')).message).toContain('does not exist');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
