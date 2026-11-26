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

/* IDEA-16: Hall pile variants A-G. Storyboard-only behaviour. */
(function () {
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function unflip(pl) {
    pl.classList.remove('lift');
    var po = pl.querySelector('.polaroid'); po.classList.remove('flipped'); po.setAttribute('aria-pressed', 'false');
  }
  document.querySelectorAll('.pile').forEach(function (pile) {
    var v = pile.dataset.v, stage = pile.querySelector('.pile-stage');
    var pls = Array.prototype.slice.call(pile.querySelectorAll('.pl'));
    var timer = null;
    var replay = pile.querySelector('[data-replay]'), collapse = pile.querySelector('[data-collapse]'), toggle = pile.querySelector('.pile-toggle');

    if (v === 'D') {
      var tabs = pile.querySelectorAll('.dtab'), cur = 0;
      var show = function (n) {
        cur = n;
        pls.forEach(function (pl, i) { pl.classList.toggle('on', i === n); pl.inert = i !== n; if (i !== n) unflip(pl); });
        tabs.forEach(function (t, i) { t.setAttribute('aria-pressed', i === n ? 'true' : 'false'); });
      };
      tabs.forEach(function (t, i) { t.addEventListener('click', function () { show(i); }); });
      replay.addEventListener('click', function () {
        clearTimeout(timer); show(0);
        var n = 0; (function step() { timer = setTimeout(function () { n++; if (n < 3) { show(n); step(); } else { show(0); } }, reduce ? 300 : 1000); })();
      });
      show(0); return;
    }

    if (v === 'G') {
      var order = [0, 1, 2], busy = false, moved = false, sx = null, force = false;
      var count = pile.querySelector('.pile-count');
      var apply = function () {
        pls.forEach(function (pl, i) { var pos = order.indexOf(i); pl.dataset.pos = pos; pl.inert = pos !== 0; });
        count.textContent = (order[0] + 1) + '/3 · D' + (order[0] + 1);
      };
      var next = function () {
        if (busy) return; busy = true;
        var top = pls[order[0]]; unflip(top);
        top.classList.add('fly');
        setTimeout(function () {
          top.classList.add('snap');
          order.push(order.shift()); apply(); top.classList.remove('fly');
          void top.offsetWidth; top.classList.remove('snap'); busy = false;
        }, reduce ? 0 : 280);
      };
      stage.addEventListener('click', function (e) {
        var top = pls[order[0]].querySelector('.polaroid');
        if (moved) { moved = false; e.stopPropagation(); e.preventDefault(); return; }
        if (force || e.target.closest('.back a')) return;
        if (!top.classList.contains('flipped') && e.target.closest('.polaroid')) { e.stopPropagation(); next(); }
      }, true);
      stage.addEventListener('pointerdown', function (e) { sx = e.clientX; moved = false; });
      stage.addEventListener('pointerup', function (e) {
        if (sx !== null && Math.abs(e.clientX - sx) > 40 && !pls[order[0]].querySelector('.polaroid').classList.contains('flipped')) { moved = true; next(); setTimeout(function () { moved = false; }, 50); }
        sx = null;
      });
      pile.querySelector('[data-flip]').addEventListener('click', function () { force = true; pls[order[0]].querySelector('.polaroid').click(); force = false; });
      replay.addEventListener('click', function () {
        clearTimeout(timer); order = [0, 1, 2]; apply(); pls.forEach(unflip);
        timer = setTimeout(next, reduce ? 0 : 500);
      });
      apply(); return;
    }

    /* A, B, C, E, F: pile that spreads when the hall is reached */
    var played = false;
    function setOpen(on) {
      pile.classList.toggle('open', on);
      if (toggle) toggle.setAttribute('aria-expanded', on ? 'true' : 'false');
      pls.forEach(function (pl) { pl.inert = !on; if (!on) unflip(pl); });
    }
    if (toggle) toggle.addEventListener('click', function () { played = true; setOpen(!pile.classList.contains('open')); });
    collapse.addEventListener('click', function () { played = true; clearTimeout(timer); setOpen(false); });
    replay.addEventListener('click', function () {
      played = true; clearTimeout(timer); setOpen(false);
      timer = setTimeout(function () { setOpen(true); }, reduce ? 0 : 900);
    });
    stage.addEventListener('click', function (e) {
      var po = e.target.closest('.polaroid'); if (!po) return;
      var pl = po.closest('.pl'), on = po.classList.contains('flipped');
      pls.forEach(function (o) { if (o !== pl) unflip(o); });
      pl.classList.toggle('lift', on);
    });
    setOpen(false);
    if (reduce || !('IntersectionObserver' in window)) { played = true; setOpen(true); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting && !played) { played = true; setOpen(true); io.disconnect(); } });
    }, { threshold: 0.6 });
    io.observe(stage);
  });
})();
