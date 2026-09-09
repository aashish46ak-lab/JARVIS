'use strict';

const JarvisHologram = (function () {
  let scene, camera, renderer, group, animId;
  let autoOrbit = true;
  let container, canvasEl, panel;

  function ensureDOM() {
    panel = document.getElementById('hologram-panel');
    if (panel) return;
    panel = document.createElement('div');
    panel.id = 'hologram-panel';
    panel.className = 'hologram-panel hidden';
    panel.innerHTML = `
      <div class="holo-header">
        <span class="holo-title">HOLOGRAPHIC PROJECTION</span>
        <button id="holo-close" title="Close">✕</button>
      </div>
      <div id="holo-canvas-wrap" class="holo-canvas-wrap"></div>
      <div class="holo-meta">
        <div id="holo-label" class="holo-label">MODEL</div>
        <div id="holo-note" class="holo-note"></div>
      </div>
      <div class="holo-controls">
        <button data-view="front">FRONT</button>
        <button data-view="side">SIDE</button>
        <button data-view="top">TOP</button>
        <button data-view="isometric">ISO</button>
        <button data-view="orbit">ORBIT</button>
      </div>
    `;
    document.body.appendChild(panel);
    document.getElementById('holo-close').onclick = hide;
    panel.querySelectorAll('[data-view]').forEach((btn) => {
      btn.onclick = () => setView(btn.dataset.view);
    });
  }

  function initThree() {
    if (renderer) return;
    ensureDOM();
    container = document.getElementById('holo-canvas-wrap');
    const w = container.clientWidth || 420;
    const h = container.clientHeight || 320;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
    camera.position.set(0, 1.2, 4);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setClearColor(0x000000, 0);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    canvasEl = renderer.domElement;

    scene.add(new THREE.AmbientLight(0x4fd8ff, 0.45));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(3, 5, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x4fd8ff, 0.35);
    fill.position.set(-3, 1, -2);
    scene.add(fill);

    const ringGeo = new THREE.RingGeometry(1.6, 1.65, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x4fd8ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -1.1;
    scene.add(ring);

    let dragging = false, lx = 0, ly = 0;
    canvasEl.addEventListener('pointerdown', (e) => { dragging = true; lx = e.clientX; ly = e.clientY; autoOrbit = false; });
    window.addEventListener('pointerup', () => { dragging = false; });
    window.addEventListener('pointermove', (e) => {
      if (!dragging || !group) return;
      const dx = e.clientX - lx;
      const dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      group.rotation.y += dx * 0.01;
      group.rotation.x += dy * 0.01;
    });

    function animate() {
      animId = requestAnimationFrame(animate);
      if (group && autoOrbit) group.rotation.y += 0.008;
      if (renderer && scene && camera) renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
      if (!container || !renderer) return;
      const nw = container.clientWidth || 420;
      const nh = container.clientHeight || 320;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    });
  }

  function mat(color) {
    const c = new THREE.Color(color || '#4fd8ff');
    return new THREE.MeshStandardMaterial({
      color: c, emissive: c, emissiveIntensity: 0.25,
      metalness: 0.55, roughness: 0.35, transparent: true, opacity: 0.92,
    });
  }

  function wire(color) {
    return new THREE.MeshBasicMaterial({ color: color || 0x4fd8ff, wireframe: true, transparent: true, opacity: 0.35 });
  }

  function buildObject(type, color) {
    const g = new THREE.Group();
    const m = mat(color);
    const w = wire(color);
    const t = (type || 'cube').toLowerCase();

    function addSolid(geo) {
      g.add(new THREE.Mesh(geo, m));
      const outline = new THREE.Mesh(geo, w);
      outline.scale.multiplyScalar(1.02);
      g.add(outline);
    }

    if (t === 'sphere' || t === 'planet') {
      addSolid(new THREE.SphereGeometry(1, 32, 32));
      if (t === 'planet') {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.06, 8, 64), mat(color));
        ring.rotation.x = Math.PI / 2.5;
        g.add(ring);
      }
    } else if (t === 'pyramid') {
      addSolid(new THREE.ConeGeometry(1, 1.6, 4));
    } else if (t === 'torus' || t === 'molecule') {
      addSolid(new THREE.TorusGeometry(0.9, 0.35, 16, 48));
      if (t === 'molecule') {
        for (let i = 0; i < 3; i++) {
          const s = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), mat(color));
          const a = (i / 3) * Math.PI * 2;
          s.position.set(Math.cos(a) * 1.1, Math.sin(a) * 0.3, Math.sin(a) * 1.1);
          g.add(s);
        }
      }
    } else if (t === 'car') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.45, 1), m);
      body.position.y = 0.1;
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.4, 0.9), m);
      cabin.position.set(-0.15, 0.45, 0);
      g.add(body, cabin);
      for (const [x, z] of [[-0.7, 0.55], [-0.7, -0.55], [0.7, 0.55], [0.7, -0.55]]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.15, 16), mat('#222'));
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, -0.15, z);
        g.add(wheel);
      }
    } else if (t === 'robot') {
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 1, 0.5), m));
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), m);
      head.position.y = 0.85;
      g.add(head);
      for (const [x, y] of [[-0.22, -0.85], [0.22, -0.85]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.3), m);
        leg.position.set(x, y, 0);
        g.add(leg);
      }
      for (const x of [-0.55, 0.55]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), m);
        arm.position.set(x, 0.1, 0);
        g.add(arm);
      }
    } else if (t === 'building') {
      for (let i = 0; i < 5; i++) {
        const h = 0.6 + (i * 0.25);
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, h, 0.5), m);
        b.position.set((i - 2) * 0.55, h / 2 - 1, (i % 2) * 0.3);
        g.add(b);
      }
    } else if (t === 'aircraft' || t === 'plane') {
      const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 2.2, 12), m);
      fuselage.rotation.z = Math.PI / 2;
      g.add(fuselage, new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.5), m));
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.3), m);
      tail.position.set(-0.9, 0.2, 0);
      g.add(tail);
    } else if (t === 'satellite') {
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.4), m));
      const panel1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.5), m);
      const panel2 = panel1.clone();
      panel1.position.x = 0.9; panel2.position.x = -0.9;
      g.add(panel1, panel2);
    } else {
      addSolid(new THREE.BoxGeometry(1.4, 1.4, 1.4));
    }
    return g;
  }

  function show({ object, label, color, note }) {
    ensureDOM();
    if (typeof THREE === 'undefined') {
      panel.classList.remove('hidden');
      document.getElementById('holo-label').textContent = label || object || 'MODEL';
      document.getElementById('holo-note').textContent = '3D engine loading…';
      return;
    }
    initThree();
    if (group) scene.remove(group);
    group = buildObject(object, color);
    scene.add(group);
    autoOrbit = true;
    camera.position.set(0, 1.2, 4);
    camera.lookAt(0, 0, 0);
    document.getElementById('holo-label').textContent = (label || object || 'MODEL').toUpperCase();
    document.getElementById('holo-note').textContent = note || 'Drag to rotate · Use view buttons';
    panel.classList.remove('hidden');
  }

  function hide() {
    if (panel) panel.classList.add('hidden');
  }

  function setView(view) {
    if (!camera) return;
    autoOrbit = view === 'orbit';
    const v = (view || 'orbit').toLowerCase();
    if (v === 'front') camera.position.set(0, 0.5, 4);
    else if (v === 'side') camera.position.set(4, 0.5, 0);
    else if (v === 'top') camera.position.set(0, 5, 0.01);
    else if (v === 'isometric') camera.position.set(3, 2.5, 3);
    else camera.position.set(0, 1.2, 4);
    camera.lookAt(0, 0, 0);
  }

  return { show, hide, setView };
})();
