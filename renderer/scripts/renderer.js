'use strict';

(function main() {
  let appState = 'idle';
  let micLevel = 0;
  let ttsLevel = 0;
  let animIntensity = 'high';
  let listeningMode = 'continuous';

  const STATUS_TEXT = {
    idle: 'STANDBY', listening: 'LISTENING', hearing: 'HEARING',
    thinking: 'ANALYZING', waiting: 'AWAITING AUTHORIZATION',
    executing: 'EXECUTING', speaking: 'SPEAKING', error: 'ERROR',
  };

  function setState(next) {
    appState = next;
    const statusEl = document.getElementById('viz-status');
    if (statusEl) statusEl.textContent = STATUS_TEXT[next] || next.toUpperCase();
    const stateLabel = document.getElementById('state-label');
    if (stateLabel) stateLabel.textContent = next.toUpperCase();
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
    const R = Math.min(w, h) * 0.48;
    ctx.clearRect(0, 0, w, h);
    const color = STATE_COLORS[appState] || '#4fd8ff';
    const intensityMul = animIntensity === 'low' ? 0.5 : animIntensity === 'high' ? 1.4 : 1;

    let energy = 0.2;
    if (appState === 'hearing' || appState === 'listening') energy = 0.25 + micLevel * 0.8;
    else if (appState === 'speaking') energy = 0.3 + ttsLevel * 0.85;
    else if (appState === 'thinking' || appState === 'executing') energy = 0.45 + Math.sin(t * 4) * 0.2;
    else if (appState === 'idle') energy = 0.22 + Math.sin(t * 0.9) * 0.08;
    else if (appState === 'waiting') energy = 0.35 + Math.sin(t * 2.5) * 0.15;
    else if (appState === 'error') energy = 0.5 + Math.sin(t * 8) * 0.2;
    energy *= intensityMul;

    const ox = cx + Math.sin(t * 0.7) * R * 0.008;
    const oy = cy + Math.sin(t * 1.1) * R * 0.01;

    const glow = ctx.createRadialGradient(ox, oy, R * 0.15, ox, oy, R * 1.05);
    glow.addColorStop(0, hexA(color, 0.08 + energy * 0.12));
    glow.addColorStop(0.7, hexA(color, 0.03));
    glow.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(ox, oy, R * 1.05, 0, Math.PI * 2); ctx.fill();

    const rings = [
      { r: 0.98, segs: 48, cov: 0.55, a: 0.35, sp: 0.15 },
      { r: 0.88, segs: 36, cov: 0.4, a: 0.45, sp: -0.22 },
      { r: 0.78, segs: 60, cov: 0.7, a: 0.3, sp: 0.35 },
      { r: 0.68, segs: 24, cov: 0.5, a: 0.5, sp: -0.18 },
      { r: 0.58, segs: 40, cov: 0.35, a: 0.4, sp: 0.28 },
    ];
    const spin = (appState === 'thinking' || appState === 'executing') ? 2.5 : 1;
    for (const ring of rings) {
      drawRing(ox, oy, R * ring.r, color, ring.a * (0.7 + energy * 0.5), t * ring.sp * spin, ring.segs, ring.cov);
    }
    drawTicks(ox, oy, R * 0.98, color, t * 0.03);
    drawTicks(ox, oy, R * 0.55, color, -t * 0.05);

    ctx.strokeStyle = hexA(color, 0.85);
    ctx.lineWidth = 3.5 * dpr;
    ctx.lineCap = 'round';
    const arcStart = -Math.PI / 2;
    const arcLen = Math.PI * 2 * Math.min(0.95, 0.15 + energy * 0.7);
    ctx.beginPath();
    ctx.arc(ox, oy, R * 0.48, arcStart + t * 0.4, arcStart + t * 0.4 + arcLen);
    ctx.stroke();
    ctx.lineCap = 'butt';

    const disc = ctx.createRadialGradient(ox, oy, 0, ox, oy, R * 0.42);
    disc.addColorStop(0, hexA(color, 0.25 + energy * 0.2));
    disc.addColorStop(0.6, hexA(color, 0.08));
    disc.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = disc;
    ctx.beginPath(); ctx.arc(ox, oy, R * 0.42, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = hexA(color, 0.7);
    ctx.lineWidth = 1.8 * dpr;
    ctx.beginPath(); ctx.arc(ox, oy, R * 0.36, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(ox, oy, R * 0.28, 0, Math.PI * 2); ctx.stroke();

    const coreR = R * (0.08 + energy * 0.06);
    const core = ctx.createRadialGradient(ox, oy, 0, ox, oy, coreR * 2.5);
    core.addColorStop(0, hexA('#ffffff', 0.95));
    core.addColorStop(0.3, hexA(color, 0.85));
    core.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(ox, oy, coreR * 2.5, 0, Math.PI * 2); ctx.fill();

    if (energy > 0.3) {
      for (let i = 0; i < 24; i++) {
        const ang = (i / 24) * Math.PI * 2 + t * 0.5;
        const j = Math.abs(Math.sin(ang * 3 + t * 8)) * energy;
        const r1 = R * 0.12;
        const r2 = r1 + R * (0.05 + j * 0.12);
        ctx.strokeStyle = hexA(color, 0.3 + j * 0.5);
        ctx.lineWidth = 1.2 * dpr;
        ctx.beginPath();
        ctx.moveTo(ox + Math.cos(ang) * r1, oy + Math.sin(ang) * r1);
        ctx.lineTo(ox + Math.cos(ang) * r2, oy + Math.sin(ang) * r2);
        ctx.stroke();
      }
    }
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

  function cleanSpeech(text) {
    if (!text) return '';
    return String(text)
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`[^`]+`/g, ' ')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/#{1,6}\s*/g, '')
      .replace(/[_~|>]/g, ' ')
      .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/https?:\/\/\S+/g, 'link')
      .replace(/\s{2,}/g, ' ')
      .trim();
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
    await JarvisVoice.speak(cleanSpeech(text));
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
  JarvisVoice.on('fallbackPushToTalk', ({ message }) => { pushActivity(message, 'warn'); });
  JarvisVoice.on('transcribing', (active) => { if (active) setState('thinking'); });

  window.jarvis.events.on('state:change', ({ state }) => setState(state));
  window.jarvis.events.on('activity', ({ text, level }) => pushActivity(text, level));
  window.jarvis.events.on('confirmation:request', showConfirmation);
  window.jarvis.events.on('error', ({ message }) => pushActivity(message, 'error'));
  window.jarvis.events.on('assistant:final', (payload) => {
    if (payload && payload.proactive) { pushMessage('jarvis', payload.text); speakReply(payload.text); }
  });
  window.jarvis.events.on('hologram:show', (payload) => {
    if (typeof JarvisHologram !== 'undefined') JarvisHologram.show(payload || {});
    pushActivity('HOLOGRAM: ' + ((payload && payload.label) || (payload && payload.object) || 'model'));
  });
  window.jarvis.events.on('hologram:hide', () => {
    if (typeof JarvisHologram !== 'undefined') JarvisHologram.hide();
  });
  window.jarvis.events.on('hologram:view', (payload) => {
    if (typeof JarvisHologram !== 'undefined') JarvisHologram.setView(payload && payload.view);
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
    const micEl = document.getElementById('btn-mic');
    if (micEl) micEl.style.display = 'none';
    await JarvisVoice.initMicLevelMeter();
    setState('idle');
    pushMessage('system', 'Good evening, sir. All systems are online.');
    pushActivity(useWake ? 'Say jarvis then your command' : 'Listening — just speak');
    await speakReply('Good evening, sir. All systems are online. I am listening.');
    if (listeningMode === 'continuous') JarvisVoice.startContinuousListening();
  }

  bootstrap();
})();
