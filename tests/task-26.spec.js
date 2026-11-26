// TASK-26: optional `photos` list (1-3 entries) in the event data: validateEvent, eventPhotos, normalizeEvent, loadEvents.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const MULTI = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'events-multi.json'), 'utf8'));
const BASE = { id: '2026-03-14-x', date: '2026-03-14', short: 'X', name: 'Event X' };
const P = (n, full) => (full ? { photo: `media/${n}.webp`, photoFull: `media/${n}-full.webp` } : { photo: `media/${n}.webp` });

async function run(page, fn, arg) {
  await page.goto('index.html');
  return page.evaluate(async ({ src, arg }) => {
    const d = await import('./js/events-data.js');
    // eslint-disable-next-line no-new-func
    return new Function('d', 'arg', `return (async () => { ${src} })();`)(d, arg);
  }, { src: `const f = ${fn.toString()}; return f(d, arg);`, arg });
}

test('valid: 1, 2, 3 entries, with and without photoFull, and the old shape', async ({ page }) => {
  const out = await run(page, (d, arg) => {
    const { BASE, P } = arg;
    const mk = (extra) => d.validateEvent({ ...BASE, ...extra }).map((x) => x.field);
    return {
      one: mk({ photos: [P[0]] }),
      two: mk({ photos: [P[0], P[1]] }),
      three: mk({ photos: [P[0], P[1], P[2]] }),
      noFull: mk({ photos: [{ photo: 'media/a.webp' }, { photo: 'media/b.webp' }] }),
      mirror: mk({ photo: P[0].photo, photoFull: P[0].photoFull, photos: [P[0], P[1]] }),
      old: mk({ photo: 'media/a.webp', photoFull: 'media/a-full.webp' }),
      none: mk({}),
    };
  }, { BASE, P: [P('a', true), P('b', true), P('c')] });
  for (const k of Object.keys(out)) expect(out[k], k).toEqual([]);
});

test('errors are reported on the field "photos"', async ({ page }) => {
  const a = P('a', true);
  const cases = {
    four: { photos: [P('a'), P('b'), P('c'), P('d')] },
    empty: { photos: [] },
    notArray: { photos: 'x' },
    notObject: { photos: [a, 'media/b.webp'] },
    noPhoto: { photos: [a, {}] },
    fullOnly: { photos: [a, { photoFull: 'media/b-full.webp' }] },
    abs: { photos: [a, { photo: '/abs.webp' }] },
    url: { photos: [a, { photo: 'https://x/y.webp' }] },
    dots: { photos: [a, { photo: '../x.webp' }] },
    fullAbs: { photos: [a, { photo: 'media/b.webp', photoFull: '/abs.webp' }] },
    dup: { photos: [a, { photo: a.photo }] },
    mirrorPhoto: { photo: 'media/other.webp', photos: [a, P('b')] },
    mirrorFull: { photo: a.photo, photoFull: 'media/other-full.webp', photos: [a, P('b')] },
  };
  const out = await run(page, (d, arg) => {
    const res = {};
    for (const [k, extra] of Object.entries(arg.cases)) res[k] = d.validateEvent({ ...arg.BASE, ...extra }).map((x) => x.field);
    return res;
  }, { BASE, cases });
  for (const k of Object.keys(cases)) expect(out[k], k).toEqual(['photos']);
});

test('eventPhotos: old shape 1, none 0, 2 and 3 in order, photoFull undefined when missing, max 3', async ({ page }) => {
  const out = await run(page, (d, arg) => {
    const res = {};
    for (const e of arg.events) res[e.short] = d.eventPhotos(e).map((p) => [p.photo, p.photoFull === undefined ? 'undef' : p.photoFull]);
    res.blankFull = d.eventPhotos({ photo: 'a.webp', photoFull: '' }).map((p) => 'photoFull' in p && p.photoFull === undefined);
    res.capped = d.eventPhotos({ photos: [1, 2, 3, 4, 5].map((n) => ({ photo: `m/${n}.webp` })) }).length;
    res.empty = d.eventPhotos({}).length + d.eventPhotos(null).length;
    return res;
  }, { events: MULTI.events });
  expect(out.ZERO).toEqual([]);
  expect(out.OLD).toEqual([['media/events/old/cover.webp', 'media/events/old/cover-full.webp']]);
  expect(out.NEW1).toEqual([['media/events/new1/a.webp', 'media/events/new1/a-full.webp']]);
  expect(out.TWO).toEqual([['media/events/two/a.webp', 'media/events/two/a-full.webp'], ['media/events/two/b.webp', 'undef']]);
  expect(out.THREE.map((p) => p[0])).toEqual(['media/events/three/a.webp', 'media/events/three/b.webp', 'media/events/three/c.webp']);
  expect(out.THREE[2][1]).toBe('undef');
  expect(out.blankFull).toEqual([true]);
  expect(out.capped).toBe(3);
  expect(out.empty).toBe(0);
});

