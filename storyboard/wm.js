/* Storyboard-only: draws the lattice watermark on any .ph[data-wm]. Not production code.
   White dashed diagonal lines (both directions, 45 deg), a small heart at every crossing,
   "@notpuzzkezz" written along the up-right lines between crossings (the line breaks around it).
   Whole layer at 40% opacity. Density: 1x = shorter side / 40; 2x = / 80; 3x = / 120 (min 8px). One cell (crossing to crossing) = 14f.
   Storyboard uses 2x (the 2x/3x switch was removed: it covered the menu button). */
(function () {
  var TEXT = '@notpuzzkezz', DENS = 2, all = [];
  function heart(c, x, y, s) {
    c.save(); c.translate(x, y); c.rotate(Math.PI / 4);
    c.beginPath(); c.moveTo(0, 0.9 * s);
    c.bezierCurveTo(-1.6 * s, -0.2 * s, -0.6 * s, -1.4 * s, 0, -0.5 * s);
    c.bezierCurveTo(0.6 * s, -1.4 * s, 1.6 * s, -0.2 * s, 0, 0.9 * s);
    c.fill(); c.restore();
  }
  function draw(cv, w, h) {
    cv.width = w; cv.height = h;
    var c = cv.getContext('2d');
    var f = Math.max(8, Math.round(Math.min(w, h) / (40 * DENS))), cell = 14 * f;
    var n = Math.ceil(Math.sqrt(w * w + h * h) / 2 / cell) + 1, span = n * cell;
    c.clearRect(0, 0, w, h);
    c.save(); c.globalAlpha = 0.4; c.translate(w / 2, h / 2); c.rotate(-Math.PI / 4);
    c.strokeStyle = c.fillStyle = '#FFFFFF';
    c.lineWidth = Math.max(1, 0.1 * f); c.setLineDash([0.5 * f, 0.35 * f]);
    c.font = '700 ' + f + 'px "Space Mono", ui-monospace, monospace';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    var gap = c.measureText(TEXT).width / 2 + 0.5 * f;
    c.beginPath();
    for (var i = -n; i <= n; i++) {
      var p = i * cell;
      c.moveTo(p, -span); c.lineTo(p, span);                 /* up-left lines: unbroken */
      for (var j = -n; j < n; j++) {                          /* up-right lines: broken around the name */
        var x0 = j * cell, mid = x0 + cell / 2;
        c.moveTo(x0, p); c.lineTo(mid - gap, p);
        c.moveTo(mid + gap, p); c.lineTo(x0 + cell, p);
      }
    }
    c.stroke();
    for (i = -n; i <= n; i++) {
      for (j = -n; j <= n; j++) {
        heart(c, j * cell, i * cell, 0.3 * f);
        if (j < n) c.fillText(TEXT, j * cell + cell / 2, i * cell);
      }
    }
    c.restore();
  }
  function init(ph) {
    var cv = ph.querySelector('canvas.wm-cv');
    if (!cv) { cv = document.createElement('canvas'); cv.className = 'wm-cv'; cv.setAttribute('aria-hidden', 'true'); ph.appendChild(cv); }
    var s = (ph.getAttribute('data-wm') || '1200x1500').split('x');
    var go = function () { draw(cv, +s[0], +s[1]); };
    go(); all.push(go);
    if (document.fonts && document.fonts.load) document.fonts.load('700 20px "Space Mono"').then(go, function () {});
  }
  window.sbWatermark = init;
  document.querySelectorAll('.ph[data-wm]').forEach(init);
})();
