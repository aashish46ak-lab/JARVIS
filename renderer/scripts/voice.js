'use strict';

const JarvisVoice = (function () {
  const listeners = {};
  function on(evt, cb) {
    if (!listeners[evt]) listeners[evt] = [];
    listeners[evt].push(cb);
  }
  function emit(evt, payload) {
    (listeners[evt] || []).forEach(function (cb) {
      try { cb(payload); } catch (e) { console.warn(e); }
    });
  }

  let recognition = null;
  let continuousWanted = false;
  let wakeWordEnabled = false;
  let wakeWord = 'jarvis';
  let listeningMode = 'continuous';
  let keepAliveTimer = null;
  let restarting = false;
  let speakingAudio = null;
  let micStream = null;
  let analyser = null;
  let audioCtx = null;
  let levelRaf = null;

  function configure(opts) {
    if (!opts) return;
    if (opts.wakeWordEnabled != null) wakeWordEnabled = !!opts.wakeWordEnabled;
    if (opts.wakeWord) wakeWord = String(opts.wakeWord).toLowerCase();
    if (opts.listeningMode) listeningMode = opts.listeningMode;
  }

  async function initMicLevelMeter() {
    try {
      if (micStream) return;
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const src = audioCtx.createMediaStreamSource(micStream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      function tick() {
        levelRaf = requestAnimationFrame(tick);
        if (!analyser) return;
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (var i = 0; i < data.length; i++) sum += data[i];
        emit('micLevel', Math.min(1, (sum / data.length) / 80));
      }
      tick();
    } catch (e) {
      emit('micError', { message: 'Mic level meter failed: ' + (e.message || e) });
    }
  }

  function scheduleKeepAlive() {
    if (keepAliveTimer) clearTimeout(keepAliveTimer);
    keepAliveTimer = setTimeout(function () {
      if (!continuousWanted || listeningMode !== 'continuous') return;
      if (restarting) return;
      try { if (recognition) recognition.stop(); } catch (_) {}
      setTimeout(function () {
        if (continuousWanted) startContinuousListening(true);
      }, 200);
    }, 25000);
  }

  function bindRecognitionHandlers(rec) {
    rec.onstart = function () {
      restarting = false;
      scheduleKeepAlive();
    };
    rec.onresult = function (event) {
      scheduleKeepAlive();
      var interim = '';
      var finalText = '';
      for (var i = event.resultIndex; i < event.results.length; i++) {
        var r = event.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (interim) emit('interim', interim);
      if (finalText) {
        var text = finalText.trim();
        if (!text) return;
        if (wakeWordEnabled) {
          var lower = text.toLowerCase();
          if (lower.indexOf(wakeWord) === -1) return;
          text = text.replace(new RegExp(wakeWord, 'ig'), '').trim();
          if (!text) { emit('wake'); return; }
          emit('wake');
        }
        emit('transcript', text);
      }
    };
    rec.onerror = function (e) {
      var err = (e && e.error) || 'error';
      if (err === 'no-speech' || err === 'aborted') { scheduleKeepAlive(); return; }
      if (err === 'not-allowed') {
        emit('micError', { message: 'Microphone blocked — allow mic in Windows & app permissions' });
        continuousWanted = false;
        return;
      }
      scheduleKeepAlive();
    };
    rec.onend = function () {
      if (!continuousWanted || listeningMode !== 'continuous') return;
      if (restarting) return;
      restarting = true;
      setTimeout(function () {
        restarting = false;
        if (continuousWanted) {
          try {
            recognition.start();
            scheduleKeepAlive();
          } catch (_) {
            setTimeout(function () {
              if (continuousWanted) startContinuousListening(true);
            }, 400);
          }
        }
      }, 180);
    };
  }

  function startContinuousListening(isRestart) {
    continuousWanted = true;
    listeningMode = 'continuous';
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      emit('fallbackPushToTalk', { message: 'Speech recognition not supported — use text or hold mic' });
      return;
    }
    try {
      if (!recognition) {
        recognition = new SR();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 1;
        bindRecognitionHandlers(recognition);
      }
      try { recognition.start(); } catch (e) {}
      scheduleKeepAlive();
      if (!isRestart) emit('wake');
    } catch (err) {
      emit('micError', { message: (err && err.message) || String(err) });
    }
  }

  function stopContinuousListening() {
    continuousWanted = false;
    if (keepAliveTimer) { clearTimeout(keepAliveTimer); keepAliveTimer = null; }
    try { if (recognition) recognition.stop(); } catch (_) {}
  }

  let pttRecorder = null;
  let pttChunks = [];
  let pttStream = null;

  async function startPushToTalkRecording() {
    pttChunks = [];
    pttStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    pttRecorder = new MediaRecorder(pttStream);
    pttRecorder.ondataavailable = function (e) {
      if (e.data && e.data.size) pttChunks.push(e.data);
    };
    pttRecorder.start(100);
  }

  async function stopPushToTalkRecording() {
    return new Promise(function (resolve) {
      if (!pttRecorder) { resolve(); return; }
      pttRecorder.onstop = async function () {
        try {
          if (pttStream) pttStream.getTracks().forEach(function (t) { t.stop(); });
          startContinuousListening();
        } catch (_) {}
        resolve();
      };
      try { pttRecorder.stop(); } catch (_) { resolve(); }
    });
  }

  function speakFree(text) {
    return new Promise(function (resolve) {
      try {
        if (!window.speechSynthesis) { resolve(); return; }
        window.speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(String(text).slice(0, 800));
        u.rate = 1.05;
        u.pitch = 0.95;
        var voices = window.speechSynthesis.getVoices();
        var en = voices.find(function (v) { return /en(-|_)?(GB|UK|US)/i.test(v.lang) && /male|daniel|google uk/i.test(v.name); })
          || voices.find(function (v) { return /^en/i.test(v.lang); });
        if (en) u.voice = en;
        var pulse = setInterval(function () { emit('ttsLevel', 0.4 + Math.random() * 0.4); }, 80);
        u.onend = function () { clearInterval(pulse); emit('ttsLevel', 0); resolve(); };
        u.onerror = function () { clearInterval(pulse); resolve(); };
        window.speechSynthesis.speak(u);
      } catch (_) { resolve(); }
    });
  }

  async function speak(text) {
    text = String(text || '').trim();
    if (!text) return;
    stopSpeaking();
    var settled = false;
    var fishDone = false;

    var freeTimer = setTimeout(async function () {
      if (settled || fishDone) return;
      await speakFree(text);
      settled = true;
    }, 900);

    try {
      var res = await window.jarvis.tts.synthesize(text);
      fishDone = true;
      clearTimeout(freeTimer);
      if (settled) return;
      if (res && res.ok && res.audio) {
        settled = true;
        try { window.speechSynthesis.cancel(); } catch (_) {}
        var bin = atob(res.audio);
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        var blob = new Blob([bytes], { type: res.mimeType || 'audio/mpeg' });
        var url = URL.createObjectURL(blob);
        speakingAudio = new Audio(url);
        await new Promise(function (resolve) {
          var pulse = setInterval(function () { emit('ttsLevel', 0.45 + Math.random() * 0.4); }, 80);
          speakingAudio.onended = function () {
            clearInterval(pulse); URL.revokeObjectURL(url); speakingAudio = null; emit('ttsLevel', 0); resolve();
          };
          speakingAudio.onerror = function () { clearInterval(pulse); resolve(); };
          speakingAudio.play().catch(function () { resolve(); });
        });
        return;
      }
    } catch (_) {
      fishDone = true;
      clearTimeout(freeTimer);
    }
    if (!settled) {
      settled = true;
      await speakFree(text);
    }
  }

  function stopSpeaking() {
    try { window.speechSynthesis.cancel(); } catch (_) {}
    if (speakingAudio) {
      try { speakingAudio.pause(); } catch (_) {}
      speakingAudio = null;
    }
    emit('ttsLevel', 0);
  }

  return {
    on: on,
    configure: configure,
    initMicLevelMeter: initMicLevelMeter,
    startContinuousListening: startContinuousListening,
    stopContinuousListening: stopContinuousListening,
    startPushToTalkRecording: startPushToTalkRecording,
    stopPushToTalkRecording: stopPushToTalkRecording,
    speak: speak,
    stopSpeaking: stopSpeaking,
  };
})();
