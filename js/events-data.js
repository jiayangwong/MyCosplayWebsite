// Event data: load data/events.json, sort newest first, group by year, validate, and make ids.
// Format (see docs/plan.md section 4): { version: 1, events: [{ id, date, short, name, venue?, activities?, link?, photo?, photoFull?, photos?, sample? }] }
// photo = watermarked display copy (1200px), photoFull = watermarked full-size master (Gallery viewer only).
// photos (TASK-26, optional, only for events with 2-3 photos) = [{ photo, photoFull? }] in day order (D1, D2, D3);
// the top-level photo / photoFull always mirror photos[0], so code that shows one photo keeps reading them.

export const EVENTS_URL = new URL('../data/events.json', import.meta.url).href;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Newest first. Events on the same date keep their order from the array (stable sort). */
export function sortEvents(events) {
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => (a.event.date === b.event.date ? a.index - b.index : a.event.date < b.event.date ? 1 : -1))
    .map(({ event }) => event);
}

export function yearOf(event) {
  return Number(String(event.date).slice(0, 4));
}

/** Returns [{ year, events }] with years in descending order. Input must already be sorted. */
export function groupByYear(events) {
  const groups = [];
  for (const event of sortEvents(events)) {
    const year = yearOf(event);
    let group = groups.find((g) => g.year === year);
    if (!group) {
      group = { year, events: [] };
      groups.push(group);
    }
    group.events.push(event);
  }
  return groups.sort((a, b) => b.year - a.year);
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== '';
}

/** Checks an optional photo path (photo / photoFull). Returns an error text, or '' when fine.
 *  Allowed: missing or empty, or a relative path. Refused: not a string, leading "/", a backslash,
 *  "://" or any "scheme:" prefix (data:, javascript:, http:, ...), or "..". */
export function photoPathError(value) {
  if (value === undefined || value === '') return '';
  if (typeof value !== 'string') return 'must be a file path.';
  if (value.startsWith('/')) return 'must be a relative path (no leading /).';
  if (value.includes('\\')) return 'must use / between folders, not \\.';
  if (value.includes('://') || /^[a-z][a-z0-9+.-]*:/i.test(value)) return 'must be a path in this site, not a web address.';
  if (value.includes('..')) return 'must not contain "..".';
  return '';
}

/** Returns a list of { field, message } errors. An empty list means the event is valid. */
export function validateEvent(event) {
  const errors = [];
  const e = event || {};
  if (!e.date) errors.push({ field: 'date', message: 'Date is required.' });
  else if (!isValidDate(e.date)) errors.push({ field: 'date', message: 'Date must be a real date in YYYY-MM-DD format.' });

  const short = typeof e.short === 'string' ? e.short.trim() : '';
  if (!short) errors.push({ field: 'short', message: 'Short form is required (e.g. CF).' });
  else if (short.length > 12) errors.push({ field: 'short', message: 'Short form must be 12 characters or fewer.' });

  if (!(typeof e.name === 'string' && e.name.trim())) errors.push({ field: 'name', message: 'Full name is required.' });

  if (e.link !== undefined && e.link !== '' && !isHttpUrl(e.link)) {
    errors.push({ field: 'link', message: 'Link must start with http:// or https://.' });
  }
  if (e.activities !== undefined && !(Array.isArray(e.activities) && e.activities.every((a) => typeof a === 'string'))) {
    errors.push({ field: 'activities', message: 'Activities must be a list of names.' });
  }
  const photoError = photoPathError(e.photo);
  if (photoError) errors.push({ field: 'photo', message: `Display photo ${photoError}` });
  const fullError = photoPathError(e.photoFull);
  if (fullError) errors.push({ field: 'photoFull', message: `Full-size photo ${fullError}` });
  else if (hasValue(e.photoFull) && !hasValue(e.photo)) {
    errors.push({ field: 'photoFull', message: 'Full-size photo needs a Display photo too.' });
  }
  if (e.photos !== undefined) errors.push(...photosErrors(e));
  return errors;
}

export const MAX_EVENT_PHOTOS = 3;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Errors ({ field: 'photos', message }) for the optional `photos` list of an event. */
function photosErrors(e) {
  const err = (message) => [{ field: 'photos', message }];
  const list = e.photos;
  if (!Array.isArray(list)) return err('Photos must be a list.');
  if (list.length === 0) return err('Photos must have at least 1 photo.');
  if (list.length > MAX_EVENT_PHOTOS) return err(`Photos can have at most ${MAX_EVENT_PHOTOS} photos.`);
  const seen = new Set();
  for (let i = 0; i < list.length; i += 1) {
    const entry = list[i];
    const label = `Photo ${i + 1}`;
    if (!isObject(entry)) return err(`${label} must be an object with a photo path.`);
    if (!hasValue(entry.photo)) return err(`${label} needs a Display photo.`);
    const photoError = photoPathError(entry.photo);
    if (photoError) return err(`${label} display photo ${photoError}`);
    const fullError = photoPathError(entry.photoFull);
    if (fullError) return err(`${label} full-size photo ${fullError}`);
    if (seen.has(entry.photo)) return err(`${label} uses the same display photo as an earlier photo.`);
    seen.add(entry.photo);
  }
  const first = list[0];
  if (hasValue(e.photo) && e.photo !== first.photo) return err('Photo must equal the first entry of photos.');
  if (hasValue(e.photoFull) && e.photoFull !== first.photoFull) return err('Full-size photo must equal the first entry of photos.');
  return [];
}

/** The photos of an event in day order: [{ photo, photoFull }] (photoFull is undefined when missing). Max 3. */
export function eventPhotos(event) {
  const e = event || {};
  const full = (value) => (hasValue(value) ? value : undefined);
  if (Array.isArray(e.photos)) {
    return e.photos
      .filter((p) => isObject(p) && hasValue(p.photo))
      .slice(0, MAX_EVENT_PHOTOS)
      .map((p) => ({ photo: p.photo, photoFull: full(p.photoFull) }));
  }
  return hasValue(e.photo) ? [{ photo: e.photo, photoFull: full(e.photoFull) }] : [];
}

/** Adds the mirror (top-level photo / photoFull = photos[0]) to an event that has `photos`.
 *  An event without a usable `photos` list is returned as it is (same object). */
export function normalizeEvent(event) {
  if (!isObject(event) || !Array.isArray(event.photos) || !isObject(event.photos[0]) || !hasValue(event.photos[0].photo)) return event;
  const first = event.photos[0];
  const copy = { ...event, photo: first.photo };
  if (hasValue(first.photoFull)) copy.photoFull = first.photoFull;
  else delete copy.photoFull;
  return copy;
}

export function slugify(text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'event';
}

/** `<date>-<slug(short)>`, with -2, -3 ... added when the id is already used. */
export function makeEventId(event, existingIds = []) {
  const taken = new Set(existingIds);
  const base = `${event.date}-${slugify(event.short)}`;
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/** "2025-12-06" -> "6 Dec 2025" */
export function formatDate(iso) {
  if (!isValidDate(iso)) return iso || '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Fetches events.json and returns the events sorted newest first. Returns [] on any failure. */
export async function loadEvents(url = EVENTS_URL) {
  try {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const events = Array.isArray(data) ? data : data.events;
    if (!Array.isArray(events)) throw new Error('events.json has no "events" list');
    return sortEvents(events.filter((e) => validateEvent(e).length === 0).map(normalizeEvent));
  } catch (error) {
    console.warn('Could not load events:', error.message);
    return [];
  }
}
