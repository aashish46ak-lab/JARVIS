'use strict';
(function main() {
  let appState = 'idle', micLevel = 0, ttsLevel = 0, animIntensity = 'high', listeningMode = 'continuous';
  const STATUS_TEXT = {
    idle: 'STANDBY', listening: 'LISTENING', hearing: 'HEARING', thinking: 'ANALYZING',
    waiting: 'AWAITING AUTHORIZATION', executing: 'EXECUTING', speaking: 'SPEAKING', error: 'ERROR',
  };
  function setState(next) {
    appState = next;
    var s = document.getElementById('viz-status'); if (s) s.textContent = STATUS_TEXT[next] || next.toUpperCase();
    var l = document.getElementById('state-label'); if (l) l.textContent = next.toUpperCase();
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
    canvas.width = Math.floor(size * dpr); canvas.height = Math.floor(size * dpr);
    canvas.style.width = size + 'px'; canvas.style.height = size + 'px';
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  setTimeout(resizeCanvas, 100); setTimeout(resizeCanvas, 500);

  var t = 0, particles = [];
  for (var pi = 0; pi < 160; pi++) {
    particles.push({ a: Math.random() * Math.PI * 2, b: (Math.random() - 0.5) * Math.PI, r: 0.35 + Math.random() * 0.55, s: 0.4 + Math.random() * 1.2, sz: 0.6 + Math.random() * 1.8 });
  }
  function hexA(hex, a) {
    var c = hex.replace('#', '');
    return 'rgba(' + parseInt(c.slice(0,2),16) + ',' + parseInt(c.slice(2,4),16) + ',' + parseInt(c.slice(4,6),16) + ',' + a + ')';
  }
  function drawFrame() {
    requestAnimationFrame(drawFrame);
    t += 0.016;
    var w = canvas.width, h = canvas.height; if (w < 10) return;
    var cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.46;
    ctx.clearRect(0, 0, w, h);
    var gold = '#ff9a1f', goldBright = '#ffd27a', goldDeep = '#c45a00';
    var energy = 0.28;
    if (appState === 'hearing' || appState === 'listening') energy = 0.35 + micLevel * 0.7;
    else if (appState === 'speaking') energy = 0.45 + ttsLevel * 0.7;
    else if (appState === 'thinking' || appState === 'executing') energy = 0.5 + Math.sin(t * 5) * 0.2;
    else energy = 0.28 + Math.sin(t * 0.9) * 0.08;
    if (animIntensity === 'low') energy *= 0.55; else if (animIntensity === 'high') energy *= 1.25;

    var g0 = ctx.createRadialGradient(cx, cy, R * 0.05, cx, cy, R * 1.15);
    g0.addColorStop(0, hexA(gold, 0.18 + energy * 0.15));
    g0.addColorStop(0.45, hexA(goldDeep, 0.08));
    g0.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g0; ctx.beginPath(); ctx.arc(cx, cy, R * 1.15, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = hexA(gold, 0.35); ctx.lineWidth = 1.2 * dpr;
    var br = R * 1.05, bl = 18 * dpr;
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function (s) {
      var x = cx + s[0] * br, y = cy + s[1] * br;
      ctx.beginPath(); ctx.moveTo(x, y - s[1] * bl); ctx.lineTo(x, y); ctx.lineTo(x - s[0] * bl, y); ctx.stroke();
    });
    for (var ring = 0; ring < 5; ring++) {
      var rr = R * (0.42 + ring * 0.12);
      ctx.strokeStyle = hexA(gold, 0.12 + energy * 0.08 + (ring === 2 ? 0.15 : 0));
      ctx.lineWidth = (1 + (ring === 2 ? 1.5 : 0)) * dpr;
      ctx.beginPath(); ctx.arc(cx, cy, rr, t * (0.15 + ring * 0.05), t * (0.15 + ring * 0.05) + Math.PI * 1.4); ctx.stroke();
    }
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var a = p.a + t * 0.25 * p.s, b = p.b + Math.sin(t * 0.4 + p.a) * 0.05;
      var pr = R * p.r * (0.85 + energy * 0.15);
      var x = cx + Math.cos(a) * Math.cos(b) * pr;
      var y = cy + Math.sin(b) * pr * 0.92;
      var z = Math.sin(a) * Math.cos(b);
      var alpha = 0.15 + (z + 1) * 0.25 + energy * 0.2;
      var size = p.sz * dpr * (0.7 + (z + 1) * 0.4);
      ctx.fillStyle = hexA(z > 0.2 ? goldBright : gold, Math.min(0.95, alpha));
      ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = hexA(goldBright, 0.35 + energy * 0.3); ctx.lineWidth = 1.5 * dpr;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.32, -t * 1.2, -t * 1.2 + Math.PI * 0.8); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.28, t * 1.5, t * 1.5 + Math.PI * 0.6); ctx.stroke();
    var coreR = R * (0.07 + energy * 0.05);
    var cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 4);
    cg.addColorStop(0, hexA('#ffffff', 0.95));
    cg.addColorStop(0.2, hexA(goldBright, 0.9));
    cg.addColorStop(0.55, hexA(gold, 0.4));
    cg.addColorStop(1, hexA(goldDeep, 0));
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, coreR * 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = goldBright; ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, Math.PI * 2); ctx.fill();
  }
  requestAnimationFrame(drawFrame);

  function tickClock() {
    var now = new Date();
    var ct = document.getElementById('clock-time'); var cd = document.getElementById('clock-date');
    if (ct) ct.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (cd) cd.textContent = now.toLocaleDateString([], { weekday: 'long', day: '2-digit', month: 'short' });
  }
  tickClock(); setInterval(tickClock, 1000);

  function setBar(key, percent) {
    var bar = document.getElementById('bar-' + key); var val = document.getElementById('val-' + key);
    if (!bar || !val) return;
    if (percent == null) { val.textContent = 'N/A'; bar.style.width = '0%'; return; }
    bar.style.width = Math.min(100, percent) + '%'; val.textContent = Math.round(percent) + '%';
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
    var feed = document.getElementById('activity-feed'); if (!feed) return;
    var item = document.createElement('div'); item.className = 'item ' + (level || 'info'); item.textContent = text;
    feed.prepend(item); while (feed.children.length > 6) feed.removeChild(feed.lastChild);
  }
  function pushMessage(role, text) {
    var convo = document.getElementById('conversation'); if (!convo) return;
    var div = document.createElement('div'); div.className = 'msg ' + role; div.textContent = text;
    convo.appendChild(div); convo.scrollTop = convo.scrollHeight;
  }
  function showConfirmation(payload) {
    var overlay = document.getElementById('confirm-overlay');
    document.getElementById('confirm-summary').textContent = payload.summary;
    overlay.classList.remove('hidden'); setState('waiting');
    var ab = document.getElementById('confirm-authorize'), cb = document.getElementById('confirm-cancel');
    var cleanup = function () { overlay.classList.add('hidden'); ab.onclick = null; cb.onclick = null; };
    ab.onclick = function () { window.jarvis.confirmation.respond(payload.id, true); cleanup(); };
    cb.onclick = function () { window.jarvis.confirmation.respond(payload.id, false); cleanup(); };
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
    pushMessage('user', text); setState('thinking');
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
    } catch (err) { console.warn(err); }
    setState('idle');
    if (listeningMode === 'continuous' && typeof JarvisVoice !== 'undefined') {
      setTimeout(function () {
        JarvisVoice.configure({ listeningMode: 'continuous', wakeWordEnabled: false });
        JarvisVoice.startContinuousListening();
        setState('listening');
        pushActivity('Listening…');
      }, 120);
    }
  }

  document.getElementById('btn-send').addEventListener('click', sendTextInput);
  document.getElementById('text-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') sendTextInput(); });
  function sendTextInput() {
    var input = document.getElementById('text-input'); var text = input.value.trim();
    if (!text) return; input.value = ''; handleUserUtterance(text);
  }
  document.getElementById('quicklaunch').addEventListener('click', function (e) {
    var btn = e.target.closest('.ql-btn'); if (!btn) return;
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

  var micBtn = document.getElementById('btn-mic'), pttHeld = false;
  if (micBtn) {
    micBtn.addEventListener('mousedown', async function () {
      pttHeld = true;
      if (typeof JarvisVoice !== 'undefined') {
        JarvisVoice.stopContinuousListening();
        await JarvisVoice.startPushToTalkRecording();
      }
      setState('listening'); micBtn.classList.add('listening');
    });
    window.addEventListener('mouseup', async function () {
      if (!pttHeld) return; pttHeld = false; micBtn.classList.remove('listening'); setState('thinking');
      if (typeof JarvisVoice !== 'undefined') await JarvisVoice.stopPushToTalkRecording();
      if (listeningMode === 'continuous' && typeof JarvisVoice !== 'undefined') JarvisVoice.startContinuousListening();
    });
  }
  if (typeof JarvisVoice !== 'undefined') {
    JarvisVoice.on('micLevel', function (level) { micLevel = level; });
    JarvisVoice.on('ttsLevel', function (level) { ttsLevel = level; });
    JarvisVoice.on('wake', function () { setState('listening'); pushActivity('VOICE DETECTED'); });
    JarvisVoice.on('interim', function () { if (appState !== 'thinking' && appState !== 'speaking') setState('hearing'); });
    JarvisVoice.on('transcript', function (text) { pushActivity('HEARD: "' + text + '"'); handleUserUtterance(text); });
    JarvisVoice.on('micError', function (payload) {
      pushActivity((payload && payload.message) || 'Mic error', 'error'); setState('error');
      setTimeout(function () { setState('idle'); }, 2500);
    });
    JarvisVoice.on('fallbackPushToTalk', function (payload) {
      pushActivity((payload && payload.message) || 'Use mic button or type', 'warn');
    });
  }
  function safeOn(channel, cb) {
    try { if (window.jarvis && window.jarvis.events) window.jarvis.events.on(channel, cb); } catch (e) {}
  }
  safeOn('state:change', function (p) { setState(p.state); });
  safeOn('activity', function (p) { pushActivity(p.text, p.level); });
  safeOn('confirmation:request', showConfirmation);
  safeOn('error', function (p) { pushActivity(p.message, 'error'); });
  safeOn('assistant:final', function (p) { if (p && p.proactive) { pushMessage('jarvis', p.text); speakReply(p.text); } });
  safeOn('hologram:show', function (p) {
    if (typeof JarvisHologram !== 'undefined') JarvisHologram.show(p || {});
    pushActivity('HOLOGRAM: ' + ((p && p.label) || (p && p.object) || 'model'));
  });
  safeOn('hologram:hide', function () { if (typeof JarvisHologram !== 'undefined') JarvisHologram.hide(); });
  safeOn('hologram:view', function (p) { if (typeof JarvisHologram !== 'undefined') JarvisHologram.setView(p && p.view); });
  safeOn('update:available', function (p) {
    pushActivity('UPDATE AVAILABLE: ' + ((p && p.remoteMessage) || 'new build'), 'warn');
    if (window.confirm('A new JARVIS update is available. Install and restart?')) {
      window.jarvis.update.apply().then(function (res) {
        pushActivity(res.ok ? 'Restarting…' : ('Failed: ' + res.error), res.ok ? 'info' : 'error');
      });
    }
  });

  async function bootstrap() {
    try {
      if (!window.jarvis) {
        document.body.innerHTML = '<div style="color:#ff9a1f;padding:2rem">JARVIS preload failed. Restart.</div>';
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
          if (typeof JarvisVoice !== 'undefined') {
            JarvisVoice.configure({ wakeWordEnabled: !!updated.wakeWordEnabled, wakeWord: updated.wakeWord, listeningMode: listeningMode });
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
        var micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        micStream.getTracks().forEach(function (tr) { tr.stop(); });
        pushActivity('Microphone granted');
      } catch (e) { pushActivity('Microphone denied', 'error'); }
      if (typeof JarvisVoice !== 'undefined') {
        try { await JarvisVoice.initMicLevelMeter(); } catch (e) {}
        JarvisVoice.startContinuousListening();
      }
      setState('listening');
      pushMessage('system', 'All systems are online.');
      pushActivity('Listening — speak naturally');
      var live = document.getElementById('live-chip'); if (live) live.classList.add('live');
      await speakReply('Good evening, sir. All systems are online. I am listening.');
    } catch (err) {
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
