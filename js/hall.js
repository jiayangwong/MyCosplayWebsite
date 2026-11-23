// Home: the convention hall walk-through (newest event first) and the YOU ARE HERE year timeline.
import { loadEvents, groupByYear, formatDate, yearOf } from './events-data.js';
import { siteUrl } from './nav.js';
import { buildBangaiStation } from './bangai.js';

const BANGAI_YEAR = '???';
const DEPTHS = ['near', 'far', 'mid'];
const PH = ['var(--ph-pink)', 'var(--ph-lilac)', 'var(--ph-sky)', 'var(--ph-grey)'];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/** 0 -> A, 25 -> Z, 26 -> AA, 27 -> AB ... */
export function hallLetter(index) {
  let n = index;
  let out = '';
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function polaroidPicture(event, index) {
  const alt = `${event.name} ${yearOf(event)}`;
  if (event.photo) {
    const img = make('img', 'polaroid-photo');
    img.src = siteUrl(event.photo);
    img.alt = alt;
    img.loading = index < 2 ? 'eager' : 'lazy';
    img.decoding = 'async';
    return img;
  }
  const ph = make('span', 'polaroid-photo polaroid-ph');
  ph.setAttribute('role', 'img');
  ph.setAttribute('aria-label', alt);
  ph.style.setProperty('--ph', PH[index % PH.length]);
  ph.append(make('span', 'polaroid-ph-short', event.short));
  ph.append(make('span', 'polaroid-ph-note', event.sample ? 'Sample · photo soon' : 'Photo soon'));
  return ph;
}

function buildStation(event, index) {
  const li = make('li', `station depth-${DEPTHS[index % DEPTHS.length]} side-${index % 2 ? 'right' : 'left'}`);
  li.id = `hall-${event.id}`;
  li.dataset.kind = 'event';
  li.dataset.id = event.id;

  const inner = make('div', 'station-inner');
  const sign = make('div', `hall-sign${index % 2 ? ' is-alt' : ''}`);
  sign.append(make('span', 'hall-sign-label', `HALL ${hallLetter(index)}`));
  sign.append(make('span', 'hall-sign-name', event.name.toUpperCase()));

  const flip = make('div', 'flip');
  flip.style.setProperty('--tilt', index % 2 ? '2deg' : '-2deg');
  const flipInner = make('div', 'flip-inner');
  const backId = `back-${event.id}`;

  const front = make('button', 'polaroid');
  front.type = 'button';
  front.setAttribute('aria-expanded', 'false');
  front.setAttribute('aria-controls', backId);
  front.append(make('span', `polaroid-tape${index % 2 ? ' is-lilac' : ''}`));
  front.append(polaroidPicture(event, index));
  front.append(make('span', 'polaroid-caption', `${formatDate(event.date)} · ${event.short}${event.sample ? ' · SAMPLE' : ''}`));

  const back = make('div', 'polaroid-back');
  back.id = backId;
  back.append(make('p', 'eyebrow', `${event.short} · ${formatDate(event.date)}`));
  back.append(make('p', 'polaroid-back-name', event.name));
  if (event.activities && event.activities.length) {
    back.append(make('p', 'polaroid-back-meta', event.activities.join(' · ')));
  }
  const action = make('a', 'btn btn-accent btn-sm');
  if (event.link) {
    action.href = event.link;
    action.target = '_blank';
    action.rel = 'noopener';
    action.textContent = 'Watch reel';
  } else {
    action.href = `${siteUrl('events.html')}#${encodeURIComponent(event.id)}`;
    action.textContent = 'See event';
  }
  const closeFlip = make('button', 'flip-close', 'Flip back');
  closeFlip.type = 'button';
  back.append(action, closeFlip);

  front.addEventListener('click', () => {
    flip.classList.add('is-flipped');
    front.setAttribute('aria-expanded', 'true');
    action.focus({ preventScroll: true });
  });
  closeFlip.addEventListener('click', () => {
    flip.classList.remove('is-flipped');
    front.setAttribute('aria-expanded', 'false');
    front.focus({ preventScroll: true });
  });

  flipInner.append(front, back);
  flip.append(flipInner);
  inner.append(sign, flip);
  li.append(inner);
  return li;
}

function buildYearMarker(year) {
  const li = make('li', 'hall-year');
  li.id = year === BANGAI_YEAR ? 'year-bangai' : `year-${year}`;
  li.dataset.kind = 'year';
  li.dataset.year = String(year);
  const sign = make('div', 'year-sign');
  sign.append(make('span', 'year-sign-label', 'YEAR'));
  const num = make('h3', 'year-sign-num', String(year));
  sign.append(num);
  li.append(sign);
  return li;
}

function buildTimeline(groups) {
  const nav = make('nav', 'timeline');
  nav.setAttribute('aria-label', 'Event timeline, newest first');
  nav.append(make('span', 'timeline-label', 'YOU ARE HERE'));
  const track = make('ol', 'timeline-track');
  for (const group of groups) {
    const yearItem = make('li');
    const yearButton = make('button', 'tl-year', String(group.year));
    yearButton.type = 'button';
    yearButton.dataset.target = `year-${group.year}`;
    yearButton.setAttribute('aria-label', `Go to ${group.year}`);
    yearItem.append(yearButton);
    track.append(yearItem);
    for (const event of group.events) {
      const tickItem = make('li');
      const tick = make('button', 'tl-tick');
      tick.type = 'button';
      tick.dataset.target = `hall-${event.id}`;
      tick.setAttribute('aria-label', `${event.short} ${event.date}`);
      tick.title = `${event.short} · ${formatDate(event.date)}`;
      tickItem.append(tick);
      track.append(tickItem);
    }
  }
  // Hall ??? 番外 is treated as one more year at the end of the timeline.
  const bangaiYear = make('li');
  const bangaiButton = make('button', 'tl-year', BANGAI_YEAR);
  bangaiButton.type = 'button';
  bangaiButton.dataset.target = 'year-bangai';
  bangaiButton.setAttribute('aria-label', 'Go to Hall ???, bangai, the extra one');
  bangaiYear.append(bangaiButton);
  track.append(bangaiYear);
  const bangaiTickItem = make('li');
  const bangaiTick = make('button', 'tl-tick');
  bangaiTick.type = 'button';
  bangaiTick.dataset.target = 'hall-bangai';
  bangaiTick.setAttribute('aria-label', 'Hall ???, bangai');
  bangaiTick.title = 'Hall ??? · 番外';
  bangaiTickItem.append(bangaiTick);
  track.append(bangaiTickItem);
  nav.append(track);
  return nav;
}

function wireTimeline(timeline, hall) {
  const buttons = [...timeline.querySelectorAll('button[data-target]')];
  const items = buttons.map((b) => document.getElementById(b.dataset.target));
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const target = document.getElementById(button.dataset.target);
      if (target) target.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'center' });
    });
  });

  let current = -1;
  const update = () => {
    const mid = window.innerHeight * 0.5;
    let best = 0;
    // The current item is the last one whose centre has reached the middle of the screen.
    items.forEach((item, i) => {
      if (!item) return;
      const rect = item.getBoundingClientRect();
      if (rect.top + rect.height / 2 <= mid + 2) best = i;
    });
    if (best === current) return;
    current = best;
    buttons.forEach((b, i) => {
      b.classList.toggle('is-current', i === best);
      if (i === best) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
      b.parentElement.classList.toggle('is-passed', i < best);
    });
    const active = buttons[best];
    const track = active.closest('.timeline-track');
    const left = active.offsetLeft - track.clientWidth / 2;
    track.scrollTo({ left, behavior: 'auto' });
  };
  return update;
}

