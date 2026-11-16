// TASK-2: data layer (events.json, loader, sort, group, validate, ids, embed detection).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test('sample events.json follows the format', () => {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'events.json'), 'utf8'));
  expect(data.version).toBe(1);
  expect(data.events.length).toBeGreaterThanOrEqual(8);
  const years = new Set(data.events.map((e) => e.date.slice(0, 4)));
  for (const y of ['2024', '2025', '2026']) expect(years.has(y)).toBe(true);
  for (const e of data.events) expect(e.sample).toBe(true);
});

test('loader, sort, group, validation, ids and embed detection', async ({ page }) => {
  await page.goto('index.html');
  const r = await page.evaluate(async () => {
    const d = await import('./js/events-data.js');
    const { detectEmbed } = await import('./js/embed.js');
    const loaded = await d.loadEvents();
    const sorted = d.sortEvents([
      { id: 'a', date: '2025-01-01' }, { id: 'b', date: '2026-03-01' }, { id: 'c', date: '2025-01-01' },
    ]).map((e) => e.id);
    const groups = d.groupByYear([
      { date: '2024-05-01' }, { date: '2026-01-01' }, { date: '2026-02-01' },
    ]).map((g) => [g.year, g.events.length]);
    const v = (e) => d.validateEvent(e).map((x) => x.field);
    return {
      loadedDescending: loaded.every((e, i) => i === 0 || loaded[i - 1].date >= e.date),
      loadedCount: loaded.length,
      sorted,
      groups,
      ok: v({ date: '2025-12-06', short: 'CF', name: 'Comic Fiesta', activities: ['x'], link: 'https://a.b' }),
      badDate: v({ date: '2025-02-30', short: 'CF', name: 'x' }),
      missing: v({}),
      longShort: v({ date: '2025-01-01', short: 'ABCDEFGHIJKLM', name: 'x' }),
      badLink: v({ date: '2025-01-01', short: 'X', name: 'x', link: 'ftp://x' }),
      badActs: v({ date: '2025-01-01', short: 'X', name: 'x', activities: 'cosplay' }),
      id1: d.makeEventId({ date: '2025-12-06', short: 'CF' }, []),
      id2: d.makeEventId({ date: '2025-12-06', short: 'CF' }, ['2025-12-06-cf']),
      id3: d.makeEventId({ date: '2025-12-06', short: 'CF' }, ['2025-12-06-cf', '2025-12-06-cf-2']),
      date: d.formatDate('2025-12-06'),
      yt1: detectEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
      yt2: detectEmbed('https://youtu.be/dQw4w9WgXcQ'),
      yt3: detectEmbed('https://youtube.com/shorts/dQw4w9WgXcQ'),
      ig1: detectEmbed('https://www.instagram.com/reel/ABC123/'),
      ig2: detectEmbed('https://www.instagram.com/p/XYZ9/?igsh=1'),
      tt: detectEmbed('https://www.tiktok.com/@puzz/video/7300000000000000000'),
      fb: detectEmbed('https://www.facebook.com/watch/?v=1'),
    };
  });
  expect(r.loadedDescending).toBe(true);
  expect(r.loadedCount).toBeGreaterThanOrEqual(8);
  expect(r.sorted).toEqual(['b', 'a', 'c']);
  expect(r.groups).toEqual([[2026, 2], [2024, 1]]);
  expect(r.ok).toEqual([]);
  expect(r.badDate).toEqual(['date']);
  expect(r.missing).toEqual(['date', 'short', 'name']);
  expect(r.longShort).toEqual(['short']);
  expect(r.badLink).toEqual(['link']);
  expect(r.badActs).toEqual(['activities']);
  expect([r.id1, r.id2, r.id3]).toEqual(['2025-12-06-cf', '2025-12-06-cf-2', '2025-12-06-cf-3']);
  expect(r.date).toBe('6 Dec 2025');
  for (const yt of [r.yt1, r.yt2, r.yt3]) expect(yt).toMatchObject({ platform: 'youtube', embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' });
  expect(r.ig1.embedUrl).toBe('https://www.instagram.com/reel/ABC123/embed');
  expect(r.ig2.embedUrl).toBe('https://www.instagram.com/p/XYZ9/embed');
  expect(r.tt.embedUrl).toBe('https://www.tiktok.com/embed/v2/7300000000000000000');
  expect(r.fb).toMatchObject({ platform: 'link', embedUrl: null, label: 'Facebook' });
});

test('a missing events.json shows "Events coming soon" instead of crashing', async ({ page }) => {
  await page.route('**/data/events.json', (route) => route.fulfill({ status: 404, body: 'nope' }));
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('events.html');
  await expect(page.getByText('Events coming soon.')).toBeVisible();
  expect(errors).toEqual([]);
});
