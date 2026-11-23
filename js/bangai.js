// Hall ??? 番外 (bangai): the one special "year" at the end of the hall. It holds funny and special
// moments from all years. It is shared by Home (the shy polaroid, TASK-19) and the Events page (the
// "Open album" button, TASK-20): both call bindAlbumTrigger(), and there is one album pop-up per page.
//
// data/moments.json (docs/plan.md section 7):
//   { "version": 1, "moments": [{ id, year?, caption?, alt?, photo?, link? }] }
// Required: id (a-z, 0-9, "-", unique) and at least one of photo / link.
import { siteUrl } from './nav.js';
import { renderMedia } from './embed.js';
import { pronunciationBlock, speakerButton } from './pronounce.js';
import { isHttpUrl, photoPathError } from './events-data.js';

export const BANGAI = { jp: '{番外|ばんがい}', romaji: 'ban-gai', en: 'Extra, outside the numbering' };
export const KAOMOJI = '(*/ω＼*)';
export const MOMENTS_URL = siteUrl('data/moments.json');
export const EMPTY_TEXT = 'Nothing here yet. (>///<) Come back later.';
const PH = ['var(--ph-pink)', 'var(--ph-lilac)', 'var(--ph-sky)', 'var(--ph-grey)'];
// A click on the backdrop right after opening is the second half of a double click, not a "close".
const BACKDROP_GRACE_MS = 500;

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== '';
}

/** Returns a list of error texts. An empty list means the moment is valid. */
export function validateMoment(moment) {
  if (!moment || typeof moment !== 'object' || Array.isArray(moment)) return ['must be an object'];
  const errors = [];
  if (typeof moment.id !== 'string' || !/^[a-z0-9-]+$/.test(moment.id)) errors.push('id must use only a-z, 0-9 and "-"');
  if (!hasValue(moment.photo) && !hasValue(moment.link)) errors.push('needs a photo or a link');
  if (hasValue(moment.year) && !(Number.isInteger(moment.year) && moment.year >= 2000 && moment.year <= 2100)) {
    errors.push('year must be a whole number from 2000 to 2100');
  }
  if (hasValue(moment.caption) && (typeof moment.caption !== 'string' || moment.caption.length > 140)) {
    errors.push('caption must be text of 1-140 characters');
  }
  if (hasValue(moment.alt) && typeof moment.alt !== 'string') errors.push('alt must be text');
  if (hasValue(moment.link) && (typeof moment.link !== 'string' || !isHttpUrl(moment.link))) errors.push('link must be an http or https address');
  const photoError = hasValue(moment.photo) ? photoPathError(moment.photo) : '';
  if (photoError) errors.push(`photo ${photoError}`);
  return errors;
}

/** Album order (A8): newest year first, moments without a year last, same year keeps array order. */
export function sortMoments(moments) {
  const key = (m) => (Number.isInteger(m.year) ? m.year : -Infinity);
  return moments
    .map((moment, index) => ({ moment, index }))
    .sort((a, b) => (key(b.moment) - key(a.moment)) || (a.index - b.index))
    .map(({ moment }) => moment);
}

/** Keeps the valid moments (one console warning per skipped moment) and sorts them. */
export function cleanMoments(list) {
  const seen = new Set();
  const good = [];
  list.forEach((moment, i) => {
    const errors = validateMoment(moment);
    if (!errors.length && seen.has(moment.id)) errors.push('id is used twice');
    if (errors.length) {
      const name = moment && typeof moment.id === 'string' ? moment.id : `#${i + 1}`;
      console.warn(`Skipped moment ${name}: ${errors.join('; ')}.`);
      return;
    }
    seen.add(moment.id);
    good.push(moment);
  });
  return sortMoments(good);
}

let momentsPromise = null;

