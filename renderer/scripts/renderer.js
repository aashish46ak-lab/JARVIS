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
    var statusEl = document.getElementById('viz-status');
    if (statusEl) statusEl.textContent = STATUS_TEXT[next] || next.toUpperCase();
    var stateLabel = document.getElementById('state-label');
    if (stateLabel) stateLabel.textContent = next.toUpperCase();
  }

  var canvas = document.getElementById('viz-canvas');
  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;

  function resizeCanvas() {
    var parent = canvas.parentElement;
    var size = parent ? parent.clientWidth : 0;
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

  var t = 0;
  var STATE_COLORS = {
    idle: '#4fd8ff', listening: '#4fd8ff', hearing: '#7be8ff', thinking: '#4fd8ff',
    waiting: '#ff9b40', executing: '#7CFFB2', speaking: '#4fd8ff', error: '#ff5470',
  };

  function hexA(hex, alpha) {
    var c = hex.replace('#', '');
    var r = parseInt(c.substring(0, 2), 16);
    var g = parseInt(c.substring(2, 4), 16);
    var b = parseInt(c.substring(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function drawRing(cx, cy, r, color, alpha, rotation, segments, coverage) {
    ctx.strokeStyle = hexA(color, alpha);
    ctx.lineWidth = 1.4 * dpr;
    var gap = (Math.PI * 2) / segments;
    for (var i = 0; i < segments; i++) {
      var start = i * gap + rotation;
      var end = start + gap * coverage;
      ctx.beginPath(); ctx.arc(cx, cy, r, start, end); ctx.stroke();
    }
  }

  function drawTicks(cx, cy, r, color, rotation) {
    ctx.strokeStyle = hexA(color, 0.25);
    ctx.lineWidth = 1 * dpr;
    for (var i = 0; i < 60; i++) {
      var angle = (i / 60) * Math.PI * 2 + rotation;
      var len = i % 5 === 0 ? 10 * dpr : 4 * dpr;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
      ctx.lineTo(cx + Math.cos(angle) * (r - len), cy + Math.sin(angle) * (r - len));
      ctx.stroke();
    }
  }

  function drawFrame() {
    requestAnimationFrame(drawFrame);
    t += 0.016;
    var w = canvas.width, h = canvas.height;
    if (w < 10 || h < 10) return;
    var cx = w / 2, cy = h / 2;
    var R = Math.min(w, h) * 0.48;
    ctx.clearRect(0, 0, w, h);
    var color = STATE_COLORS[appState] || '#4fd8ff';
    var intensityMul = animIntensity === 'low' ? 0.5 : animIntensity === 'high' ? 1.4 : 1;

    var energy = 0.2;
    if (appState === 'hearing' || appState === 'listening') energy = 0.25 + micLevel * 0.8;
    else if (appState === 'speaking') energy = 0.3 + ttsLevel * 0.85;
    else if (appState === 'thinking' || appState === 'executing') energy = 0.45 + Math.sin(t * 4) * 0.2;
    else if (appState === 'idle') energy = 0.22 + Math.sin(t * 0.9) * 0.08;
    else if (appState === 'waiting') energy = 0.35 + Math.sin(t * 2.5) * 0.15;
    else if (appState === 'error') energy = 0.5 + Math.sin(t * 8) * 0.2;
    energy *= intensityMul;

    var ox = cx + Math.sin(t * 0.7) * R * 0.008;
    var oy = cy + Math.sin(t * 1.1) * R * 0.01;

    var glow = ctx.createRadialGradient(ox, oy, R * 0.15, ox, oy, R * 1.05);
    glow.addColorStop(0, hexA(color, 0.08 + energy * 0.12));
    glow.addColorStop(0.7, hexA(color, 0.03));
    glow.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(ox, oy, R * 1.05, 0, Math.PI * 2); ctx.fill();

    var rings = [
      { r: 0.98, segs: 48, cov: 0.55, a: 0.35, sp: 0.15 },
      { r: 0.88, segs: 36, cov: 0.4, a: 0.45, sp: -0.22 },
      { r: 0.78, segs: 60, cov: 0.7, a: 0.3, sp: 0.35 },
      { r: 0.68, segs: 24, cov: 0.5, a: 0.5, sp: -0.18 },
      { r: 0.58, segs: 40, cov: 0.35, a: 0.4, sp: 0.28 },
    ];
    var spin = (appState === 'thinking' || appState === 'executing') ? 2.5 : 1;
    for (var ri = 0; ri < rings.length; ri++) {
      var ring = rings[ri];
      drawRing(ox, oy, R * ring.r, color, ring.a * (0.7 + energy * 0.5), t * ring.sp * spin, ring.segs, ring.cov);
    }
    drawTicks(ox, oy, R * 0.98, color, t * 0.03);
    drawTicks(ox, oy, R * 0.55, color, -t * 0.05);

    ctx.strokeStyle = hexA(color, 0.85);
    ctx.lineWidth = 3.5 * dpr;
    ctx.lineCap = 'round';
    var arcStart = -Math.PI / 2;
    var arcLen = Math.PI * 2 * Math.min(0.95, 0.15 + energy * 0.7);
    ctx.beginPath();
    ctx.arc(ox, oy, R * 0.48, arcStart + t * 0.4, arcStart + t * 0.4 + arcLen);
    ctx.stroke();
    ctx.lineCap = 'butt';

    var disc = ctx.createRadialGradient(ox, oy, 0, ox, oy, R * 0.42);
    disc.addColorStop(0, hexA(color, 0.25 + energy * 0.2));
    disc.addColorStop(0.6, hexA(color, 0.08));
    disc.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = disc;
    ctx.beginPath(); ctx.arc(ox, oy, R * 0.42, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = hexA(color, 0.7);
    ctx.lineWidth = 1.8 * dpr;
    ctx.beginPath(); ctx.arc(ox, oy, R * 0.36, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(ox, oy, R * 0.28, 0, Math.PI * 2); ctx.stroke();

    var coreR = R * (0.08 + energy * 0.06);
    var core = ctx.createRadialGradient(ox, oy, 0, ox, oy, coreR * 2.5);
    core.addColorStop(0, hexA('#ffffff', 0.95));
    core.addColorStop(0.3, hexA(color, 0.85));
    core.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(ox, oy, coreR * 2.5, 0, Math.PI * 2); ctx.fill();

    if (energy > 0.3) {
      for (var i = 0; i < 24; i++) {
        var ang = (i / 24) * Math.PI * 2 + t * 0.5;
        var j = Math.abs(Math.sin(ang * 3 + t * 8)) * energy;
        var r1 = R * 0.12;
        var r2 = r1 + R * (0.05 + j * 0.12);
        ctx.strokeStyle = hexA(color, 0.3 + j * 0.5);
        ctx.lineWidth = 1.2 * dpr;
        ctx.beginPath();
        ctx.moveTo(ox + Math.cos(ang) * r1, oy + Math.sin(ang) * r1);
        ctx.lineTo(ox + Math.cos(ang) * r2, oy + Math.sin(ang) * r2);
        ctx.stroke();
      }
    }
  }
  requestAnimationFrame(drawFrame);

  function tickClock() {
    var now = new Date();
    var ct = document.getElementById('clock-time');
    var cd = document.getElementById('clock-date');
    if (ct) ct.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (cd) cd.textContent = now.toLocaleDateString([], { weekday: 'long', day: '2-digit', month: 'short' });
  }
  tickClock();
  setInterval(tickClock, 1000);

  function setBar(key, percent) {
    var bar = document.getElementById('bar-' + key);
    var val = document.getElementById('val-' + key);
    if (!bar || !val) return;
    if (percent == null) { val.textContent = 'N/A'; bar.style.width = '0%'; return; }
    bar.style.width = Math.min(100, percent) + '%';
    val.textContent = Math.round(percent) + '%';
  }
  async function refreshTelemetry() {
    try {
      var s = await window.jarvis.system.getStatus();
      setBar('cpu', s.cpuLoadPercent);
      setBar('ram', s.ramUsedPercent);
      setBar('disk', s.diskUsedPercent);
      setBar('batt', s.batteryPercent);
    } catch (e) {}
  }
  refreshTelemetry();
  setInterval(refreshTelemetry, 15000);

  function pushActivity(text, level) {
    var feed = document.getElementById('activity-feed');
    if (!feed) return;
    var item = document.createElement('div');
    item.className = 'item ' + (level || 'info');
    item.textContent = text;
    feed.prepend(item);
    while (feed.children.length > 6) feed.removeChild(feed.lastChild);
  }

  function pushMessage(role, text) {
    var convo = document.getElementById('conversation');
    if (!convo) return;
    var div = document.createElement('div');
    div.className = 'msg ' + role;
    div.textContent = text;
    convo.appendChild(div);
    convo.scrollTop = convo.scrollHeight;
  }

  function showConfirmation(payload) {
    var overlay = document.getElementById('confirm-overlay');
    document.getElementById('confirm-summary').textContent = payload.summary;
    overlay.classList.remove('hidden');
    setState('waiting');
    var authorizeBtn = document.getElementById('confirm-authorize');
    var cancelBtn = document.getElementById('confirm-cancel');
    var cleanup = function () {
      overlay.classList.add('hidden');
      authorizeBtn.onclick = null;
      cancelBtn.onclick = null;
    };
    authorizeBtn.onclick = function () { window.jarvis.confirmation.respond(payload.id, true); cleanup(); };
    cancelBtn.onclick = function () { window.jarvis.confirmation.respond(payload.id, false); cleanup(); };
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

  var processing = false;
  async function handleUserUtterance(text) {
    if (!text || processing) return;
    processing = true;
    pushMessage('user', text);
    setState('thinking');
    try {
      var res = await window.jarvis.chat.sendMessage(text);
      var reply = res.ok ? res.reply : (res.error || "I'm afraid something went wrong.");
      pushMessage('jarvis', reply);
      await speakReply(reply);
    } catch (err) {
      pushMessage('jarvis', "I'm afraid something went wrong, sir.");
      pushActivity(String(err && err.message || err), 'error');
    }
    processing = false;
  }

  async function speakReply(text) {
    try {
      if (listeningMode === 'continuous' && typeof JarvisVoice !== 'undefined') JarvisVoice.stopContinuousListening();
      setState('speaking');
      if (typeof JarvisVoice !== 'undefined') await JarvisVoice.speak(cleanSpeech(text));
    } catch (err) {
      console.warn('speak failed', err);
    }
    setState('idle');
    if (listeningMode === 'continuous' && typeof JarvisVoice !== 'undefined') JarvisVoice.startContinuousListening();
  }

  document.getElementById('btn-send').addEventListener('click', sendTextInput);
  document.getElementById('text-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') sendTextInput();
  });
  function sendTextInput() {
    var input = document.getElementById('text-input');
    var text = input.value.trim();
    if (!text) return;
    input.value = '';
    handleUserUtterance(text);
  }

  document.getElementById('quicklaunch').addEventListener('click', function (e) {
    var btn = e.target.closest('.ql-btn');
    if (!btn) return;
    handleUserUtterance('Open ' + btn.dataset.app);
  });

  document.getElementById('btn-settings').addEventListener('click', function () {
    if (typeof JarvisSettings !== 'undefined') JarvisSettings.openDrawer();
  });
  document.getElementById('btn-minimize').addEventListener('click', function () { window.jarvis.win.minimize(); });
  document.getElementById('btn-close').addEventListener('click', function () { window.jarvis.win.close(); });
  document.getElementById('btn-pin').addEventListener('click', async function () {
    var pinned = await window.jarvis.win.toggleAlwaysOnTop();
    document.getElementById('btn-pin').style.color = pinned ? 'var(--cyan)' : '';
  });

  if (typeof JarvisVoice !== 'undefined') {
    JarvisVoice.on('micLevel', function (level) { micLevel = level; });
    JarvisVoice.on('ttsLevel', function (level) { ttsLevel = level; });
    JarvisVoice.on('wake', function () { setState('listening'); pushActivity('VOICE DETECTED'); });
    JarvisVoice.on('interim', function () {
      if (appState !== 'thinking' && appState !== 'speaking') setState('hearing');
    });
    JarvisVoice.on('transcript', function (text) {
      pushActivity('HEARD: "' + text + '"');
      handleUserUtterance(text);
    });
    JarvisVoice.on('micError', function (payload) {
      pushActivity((payload && payload.message) || 'Mic error', 'error');
      setState('error');
      setTimeout(function () { setState('idle'); }, 2500);
    });
    JarvisVoice.on('fallbackPushToTalk', function (payload) {
      pushActivity((payload && payload.message) || 'Using push-to-talk', 'warn');
    });
    JarvisVoice.on('transcribing', function (active) { if (active) setState('thinking'); });
  }

  function safeOn(channel, cb) {
    try {
      if (window.jarvis && window.jarvis.events) window.jarvis.events.on(channel, cb);
    } catch (e) {
      console.warn('event subscribe failed', channel, e);
    }
  }
  safeOn('state:change', function (payload) { setState(payload.state); });
  safeOn('activity', function (payload) { pushActivity(payload.text, payload.level); });
  safeOn('confirmation:request', showConfirmation);
  safeOn('error', function (payload) { pushActivity(payload.message, 'error'); });
  safeOn('assistant:final', function (payload) {
    if (payload && payload.proactive) {
      pushMessage('jarvis', payload.text);
      speakReply(payload.text);
    }
  });
  safeOn('hologram:show', function (payload) {
    if (typeof JarvisHologram !== 'undefined') JarvisHologram.show(payload || {});
    pushActivity('HOLOGRAM: ' + ((payload && payload.label) || (payload && payload.object) || 'model'));
  });
  safeOn('hologram:hide', function () {
    if (typeof JarvisHologram !== 'undefined') JarvisHologram.hide();
  });
  safeOn('hologram:view', function (payload) {
    if (typeof JarvisHologram !== 'undefined') JarvisHologram.setView(payload && payload.view);
  });

  async function bootstrap() {
    try {
      if (!window.jarvis) {
        document.body.innerHTML = '<div style="color:#4fd8ff;padding:2rem">JARVIS preload failed. Restart the app.</div>';
        return;
      }
      var config = await window.jarvis.config.getAll();
      listeningMode = config.listeningMode || 'continuous';
      animIntensity = config.animationIntensity || 'high';
      document.getElementById('provider-label').textContent = config.aiProvider || 'groq';
      document.getElementById('wakeword-label').textContent = config.wakeWordEnabled ? (config.wakeWord || 'jarvis') : 'open mic';

      if (typeof JarvisSettings !== 'undefined') {
        JarvisSettings.wireDrawer(function (updated) {
          listeningMode = updated.listeningMode;
          animIntensity = updated.animationIntensity;
          document.getElementById('provider-label').textContent = updated.aiProvider;
          document.getElementById('wakeword-label').textContent = updated.wakeWordEnabled ? updated.wakeWord : 'open mic';
          if (typeof JarvisVoice !== 'undefined') {
            JarvisVoice.configure({
              wakeWordEnabled: updated.wakeWordEnabled,
              wakeWord: updated.wakeWord,
              listeningMode: updated.listeningMode,
            });
            if (updated.listeningMode === 'continuous') JarvisVoice.startContinuousListening();
            else JarvisVoice.stopContinuousListening();
          }
        });
      }

      if (!config.firstRunComplete) {
        document.getElementById('setup-screen').classList.remove('hidden');
        if (typeof JarvisSettings !== 'undefined') {
          JarvisSettings.initSetupWizard(async function () {
            document.getElementById('setup-screen').classList.add('hidden');
            document.getElementById('hud-screen').classList.remove('hidden');
            await startHud();
          });
        }
      } else {
        document.getElementById('hud-screen').classList.remove('hidden');
        await startHud();
      }
    } catch (err) {
      console.error('bootstrap failed', err);
      document.body.innerHTML = '<div style="color:#ff5470;padding:2rem">Startup error: ' + (err.message || err) + '</div>';
    }
  }

  async function startHud() {
    try {
      var config = await window.jarvis.config.getAll();
      listeningMode = config.listeningMode || 'continuous';
      var useWake = !!config.wakeWordEnabled;
      if (typeof JarvisVoice !== 'undefined') {
        JarvisVoice.configure({
          wakeWordEnabled: useWake,
          wakeWord: config.wakeWord || 'jarvis',
          listeningMode: listeningMode,
        });
      }
      resizeCanvas();
      var micEl = document.getElementById('btn-mic');
      if (micEl) micEl.style.display = 'none';
      if (typeof JarvisVoice !== 'undefined') {
        try { await JarvisVoice.initMicLevelMeter(); } catch (e) { console.warn(e); }
      }
      setState('idle');
      pushMessage('system', 'Good evening, sir. All systems are online.');
      pushActivity(useWake ? 'Say jarvis then your command' : 'Listening — just speak');
      speakReply('Good evening, sir. All systems are online. I am listening.').catch(function () {});
      if (listeningMode === 'continuous' && typeof JarvisVoice !== 'undefined') {
        try { JarvisVoice.startContinuousListening(); } catch (e) { console.warn(e); }
      }
    } catch (err) {
      console.error('startHud failed', err);
      pushActivity('HUD start error: ' + (err.message || err), 'error');
      setState('idle');
    }
  }

  bootstrap();
})();
