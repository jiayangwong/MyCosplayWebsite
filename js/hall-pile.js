// Home hall: behaviour of a 2-3 photo station (IDEA-16).
// 768px and wider (TASK-28): a neat peek pile that spreads when the station is about 60% visible and
// goes back to a pile below about 25%. No click needed; the pile is also a button.
// Under 768px (TASK-29): one polaroid; the D1 D2 D3 tabs are story-style bars (1.5 s each) that flip the
// photo by themselves for two rounds, then stop on the last day. Pressing a tab stops it until a reload.

export const WIDE_QUERY = '(min-width: 768px)';
export const OPEN_RATIO = 0.6;
export const CLOSE_RATIO = 0.25;
export const STEP = 1500; // ms each day is shown (also --dur-story)
export const ROUNDS = 2;

/**
 * Pure timing rule for the phone story. `elapsed` is the in-view play time in ms, `n` the number of photos.
 * Returns the round (0 or 1), the shown day (0-based), the fill of every tab (0 to 1) and whether it is done.
 * At a round boundary all fills are 0 and D1 is shown in the same frame (the reset).
 */
export function storyFrame(elapsed, n) {
  const total = ROUNDS * n * STEP;
  const e = Math.max(0, Math.min(elapsed, total));
  if (e >= total) return { round: ROUNDS - 1, day: n - 1, fills: Array(n).fill(1), done: true };
  const round = Math.floor(e / (n * STEP));
  const within = e - round * n * STEP;
  const day = Math.floor(within / STEP);
  const frac = (within - day * STEP) / STEP;
  const fills = Array.from({ length: n }, (_, k) => (k < day ? 1 : k === day ? frac : 0));
  return { round, day, fills, done: false };
}

/** Ratio at which the pile spreads: 60%, or less when the stage is too tall to ever show 60% (E6). */
export function openThreshold(stageHeight, viewportHeight) {
  if (!(stageHeight > 0) || !(viewportHeight > 0)) return OPEN_RATIO;
  return Math.min(OPEN_RATIO, (0.95 * viewportHeight) / stageHeight);
}

/** Pure hysteresis rule: next open state from the current one and the visible ratio. */
export function nextOpen(open, ratio, openAt = OPEN_RATIO) {
  if (!open && ratio >= openAt) return true;
  if (open && ratio < CLOSE_RATIO) return false;
  return open;
}

function thresholds(extra) {
  const list = [];
  for (let i = 0; i <= 20; i += 1) list.push(i / 20);
  list.push(CLOSE_RATIO, OPEN_RATIO, extra);
  return [...new Set(list.filter((t) => t >= 0 && t <= 1))].sort((a, b) => a - b);
}