/** Fetches data/moments.json once per page (on the first album open). Never throws. */
export function loadMoments() {
  if (!momentsPromise) {
    momentsPromise = (async () => {
      try {
        const response = await fetch(MOMENTS_URL, { cache: 'no-cache' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const list = data && Array.isArray(data.moments) ? data.moments : null;
        if (!list) throw new Error('no "moments" list');
        return cleanMoments(list);
      } catch (error) {
        console.warn('Could not load moments:', error.message);
        return [];
      }
    })();
  }
  return momentsPromise;
}

function buildItem(moment, index) {
  const li = make('li', 'bm-item');
  li.dataset.type = moment.link ? 'link' : 'photo';
  li.dataset.id = moment.id;
  const label = moment.alt || moment.caption || 'Special moment';
  const media = renderMedia({
    link: moment.link || '',
    photo: moment.photo ? siteUrl(moment.photo) : '',
    alt: label,
    placeholder: 'Photo soon',
    title: moment.caption || 'Special moment',
  });
  media.style.setProperty('--ph', PH[index % PH.length]);
  li.append(media);
  const cap = [moment.year, moment.caption].filter(hasValue).join(' · ');
  if (cap) li.append(make('p', 'bm-cap', cap));
  return li;
}

function buildDialog() {
  const dialog = make('dialog', 'bangai-modal');
  dialog.id = 'bangai';
  dialog.setAttribute('aria-labelledby', 'bangai-h');
  const lace = make('div', 'bm-lace');
  lace.setAttribute('aria-hidden', 'true');
  dialog.append(lace);

  const head = make('div', 'bm-head');
  const titles = make('div', 'bm-titles');
  titles.append(make('p', 'eyebrow', 'HALL ??? · ALL YEARS'));
  const titleRow = make('div', 'bm-title-row');
  const h2 = make('h2', '');
  h2.id = 'bangai-h';
  const jp = make('span', '');
  jp.lang = 'ja';
  const ruby = make('ruby', '', '番外');
  ruby.append(make('rt', '', 'ばんがい'));
  jp.append(ruby);
  h2.append(jp, ' ', make('span', 'bm-en', 'THE EXTRA ONE'));
  titleRow.append(h2);
  const speaker = speakerButton(BANGAI.jp, BANGAI.romaji);
  if (speaker) titleRow.append(speaker);
  titles.append(titleRow, make('p', 'pron-romaji bm-rom', `${BANGAI.romaji} · "${BANGAI.en.toLowerCase()}"`));
  const close = make('button', 'btn btn-secondary btn-sm bm-close', 'CLOSE ×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close the Hall ??? album');
  head.append(titles, close);

  const intro = make('p', 'bm-intro', 'Funny and special moments from every year. Not one con, just the things that did not fit anywhere else. (/ω＼)');

  const chips = make('div', 'bm-chips');
  chips.setAttribute('role', 'group');
  chips.setAttribute('aria-label', 'Filter the album');
  [['all', 'All'], ['photo', 'Photos'], ['link', 'Videos & links']].forEach(([key, text], i) => {
    const chip = make('button', 'bm-chip', text);
    chip.type = 'button';
    chip.dataset.f = key;
    chip.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
    chips.append(chip);
  });

  const grid = make('ul', 'bm-grid');
  const loading = make('p', 'bm-loading', 'Loading…');
  loading.hidden = true;
  const empty = make('p', 'bm-empty empty-state', EMPTY_TEXT);
  empty.hidden = true;
  const body = make('div', 'bm-body');
  body.append(intro, chips, loading, grid, empty);
  dialog.append(head, body);
  return { dialog, close, chips, grid, loading, empty };
}

let album = null;

/** The one album pop-up of this page (made on first use). */
function getAlbum() {
  if (album) return album;
  const parts = buildDialog();
  const { dialog, close, chips, grid, loading, empty } = parts;
  let filled = false;
  let opening = false;
  let openedAt = 0;
  let trigger = null;

  const render = (filter) => {
    let shown = 0;
    grid.querySelectorAll('.bm-item').forEach((item) => {
      const on = filter === 'all' || item.dataset.type === filter;
      item.hidden = !on;
      if (on) shown += 1;
    });
    empty.hidden = shown > 0;
  };

  const fill = async () => {
    if (filled) return;
    filled = true;
    loading.hidden = false;
    const moments = await loadMoments();
    moments.forEach((m, i) => grid.append(buildItem(m, i)));
    loading.hidden = true;
    const pressed = chips.querySelector('[aria-pressed="true"]');
    render(pressed ? pressed.dataset.f : 'all');
  };

  const open = (from) => {
    // Guard: a second click (double click, or a click while it is open) does nothing.
    if (opening || dialog.open) return;
    opening = true;
    try {
      if (!dialog.isConnected) document.body.append(dialog);
      trigger = from || null;
      dialog.showModal();
      openedAt = performance.now();
      if (trigger) trigger.setAttribute('aria-expanded', 'true');
      document.documentElement.classList.add('bangai-open');
      close.focus();
    } finally {
      opening = false;
    }
    fill();
  };

  const shut = () => {
    if (dialog.open) dialog.close();
  };

  close.addEventListener('click', shut);
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    if (performance.now() - openedAt < BACKDROP_GRACE_MS) return;
    // Only a click outside the dialog box is a backdrop click.
    const r = dialog.getBoundingClientRect();
    const inside = event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
    if (!inside) shut();
  });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('bangai-open');
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
      trigger.focus({ preventScroll: true });
    }
  });
  chips.addEventListener('click', (event) => {
    const chip = event.target.closest('.bm-chip');
    if (!chip) return;
    chips.querySelectorAll('.bm-chip').forEach((c) => c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'));
    render(chip.dataset.f);
  });

  album = { dialog, open, shut };
  return album;
}

