'use strict';

const JarvisSettings = (function () {
  let config = {};
  let onUpdate = null;

  async function openDrawer() {
    config = await window.jarvis.config.getAll();
    var enroll = { face: false, voice: false };
    try { enroll = await window.jarvis.enroll.status(); } catch (_) {}
    var body = document.getElementById('settings-body');
    body.innerHTML =
      '<div class="s-section">AI ENGINE</div>' +
      '<label>Provider</label><select id="s-provider">' +
      '<option value="groq">Groq</option><option value="gemini">Gemini</option></select>' +
      '<label>Groq API Key</label><input id="s-groq" type="password" value="' + (config.groqApiKey || '') + '" />' +
      '<label>Groq Model</label><select id="s-model">' +
      '<option value="llama-3.1-8b-instant">llama-3.1-8b-instant</option>' +
      '<option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile</option></select>' +
      '<div class="s-section">VOICE</div>' +
      '<label>Fish API Key</label><input id="s-fish" type="password" value="' + (config.fishApiKey || '') + '" />' +
      '<label>Fish Voice ID</label><input id="s-voiceid" type="text" value="' + (config.fishVoiceId || '14129c3e320149449d6bada6862f7338') + '" />' +
      '<label>Speed</label><input id="s-speed" type="range" min="0.7" max="1.3" step="0.05" value="' + (config.speakingSpeed || 1) + '" />' +
      '<div class="s-section">LISTENING</div>' +
      '<label>Mode</label><select id="s-listen"><option value="continuous">Always listening</option><option value="push-to-talk">Push-to-talk</option></select>' +
      '<label>Wake word</label><select id="s-wake"><option value="false">No</option><option value="true">Yes</option></select>' +
      '<div class="s-section">IDENTITY</div>' +
      '<p class="s-hint">Face: ' + (enroll.face ? 'saved' : 'not enrolled') + ' · Voice: ' + (enroll.voice ? 'saved' : 'not enrolled') + '</p>' +
      '<button id="s-reenroll">Re-enroll face & voice</button>' +
      '<div class="s-section">DISPLAY</div>' +
      '<label>Animation</label><select id="s-anim"><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select>' +
      '<button id="s-save" class="s-primary">Save</button><button id="s-test-ai">Test AI</button><button id="s-test-voice">Test voice</button>';
    document.getElementById('settings-drawer').classList.remove('hidden');
    document.getElementById('s-provider').value = config.aiProvider || 'groq';
    if (config.groqModel) document.getElementById('s-model').value = config.groqModel;
    if (config.listeningMode) document.getElementById('s-listen').value = config.listeningMode;
    document.getElementById('s-wake').value = config.wakeWordEnabled ? 'true' : 'false';
    if (config.animationIntensity) document.getElementById('s-anim').value = config.animationIntensity;

    document.getElementById('s-save').onclick = async function () {
      var partial = {
        aiProvider: document.getElementById('s-provider').value,
        groqApiKey: document.getElementById('s-groq').value || undefined,
        groqModel: document.getElementById('s-model').value,
        fishApiKey: document.getElementById('s-fish').value || undefined,
        fishVoiceId: document.getElementById('s-voiceid').value,
        speakingSpeed: parseFloat(document.getElementById('s-speed').value) || 1,
        listeningMode: document.getElementById('s-listen').value,
        wakeWordEnabled: document.getElementById('s-wake').value === 'true',
        animationIntensity: document.getElementById('s-anim').value,
        voiceEnabled: true, firstRunComplete: true,
      };
      if (partial.groqApiKey && partial.groqApiKey.indexOf('••••') !== -1) delete partial.groqApiKey;
      if (partial.fishApiKey && partial.fishApiKey.indexOf('••••') !== -1) delete partial.fishApiKey;
      var updated = await window.jarvis.config.update(partial);
      if (onUpdate) onUpdate(updated);
      alert('Saved.');
    };
    document.getElementById('s-test-ai').onclick = async function () {
      var res = await window.jarvis.config.testAI();
      alert(res.ok ? 'AI OK' : 'Failed: ' + res.error);
    };
    document.getElementById('s-test-voice').onclick = async function () {
      var res = await window.jarvis.config.testVoice();
      alert(res.ok ? 'Voice OK' : 'Failed: ' + res.error);
    };
    document.getElementById('s-reenroll').onclick = function () {
      document.getElementById('settings-drawer').classList.add('hidden');
      document.getElementById('hud-screen').classList.add('hidden');
      document.getElementById('setup-screen').classList.remove('hidden');
      initSetupWizard(function () {
        document.getElementById('setup-screen').classList.add('hidden');
        document.getElementById('hud-screen').classList.remove('hidden');
        if (window.__jarvisStartHud) window.__jarvisStartHud();
      }, true);
    };
  }

  function wireDrawer(cb) {
    onUpdate = cb;
    document.getElementById('btn-close-settings').onclick = function () {
      document.getElementById('settings-drawer').classList.add('hidden');
    };
  }

  function initSetupWizard(onDone, reenrollOnly) {
    var steps = document.getElementById('setup-steps');
    var finish = document.getElementById('setup-finish');
    finish.disabled = true;
    var step = reenrollOnly ? 1 : 0;
    var stream = null, faceDataUrl = null, voiceBase64 = null;

    function stopStream() {
      if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    }

    async function render() {
      stopStream();
      if (step === 0) {
        steps.innerHTML = '<p class="setup-step-title">Step 1 · API Keys</p>' +
          '<label>Groq API Key *</label><input id="su-groq" type="password" class="setup-input" placeholder="gsk_..." />' +
          '<label>Fish Audio Key (optional)</label><input id="su-fish" type="password" class="setup-input" />';
        finish.disabled = false; finish.textContent = 'Next: Camera';
      } else if (step === 1) {
        steps.innerHTML = '<p class="setup-step-title">Step 2 · Face</p>' +
          '<p class="s-hint">Allow camera. Look at the lens, then capture.</p>' +
          '<video id="su-video" autoplay playsinline muted class="enroll-video"></video>' +
          '<canvas id="su-canvas" style="display:none"></canvas>' +
          '<div id="su-face-preview" class="enroll-preview hidden"></div>' +
          '<button type="button" id="su-capture" class="s-primary">Capture face</button>' +
          '<p id="su-face-status" class="s-hint"></p>';
        finish.disabled = true; finish.textContent = 'Next: Voice';
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          document.getElementById('su-video').srcObject = stream;
          document.getElementById('su-capture').onclick = function () {
            var vid = document.getElementById('su-video');
            var c = document.getElementById('su-canvas');
            c.width = vid.videoWidth || 640; c.height = vid.videoHeight || 480;
            c.getContext('2d').drawImage(vid, 0, 0, c.width, c.height);
            faceDataUrl = c.toDataURL('image/png');
            var prev = document.getElementById('su-face-preview');
            prev.innerHTML = '<img src="' + faceDataUrl + '" alt="face" />';
            prev.classList.remove('hidden');
            document.getElementById('su-face-status').textContent = 'Captured.';
            finish.disabled = false;
          };
        } catch (err) {
          document.getElementById('su-face-status').textContent = 'Camera blocked — you can skip.';
          finish.disabled = false; finish.textContent = 'Skip face';
        }
      } else if (step === 2) {
        steps.innerHTML = '<p class="setup-step-title">Step 3 · Voice</p>' +
          '<p class="s-hint">Hold and say: “Jarvis, this is my voice.”</p>' +
          '<button type="button" id="su-rec" class="s-primary">Hold to record</button>' +
          '<p id="su-voice-status" class="s-hint">Not recorded yet</p>';
        finish.disabled = true; finish.textContent = 'Finish & Launch';
        var rec = null, chunks = [], micStream = null;
        var btn = document.getElementById('su-rec');
        btn.onmousedown = async function () {
          try {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
            chunks = [];
            rec = new MediaRecorder(micStream);
            rec.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
            rec.start(100);
            btn.textContent = 'Recording… release when done';
          } catch (err) {
            document.getElementById('su-voice-status').textContent = 'Mic error: ' + err.message;
          }
        };
        window.addEventListener('mouseup', function () {
          if (!rec || rec.state === 'inactive') return;
          rec.onstop = function () {
            var blob = new Blob(chunks, { type: 'audio/webm' });
            var reader = new FileReader();
            reader.onloadend = function () {
              voiceBase64 = String(reader.result).split(',')[1];
              document.getElementById('su-voice-status').textContent = 'Voice saved.';
              finish.disabled = false;
            };
            reader.readAsDataURL(blob);
            if (micStream) micStream.getTracks().forEach(function (t) { t.stop(); });
            btn.textContent = 'Hold to record';
          };
          rec.stop();
        });
        setTimeout(function () { if (finish.disabled) { finish.disabled = false; finish.textContent = 'Skip & finish'; } }, 400);
      }
    }

    finish.onclick = async function () {
      if (step === 0) {
        var groq = document.getElementById('su-groq').value.trim();
        var fish = document.getElementById('su-fish').value.trim();
        if (!groq) { alert('Groq key required'); return; }
        await window.jarvis.config.update({
          groqApiKey: groq, fishApiKey: fish || undefined,
          fishVoiceId: '14129c3e320149449d6bada6862f7338', groqModel: 'llama-3.1-8b-instant',
          aiProvider: 'groq', voiceEnabled: true, listeningMode: 'continuous', wakeWordEnabled: false,
        });
        step = 1; await render(); return;
      }
      if (step === 1) {
        if (faceDataUrl) await window.jarvis.enroll.saveFace(faceDataUrl);
        step = 2; await render(); return;
      }
      if (step === 2) {
        if (voiceBase64) await window.jarvis.enroll.saveVoice(voiceBase64, 'audio/webm');
        stopStream();
        await window.jarvis.config.update({ firstRunComplete: true, enrollmentComplete: true, listeningMode: 'continuous', wakeWordEnabled: false });
        onDone();
      }
    };
    render();
  }

  return { openDrawer: openDrawer, wireDrawer: wireDrawer, initSetupWizard: initSetupWizard };
})();
