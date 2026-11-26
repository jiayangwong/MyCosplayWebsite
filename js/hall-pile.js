// Home hall: behaviour of a 2-3 photo station (IDEA-16).
// 768px and wider (TASK-28): a neat peek pile that spreads when the station is about 60% visible and
// goes back to a pile below about 25%. No click needed; the pile is also a button.

export const WIDE_QUERY = '(min-width: 768px)';
export const OPEN_RATIO = 0.6;
export const CLOSE_RATIO = 0.25;

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

  function applyWide() {
    if (reduce.matches) setOpen(manual ? open : true);
    else if (manual) setOpen(open);
    else setOpen(inView && nextOpen(open, ratio, openAt));
  }

  function applyMode() {
    if (wide.matches) {
      pls.forEach((pl) => {
        pl.removeAttribute('role');
        pl.removeAttribute('aria-labelledby');
        pl.removeAttribute('aria-hidden');
      });
      applyWide();
    } else {
      pile.classList.remove('open');
      pile.dataset.state = 'phone';
      pls.forEach((pl, i) => { pl.inert = i !== 0; pl.classList.toggle('on', i === 0); });
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
    if (!pl || !wide.matches) return;
    pls.forEach((other) => { if (other !== pl) unflip(other); });
    pl.classList.toggle('lift', flipOf(pl).classList.contains('is-flipped'));
  });

  const observe = () => {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        ratio = entry.intersectionRatio;
        inView = entry.isIntersecting && ratio > 0;
        openAt = openThreshold(entry.boundingClientRect.height, window.innerHeight);
        if (!wide.matches) continue;
        if (!inView) manual = false; // the manual toggle ends when the station leaves the viewport
        applyWide();
      }
    }, { threshold: thresholds(openAt) });
    io.observe(stage);
  };

  const onChange = () => applyMode();
  wide.addEventListener('change', onChange);
  reduce.addEventListener('change', onChange);
  pile.dataset.state = 'pile';
  setOpen(false);
  applyMode();
  observe();
}
