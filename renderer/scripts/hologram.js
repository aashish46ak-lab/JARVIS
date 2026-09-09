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
    camera.position.set(0, 1.2, 4.0);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    canvasEl = renderer.domElement;
    scene.add(new THREE.AmbientLight(0x4fd8ff, 1.0));

    for (var ri = 0; ri < 3; ri++) {
      var rg = new THREE.RingGeometry(1.2 + ri * 0.22, 1.22 + ri * 0.22, 96);
      var rm = new THREE.MeshBasicMaterial({ color: 0x4fd8ff, transparent: true, opacity: 0.25 - ri * 0.05, side: THREE.DoubleSide });
      var ring = new THREE.Mesh(rg, rm);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -1.2;
      scene.add(ring);
    }
    var grid = new THREE.GridHelper(5, 24, 0x1a6a8a, 0x0a3040);
    grid.position.y = -1.21;
    if (grid.material) { grid.material.transparent = true; grid.material.opacity = 0.3; }
    scene.add(grid);

    var dragging = false, lx = 0, ly = 0;
    canvasEl.addEventListener('pointerdown', function (e) {
      dragging = true; lx = e.clientX; ly = e.clientY; autoOrbit = false;
    });
    window.addEventListener('pointerup', function () { dragging = false; });
    window.addEventListener('pointermove', function (e) {
      if (!dragging || !group) return;
      group.rotation.y += (e.clientX - lx) * 0.01;
      group.rotation.x += (e.clientY - ly) * 0.01;
      lx = e.clientX; ly = e.clientY;
    });

    function animate() {
      animId = requestAnimationFrame(animate);
      if (group && autoOrbit) group.rotation.y += 0.005;
      scanLine += 0.025;
      if (group) {
        group.traverse(function (obj) {
          if (obj.material && obj.userData && obj.userData.baseOpacity != null) {
            obj.material.opacity = obj.userData.baseOpacity * (0.82 + 0.18 * Math.sin(scanLine * 2.5 + (obj.id || 0) * 0.3));
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
    var m = new THREE.MeshBasicMaterial({
      color: 0x4fd8ff, wireframe: true, transparent: true, opacity: opacity == null ? 0.5 : opacity,
    });
    m.userData = { baseOpacity: m.opacity };
    return m;
  }

  function pointsFromGeometry(geo, count, color, size) {
    try {
      geo = geo.index ? geo.toNonIndexed() : geo;
      var pos = geo.attributes.position;
      var n = pos.count;
      var take = Math.min(count || 1400, n);
      var arr = new Float32Array(take * 3);
      var step = Math.max(1, Math.floor(n / take));
      var j = 0;
      for (var i = 0; i < n && j < take; i += step) {
        arr[j * 3] = pos.getX(i);
        arr[j * 3 + 1] = pos.getY(i);
        arr[j * 3 + 2] = pos.getZ(i);
        j++;
      }
      var bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.BufferAttribute(arr.slice(0, j * 3), 3));
      var mat = new THREE.PointsMaterial({
        color: color || 0xa8f0ff,
        size: size || 0.028,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        sizeAttenuation: true,
      });
      mat.userData = { baseOpacity: 0.95 };
      return new THREE.Points(bg, mat);
    } catch (e) {
      return null;
    }
  }

  function wireAndDots(geo, g, pointCount) {
    g.add(new THREE.Mesh(geo, cyanMat(0.32)));
    var pts = pointsFromGeometry(geo.clone(), pointCount || 1000, 0xb8f4ff, 0.03);
    if (pts) g.add(pts);
  }

  function buildJarvisCore(g) {
    wireAndDots(new THREE.SphereGeometry(1.05, 48, 36), g, 1600);
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.65, 32, 24), cyanMat(0.45)));
    var coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    coreMat.userData = { baseOpacity: 0.85 };
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 16), coreMat));
    for (var i = 0; i < 3; i++) {
      var torus = new THREE.Mesh(new THREE.TorusGeometry(0.75 + i * 0.18, 0.012, 8, 80), cyanMat(0.55 - i * 0.1));
      torus.rotation.x = Math.PI / 2 + i * 0.4;
      torus.rotation.y = i * 0.7;
      g.add(torus);
    }
    var arc = new THREE.TorusGeometry(1.15, 0.01, 6, 64, Math.PI * 1.4);
    var a1 = new THREE.Mesh(arc, cyanMat(0.4));
    a1.rotation.y = Math.PI / 2;
    g.add(a1);
  }

  function buildSuit(g) {
    wireAndDots(new THREE.BoxGeometry(0.9, 1.15, 0.5), g, 800);
    var helm = new THREE.Mesh(new THREE.SphereGeometry(0.38, 20, 16), cyanMat(0.5));
    helm.position.y = 0.95;
    helm.scale.set(1, 1.15, 1.05);
    g.add(helm);
    [[-0.65, 0.15], [0.65, 0.15]].forEach(function (p) {
      var arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.85, 0.22), cyanMat(0.4));
      arm.position.set(p[0], p[1], 0); g.add(arm);
    });
    [[-0.25, -1.0], [0.25, -1.0]].forEach(function (p) {
      var leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.95, 0.32), cyanMat(0.4));
      leg.position.set(p[0], p[1], 0); g.add(leg);
    });
    var reactor = new THREE.Mesh(new THREE.CircleGeometry(0.12, 24), cyanMat(0.9));
    reactor.position.set(0, 0.35, 0.26);
    g.add(reactor);
  }

  function buildHead(g) {
    wireAndDots(new THREE.SphereGeometry(0.7, 36, 28), g, 1200);
    var face = new THREE.Mesh(new THREE.CircleGeometry(0.45, 32), cyanMat(0.35));
    face.position.z = 0.55; g.add(face);
    [[-0.18, 0.12], [0.18, 0.12]].forEach(function (p) {
      var eye = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.04), cyanMat(0.9));
      eye.position.set(p[0], p[1], 0.62); g.add(eye);
    });
  }

  function buildObject(type) {
    var g = new THREE.Group();
    var t = (type || 'jarvis').toLowerCase().replace(/\s+/g, '');

    if (t === 'jarvis' || t === 'core' || t === 'ai' || t === 'hologram') buildJarvisCore(g);
    else if (t === 'suit' || t === 'ironman' || t === 'armor') buildSuit(g);
    else if (t === 'head' || t === 'face' || t === 'helmet') buildHead(g);
    else if (t === 'sphere' || t === 'ball') wireAndDots(new THREE.SphereGeometry(1, 40, 32), g, 1400);
    else if (t === 'planet' || t === 'earth' || t === 'world') {
      wireAndDots(new THREE.SphereGeometry(1, 40, 32), g, 1400);
      g.add(new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.03, 8, 80), cyanMat(0.5)));
    } else if (t === 'pyramid' || t === 'cone') wireAndDots(new THREE.ConeGeometry(1, 1.6, 4, 1), g, 600);
    else if (t === 'torus' || t === 'ring') wireAndDots(new THREE.TorusGeometry(0.9, 0.32, 20, 64), g, 900);
    else if (t === 'molecule') {
      wireAndDots(new THREE.TorusGeometry(0.9, 0.28, 16, 48), g, 700);
      for (var i = 0; i < 5; i++) {
        var s = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), cyanMat(0.55));
        var a = (i / 5) * Math.PI * 2;
        s.position.set(Math.cos(a) * 1.1, Math.sin(a * 1.5) * 0.3, Math.sin(a) * 1.1);
        g.add(s);
      }
    } else if (t === 'car' || t === 'vehicle') {
      wireAndDots(new THREE.BoxGeometry(2.1, 0.42, 1.05), g, 700);
      var cab = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.38, 0.9), cyanMat(0.4));
      cab.position.set(-0.15, 0.4, 0); g.add(cab);
      for (var w = 0; w < 4; w++) {
        var wheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 10, 20), cyanMat(0.55));
        wheel.rotation.y = Math.PI / 2;
        wheel.position.set(w < 2 ? -0.7 : 0.7, -0.22, w % 2 ? 0.58 : -0.58);
        g.add(wheel);
      }
    } else if (t === 'robot') {
      wireAndDots(new THREE.BoxGeometry(0.8, 1.05, 0.48), g, 700);
      var head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.48), cyanMat(0.5));
      head.position.y = 0.9; g.add(head);
      [[-0.24, -0.95], [0.24, -0.95]].forEach(function (p) {
        var leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.75, 0.3), cyanMat(0.4));
        leg.position.set(p[0], p[1], 0); g.add(leg);
      });
      [[-0.58, 0.1], [0.58, 0.1]].forEach(function (p) {
        var arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), cyanMat(0.4));
        arm.position.set(p[0], p[1], 0); g.add(arm);
      });
    } else if (t === 'building' || t === 'tower' || t === 'city') {
      for (var i = 0; i < 6; i++) {
        var hh = 0.6 + i * 0.32;
        var b = new THREE.Mesh(new THREE.BoxGeometry(0.42, hh, 0.42), cyanMat(0.4));
        b.position.set((i - 2.5) * 0.5, hh / 2 - 1.05, (i % 2) * 0.28);
        g.add(b);
      }
    } else if (t === 'aircraft' || t === 'plane' || t === 'jet') {
      var fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 2.3, 12), cyanMat(0.45));
      fuse.rotation.z = Math.PI / 2; g.add(fuse);
      g.add(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.05, 0.6), cyanMat(0.45)));
      var tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.3), cyanMat(0.45));
      tail.position.set(-1.0, 0.25, 0); g.add(tail);
    } else if (t === 'satellite') {
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.35), cyanMat(0.5)));
      var p1 = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.04, 0.48), cyanMat(0.4));
      var p2 = p1.clone(); p1.position.x = 0.9; p2.position.x = -0.9; g.add(p1, p2);
    } else {
      buildJarvisCore(g);
    }

    g.add(new THREE.Mesh(new THREE.BoxGeometry(2.7, 2.7, 2.7), cyanMat(0.08)));
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
    group = buildObject(opts.object || opts.label || 'jarvis');
    scene.add(group);
    autoOrbit = true;
    camera.position.set(0, 1.2, 4.0);
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
    if (v === 'front') camera.position.set(0, 0.5, 4.0);
    else if (v === 'side') camera.position.set(4.0, 0.5, 0);
    else if (v === 'top') camera.position.set(0, 5, 0.01);
    else if (v === 'isometric') camera.position.set(3.0, 2.4, 3.0);
    else camera.position.set(0, 1.2, 4.0);
    camera.lookAt(0, 0, 0);
  }

  return { show: show, hide: hide, setView: setView };
})();
