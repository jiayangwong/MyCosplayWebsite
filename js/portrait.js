// Portrait (TASK-14): the Home guest pass (.pass-photo) and About (.portrait) show the watermarked portrait
// from data/site.json when it is set. With `portrait: null`, no data/site.json, or a file that fails to load,
// the slot keeps today's placeholder (same aria-label) and nothing breaks.
export const SITE_URL = new URL('../data/site.json', import.meta.url).href;
export const PORTRAIT_ALT = 'Portrait of Puzz Kezz';

/** data/site.json, or null when it can't be read. */
export async function loadSite(url = SITE_URL) {
  try {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) return null;
    const data = await response.json();
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

/** A plain relative path inside the site (no scheme, no leading "/", no ".."), else ''. */
export function safeRelativePath(value) {
  if (typeof value !== 'string') return '';
  const v = value.trim();
  if (!v || v.startsWith('/') || v.includes('://') || v.includes('\\') || /^[a-z][a-z0-9+.-]*:/i.test(v)) return '';
  if (v.split('/').some((seg) => seg === '..')) return '';
  return v;
}

/** Puts the portrait into `slot` once it has loaded. The placeholder stays until then (and on any error). */
export async function mountPortrait(slot) {
  if (!slot) return;
  const site = await loadSite();
  const src = site ? safeRelativePath(site.portrait) : '';
  if (!src) return;
  const img = document.createElement('img');
  img.alt = PORTRAIT_ALT;
  img.loading = 'eager';
  img.decoding = 'async';
  img.hidden = true;
  img.addEventListener('load', () => {
    slot.replaceChildren(img);
    slot.removeAttribute('role');
    slot.removeAttribute('aria-label');
    slot.classList.add('has-photo');
    img.hidden = false;
  }, { once: true });
  img.addEventListener('error', () => img.remove(), { once: true });
  img.setAttribute('src', src);
  slot.append(img);
}
