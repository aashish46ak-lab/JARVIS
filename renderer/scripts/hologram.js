'use strict';

const JarvisHologram = (function () {
  let scene, camera, renderer, group, animId;
  let autoOrbit = true;
  let container, canvasEl, panel;
  let scanLine = 0;

  function ensureDOM() {
    panel = document.getElementById('hologram-panel');
    if (panel) return;
    panel = document.createElement('div');
    panel.id = 'hologram-panel';
    panel.className = 'hologram-panel hidden';
    panel.innerHTML =
      '<div class="holo-header">' +
      '<span class="holo-title">HOLOGRAPHIC PROJECTION</span>' +
      '<button id="holo-close" title="Close">✕</button></div>' +
      '<div id="holo-canvas-wrap" class="holo-canvas-wrap"></div>' +
      '<div class="holo-meta"><div id="holo-label" class="holo-label">MODEL</div>' +
      '<div id="holo-note" class="holo-note"></div></div>' +
      '<div class="holo-controls">' +
      '<button data-view="front">FRONT</button>' +
      '<button data-view="side">SIDE</button>' +
      '<button data-view="top">TOP</button>' +
      '<button data-view="isometric">ISO</button>' +
      '<button data-view="orbit">ORBIT</button></div>';
    document.body.appendChild(panel);
    document.getElementById('holo-close').onclick = hide;
    panel.querySelectorAll('[data-view]').forEach(function (btn) {
      btn.onclick = function () { setView(btn.dataset.view); };
    });
  }

  function initThree() {
    if (renderer) return;
    ensureDOM();
    container = document.getElementById('holo-canvas-wrap');
    var w = container.clientWidth || 420;
    var h = container.clientHeight || 320;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    camera.position.set(0, 1.4, 4.2);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    canvasEl = renderer.domElement;
    scene.add(new THREE.AmbientLight(0x4fd8ff, 0.9));
    var ringGeo = new THREE.RingGeometry(1.5, 1.52, 96);
    var ringMat = new THREE.MeshBasicMaterial({ color: 0x4fd8ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
    var ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -1.15;
    scene.add(ring);
    var grid = new THREE.GridHelper(4, 20, 0x1a6a8a, 0x0a3040);
    grid.position.y = -1.16;
    grid.material.transparent = true;
    grid.material.opacity = 0.35;
    scene.add(grid);
    var dragging = false, lx = 0, ly = 0;
    canvasEl.addEventListener('pointerdown', function (e) { dragging = true; lx = e.clientX; ly = e.clientY; autoOrbit = false; });
    window.addEventListener('pointerup', function () { dragging = false; });
    window.addEventListener('pointermove', function (e) {
      if (!dragging || !group) return;
      group.rotation.y += (e.clientX - lx) * 0.01;
      group.rotation.x += (e.clientY - ly) * 0.01;
      lx = e.clientX; ly = e.clientY;
    });
    function animate() {
      animId = requestAnimationFrame(animate);
      if (group && autoOrbit) group.rotation.y += 0.006;
      scanLine += 0.02;
      if (group) {
        group.traverse(function (obj) {
          if (obj.material && obj.material.opacity !== undefined && obj.userData.baseOpacity) {
            obj.material.opacity = obj.userData.baseOpacity * (0.85 + 0.15 * Math.sin(scanLine * 3 + (obj.id || 0)));
          }
        });
      }
      if (renderer && scene && camera) renderer.render(scene, camera);
    }
    animate();
    window.addEventListener('resize', function () {
      if (!container || !renderer) return;
      var nw = container.clientWidth || 420, nh = container.clientHeight || 320;
      camera.aspect = nw / nh; camera.updateProjectionMatrix(); renderer.setSize(nw, nh);
    });
  }

  function cyanMat(opacity) {
    var m = new THREE.MeshBasicMaterial({ color: 0x4fd8ff, wireframe: true, transparent: true, opacity: opacity == null ? 0.55 : opacity });
    m.userData = { baseOpacity: m.opacity };
    return m;
  }

  function pointsFromGeometry(geo, count, color) {
    geo = geo.index ? geo.toNonIndexed() : geo;
    var pos = geo.attributes.position;
    var n = pos.count;
    var take = Math.min(count || 1200, n);
    var arr = new Float32Array(take * 3);
    var step = Math.max(1, Math.floor(n / take));
    var j = 0;
    for (var i = 0; i < n && j < take; i += step) {
      arr[j * 3] = pos.getX(i); arr[j * 3 + 1] = pos.getY(i); arr[j * 3 + 2] = pos.getZ(i); j++;
    }
    var bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(arr.slice(0, j * 3), 3));
    var mat = new THREE.PointsMaterial({ color: color || 0x7be8ff, size: 0.035, transparent: true, opacity: 0.9, depthWrite: false, sizeAttenuation: true });
    mat.userData = { baseOpacity: 0.9 };
    return new THREE.Points(bg, mat);
  }

  function wireAndDots(geo, g) {
    g.add(new THREE.Mesh(geo, cyanMat(0.35)));
    try { g.add(pointsFromGeometry(geo.clone(), 900, 0xa8f0ff)); } catch (e) {}
  }

  function buildObject(type) {
    var g = new THREE.Group();
    var t = (type || 'cube').toLowerCase();
    if (t === 'sphere' || t === 'planet') {
      wireAndDots(new THREE.SphereGeometry(1, 32, 24), g);
      if (t === 'planet') g.add(new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.04, 8, 64), cyanMat(0.5)));
    } else if (t === 'pyramid') {
      wireAndDots(new THREE.ConeGeometry(1, 1.6, 4, 1), g);
    } else if (t === 'torus' || t === 'molecule') {
      wireAndDots(new THREE.TorusGeometry(0.9, 0.32, 16, 48), g);
      if (t === 'molecule') {
        for (var i = 0; i < 4; i++) {
          var s = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), cyanMat(0.5));
          var a = (i / 4) * Math.PI * 2;
          s.position.set(Math.cos(a) * 1.15, Math.sin(a * 2) * 0.25, Math.sin(a) * 1.15);
          g.add(s);
        }
      }
    } else if (t === 'car') {
      wireAndDots(new THREE.BoxGeometry(2, 0.4, 1), g);
      var cab = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.35, 0.85), cyanMat(0.4));
      cab.position.set(-0.15, 0.38, 0); g.add(cab);
      for (var w = 0; w < 4; w++) {
        var wheel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 8, 16), cyanMat(0.55));
        wheel.rotation.y = Math.PI / 2;
        wheel.position.set(w < 2 ? -0.65 : 0.65, -0.2, w % 2 ? 0.55 : -0.55);
        g.add(wheel);
      }
    } else if (t === 'robot') {
      wireAndDots(new THREE.BoxGeometry(0.75, 1.0, 0.45), g);
      var head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), cyanMat(0.45));
      head.position.y = 0.85; g.add(head);
      [[-0.22, -0.9], [0.22, -0.9]].forEach(function (p) {
        var leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.28), cyanMat(0.4));
        leg.position.set(p[0], p[1], 0); g.add(leg);
      });
      [[-0.55, 0.1], [0.55, 0.1]].forEach(function (p) {
        var arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 0.18), cyanMat(0.4));
        arm.position.set(p[0], p[1], 0); g.add(arm);
      });
    } else if (t === 'building') {
      for (var i = 0; i < 5; i++) {
        var hh = 0.7 + i * 0.28;
        var b = new THREE.Mesh(new THREE.BoxGeometry(0.45, hh, 0.45), cyanMat(0.4));
        b.position.set((i - 2) * 0.52, hh / 2 - 1, (i % 2) * 0.25); g.add(b);
      }
    } else if (t === 'aircraft' || t === 'plane') {
      var fm = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.2, 10), cyanMat(0.45));
      fm.rotation.z = Math.PI / 2; g.add(fm);
      g.add(new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.05, 0.55), cyanMat(0.45)));
      var tail = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 0.28), cyanMat(0.45));
      tail.position.set(-0.95, 0.22, 0); g.add(tail);
    } else if (t === 'satellite') {
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.35), cyanMat(0.5)));
      var p1 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.04, 0.45), cyanMat(0.4));
      var p2 = p1.clone(); p1.position.x = 0.85; p2.position.x = -0.85; g.add(p1, p2);
    } else {
      wireAndDots(new THREE.BoxGeometry(1.3, 1.3, 1.3), g);
    }
    g.add(new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 2.6), cyanMat(0.12)));
    return g;
  }

  function show(opts) {
    opts = opts || {};
    ensureDOM();
    if (typeof THREE === 'undefined') {
      panel.classList.remove('hidden');
      document.getElementById('holo-label').textContent = (opts.label || opts.object || 'MODEL').toUpperCase();
      document.getElementById('holo-note').textContent = '3D engine loading…';
      return;
    }
    initThree();
    if (group) scene.remove(group);
    group = buildObject(opts.object);
    scene.add(group);
    autoOrbit = true;
    camera.position.set(0, 1.4, 4.2);
    camera.lookAt(0, 0, 0);
    document.getElementById('holo-label').textContent = (opts.label || opts.object || 'MODEL').toUpperCase();
    document.getElementById('holo-note').textContent = opts.note || 'Wireframe projection · Drag to rotate';
    panel.classList.remove('hidden');
  }

  function hide() { if (panel) panel.classList.add('hidden'); }

  function setView(view) {
    if (!camera) return;
    autoOrbit = view === 'orbit';
    var v = (view || 'orbit').toLowerCase();
    if (v === 'front') camera.position.set(0, 0.6, 4.2);
    else if (v === 'side') camera.position.set(4.2, 0.6, 0);
    else if (v === 'top') camera.position.set(0, 5, 0.01);
    else if (v === 'isometric') camera.position.set(3.2, 2.6, 3.2);
    else camera.position.set(0, 1.4, 4.2);
    camera.lookAt(0, 0, 0);
  }

  return { show: show, hide: hide, setView: setView };
})();
