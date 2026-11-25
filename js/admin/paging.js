// Events list paging helpers (TASK-24). Pure functions plus the remembered page size (localStorage, never throws).
export const PAGE_SIZE_KEY = 'puzzkezz.admin.eventsPerPage';
export const PAGE_SIZES = [5, 10];

/** Device default: 5 under 768px (phone), 10 from 768px up. */
export function defaultPageSize(width) {
  return width < 768 ? 5 : 10;
}

export function pageCount(n, size) {
  return Math.max(1, Math.ceil(n / size));
}

/** 0-based page that holds the item at 0-based `index`. */
export function pageOf(index, size) {
  return Math.max(0, Math.floor(index / size));
}

/** Saved size (5 or 10), or `fallback` when nothing valid is saved or storage throws. */
export function readPageSize(fallback) {
  try {
    const v = Number(localStorage.getItem(PAGE_SIZE_KEY));
    return PAGE_SIZES.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

export function savePageSize(size) {
  try {
    localStorage.setItem(PAGE_SIZE_KEY, String(size));
  } catch { /* storage unavailable: the choice just is not remembered */ }
}