/** Scroll-driven "camera": stations grow as they approach and pass the middle of the screen. */
function wireCamera(hall, wrap) {
  const stations = [...hall.querySelectorAll('.station, .hall-year')];
  const update = () => {
    if (reduceMotion.matches) return;
    const vh = window.innerHeight;
    for (const station of stations) {
      const rect = station.getBoundingClientRect();
      if (rect.bottom < -200 || rect.top > vh + 200) continue;
      const r = Math.max(-1, Math.min(1, (rect.top + rect.height / 2 - vh / 2) / vh));
      const scale = 1 - r * 0.16;
      station.style.setProperty('--cam-scale', scale.toFixed(3));
      station.style.setProperty('--cam-y', `${(r * 24).toFixed(1)}px`);
      station.style.setProperty('--cam-fade', (1 - Math.max(0, r - 0.7)).toFixed(3));
    }
    const wrapRect = wrap.getBoundingClientRect();
    wrap.style.setProperty('--walk', `${(-wrapRect.top * 0.35).toFixed(0)}px`);
  };
  return update;
}

export async function mountHall({ hallList, timelineSlot, summary }) {
  const events = await loadEvents();
  const wrap = hallList.closest('.hall-wrap');
  if (!events.length) {
    const li = make('li', 'hall-empty empty-state', 'Events coming soon.');
    hallList.append(li);
    return;
  }

  const groups = groupByYear(events);
  let index = 0;
  for (const group of groups) {
    hallList.append(buildYearMarker(group.year));
    for (const event of group.events) {
      hallList.append(buildStation(event, index));
      index += 1;
    }
  }

  hallList.append(buildYearMarker(BANGAI_YEAR));
  hallList.append(buildBangaiStation(index));

  if (summary) {
    const years = groups.map((g) => g.year);
    summary.textContent = `${events.length} events · ${years[0]} → ${years[years.length - 1]}`;
  }

  const timeline = buildTimeline(groups);
  timelineSlot.append(timeline);

  const updateTimeline = wireTimeline(timeline, hallList);
  const updateCamera = wireCamera(hallList, wrap);
  const applyMotionMode = () => wrap.classList.toggle('is-static', reduceMotion.matches);
  applyMotionMode();
  reduceMotion.addEventListener('change', applyMotionMode);

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateTimeline();
      updateCamera();
      ticking = false;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();
}
