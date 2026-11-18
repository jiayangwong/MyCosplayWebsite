// Event data: load data/events.json, sort newest first, group by year, validate, and make ids.
// Format (see docs/plan.md section 4): { version: 1, events: [{ id, date, short, name, venue?, activities?, link?, photo?, photoFull?, sample? }] }
// photo = watermarked display copy (1200px), photoFull = watermarked full-size master (Gallery viewer only).

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
 *  Allowed: missing or empty, or a relative path. Refused: not a string, leading "/", "://" or "..". */
export function photoPathError(value) {
  if (value === undefined || value === '') return '';
  if (typeof value !== 'string') return 'must be a file path.';
  if (value.startsWith('/')) return 'must be a relative path (no leading /).';
  if (value.includes('://')) return 'must be a path in this site, not a web address.';
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
  return errors;
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
    return sortEvents(events.filter((e) => validateEvent(e).length === 0));
  } catch (error) {
    console.warn('Could not load events:', error.message);
    return [];
  }
}
