// Gallery: every event preview photo, newest first, with a larger view in a <dialog>.
import { loadEvents } from './events-data.js';
import { siteUrl } from './nav.js';

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export async function mountGallery(root) {
  const events = (await loadEvents()).filter((e) => e.photo);
  if (!events.length) {
    root.append(make('p', 'empty-state', 'Photos coming soon.'));
    return;
  }

  const dialog = make('dialog', 'lightbox');
  dialog.setAttribute('aria-label', 'Photo');
  const close = make('button', 'btn btn-on-dark btn-sm lightbox-close', 'Close');
  close.type = 'button';
  const big = make('img', 'lightbox-img');
  const caption = make('p', 'lightbox-caption');
  dialog.append(close, big, caption);
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  const grid = make('ul', 'gallery-grid');
  for (const event of events) {
    const year = event.date.slice(0, 4);
    const alt = `${event.name} ${year}`;
    const li = make('li', 'gallery-item');
    const button = make('button', 'gallery-tile');
    button.type = 'button';
    const img = make('img');
    img.src = siteUrl(event.photo);
    img.alt = alt;
    img.loading = 'lazy';
    img.decoding = 'async';
    const cap = make('span', 'gallery-caption');
    cap.append(make('span', 'tag', event.short), ` ${event.name} · ${year}`);
    button.append(img, cap);
    button.addEventListener('click', () => {
      big.src = img.src;
      big.alt = alt;
      caption.textContent = `${event.short} · ${event.name} · ${year}`;
      dialog.showModal();
      close.focus();
    });
    li.append(button);
    grid.append(li);
  }
  root.append(grid, dialog);
}
