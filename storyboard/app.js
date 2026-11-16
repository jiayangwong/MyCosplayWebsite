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
      if (e.target.closest('.back a')) return;
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
})();
