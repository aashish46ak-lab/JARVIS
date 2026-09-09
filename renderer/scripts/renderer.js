'use strict';

(function main() {
  let appState = 'idle';
  let micLevel = 0;
  let ttsLevel = 0;
  let animIntensity = 'high';
  let listeningMode = 'continuous';

  const STATUS_TEXT = {
    idle: 'SYSTEMS NOMINAL', listening: 'LISTENING', hearing: 'HEARING',
    thinking: 'ANALYZING', waiting: 'AWAITING AUTHORIZATION',
    executing: 'EXECUTING', speaking: 'SPEAKING', error: 'ERROR',
  };

  function setState(next) {
    appState = next;
    const statusEl = document.getElementById('viz-status');
    if (statusEl) statusEl.textContent = STATUS_TEXT[next] || next.toUpperCase();
    const stateLabel = document.getElementById('state-label');
    if (stateLabel) stateLabel.textContent = next.toUpperCase();
    const micBtn = document.getElementById('btn-mic');
    if (micBtn) micBtn.classList.toggle('listening', next === 'listening' || next === 'hearing');
  }

  const canvas = document.getElementById('viz-canvas');
  const ctx = canvas.getContext('2d');
  let dpr = window.devicePixelRatio || 1;

  function resizeCanvas() {
    const parent = canvas.parentElement;
    let size = parent ? parent.clientWidth : 0;
    if (!size || size < 50) size = Math.min(480, Math.floor(window.innerWidth * 0.4));
    size = Math.max(size, 280);
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(size * dpr);
    canvas.height = Math.floor(size * dpr);
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  setTimeout(resizeCanvas, 100);
  setTimeout(resizeCanvas, 500);

  let t = 0;
  const STATE_COLORS = {
    idle: '#4fd8ff', listening: '#4fd8ff', hearing: '#7be8ff', thinking: '#4fd8ff',
    waiting: '#ff9b40', executing: '#7CFFB2', speaking: '#4fd8ff', error: '#ff5470',
  };

  function drawFrame() {
    requestAnimationFrame(drawFrame);
    t += 0.016;
    const w = canvas.width, h = canvas.height;
    if (w < 10 || h < 10) return;
    const cx = w / 2, cy = h / 2;
    const baseR = Math.min(w, h) * 0.36;
    ctx.clearRect(0, 0, w, h);
    const color = STATE_COLORS[appState] || '#4fd8ff';
    const intensityMul = animIntensity === 'low' ? 0.55 : animIntensity === 'high' ? 1.55 : 1;

    let energy = 0.18;
    if (appState === 'hearing' || appState === 'listening') energy = 0.2 + micLevel * 0.85;
    else if (appState === 'speaking') energy = 0.25 + ttsLevel * 0.9;
    else if (appState === 'thinking' || appState === 'executing') energy = 0.4 + Math.sin(t * 5) * 0.2;
    else if (appState === 'idle') energy = 0.22 + Math.sin(t * 1.1) * 0.1;
    else if (appState === 'waiting') energy = 0.35 + Math.sin(t * 3) * 0.2;
    else if (appState === 'error') energy = 0.45 + Math.sin(t * 9) * 0.25;
    energy *= intensityMul;

    const hoverY = Math.sin(t * 1.4) * baseR * 0.035;
    const hoverX = Math.sin(t * 0.9) * baseR * 0.012;
    const ox = cx + hoverX;
    const oy = cy + hoverY;

    const atm = ctx.createRadialGradient(ox, oy, baseR * 0.2, ox, oy, baseR * 1.9);
    atm.addColorStop(0, hexA(color, 0.12 + energy * 0.15));
    atm.addColorStop(0.5, hexA(color, 0.04));
    atm.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = atm;
    ctx.beginPath(); ctx.arc(ox, oy, baseR * 1.9, 0, Math.PI * 2); ctx.fill();

    const ringSpeed = (appState === 'thinking' || appState === 'executing') ? 2.4 : 0.5;
    drawRing(ox, oy, baseR * 1.58, color, 0.22, t * ringSpeed * 0.25, 28, 0.35);
    drawRing(ox, oy, baseR * 1.42, color, 0.32, -t * ringSpeed * 0.45, 18, 0.45);
    drawRing(ox, oy, baseR * 1.26, color, 0.42, t * ringSpeed * 0.7, 14, 0.5);
    drawRing(ox, oy, baseR * 1.08, color, 0.55, -t * ringSpeed * 0.9, 22, 0.3);
    drawTicks(ox, oy, baseR * 1.68, color, t * 0.04);
    drawTicks(ox, oy, baseR * 0.88, color, -t * 0.06);

    const suitScale = 1 + energy * 0.08;
    const bodyH = baseR * 0.95 * suitScale;
    const bodyW = baseR * 0.55 * suitScale;

    const bodyGrad = ctx.createRadialGradient(ox, oy - bodyH * 0.05, 0, ox, oy, bodyH * 0.85);
    bodyGrad.addColorStop(0, hexA(color, 0.55 + energy * 0.3));
    bodyGrad.addColorStop(0.45, hexA(color, 0.22));
    bodyGrad.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(ox, oy + bodyH * 0.05, bodyW * 0.55, bodyH * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = hexA(color, 0.75);
    ctx.lineWidth = 2.4 * dpr;
    ctx.beginPath();
    ctx.ellipse(ox, oy + bodyH * 0.02, bodyW * 0.42, bodyH * 0.32, 0, -Math.PI * 0.15, Math.PI * 1.15);
    ctx.stroke();

    const reactorR = baseR * (0.14 + energy * 0.12);
    const reactor = ctx.createRadialGradient(ox, oy + bodyH * 0.02, 0, ox, oy + bodyH * 0.02, reactorR * 2.2);
    reactor.addColorStop(0, hexA('#ffffff', 0.95));
    reactor.addColorStop(0.25, hexA(color, 0.9));
    reactor.addColorStop(0.6, hexA(color, 0.35));
    reactor.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = reactor;
    ctx.beginPath(); ctx.arc(ox, oy + bodyH * 0.02, reactorR * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hexA('#eafcff', 0.95);
    ctx.beginPath(); ctx.arc(ox, oy + bodyH * 0.02, reactorR * 0.45, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = hexA(color, 0.65);
    ctx.lineWidth = 2 * dpr;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(ox + side * bodyW * 0.48, oy - bodyH * 0.12, bodyW * 0.28, side > 0 ? -0.4 : Math.PI - 0.2, side > 0 ? 0.9 : Math.PI + 0.4);
      ctx.stroke();
    }

    ctx.strokeStyle = hexA(color, 0.7);
    ctx.lineWidth = 2.2 * dpr;
    ctx.beginPath();
    ctx.arc(ox, oy - bodyH * 0.28, bodyW * 0.38, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();

    if (appState === 'speaking' || appState === 'hearing' || energy > 0.35) {
      const eyeY = oy - bodyH * 0.32;
      const eyeDist = bodyW * 0.18;
      const eyeR = baseR * (0.04 + energy * 0.05);
      const eyeA = 0.6 + energy * 0.4;
      for (const side of [-1, 1]) {
        const ex = ox + side * eyeDist;
        const eg = ctx.createRadialGradient(ex, eyeY, 0, ex, eyeY, eyeR * 3);
        eg.addColorStop(0, hexA('#ffffff', eyeA));
        eg.addColorStop(0.35, hexA(color, eyeA * 0.85));
        eg.addColorStop(1, hexA(color, 0));
        ctx.fillStyle = eg;
        ctx.beginPath(); ctx.arc(ex, eyeY, eyeR * 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = hexA('#f0fdff', 0.95);
        ctx.beginPath(); ctx.arc(ex, eyeY, eyeR * 0.5, 0, Math.PI * 2); ctx.fill();
      }
    }

    for (let i = 0; i < 36; i++) {
      const angle = (i / 36) * Math.PI * 2 + t * 0.2;
      const jitter = (appState === 'hearing' || appState === 'speaking')
        ? Math.abs(Math.sin(angle * 6 + t * 10)) * energy : energy * 0.25;
      const r1 = baseR * 0.22;
      const r2 = r1 + baseR * (0.08 + jitter * 0.35);
      ctx.strokeStyle = hexA(color, 0.35 + jitter * 0.55);
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      ctx.moveTo(ox + Math.cos(angle) * r1, oy + bodyH * 0.02 + Math.sin(angle) * r1);
      ctx.lineTo(ox + Math.cos(angle) * r2, oy + bodyH * 0.02 + Math.sin(angle) * r2);
      ctx.stroke();
    }

    if (appState === 'speaking' || appState === 'thinking') {
      ctx.strokeStyle = hexA(color, 0.3 + energy * 0.35);
      ctx.lineWidth = 1.3 * dpr;
      const arcR = baseR * (1.35 + energy * 0.2);
      ctx.beginPath(); ctx.arc(ox, oy, arcR, t * 2.2, t * 2.2 + Math.PI * 0.65); ctx.stroke();
      ctx.beginPath(); ctx.arc(ox, oy, arcR * 1.1, -t * 1.7, -t * 1.7 + Math.PI * 0.5); ctx.stroke();
    }

    ctx.strokeStyle = hexA(color, 0.15 + energy * 0.1);
    ctx.lineWidth = 1.2 * dpr;
    ctx.beginPath();
    ctx.ellipse(ox, oy + baseR * 0.95, baseR * 0.55, baseR * 0.08, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawRing(cx, cy, r, color, alpha, rotation, segments, coverage) {
    ctx.strokeStyle = hexA(color, alpha);
    ctx.lineWidth = 1.4 * dpr;
    const gap = (Math.PI * 2) / segments;
    for (let i = 0; i < segments; i++) {
      const start = i * gap + rotation;
      const end = start + gap * coverage;
      ctx.beginPath(); ctx.arc(cx, cy, r, start, end); ctx.stroke();
    }
  }

  function drawTicks(cx, cy, r, color, rotation) {
    ctx.strokeStyle = hexA(color, 0.25);
    ctx.lineWidth = 1 * dpr;
    for (let i = 0; i < 60; i++) {
      const angle = (i / 60) * Math.PI * 2 + rotation;
      const len = i % 5 === 0 ? 10 * dpr : 4 * dpr;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
      ctx.lineTo(cx + Math.cos(angle) * (r - len), cy + Math.sin(angle) * (r - len));
      ctx.stroke();
    }
  }

  function hexA(hex, alpha) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  requestAnimationFrame(drawFrame);

  function tickClock() {
    const now = new Date();
    document.getElementById('clock-time').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    document.getElementById('clock-date').textContent = now.toLocaleDateString([], { weekday: 'long', day: '2-digit', month: 'short' });
  }
  tickClock();
  setInterval(tickClock, 1000);

  async function refreshTelemetry() {
    try {
      const s = await window.jarvis.system.getStatus();
      setBar('cpu', s.cpuLoadPercent);
      setBar('ram', s.ramUsedPercent);
      setBar('disk', s.diskUsedPercent);
      setBar('batt', s.batteryPercent);
    } catch (_) {}
  }
  function setBar(key, percent) {
    const bar = document.getElementById('bar-' + key);
    const val = document.getElementById('val-' + key);
    if (percent == null) { val.textContent = 'N/A'; bar.style.width = '0%'; return; }
    bar.style.width = Math.min(100, percent) + '%';
    val.textContent = Math.round(percent) + '%';
  }
  refreshTelemetry();
  setInterval(refreshTelemetry, 15000);

  function pushActivity(text, level) {
    const feed = document.getElementById('activity-feed');
    const item = document.createElement('div');
    item.className = 'item ' + (level || 'info');
    item.textContent = text;
    feed.prepend(item);
    while (feed.children.length > 6) feed.removeChild(feed.lastChild);
  }

  function pushMessage(role, text) {
    const convo = document.getElementById('conversation');
    const div = document.createElement('div');
    div.className = 'msg ' + role;
    div.textContent = text;
    convo.appendChild(div);
    convo.scrollTop = convo.scrollHeight;
  }

  function showConfirmation(payload) {
    const overlay = document.getElementById('confirm-overlay');
    document.getElementById('confirm-summary').textContent = payload.summary;
    overlay.classList.remove('hidden');
    setState('waiting');
    const authorizeBtn = document.getElementById('confirm-authorize');
    const cancelBtn = document.getElementById('confirm-cancel');
    const cleanup = () => { overlay.classList.add('hidden'); authorizeBtn.onclick = null; cancelBtn.onclick = null; };
    authorizeBtn.onclick = () => { window.jarvis.confirmation.respond(payload.id, true); cleanup(); };
    cancelBtn.onclick = () => { window.jarvis.confirmation.respond(payload.id, false); cleanup(); };
  }

  let processing = false;
  async function handleUserUtterance(text) {
    if (!text || processing) return;
    processing = true;
    pushMessage('user', text);
    setState('thinking');
    const res = await window.jarvis.chat.sendMessage(text);
    const reply = res.ok ? res.reply : (res.error || "I'm afraid something went wrong.");
    pushMessage('jarvis', reply);
    await speakReply(reply);
    processing = false;
  }

  async function speakReply(text) {
    if (listeningMode === 'continuous') JarvisVoice.stopContinuousListening();
    setState('speaking');
    await JarvisVoice.speak(text);
    setState('idle');
    if (listeningMode === 'continuous') JarvisVoice.startContinuousListening();
  }

  document.getElementById('btn-send').addEventListener('click', sendTextInput);
  document.getElementById('text-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendTextInput(); });
  function sendTextInput() {
    const input = document.getElementById('text-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    handleUserUtterance(text);
  }

  const micBtn = document.getElementById('btn-mic');
  let pttHeld = false;
  micBtn.addEventListener('mousedown', async () => {
    pttHeld = true;
    if (listeningMode === 'continuous') JarvisVoice.stopContinuousListening();
    await JarvisVoice.startPushToTalkRecording();
    setState('listening');
  });
  window.addEventListener('mouseup', async () => {
    if (!pttHeld) return;
    pttHeld = false;
    setState('thinking');
    await JarvisVoice.stopPushToTalkRecording();
    if (listeningMode === 'continuous') JarvisVoice.startContinuousListening();
  });

  document.getElementById('quicklaunch').addEventListener('click', (e) => {
    const btn = e.target.closest('.ql-btn');
    if (!btn) return;
    handleUserUtterance('Open ' + btn.dataset.app);
  });

  document.getElementById('btn-settings').addEventListener('click', () => JarvisSettings.openDrawer());
  document.getElementById('btn-minimize').addEventListener('click', () => window.jarvis.win.minimize());
  document.getElementById('btn-close').addEventListener('click', () => window.jarvis.win.close());
  document.getElementById('btn-pin').addEventListener('click', async () => {
    const pinned = await window.jarvis.win.toggleAlwaysOnTop();
    document.getElementById('btn-pin').style.color = pinned ? 'var(--cyan)' : '';
  });

  JarvisVoice.on('micLevel', (level) => { micLevel = level; });
  JarvisVoice.on('ttsLevel', (level) => { ttsLevel = level; });
  JarvisVoice.on('wake', () => { setState('listening'); pushActivity('VOICE DETECTED'); });
  JarvisVoice.on('interim', () => { if (appState !== 'thinking' && appState !== 'speaking') setState('hearing'); });
  JarvisVoice.on('transcript', (text) => { pushActivity('HEARD: "' + text + '"'); handleUserUtterance(text); });
  JarvisVoice.on('micError', ({ message }) => { pushActivity(message, 'error'); setState('error'); setTimeout(() => setState('idle'), 2500); });
  JarvisVoice.on('fallbackPushToTalk', ({ message }) => {
    pushActivity(message, 'warn');
    document.getElementById('hud-tagline').textContent = 'Push-to-talk — hold the mic button.';
  });
  JarvisVoice.on('transcribing', (active) => { if (active) setState('thinking'); });

  window.jarvis.events.on('state:change', ({ state }) => setState(state));
  window.jarvis.events.on('activity', ({ text, level }) => pushActivity(text, level));
  window.jarvis.events.on('confirmation:request', showConfirmation);
  window.jarvis.events.on('error', ({ message }) => pushActivity(message, 'error'));
  window.jarvis.events.on('assistant:final', (payload) => {
    if (payload && payload.proactive) { pushMessage('jarvis', payload.text); speakReply(payload.text); }
  });

  async function bootstrap() {
    const config = await window.jarvis.config.getAll();
    listeningMode = config.listeningMode || 'continuous';
    animIntensity = config.animationIntensity || 'high';
    document.getElementById('provider-label').textContent = config.aiProvider || 'groq';
    document.getElementById('wakeword-label').textContent = config.wakeWordEnabled ? config.wakeWord : 'open mic';

    JarvisSettings.wireDrawer((updated) => {
      listeningMode = updated.listeningMode;
      animIntensity = updated.animationIntensity;
      document.getElementById('provider-label').textContent = updated.aiProvider;
      document.getElementById('wakeword-label').textContent = updated.wakeWordEnabled ? updated.wakeWord : 'open mic';
      JarvisVoice.configure({ wakeWordEnabled: updated.wakeWordEnabled, wakeWord: updated.wakeWord, listeningMode: updated.listeningMode });
      if (updated.listeningMode === 'continuous') JarvisVoice.startContinuousListening();
      else JarvisVoice.stopContinuousListening();
    });

    if (!config.firstRunComplete) {
      document.getElementById('setup-screen').classList.remove('hidden');
      JarvisSettings.initSetupWizard(async () => {
        document.getElementById('setup-screen').classList.add('hidden');
        document.getElementById('hud-screen').classList.remove('hidden');
        await startHud();
      });
    } else {
      document.getElementById('hud-screen').classList.remove('hidden');
      await startHud();
    }
  }

  async function startHud() {
    const config = await window.jarvis.config.getAll();
    listeningMode = config.listeningMode || 'continuous';
    const useWake = !!config.wakeWordEnabled;
    JarvisVoice.configure({ wakeWordEnabled: useWake, wakeWord: config.wakeWord || 'jarvis', listeningMode: listeningMode });
    resizeCanvas();
    await JarvisVoice.initMicLevelMeter();
    setState('idle');
    pushMessage('system', 'Good evening, sir. All systems are online.');
    pushActivity(useWake ? 'Say "jarvis" then your command' : 'Listening — just speak anytime');
    await speakReply('Good evening, sir. All systems are online. I am listening.');
    if (listeningMode === 'continuous') JarvisVoice.startContinuousListening();
  }

  bootstrap();
})();