export function wirePile(pile) {
  const stage = pile.querySelector('.pile-stage');
  const toggle = pile.querySelector('.pile-toggle');
  const pls = [...pile.querySelectorAll('.pl')];
  const wide = window.matchMedia(WIDE_QUERY);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const name = pile.dataset.name || '';
  const n = pls.length;

  let open = false;
  let manual = false; // a manual toggle holds until the station leaves the viewport
  let ratio = 0;
  let inView = false;
  let openAt = OPEN_RATIO;

  // phone story
  const tabs = [...pile.querySelectorAll('.dtab')];
  let state = 'idle'; // idle | playing | paused | done | stopped (kept in memory only: a reload plays again)
  let elapsed = 0;
  let last = 0;
  let raf = 0;
  let cur = 0;

  const flipOf = (pl) => pl.querySelector('.flip');
  const unflip = (pl) => {
    const flip = flipOf(pl);
    flip.classList.remove('is-flipped');
    flip.querySelector('.polaroid').setAttribute('aria-expanded', 'false');
    pl.classList.remove('lift');
  };

  function setOpen(on) {
    open = on;
    pile.dataset.state = on ? 'open' : 'pile';
    if (!on) {
      const active = document.activeElement;
      const hadFocus = active && active !== toggle && pile.contains(active);
      pls.forEach(unflip);
      if (hadFocus) toggle.focus({ preventScroll: true });
    }
    pile.classList.toggle('open', on);
    toggle.setAttribute('aria-expanded', on ? 'true' : 'false');
    toggle.setAttribute('aria-label', `${name}: ${n} photos, day 1 to day ${n}. ${on ? 'Stack the photos' : 'Show all photos'}`);
    pls.forEach((pl) => { pl.inert = !on; });
  }

  const anyFlipped = () => pls.some((pl) => flipOf(pl).classList.contains('is-flipped'));
  const setState = (next) => { state = next; pile.dataset.storyState = next; };

  function show(day) {
    cur = day;
    pls.forEach((pl, k) => {
      pl.classList.toggle('on', k === day);
      pl.inert = k !== day;
      if (k !== day) { pl.setAttribute('aria-hidden', 'true'); unflip(pl); } else pl.removeAttribute('aria-hidden');
    });
    tabs.forEach((tab, k) => {
      tab.setAttribute('aria-selected', k === day ? 'true' : 'false');
      tab.tabIndex = k === day ? 0 : -1;
    });
  }

  function applyFrame() {
    const frame = storyFrame(elapsed, n);
    if (state !== 'stopped') {
      if (frame.day !== cur) show(frame.day);
      tabs.forEach((tab, k) => tab.style.setProperty('--p', String(frame.fills[k])));
      pile.dataset.storyRound = String(frame.round + 1);
      pile.dataset.storyMs = String(Math.round(elapsed));
    }
    return frame;
  }

  function tick(now) {
    if (state !== 'playing') return;
    elapsed += Math.max(0, Math.min(now - last, 250));
    last = now;
    const frame = applyFrame();
    if (frame.done) { setState('done'); return; }
    raf = requestAnimationFrame(tick);
  }

  function evaluate() {
    const phoneMode = !wide.matches;
    const canGo = phoneMode && !reduce.matches && (state === 'idle' || state === 'playing' || state === 'paused')
      && inView && ratio >= openAt && !document.hidden && !anyFlipped();
    if (canGo && state !== 'playing') {
      setState('playing');
      last = performance.now();
      raf = requestAnimationFrame(tick);
    } else if (!canGo && state === 'playing') {
      cancelAnimationFrame(raf);
      setState('paused');
    }
  }

  // Pressing a tab shows that day and stops the story for good (until the page is reloaded).
  function pick(day, focus) {
    cancelAnimationFrame(raf);
    setState('stopped');
    pile.classList.add('stopped');
    show(day);
    if (focus) tabs[day].focus({ preventScroll: true });
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => pick(i, false));
    tab.addEventListener('keydown', (event) => {
      let j = -1;
      if (event.key === 'ArrowRight') j = (cur + 1) % n;
      else if (event.key === 'ArrowLeft') j = (cur + n - 1) % n;
      else if (event.key === 'Home') j = 0;
      else if (event.key === 'End') j = n - 1;
      if (j >= 0) { event.preventDefault(); pick(j, true); }
    });
  });

  function applyWide() {
    if (reduce.matches) setOpen(manual ? open : true);
    else if (manual) setOpen(open);
    else setOpen(inView && nextOpen(open, ratio, openAt));
  }

  function applyMode() {
    if (wide.matches) {
      cancelAnimationFrame(raf);
      if (state === 'playing') setState('paused');
      pile.classList.remove('stopped');
      pls.forEach((pl) => {
        pl.removeAttribute('role');
        pl.removeAttribute('aria-labelledby');
        pl.removeAttribute('aria-hidden');
      });
      applyWide();
    } else {
      pile.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      pls.forEach((pl, k) => {
        pl.setAttribute('role', 'tabpanel');
        pl.setAttribute('aria-labelledby', tabs[k].id);
        pl.classList.remove('lift');
      });
      pile.classList.toggle('stopped', state === 'stopped' || reduce.matches);
      show(cur);
      if (state !== 'stopped') applyFrame();
      evaluate();
    }
  }

  toggle.addEventListener('click', () => {
    if (!wide.matches) return;
    manual = true;
    setOpen(!open);
  });

  // A photo tap flips it (handled by the flip card); keep it above its neighbours while flipped.
  stage.addEventListener('click', (event) => {
    const pl = event.target.closest('.pl');
    if (!pl) return;
    if (!wide.matches) { evaluate(); return; } // flipped = paused, "Flip back" = continue
    pls.forEach((other) => { if (other !== pl) unflip(other); });
    pl.classList.toggle('lift', flipOf(pl).classList.contains('is-flipped'));
  });

  const observe = () => {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        ratio = entry.intersectionRatio;
        inView = entry.isIntersecting && ratio > 0;
        openAt = openThreshold(entry.boundingClientRect.height, window.innerHeight);
        if (!wide.matches) { evaluate(); continue; }
        // The manual toggle ends when the station leaves the viewport; with reduced motion there is no
        // scroll automation, so it holds (BUG-13).
        if (!inView && !reduce.matches) manual = false;
        applyWide();
      }
    }, { threshold: thresholds(openAt) });
    io.observe(stage);
  };

  const onChange = () => applyMode();
  document.addEventListener('visibilitychange', evaluate);
  wide.addEventListener('change', onChange);
  reduce.addEventListener('change', onChange);
  pile.dataset.state = 'pile';
  pile.dataset.storyState = 'idle';
  setOpen(false);
  applyMode();
  observe();
}