test('normalizeEvent fills the mirror and leaves an old-shape event deep-equal', async ({ page }) => {
  const out = await run(page, (d, arg) => {
    const byShort = Object.fromEntries(arg.events.map((e) => [e.short, e]));
    const onlyp = d.normalizeEvent(byShort.ONLYP);
    const noFull = d.normalizeEvent({ id: 'x', photos: [{ photo: 'a.webp' }, { photo: 'b.webp' }], photoFull: 'stale.webp' });
    const old = d.normalizeEvent(byShort.OLD);
    const zero = d.normalizeEvent(byShort.ZERO);
    return {
      onlyp: [onlyp.photo, onlyp.photoFull, onlyp.photos.length],
      onlypInputUntouched: byShort.ONLYP.photo === undefined,
      noFull: [noFull.photo, 'photoFull' in noFull],
      oldSame: JSON.stringify(old) === JSON.stringify(byShort.OLD),
      zeroSame: zero === byShort.ZERO,
      nonObject: [d.normalizeEvent(null), d.normalizeEvent('x')],
    };
  }, { events: MULTI.events });
  expect(out.onlyp).toEqual(['media/events/onlyp/a.webp', 'media/events/onlyp/a-full.webp', 2]);
  expect(out.onlypInputUntouched).toBe(true);
  expect(out.noFull).toEqual(['a.webp', false]);
  expect(out.oldSame).toBe(true);
  expect(out.zeroSame).toBe(true);
  expect(out.nonObject).toEqual([null, 'x']);
});

test('loadEvents with the fixture: invalid events dropped, multi-photo events carry the mirror, old shape unchanged', async ({ page }) => {
  await page.route('**/data/events.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(MULTI) }));
  const out = await run(page, async (d) => {
    const events = await d.loadEvents();
    return events.map((e) => ({ short: e.short, photo: e.photo, photoFull: e.photoFull, n: d.eventPhotos(e).length, hasPhotos: 'photos' in e }));
  });
  expect(out.map((e) => e.short)).toEqual(['ZERO', 'OLD', 'NEW1', 'TWO', 'THREE', 'ONLYP']);
  const by = Object.fromEntries(out.map((e) => [e.short, e]));
  expect(by.ONLYP).toMatchObject({ photo: 'media/events/onlyp/a.webp', photoFull: 'media/events/onlyp/a-full.webp', n: 2, hasPhotos: true });
  expect(by.NEW1).toMatchObject({ photo: 'media/events/new1/a.webp', n: 1 });
  expect(by.THREE).toMatchObject({ photo: 'media/events/three/a.webp', n: 3 });
  expect(by.OLD).toMatchObject({ photo: 'media/events/old/cover.webp', n: 1, hasPhotos: false });
  expect(by.ZERO).toMatchObject({ n: 0, hasPhotos: false });
});

test('loadEvents still returns [] on failure', async ({ page }) => {
  await page.route('**/data/events.json', (route) => route.fulfill({ status: 500, body: 'no' }));
  expect(await run(page, async (d) => (await d.loadEvents()).length)).toBe(0);
});

test('every event in the real data/events.json passes validateEvent and loadEvents keeps all of them', async ({ page }) => {
  const real = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'events.json'), 'utf8'));
  const out = await run(page, async (d, arg) => ({
    invalid: arg.events.map((e) => ({ id: e.id, errors: d.validateEvent(e) })).filter((r) => r.errors.length),
    loaded: (await d.loadEvents()).map((e) => e.id),
  }), { events: real.events });
  expect(out.invalid).toEqual([]);
  expect(out.loaded.sort()).toEqual(real.events.map((e) => e.id).sort());
});
