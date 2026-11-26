/* Storyboard-only behaviour: menu, polaroid flip, carousel dots, speaker toggle. Not production code. */
(function () {
  var menu = document.getElementById('menu');
  var openBtn = document.querySelector('[data-open-menu]');
  if (menu && openBtn) {
    openBtn.addEventListener('click', function () {
      if (menu.showModal) menu.showModal(); else menu.setAttribute('open', '');
      openBtn.setAttribute('aria-expanded', 'true');
    });
    function close() {
      if (menu.close) menu.close(); else menu.removeAttribute('open');
      openBtn.setAttribute('aria-expanded', 'false'); openBtn.focus();
    }
    menu.querySelector('[data-close-menu]').addEventListener('click', close);
    menu.addEventListener('close', function () { openBtn.setAttribute('aria-expanded', 'false'); });
  }
  document.querySelectorAll('.polaroid').forEach(function (p) {
    p.addEventListener('click', function (e) {
      if (p.hasAttribute('data-open-bangai') || e.target.closest('.back a')) return;
      var on = p.classList.toggle('flipped');
      p.setAttribute('aria-pressed', on);
    });
  });
  document.querySelectorAll('.speaker').forEach(function (b) {
    b.addEventListener('click', function () {
      b.setAttribute('aria-pressed', 'true');
      setTimeout(function () { b.setAttribute('aria-pressed', 'false'); }, 800);
    });
  });
  document.querySelectorAll('[data-carousel]').forEach(function (row) {
    var dots = row.parentNode.querySelectorAll('.dot');
    var cards = row.children;
    dots.forEach(function (d, i) {
      d.addEventListener('click', function () {
        row.scrollTo({ left: cards[i].offsetLeft - row.offsetLeft - 8, behavior: 'smooth' });
      });
    });
    row.addEventListener('scroll', function () {
      var best = 0, min = 1e9;
      for (var i = 0; i < cards.length; i++) {
        var d = Math.abs(cards[i].offsetLeft - row.offsetLeft - row.scrollLeft);
        if (d < min) { min = d; best = i; }
      }
      dots.forEach(function (x, i) { x.setAttribute('aria-current', i === best ? 'true' : 'false'); });
    });
  });

  /* Hall ??? album modal (IDEA-12). Only this polaroid opens a modal. */
  var bm = document.getElementById('bangai');
  var bOpen = document.querySelector('[data-open-bangai]');
  if (bm && bOpen) {
    bOpen.addEventListener('click', function () {
      if (bm.showModal) bm.showModal(); else bm.setAttribute('open', '');
      bOpen.setAttribute('aria-expanded', 'true');
    });
    function bClose() { if (bm.close) bm.close(); else bm.removeAttribute('open'); bOpen.setAttribute('aria-expanded', 'false'); bOpen.focus(); }
    bm.querySelector('[data-close-bangai]').addEventListener('click', bClose);
    bm.addEventListener('click', function (e) { if (e.target === bm) bClose(); });
    bm.addEventListener('close', function () { bOpen.setAttribute('aria-expanded', 'false'); });
    bm.querySelectorAll('.chip').forEach(function (c) {
      c.addEventListener('click', function () {
        bm.querySelectorAll('.chip').forEach(function (x) { x.setAttribute('aria-pressed', x === c ? 'true' : 'false'); });
        bm.querySelectorAll('.bm-item').forEach(function (it) { it.hidden = !(c.dataset.f === 'all' || it.dataset.type === c.dataset.f); });
      });
    });
    bm.querySelectorAll('.bm-sb [data-state]').forEach(function (b) {
      b.addEventListener('click', function () {
        var empty = b.dataset.state === 'empty';
        bm.classList.toggle('is-empty', empty);
        document.getElementById('bm-empty').hidden = !empty;
        bm.querySelectorAll('.bm-sb [data-state]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      });
    });
  }
})();

/* IDEA-16: hall photos. Storyboard-only behaviour.
   768px and up: peek pile that spreads when the hall is about 60% visible, back to a pile below about 25%.
   Under 768px: one photo; the D1 D2 D3 tabs are story-style bars (1.5 s each), play two rounds, stop on D3; pressing a tab stops it until reload. */
(function () {
  var STEP = 1500;
  var wide = matchMedia('(min-width: 768px)'), rm = matchMedia('(prefers-reduced-motion: reduce)');
  var piles = [];
  function unflip(pl) {
    pl.classList.remove('lift');
    var po = pl.querySelector('.polaroid'); po.classList.remove('flipped'); po.setAttribute('aria-pressed', 'false');
  }
  document.querySelectorAll('.pile').forEach(function (pile) {
    var n = +pile.dataset.n, stage = pile.querySelector('.pile-stage');
    var pls = Array.prototype.slice.call(pile.querySelectorAll('.pl'));
    if (n < 2) { pls[0].classList.add('on'); return; }
    var tabs = Array.prototype.slice.call(pile.querySelectorAll('.dtab'));
    var toggle = pile.querySelector('.pile-toggle');
    var ratio = 0, inView = false, open = false, manual = false;           /* PC state */
    var cur = 0, el = 0, last = 0, raf = 0, running = false, started = false, stopped = false, round = 0, resetting = false; /* phone state: stopped = user pressed a tab, for good */

    function anyFlipped() { return pls.some(function (pl) { return pl.querySelector('.polaroid').classList.contains('flipped'); }); }
    function setFill() {
      tabs.forEach(function (t, k) { t.style.setProperty('--p', k < cur ? 1 : (k === cur ? Math.min(el / STEP, 1) : 0)); });
    }

    /* PC pile */
    function setOpen(on) {
      open = on; pile.classList.toggle('open', on);
      toggle.setAttribute('aria-expanded', on ? 'true' : 'false');
      pls.forEach(function (pl) { pl.inert = !on; if (!on) unflip(pl); });
    }
    toggle.addEventListener('click', function () { manual = true; setOpen(!open); });

    /* Phone tabs */
    function show(i) {
      cur = i;
      pls.forEach(function (pl, k) { pl.classList.toggle('on', k === i); pl.inert = k !== i; if (k !== i) unflip(pl); });
      tabs.forEach(function (t, k) { t.setAttribute('aria-selected', k === i ? 'true' : 'false'); t.tabIndex = k === i ? 0 : -1; });
    }
    function pick(i, focus) { stopped = true; pile.classList.add('stopped'); show(i); evaluate(); if (focus) tabs[i].focus(); }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { pick(i); });
      t.addEventListener('keydown', function (e) {
        var k = e.key, j = -1;
        if (k === 'ArrowRight') j = (cur + 1) % n; else if (k === 'ArrowLeft') j = (cur + n - 1) % n;
        else if (k === 'Home') j = 0; else if (k === 'End') j = n - 1;
        if (j >= 0) { e.preventDefault(); pick(j, true); }
      });
    });
    function tick(t) {
      if (!running) return;
      el += Math.min(t - last, 100); last = t;
      if (el >= STEP) {
        if (cur >= n - 1) {
          el = STEP; setFill(); running = false; started = true;
          if (round < 1) {
            resetting = true; pile.classList.add('xf'); show(0);
            setTimeout(function () {
              resetting = false; pile.classList.remove('xf');
              if (stopped) return;
              round = 1; cur = 0; el = 0; setFill(); evaluate();
            }, 200);
          }
          return;
        }
        cur++; el = 0; show(cur);
      }
      setFill();
      raf = requestAnimationFrame(tick);
    }
    function evaluate() {
      var done = round >= 1 && cur >= n - 1 && el >= STEP;
      var go = !resetting && !wide.matches && !rm.matches && !stopped && !done && inView && (started || ratio >= 0.6) && !document.hidden && !anyFlipped();
      if (go) started = true;
      if (go && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(tick); }
      else if (!go && running) { running = false; cancelAnimationFrame(raf); }
    }
    pile._eval = evaluate;

    function mode() {
      if (wide.matches) {
        running = false; cancelAnimationFrame(raf);
        pls.forEach(function (pl) { pl.classList.remove('on'); pl.removeAttribute('role'); pl.removeAttribute('aria-labelledby'); });
        setOpen(rm.matches ? true : (manual ? open : (inView && ratio >= 0.6)));
      } else {
        pile.classList.remove('open'); manual = false;
        pls.forEach(function (pl, k) { pl.setAttribute('role', 'tabpanel'); pl.setAttribute('aria-labelledby', tabs[k].id); pl.classList.remove('lift'); });
        pile.classList.toggle('stopped', stopped || rm.matches); show(cur); setFill(); evaluate();
      }
    }
    pile._mode = mode;

    stage.addEventListener('click', function (e) {
      var po = e.target.closest('.polaroid'); if (!po) return;
      var pl = po.closest('.pl'), on = po.classList.contains('flipped');
      pls.forEach(function (o) { if (o !== pl) unflip(o); });
      if (wide.matches) pl.classList.toggle('lift', on);
      evaluate();
    });

    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        ratio = en.intersectionRatio; inView = en.isIntersecting && ratio > 0;
        if (wide.matches) {
          if (rm.matches) return;
          if (!inView) { manual = false; if (open) setOpen(false); }
          else if (!manual) { if (!open && ratio >= 0.6) setOpen(true); else if (open && ratio <= 0.25) setOpen(false); }
        } else {
          evaluate();
        }
      });
    }, { threshold: [0, 0.25, 0.6, 1] });
    io.observe(stage);
    piles.push(pile);
    mode();
  });
  function allModes() { piles.forEach(function (p) { p._mode(); }); }
  (wide.addEventListener ? wide.addEventListener.bind(wide, 'change') : wide.addListener.bind(wide))(allModes);
  (rm.addEventListener ? rm.addEventListener.bind(rm, 'change') : rm.addListener.bind(rm))(allModes);
  document.addEventListener('visibilitychange', function () { piles.forEach(function (p) { p._eval(); }); });
})();
