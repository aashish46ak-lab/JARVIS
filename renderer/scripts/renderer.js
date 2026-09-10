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
    waiting: '#ff9b40', executing: '#7CFFB2', speaking: '#ff4d4d', error: '#ff5470',
  };

  function hexA(hex, alpha) {
    var c = hex.replace('#', '');
    return 'rgba(' + parseInt(c.substring(0, 2), 16) + ',' + parseInt(c.substring(2, 4), 16) + ',' + parseInt(c.substring(4, 6), 16) + ',' + alpha + ')';
  }

  function drawFrame() {
    requestAnimationFrame(drawFrame);
    t += 0.016;
    var w = canvas.width, h = canvas.height;
    if (w < 10 || h < 10) return;
    var cx = w / 2, cy = h / 2;
    var R = Math.min(w, h) * 0.46;
    ctx.clearRect(0, 0, w, h);
    var color = STATE_COLORS[appState] || '#4fd8ff';
    var intensityMul = animIntensity === 'low' ? 0.5 : animIntensity === 'high' ? 1.35 : 1;
    var energy = 0.22;
    if (appState === 'hearing' || appState === 'listening') energy = 0.28 + micLevel * 0.75;
    else if (appState === 'speaking') energy = 0.35 + ttsLevel * 0.8;
    else if (appState === 'thinking' || appState === 'executing') energy = 0.45 + Math.sin(t * 4) * 0.2;
    else if (appState === 'idle') energy = 0.2 + Math.sin(t * 0.8) * 0.06;
    energy *= intensityMul;

    var glow = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.15);
    glow.addColorStop(0, hexA(color, 0.06 + energy * 0.1));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.15, 0, Math.PI * 2); ctx.fill();

    ctx.save();
    ctx.strokeStyle = hexA(color, 0.55);
    ctx.lineWidth = 2.2 * dpr;
    ctx.setLineDash([6 * dpr, 5 * dpr]);
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.98, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    ctx.strokeStyle = hexA(color, 0.92);
    ctx.lineWidth = 5 * dpr;
    ctx.lineCap = 'round';
    var arcSpin = t * 0.35;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.98, -Math.PI * 0.15 + arcSpin, Math.PI * 0.55 + arcSpin);
    ctx.stroke();
    ctx.lineCap = 'butt';

    ctx.strokeStyle = hexA(color, 0.45);
    ctx.lineWidth = 1.6 * dpr;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.78, 0, Math.PI * 2); ctx.stroke();

    var segs = 36;
    for (var i = 0; i < segs; i++) {
      if (i % 3 === 0) continue;
      var a0 = (i / segs) * Math.PI * 2 + t * 0.12;
      var a1 = a0 + (Math.PI * 2) / segs * 0.55;
      ctx.strokeStyle = hexA(color, 0.35 + energy * 0.25);
      ctx.lineWidth = 1.2 * dpr;
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.62, a0, a1); ctx.stroke();
    }

    ctx.fillStyle = 'rgba(4, 10, 18, 0.92)';
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = hexA(color, 0.5);
    ctx.lineWidth = 1.4 * dpr;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.28, 0, Math.PI * 2); ctx.stroke();

    var coreColor = (appState === 'speaking') ? '#ff3333' : '#e02020';
    var coreR = R * (0.09 + energy * 0.04);
    var coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 3);
    coreGlow.addColorStop(0, hexA('#ffffff', 0.9));
    coreGlow.addColorStop(0.25, hexA(coreColor, 0.95));
    coreGlow.addColorStop(0.55, hexA(coreColor, 0.45));
    coreGlow.addColorStop(1, hexA(coreColor, 0));
    ctx.fillStyle = coreGlow;
    ctx.beginPath(); ctx.arc(cx, cy, coreR * 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = coreColor;
    ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = hexA(color, 0.7);
    for (var d = 0; d < 4; d++) {
      var ang = (d / 4) * Math.PI * 2 - Math.PI / 2;
      var dx = cx + Math.cos(ang) * R * 0.38;
      var dy = cy + Math.sin(ang) * R * 0.38;
      ctx.beginPath();
      ctx.moveTo(dx, dy - 3 * dpr);
      ctx.lineTo(dx + 2.5 * dpr, dy);
      ctx.lineTo(dx, dy + 3 * dpr);
      ctx.lineTo(dx - 2.5 * dpr, dy);
      ctx.closePath();
      ctx.fill();
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
  tickClock(); setInterval(tickClock, 1000);

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
      setBar('cpu', s.cpuLoadPercent); setBar('ram', s.ramUsedPercent);
      setBar('disk', s.diskUsedPercent); setBar('batt', s.batteryPercent);
    } catch (e) {}
  }
  refreshTelemetry(); setInterval(refreshTelemetry, 15000);

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
    var cleanup = function () { overlay.classList.add('hidden'); authorizeBtn.onclick = null; cancelBtn.onclick = null; };
    authorizeBtn.onclick = function () { window.jarvis.confirmation.respond(payload.id, true); cleanup(); };
    cancelBtn.onclick = function () { window.jarvis.confirmation.respond(payload.id, false); cleanup(); };
  }
  function cleanSpeech(text) {
    if (!text) return '';
    return String(text).replace(/```[\s\S]*?```/g, ' ').replace(/`[^`]+`/g, ' ')
      .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1')
      .replace(/#{1,6}\s*/g, '').replace(/[_~|>]/g, ' ')
      .replace(/\[[^\]]*\]\([^)]*\)/g, ' ').replace(/https?:\/\/\S+/g, 'link')
      .replace(/\s{2,}/g, ' ').trim();
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
      if (typeof JarvisVoice !== 'undefined') JarvisVoice.stopContinuousListening();
      setState('speaking');
      if (typeof JarvisVoice !== 'undefined') await JarvisVoice.speak(cleanSpeech(text));
    } catch (err) { console.warn('speak failed', err); }
    setState('idle');
    if (listeningMode === 'continuous' && typeof JarvisVoice !== 'undefined') {
      setTimeout(function () {
        JarvisVoice.configure({ listeningMode: 'continuous', wakeWordEnabled: false });
        JarvisVoice.startContinuousListening();
        setState('listening');
        pushActivity('Listening…');
      }, 350);
    }
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

  var micBtn = document.getElementById('btn-mic');
  var pttHeld = false;
  if (micBtn) {
    micBtn.addEventListener('mousedown', async function () {
      pttHeld = true;
      if (typeof JarvisVoice !== 'undefined') {
        JarvisVoice.stopContinuousListening();
        await JarvisVoice.startPushToTalkRecording();
      }
      setState('listening');
      micBtn.classList.add('listening');
    });
    window.addEventListener('mouseup', async function () {
      if (!pttHeld) return;
      pttHeld = false;
      micBtn.classList.remove('listening');
      setState('thinking');
      if (typeof JarvisVoice !== 'undefined') await JarvisVoice.stopPushToTalkRecording();
      if (listeningMode === 'continuous' && typeof JarvisVoice !== 'undefined') {
        JarvisVoice.startContinuousListening();
      }
    });
  }

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
      pushActivity((payload && payload.message) || 'Use mic button or type', 'warn');
    });
  }

  function safeOn(channel, cb) {
    try { if (window.jarvis && window.jarvis.events) window.jarvis.events.on(channel, cb); }
    catch (e) { console.warn(e); }
  }
  safeOn('state:change', function (p) { setState(p.state); });
  safeOn('activity', function (p) { pushActivity(p.text, p.level); });
  safeOn('confirmation:request', showConfirmation);
  safeOn('error', function (p) { pushActivity(p.message, 'error'); });
  safeOn('assistant:final', function (p) {
    if (p && p.proactive) { pushMessage('jarvis', p.text); speakReply(p.text); }
  });
  safeOn('hologram:show', function (p) {
    if (typeof JarvisHologram !== 'undefined') JarvisHologram.show(p || {});
    pushActivity('HOLOGRAM: ' + ((p && p.label) || (p && p.object) || 'model'));
  });
  safeOn('hologram:hide', function () { if (typeof JarvisHologram !== 'undefined') JarvisHologram.hide(); });
  safeOn('hologram:view', function (p) { if (typeof JarvisHologram !== 'undefined') JarvisHologram.setView(p && p.view); });

  async function bootstrap() {
    try {
      if (!window.jarvis) {
        document.body.innerHTML = '<div style="color:#4fd8ff;padding:2rem">JARVIS preload failed. Restart.</div>';
        return;
      }
      var config = await window.jarvis.config.getAll();
      listeningMode = 'continuous';
      animIntensity = config.animationIntensity || 'high';
      document.getElementById('provider-label').textContent = (config.aiProvider || 'groq').toUpperCase();
      document.getElementById('wakeword-label').textContent = 'OPEN MIC';

      if (typeof JarvisSettings !== 'undefined') {
        JarvisSettings.wireDrawer(function (updated) {
          listeningMode = updated.listeningMode || 'continuous';
          animIntensity = updated.animationIntensity;
          document.getElementById('provider-label').textContent = (updated.aiProvider || 'groq').toUpperCase();
          document.getElementById('wakeword-label').textContent = updated.wakeWordEnabled ? updated.wakeWord : 'OPEN MIC';
          if (typeof JarvisVoice !== 'undefined') {
            JarvisVoice.configure({
              wakeWordEnabled: !!updated.wakeWordEnabled,
              wakeWord: updated.wakeWord,
              listeningMode: listeningMode,
            });
            if (listeningMode === 'continuous') JarvisVoice.startContinuousListening();
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
      document.body.innerHTML = '<div style="color:#ff5470;padding:2rem">Startup error: ' + (err.message || err) + '</div>';
    }
  }

  async function startHud() {
    try {
      listeningMode = 'continuous';
      if (typeof JarvisVoice !== 'undefined') {
        JarvisVoice.configure({ wakeWordEnabled: false, wakeWord: 'jarvis', listeningMode: 'continuous' });
      }
      resizeCanvas();

      try {
        pushActivity('Requesting microphone…');
        var micStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        micStream.getTracks().forEach(function (tr) { tr.stop(); });
        pushActivity('Microphone granted');
      } catch (e) {
        pushActivity('Microphone denied — enable in Windows settings', 'error');
      }
      try {
        pushActivity('Requesting camera…');
        var camStream = await navigator.mediaDevices.getUserMedia({ video: true });
        camStream.getTracks().forEach(function (tr) { tr.stop(); });
        pushActivity('Camera granted');
      } catch (e) {
        pushActivity('Camera optional — skipped', 'warn');
      }

      if (typeof JarvisVoice !== 'undefined') {
        try { await JarvisVoice.initMicLevelMeter(); } catch (e) { console.warn(e); }
        JarvisVoice.startContinuousListening();
      }

      try {
        if (window.jarvis.enroll) {
          var faceRes = await window.jarvis.enroll.getFaceDataUrl();
          if (faceRes && faceRes.ok && faceRes.dataUrl) {
            var chip = document.getElementById('face-chip');
            var img = document.getElementById('face-chip-img');
            if (chip && img) { img.src = faceRes.dataUrl; chip.classList.remove('hidden'); }
          }
        }
      } catch (_) {}

      try {
        if (typeof JarvisHologram !== 'undefined') {
          JarvisHologram.show({ object: 'jarvis', label: 'J.A.R.V.I.S. CORE', note: 'Primary interface online' });
        }
      } catch (_) {}

      setState('listening');
      pushMessage('system', 'All systems are online.');
      pushActivity('Listening — speak naturally');
      var live = document.getElementById('live-chip');
      if (live) live.classList.add('live');
      await speakReply('Good evening, sir. All systems are online. I am listening.');
    } catch (err) {
      console.error('startHud failed', err);
      pushActivity('HUD error: ' + (err.message || err), 'error');
      if (typeof JarvisVoice !== 'undefined') {
        JarvisVoice.configure({ listeningMode: 'continuous', wakeWordEnabled: false });
        JarvisVoice.startContinuousListening();
      }
      setState('listening');
    }
  }

  window.__jarvisStartHud = startHud;
  bootstrap();
})();
