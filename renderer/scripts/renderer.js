'use strict';

(function main() {
  // ---------------------------------------------------------------- state
  let appState = 'idle'; // idle | listening | hearing | thinking | waiting | executing | speaking | error
  let micLevel = 0;
  let ttsLevel = 0;
  let animIntensity = 'normal';
  let listeningMode = 'continuous';

  const STATUS_TEXT = {
    idle: 'SYSTEMS NOMINAL',
    listening: 'LISTENING',
    hearing: 'HEARING',
    thinking: 'ANALYZING',
    waiting: 'AWAITING AUTHORIZATION',
    executing: 'EXECUTING',
    speaking: 'SPEAKING',
    error: 'ERROR',
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

  // ---------------------------------------------------------------- canvas visualizer
  const canvas = document.getElementById('viz-canvas');
  const ctx = canvas.getContext('2d');
  let dpr = window.devicePixelRatio || 1;

  function resizeCanvas() {
    const size = canvas.parentElement.clientWidth;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  let t = 0;
  const STATE_COLORS = {
    idle: '#4fd8ff', listening: '#4fd8ff', hearing: '#7be8ff', thinking: '#4fd8ff',
    waiting: '#ff9b40', executing: '#7CFFB2', speaking: '#4fd8ff', error: '#ff5470',
  };

  function drawFrame() {
    requestAnimationFrame(drawFrame);
    t += 0.016;
    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2;
    const baseR = Math.min(w, h) * 0.34;
    ctx.clearRect(0, 0, w, h);

    const color = STATE_COLORS[appState] || '#4fd8ff';
    const intensityMul = animIntensity === 'low' ? 0.5 : animIntensity === 'high' ? 1.6 : 1;

    let energy = 0.15;
    if (appState === 'hearing' || appState === 'listening') energy = 0.15 + micLevel * 0.85;
    else if (appState === 'speaking') energy = 0.15 + ttsLevel * 0.85;
    else if (appState === 'thinking' || appState === 'executing') energy = 0.35 + Math.sin(t * 4) * 0.15;
    else if (appState === 'idle') energy = 0.2 + Math.sin(t * 1.2) * 0.08;
    else if (appState === 'waiting') energy = 0.3 + Math.sin(t * 3) * 0.2;
    else if (appState === 'error') energy = 0.4 + Math.sin(t * 8) * 0.2;
    energy *= intensityMul;

    const ringSpeed = (appState === 'thinking' || appState === 'executing') ? 2.2 : 0.4;
    drawRing(cx, cy, baseR * 1.35, color, 0.35, t * ringSpeed, 10, 0.55);
    drawRing(cx, cy, baseR * 1.18, color, 0.5, -t * ringSpeed * 0.7, 18, 0.35);
    drawTicks(cx, cy, baseR * 1.5, color, t * 0.05);

    // Subtle head motion while speaking
    const headOffsetX = appState === 'speaking' ? Math.sin(t * 1.8) * baseR * 0.04 * energy : 0;
    const headOffsetY = appState === 'speaking' ? Math.cos(t * 1.3) * baseR * 0.025 * energy : 0;
    const ox = cx + headOffsetX;
    const oy = cy + headOffsetY;

    const coreR = baseR * (0.55 + energy * 0.35);
    const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, coreR * 1.4);
    grad.addColorStop(0, hexA(color, 0.95));
    grad.addColorStop(0.45, hexA(color, 0.4));
    grad.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ox, oy, coreR * 1.4, 0, Math.PI * 2);
    ctx.fill();

    // Dual eye lights that pulse with TTS energy
    if (appState === 'speaking' || appState === 'hearing') {
      const eyeDist = coreR * 0.38;
      const eyeR = coreR * (0.12 + energy * 0.08);
      const eyeAlpha = 0.55 + energy * 0.45;
      for (const side of [-1, 1]) {
        const ex = ox + side * eyeDist;
        const ey = oy - coreR * 0.08;
        const eyeGrad = ctx.createRadialGradient(ex, ey, 0, ex, ey, eyeR * 2.2);
        eyeGrad.addColorStop(0, hexA('#ffffff', eyeAlpha));
        eyeGrad.addColorStop(0.4, hexA(color, eyeAlpha * 0.8));
        eyeGrad.addColorStop(1, hexA(color, 0));
        ctx.fillStyle = eyeGrad;
        ctx.beginPath();
        ctx.arc(ex, ey, eyeR * 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hexA('#e8fbff', 0.9);
        ctx.beginPath();
        ctx.arc(ex, ey, eyeR * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.strokeStyle = hexA(color, 0.9);
    ctx.lineWidth = 2.2 * dpr;
    ctx.beginPath();
    ctx.arc(ox, oy, coreR * 0.62, 0, Math.PI * 2);
    ctx.stroke();

    const bars = 48;
    for (let i = 0; i < bars; i++) {
      const angle = (i / bars) * Math.PI * 2 + t * 0.18;
      const jitter = (appState === 'hearing' || appState === 'speaking')
        ? Math.abs(Math.sin(angle * 7 + t * 12)) * energy
        : energy * 0.28;
      const r1 = baseR * 0.78;
      const r2 = r1 + baseR * (0.06 + jitter * 0.32);
      ctx.strokeStyle = hexA(color, 0.45 + jitter * 0.55);
      ctx.lineWidth = 1.7 * dpr;
      ctx.beginPath();
      ctx.moveTo(ox + Math.cos(angle) * r1, oy + Math.sin(angle) * r1);
      ctx.lineTo(ox + Math.cos(angle) * r2, oy + Math.sin(angle) * r2);
      ctx.stroke();
    }

    if (appState === 'speaking') {
      ctx.strokeStyle = hexA(color, 0.25 + energy * 0.35);
      ctx.lineWidth = 1.2 * dpr;
      const arcR = baseR * (1.55 + energy * 0.15);
      ctx.beginPath();
      ctx.arc(ox, oy, arcR, t * 2, t * 2 + Math.PI * 0.7);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ox, oy, arcR * 1.08, -t * 1.6, -t * 1.6 + Math.PI * 0.5);
      ctx.stroke();
    }
  }

  function drawRing(cx, cy, r, color, alpha, rotation, segments, coverage) {
    ctx.strokeStyle = hexA(color, alpha);
    ctx.lineWidth = 1.4 * dpr;
    const gap = (Math.PI * 2) / segments;
    for (let i = 0; i < segments; i++) {
      const start = i * gap + rotation;
      const end = start + gap * coverage;
      ctx.beginPath();
      ctx.arc(cx, cy, r, start, end);
      ctx.stroke();
    }
  }

  function drawTicks(cx, cy, r, color, rotation) {
    ctx.strokeStyle = hexA(color, 0.25);
    ctx.lineWidth = 1 * dpr;
    const count = 60;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rotation;
      const len = i % 5 === 0 ? 10 * dpr : 4 * dpr;
      const x1 = cx + Math.cos(angle) * r;
      const y1 = cy + Math.sin(angle) * r;
      const x2 = cx + Math.cos(angle) * (r - len);
      const y2 = cy + Math.sin(angle) * (r - len);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  function hexA(hex, alpha) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  requestAnimationFrame(drawFrame);

  // ---------------------------------------------------------------- clock
  function tickClock() {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const date = now.toLocaleDateString([], { weekday: 'long', day: '2-digit', month: 'short' });
    document.getElementById('clock-time').textContent = time;
    document.getElementById('clock-date').textContent = date;
  }
  tickClock();
  setInterval(tickClock, 1000);

  // ---------------------------------------------------------------- telemetry
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
    const bar = document.getElementById(`bar-${key}`);
    const val = document.getElementById(`val-${key}`);
    if (percent === null || percent === undefined) {
      val.textContent = 'N/A';
      bar.style.width = '0%';
      return;
    }
    bar.style.width = `${Math.min(100, percent)}%`;
    val.textContent = `${Math.round(percent)}%`;
  }
  refreshTelemetry();
  setInterval(refreshTelemetry, 15000);

  // ---------------------------------------------------------------- activity feed
  function pushActivity(text, level = 'info') {
    const feed = document.getElementById('activity-feed');
    const item = document.createElement('div');
    item.className = `item ${level}`;
    item.textContent = text;
    feed.prepend(item);
    while (feed.children.length > 6) feed.removeChild(feed.lastChild);
  }

  // ---------------------------------------------------------------- conversation
  function pushMessage(role, text) {
    const convo = document.getElementById('conversation');
    const div = document.createElement('div');
    div.className = `msg ${role}`;
    div.textContent = text;
    convo.appendChild(div);
    convo.scrollTop = convo.scrollHeight;
  }

  // ---------------------------------------------------------------- confirmation modal
  function showConfirmation({ id, summary }) {
    const overlay = document.getElementById('confirm-overlay');
    document.getElementById('confirm-summary').textContent = summary;
    overlay.classList.remove('hidden');
    setState('waiting');

    const authorizeBtn = document.getElementById('confirm-authorize');
    const cancelBtn = document.getElementById('confirm-cancel');
    const cleanup = () => {
      overlay.classList.add('hidden');
      authorizeBtn.onclick = null;
      cancelBtn.onclick = null;
    };
    authorizeBtn.onclick = () => { window.jarvis.confirmation.respond(id, true); cleanup(); };
    cancelBtn.onclick = () => { window.jarvis.confirmation.respond(id, false); cleanup(); };
  }

  // ---------------------------------------------------------------- chat pipeline
  let processing = false;

  async function handleUserUtterance(text) {
    if (!text || processing) return;
    processing = true;
    pushMessage('user', text);
    setState('thinking');

    const res = await window.jarvis.chat.sendMessage(text);
    const reply = res.ok ? res.reply : (res.error || "I'm afraid something went wrong.");
    pushMessage('jarvis', reply);

    const voiceEnabled = JarvisSettings.config?.voiceEnabled !== false;
    if (voiceEnabled) {
      await speakReply(reply);
    } else {
      setState('idle');
    }
    processing = false;
  }

  async function speakReply(text) {
    if (listeningMode === 'continuous') JarvisVoice.stopContinuousListening();
    setState('speaking');
    await JarvisVoice.speak(text);
    setState('idle');
    if (listeningMode === 'continuous') JarvisVoice.startContinuousListening();
  }

  // ---------------------------------------------------------------- text input row
  document.getElementById('btn-send').addEventListener('click', sendTextInput);
  document.getElementById('text-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendTextInput();
  });
  function sendTextInput() {
    const input = document.getElementById('text-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    handleUserUtterance(text);
  }

  // ---------------------------------------------------------------- mic button (push-to-talk)
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

  // ---------------------------------------------------------------- quick launch
  document.getElementById('quicklaunch').addEventListener('click', (e) => {
    const btn = e.target.closest('.ql-btn');
    if (!btn) return;
    handleUserUtterance(`Open ${btn.dataset.app}`);
  });

  // ---------------------------------------------------------------- top bar controls
  document.getElementById('btn-settings').addEventListener('click', () => JarvisSettings.openDrawer());
  document.getElementById('btn-minimize').addEventListener('click', () => window.jarvis.win.minimize());
  document.getElementById('btn-close').addEventListener('click', () => window.jarvis.win.close());
  document.getElementById('btn-pin').addEventListener('click', async () => {
    const pinned = await window.jarvis.win.toggleAlwaysOnTop();
    document.getElementById('btn-pin').style.color = pinned ? 'var(--cyan)' : '';
  });

  // ---------------------------------------------------------------- JarvisVoice event wiring
  JarvisVoice.on('micLevel', (level) => { micLevel = level; });
  JarvisVoice.on('ttsLevel', (level) => { ttsLevel = level; });
  JarvisVoice.on('wake', () => {
    setState('listening');
    pushActivity('VOICE DETECTED — WAKE WORD');
  });
  JarvisVoice.on('interim', () => { if (appState !== 'thinking' && appState !== 'speaking') setState('hearing'); });
  JarvisVoice.on('transcript', (text) => {
    pushActivity(`HEARD: "${text}"`);
    handleUserUtterance(text);
  });
  JarvisVoice.on('micError', ({ message }) => {
    pushActivity(message, 'error');
    setState('error');
    setTimeout(() => setState('idle'), 2500);
  });
  JarvisVoice.on('fallbackPushToTalk', ({ message }) => {
    pushActivity(message, 'warn');
    micBtn.classList.remove('muted');
    document.getElementById('hud-tagline').textContent = 'Push-to-talk mode — hold the mic button to speak.';
  });
  JarvisVoice.on('transcribing', (active) => { if (active) setState('thinking'); });

  // ---------------------------------------------------------------- bus events from main
  window.jarvis.events.on('state:change', ({ state }) => setState(state));
  window.jarvis.events.on('activity', ({ text, level }) => pushActivity(text, level));
  window.jarvis.events.on('confirmation:request', showConfirmation);
  window.jarvis.events.on('error', ({ message }) => pushActivity(message, 'error'));
  window.jarvis.events.on('assistant:final', (payload) => {
    if (payload && payload.proactive) {
      pushMessage('jarvis', payload.text);
      speakReply(payload.text);
    }
  });

  // ---------------------------------------------------------------- screen bootstrap
  async function bootstrap() {
    const config = await window.jarvis.config.getAll();
    listeningMode = config.listeningMode;
    animIntensity = config.animationIntensity;
    document.getElementById('provider-label').textContent = config.aiProvider;
    document.getElementById('wakeword-label').textContent = config.wakeWordEnabled ? config.wakeWord : 'disabled';

    JarvisSettings.wireDrawer((updated) => {
      listeningMode = updated.listeningMode;
      animIntensity = updated.animationIntensity;
      document.getElementById('provider-label').textContent = updated.aiProvider;
      document.getElementById('wakeword-label').textContent = updated.wakeWordEnabled ? updated.wakeWord : 'disabled';
      JarvisVoice.configure({
        wakeWordEnabled: updated.wakeWordEnabled,
        wakeWord: updated.wakeWord,
        listeningMode: updated.listeningMode,
      });
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
    JarvisVoice.configure({
      wakeWordEnabled: config.wakeWordEnabled,
      wakeWord: config.wakeWord,
      listeningMode: config.listeningMode,
    });
    await JarvisVoice.initMicLevelMeter();
    setState('idle');
    pushMessage('system', 'Good evening, sir. All systems are online.');

    if (config.listeningMode !== 'continuous') {
      pushActivity('Push-to-talk mode — hold the mic button to speak.');
    }

    if (config.voiceEnabled) {
      await speakReply('Good evening, sir. All systems are online.');
    } else if (config.listeningMode === 'continuous') {
      JarvisVoice.startContinuousListening();
    }
  }

  bootstrap();
})();
