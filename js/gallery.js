// Gallery: every event preview photo, newest first, with a photo viewer in a modal <dialog>.
// Tiles use `photo` (the 1200px display copy) only. The viewer shows `photo` at once, then loads
// `photoFull` (the full-size master) in the background and cross-fades it in when it is decoded.
import { loadEvents } from './events-data.js';
import { siteUrl } from './nav.js';

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function navButton(className, label, arrow) {
  const b = make('button', className, arrow);
  b.type = 'button';
  b.setAttribute('aria-label', label);
  return b;
}

/** Builds the viewer. Returns { dialog, open(index, opener) }. */
function buildViewer(items) {
  const dialog = make('dialog', 'lightbox viewer');
  dialog.setAttribute('aria-labelledby', 'viewer-caption');

  const close = navButton('v-close', 'Close photo', '×');
  const box = make('div', 'vbox');
  const stage = make('div', 'vstage');
  const disp = make('img', 'lightbox-img v-img');
  disp.alt = 'Selected gallery photo'; // replaced by the photo's own alt in show(); never alt-less (BUG-9)
  disp.decoding = 'async';
  const full = make('img', 'v-img v-full');
  full.alt = '';
  full.setAttribute('aria-hidden', 'true');
  const bar = make('div', 'vbar');
  bar.setAttribute('aria-hidden', 'true');
  const label = make('span', 'vlabel', 'Loading full size...');
  const fail = make('p', 'vfail');
  fail.setAttribute('role', 'status');
  fail.append(make('span', 'vfail-icon', '⚠'), ' Full size unavailable');
  fail.querySelector('.vfail-icon').setAttribute('aria-hidden', 'true');
  stage.append(disp, full, bar, label, fail);

  const caption = make('p', 'vcap lightbox-caption');
  caption.id = 'viewer-caption';
  const capText = make('span', 'vtxt');
  const tag = make('span', 'vtag', 'Preview');
  caption.append(capText, tag);

  const nav = make('div', 'vnav');
  const prev = navButton('v-prev', 'Previous photo', '←');
  const next = navButton('v-next', 'Next photo', '→');
  nav.append(prev, next);
  box.append(stage, caption, nav);
  dialog.append(close, box);

  let current = 0;
  let opener = null;
  let token = 0; // ignores late loads from a photo that is no longer shown

  function setState(name) {
    stage.classList.toggle('is-loading', name === 'loading');
    stage.classList.toggle('is-full', name === 'full');
    stage.classList.toggle('is-failed', name === 'failed');
    tag.textContent = name === 'full' ? 'Full size' : 'Preview';
  }

  function show(index) {
    current = index;
    const item = items[index];
    const my = ++token;
    disp.src = item.photo;
    disp.alt = item.alt;
    capText.textContent = `${item.caption} `;
    // If the focused nav button is about to hide, keep focus inside the viewer.
    const focused = document.activeElement;
    prev.hidden = index === 0;
    next.hidden = index === items.length - 1;
    if ((focused === prev && prev.hidden) || (focused === next && next.hidden)) {
      const other = focused === prev ? next : prev;
      (other.hidden ? close : other).focus();
    }
    full.onload = null;
    full.onerror = null;
    full.removeAttribute('src');
    if (!item.photoFull) {
      setState('preview');
      return;
    }
    setState('loading');
    const swapIn = () => {
      if (my !== token) return;
      // Cross-fade: the decoded master fades in on top (var(--dur-fast), 0 under reduced motion).
      setState('full');
      // After the fade, the main <img> (which carries the alt text) also points at the master,
      // so the visible photo, its src and its alt match. The overlay hides any re-decode.
      const ms = parseFloat(getComputedStyle(full).transitionDuration) * 1000 || 0;
      setTimeout(() => { if (my === token) disp.src = full.src; }, ms + 20);
    };
    full.onload = () => {
      if (my !== token) return;
      (full.decode ? full.decode().catch(() => {}) : Promise.resolve()).then(swapIn);
    };
    full.onerror = () => {
      if (my !== token) return;
      setState('failed'); // the display copy stays; no pop-up
    };
    full.src = item.photoFull;
  }

  function step(delta) {
    const i = current + delta;
    if (i >= 0 && i < items.length) show(i);
  }

  close.addEventListener('click', () => dialog.close());
  prev.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
  });
  dialog.addEventListener('close', () => {
    token += 1;
    full.onload = null;
    full.onerror = null;
    document.documentElement.classList.remove('viewer-open');
    if (opener) opener.focus();
  });

  // Swipe left/right on phones (bonus in the style guide). Pinch zoom is left alone.
  let touchX = null;
  stage.addEventListener('touchstart', (e) => { touchX = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
  });

  return {
    dialog,
    open(index, from) {
      opener = from;
      document.documentElement.classList.add('viewer-open');
      dialog.showModal();
      show(index);
      close.focus();
    },
  };
}

export async function mountGallery(root) {
  const events = (await loadEvents()).filter((e) => e.photo);
  if (!events.length) {
    root.append(make('p', 'empty-state', 'Photos coming soon.'));
    return;
  }

  const items = events.map((event) => {
    const year = event.date.slice(0, 4);
    return {
      event,
      year,
      alt: `${event.name} ${year}`,
      caption: `${event.short} · ${event.name} · ${year}`,
      photo: siteUrl(event.photo),
      photoFull: event.photoFull ? siteUrl(event.photoFull) : '',
    };
  });
  const viewer = buildViewer(items);

  const grid = make('ul', 'gallery-grid');
  items.forEach((item, index) => {
    const li = make('li', 'gallery-item');
    const button = make('button', 'gallery-tile');
    button.type = 'button';
    const img = make('img');
    img.src = item.photo;
    img.alt = item.alt;
    img.loading = 'lazy';
    img.decoding = 'async';
    const cap = make('span', 'gallery-caption');
    cap.append(make('span', 'tag', item.event.short), ` ${item.event.name} · ${item.year}`);
    button.append(img, cap);
    button.addEventListener('click', () => viewer.open(index, button));
    li.append(button);
    grid.append(li);
  });
  root.append(grid, viewer.dialog);
}
