// さしすせそ reel section, shared by Home (#reels) and reels.html.
import { pronunciationBlock, speak, canSpeak } from './pronounce.js';

export const REELS_URL = new URL('../data/reels.json', import.meta.url).href;
const PH = ['var(--ph-pink)', 'var(--ph-lilac)', 'var(--ph-grey)', 'var(--ph-pink)', 'var(--ph-sky)'];

export async function loadReels(url = REELS_URL) {
  try {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn('Could not load reels:', error.message);
    return null;
  }
}

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** A reel cover path: plain relative path inside the site, else '' (placeholder). */
function safeThumb(value) {
  if (typeof value !== 'string') return '';
  const v = value.trim();
  if (!v || v.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(v) || v.split('/').includes('..')) return '';
  return v;
}

function buildCard(reel, index) {
  const li = make('li', 'reel-card');
  li.dataset.index = String(index);
  li.id = `reel-${reel.id}`;

  const cover = reel.url ? document.createElement('a') : make('div');
  cover.classList.add('reel-cover');
  if (reel.url) {
    cover.href = reel.url;
    cover.target = '_blank';
    cover.rel = 'noopener';
    cover.setAttribute('aria-label', `Watch the ${reel.romaji} reel (${reel.category}) on Instagram`);
  } else {
    cover.classList.add('is-soon');
  }
  cover.style.setProperty('--ph', PH[index % PH.length]);

  const badge = make('span', 'kana-badge');
  badge.setAttribute('aria-hidden', 'true');
  const kana = make('span', 'kana-badge-jp', reel.kana);
  kana.lang = 'ja';
  badge.append(kana, make('span', 'kana-badge-romaji', reel.kanaRomaji));
  cover.append(badge);

  const label = make('span', 'reel-cover-label', reel.url ? 'Watch reel' : 'Reel cover');
  cover.append(label);
  const thumb = safeThumb(reel.thumb);
  if (thumb) {
    // TASK-14: the watermarked cover from the uploader. If it fails to load, the placeholder stays.
    const img = document.createElement('img');
    img.alt = `${reel.en} reel cover`;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('load', () => { label.hidden = true; }, { once: true });
    img.addEventListener('error', () => { img.remove(); label.hidden = false; }, { once: true });
    img.setAttribute('src', thumb);
    cover.append(img);
  }
  if (!reel.url) cover.append(make('span', 'reel-soon', 'Coming soon'));

  li.append(cover, pronunciationBlock(reel, { tag: 'h3', className: 'pron-card' }), make('p', 'reel-cat', reel.category));
  return li;
}

function wireCarousel(track, dots) {
  const cards = [...track.children];
  const setActive = (i) => {
    dots.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-current', j === i ? 'true' : 'false'));
  };
  const indexFromScroll = () => {
    const first = cards[0];
    if (!first) return 0;
    const step = first.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || '0');
    return Math.min(cards.length - 1, Math.max(0, Math.round(track.scrollLeft / step)));
  };
  let ticking = false;
  track.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { setActive(indexFromScroll()); ticking = false; });
  }, { passive: true });
  dots.querySelectorAll('button').forEach((button, i) => {
    button.addEventListener('click', () => {
      const card = cards[i];
      track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior: 'smooth' });
      setActive(i);
    });
  });
  setActive(0);
}

/** Renders the whole section into `container`. */
export async function mountReels(container, { headingTag = 'h2' } = {}) {
  const data = await loadReels();
  if (!data) {
    container.append(make('p', 'empty-state', 'Reels coming soon.'));
    return;
  }

  const head = make('div', 'reels-head');
  const sign = make('div', 'reels-sign');
  sign.append(pronunciationBlock(data.header, { tag: headingTag, className: 'pron-on-dark pron-header' }));
  const intro = make('div', 'reels-intro');
  intro.append(make('p', 'reels-subtitle', data.subtitle));
  if (canSpeak()) {
    const sound = make('button', 'btn btn-accent btn-sm sound-on');
    sound.type = 'button';
    sound.innerHTML = 'Sound on · <span lang="ja">さしすせそ</span>';
    sound.addEventListener('click', () => speak(data.header.speak || data.header.jp, sound));
    intro.append(sound);
  }
  head.append(sign, intro);

  const track = make('ol', 'reel-track');
  track.setAttribute('aria-label', 'さしすせそ reels');
  data.reels.forEach((reel, i) => track.append(buildCard(reel, i)));

  const dots = make('div', 'reel-dots');
  dots.setAttribute('role', 'group');
  dots.setAttribute('aria-label', 'Choose a reel');
  data.reels.forEach((reel, i) => {
    const dot = make('button', 'reel-dot');
    dot.type = 'button';
    dot.setAttribute('aria-label', `Show reel ${i + 1}: ${reel.romaji}`);
    dots.append(dot);
  });

  container.append(head, track, dots);
  wireCarousel(track, dots);
}
