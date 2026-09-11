'use strict';
/* Overrides gold canvas orb with cyan particles; CSS rings do the main look. */
(function () {
  var canvas = document.getElementById('viz-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var t = 0;
  var particles = [];
  for (var i = 0; i < 70; i++) {
    particles.push({ a: Math.random() * Math.PI * 2, r: 0.4 + Math.random() * 0.48, s: 0.3 + Math.random(), sz: 0.5 + Math.random() * 1.2 });
  }
  function hexA(hex, a) {
    var c = hex.replace('#', '');
    return 'rgba(' + parseInt(c.slice(0, 2), 16) + ',' + parseInt(c.slice(2, 4), 16) + ',' + parseInt(c.slice(4, 6), 16) + ',' + a + ')';
  }
  var CYAN = '#4fd8ff', CYAN_B = '#a8f0ff', ORANGE = '#ff9b40';
  var appState = 'idle', micLevel = 0, ttsLevel = 0;

  // Hook status text changes to drive CSS classes on #jarvis-core
  var statusEl = document.getElementById('viz-status');
  if (statusEl) {
    var mo = new MutationObserver(function () {
      var txt = (statusEl.textContent || '').toUpperCase();
      var core = document.getElementById('jarvis-core');
      if (!core) return;
      core.classList.toggle('is-speaking', txt.indexOf('SPEAK') >= 0);
      core.classList.toggle('is-listening', txt.indexOf('LISTEN') >= 0 || txt.indexOf('HEAR') >= 0);
    });
    mo.observe(statusEl, { childList: true, characterData: true, subtree: true });
  }

  function resize() {
    var parent = canvas.parentElement;
    var size = parent ? parent.clientWidth : 320;
    size = Math.max(size || 320, 280);
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(size * dpr);
    canvas.height = Math.floor(size * dpr);
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
  }
  resize();
  window.addEventListener('resize', resize);

  function frame() {
    requestAnimationFrame(frame);
    t += 0.016;
    var w = canvas.width, h = canvas.height;
    if (w < 10) return;
    var cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.48;
    ctx.clearRect(0, 0, w, h);
    var energy = 0.3 + Math.sin(t * 0.9) * 0.08;
    // orbit dots only (rings are CSS)
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var a = p.a + t * 0.35 * p.s;
      var pr = R * p.r;
      var x = cx + Math.cos(a) * pr;
      var y = cy + Math.sin(a) * pr;
      ctx.fillStyle = hexA(i % 8 === 0 ? ORANGE : CYAN_B, 0.25 + energy * 0.4);
      ctx.beginPath();
      ctx.arc(x, y, p.sz * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Delay start so original gold loop can be drowned out by clearRect each frame
  setTimeout(function () {
    requestAnimationFrame(frame);
  }, 50);
})();
