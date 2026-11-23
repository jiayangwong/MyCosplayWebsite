// Hall ??? 番外 (bangai): the one special "year" at the end of the hall. It holds funny and special
// moments from all years. Only its polaroid is clickable: it opens an album pop-up (photos, videos, links).
import { siteUrl } from './nav.js';
import { renderMedia } from './embed.js';
import { pronunciationBlock } from './pronounce.js';

export const BANGAI = { jp: '{番外|ばんがい}', romaji: 'ban-gai', en: 'Extra, outside the numbering' };
const KAOMOJI = '(*/ω＼*)';
const MOMENTS_URL = siteUrl('data/moments.json');
const PH = ['var(--ph-pink)', 'var(--ph-lilac)', 'var(--ph-sky)', 'var(--ph-grey)'];

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** moments.json: { "version": 1, "moments": [{ "year": 2025, "caption": "...", "photo": "photos/..", "link": "https://.." }] } */
async function loadMoments() {
  try {
    const response = await fetch(MOMENTS_URL, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const list = Array.isArray(data) ? data : data.moments;
    if (!Array.isArray(list)) return [];
    return list.filter((m) => m && (m.photo || m.link));
  } catch (error) {
    console.warn('Could not load moments:', error.message);
    return [];
  }
}

function momentType(moment) {
  return moment.link ? 'link' : 'photo';
}

function buildItem(moment, index) {
  const li = make('li', 'bm-item');
  li.dataset.type = momentType(moment);
  const media = renderMedia({
    link: moment.link,
    photo: moment.photo ? siteUrl(moment.photo) : null,
    alt: moment.caption || 'Special moment',
    placeholder: 'Photo soon',
    title: moment.caption || 'Special moment',
  });
  media.style.setProperty('--ph', PH[index % PH.length]);
  li.append(media);
  const cap = [moment.year, moment.caption].filter(Boolean).join(' · ');
  if (cap) li.append(make('p', 'bm-cap', cap));
  return li;
}

function buildDialog() {
  const dialog = make('dialog', 'bangai-modal');
  dialog.id = 'bangai';
  dialog.setAttribute('aria-labelledby', 'bangai-h');
  dialog.append(make('div', 'bm-lace'));

  const head = make('div', 'bm-head');
  const titles = make('div', 'bm-titles');
  titles.append(make('p', 'eyebrow', 'HALL ??? · ALL YEARS'));
  const h2 = make('h2', '');
  h2.id = 'bangai-h';
  h2.lang = 'ja';
  h2.innerHTML = '<ruby>番外<rt>ばんがい</rt></ruby> <span class="bm-en" lang="en">THE EXTRA ONE</span>';
  titles.append(h2, make('p', 'pron-romaji', 'ban-gai · "extra, outside the numbering"'));
  const close = make('button', 'btn btn-secondary btn-sm bm-close', 'CLOSE ×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close the Hall ??? album');
  head.append(titles, close);

  const intro = make('p', 'bm-intro', `Funny and special moments from every year. Not one con, just the things that did not fit anywhere else. ${KAOMOJI.replace('*/', '/')}`);

  const chips = make('div', 'bm-chips');
  chips.setAttribute('role', 'group');
  chips.setAttribute('aria-label', 'Filter the album');
  const filters = [['all', 'All'], ['photo', 'Photos'], ['link', 'Videos & links']];
  filters.forEach(([key, label], i) => {
    const chip = make('button', 'bm-chip', label);
    chip.type = 'button';
    chip.dataset.f = key;
    chip.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
    chips.append(chip);
  });

  const grid = make('ul', 'bm-grid');
  const empty = make('p', 'bm-empty empty-state', 'Nothing here yet. (>///<) Come back later.');
  empty.hidden = true;
  const body = make('div', 'bm-body');
  body.append(intro, chips, grid, empty);
  dialog.append(head, body);
  return { dialog, close, chips, grid, empty };
}

/** Builds the Hall ??? station (hall sign + shy polaroid). Returns the <li>. */
export function buildBangaiStation(index) {
  const parts = buildDialog();
  const { dialog, close, chips, grid, empty } = parts;
  let loaded = false;

  const li = make('li', 'station bangai depth-near side-right');
  li.id = 'hall-bangai';
  li.dataset.kind = 'event';
  li.dataset.id = 'bangai';

  const inner = make('div', 'station-inner');
  const sign = make('div', 'hall-sign is-alt hall-sign-special');
  sign.append(make('span', 'hall-sign-label', 'HALL ???'));
  const name = make('span', 'hall-sign-name');
  name.lang = 'ja';
  name.innerHTML = '<ruby>番外<rt>ばんがい</rt></ruby>';
  sign.append(name, make('span', 'hall-sign-rom', 'bangai · the extra one'));

  const flip = make('div', 'flip bangai-flip');
  flip.style.setProperty('--tilt', '3deg');
  const trigger = make('button', 'polaroid polaroid-shy');
  trigger.type = 'button';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-controls', 'bangai');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-label', 'Hall ???, bangai. Open the special album: funny and special moments from all years');
  trigger.append(make('span', 'polaroid-tape is-lilac'));
  const ph = make('span', 'polaroid-photo polaroid-ph shy-ph');
  ph.append(make('span', 'kao', KAOMOJI), make('span', 'polaroid-ph-note', '…?'));
  ph.querySelector('.kao').setAttribute('aria-hidden', 'true');
  trigger.append(ph, make('span', 'polaroid-caption', '??? · all years · tap me'));
  flip.append(trigger);

  const pron = pronunciationBlock({ jp: BANGAI.jp, romaji: BANGAI.romaji, en: BANGAI.en }, { className: 'pron-inline' });
  inner.append(sign, flip, pron);
  li.append(inner);

  const render = (filter) => {
    let shown = 0;
    grid.querySelectorAll('.bm-item').forEach((item) => {
      const on = filter === 'all' || item.dataset.type === filter;
      item.hidden = !on;
      if (on) shown += 1;
    });
    empty.hidden = shown > 0;
  };

  const open = async () => {
    if (!dialog.isConnected) document.body.append(dialog);
    if (!loaded) {
      loaded = true;
      const moments = await loadMoments();
      moments.forEach((m, i) => grid.append(buildItem(m, i)));
      render('all');
    }
    dialog.showModal();
    trigger.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('viewer-open');
    close.focus();
  };
  const shut = () => {
    if (dialog.open) dialog.close();
  };

  trigger.addEventListener('click', open);
  close.addEventListener('click', shut);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) shut();
  });
  dialog.addEventListener('close', () => {
    trigger.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('viewer-open');
    trigger.focus({ preventScroll: true });
  });
  chips.addEventListener('click', (event) => {
    const chip = event.target.closest('.bm-chip');
    if (!chip) return;
    chips.querySelectorAll('.bm-chip').forEach((c) => c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'));
    render(chip.dataset.f);
  });
  return li;
}