/** Makes a button open the album. Focus returns to it when the album closes. */
export function bindAlbumTrigger(button) {
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-controls', 'bangai');
  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('click', () => getAlbum().open(button));
  // aria-controls must point at an element in the page: add the (closed) dialog now. Nothing is fetched.
  const { dialog } = getAlbum();
  if (!dialog.isConnected) document.body.append(dialog);
  return button;
}

/** Home: the Hall ??? station (hall sign, shy polaroid, pronunciation). Returns the <li>. */
export function buildBangaiStation() {
  const li = make('li', 'station bangai depth-near side-right');
  li.id = 'hall-bangai';
  li.dataset.kind = 'event';
  li.dataset.id = 'bangai';

  const inner = make('div', 'station-inner');
  const sign = make('div', 'hall-sign is-alt hall-sign-special');
  sign.append(make('span', 'hall-sign-label', 'HALL ???'));
  const name = make('span', 'hall-sign-name');
  name.lang = 'ja';
  const ruby = make('ruby', '', '番外');
  ruby.append(make('rt', '', 'ばんがい'));
  name.append(ruby);
  sign.append(name, make('span', 'hall-sign-rom', 'bangai · the extra one'));

  const flip = make('div', 'flip bangai-flip');
  flip.style.setProperty('--tilt', '3deg');
  const trigger = make('button', 'polaroid polaroid-shy');
  trigger.type = 'button';
  trigger.setAttribute('aria-label', 'Hall ???, bangai. Open the special album: funny and special moments from all years');
  trigger.append(make('span', 'polaroid-tape is-lilac'));
  const ph = make('span', 'polaroid-photo polaroid-ph shy-ph');
  const kao = make('span', 'kao', KAOMOJI);
  kao.setAttribute('aria-hidden', 'true');
  const dots = make('span', 'polaroid-ph-note', '…?');
  dots.setAttribute('aria-hidden', 'true');
  ph.append(kao, dots);
  trigger.append(ph, make('span', 'polaroid-caption', '??? · all years · tap me'));
  bindAlbumTrigger(trigger);
  flip.append(trigger);

  const pron = pronunciationBlock(BANGAI, { className: 'pron-inline' });
  inner.append(sign, flip, pron);
  li.append(inner);
  return li;
}

