'use strict';

/**
 * JARVIS voice layer — STT + TTS orchestration.
 * Critical fix: strong anti-echo so JARVIS never hears its own speech
 * and does not repeat the same command 3–4 times.
 */
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
  let lastTranscriptAt = 0;
  let lastTranscriptText = '';
  let isSpeaking = false;
  let muteUntil = 0;
  const POST_SPEAK_MUTE_MS = 1600;
  const DUPLICATE_WINDOW_MS = 4500;

  function configure(opts) {
    if (!opts) return;
    if (opts.wakeWordEnabled != null) wakeWordEnabled = !!opts.wakeWordEnabled;
    if (opts.wakeWord) wakeWord = String(opts.wakeWord).toLowerCase();
    if (opts.listeningMode) listeningMode = opts.listeningMode;
  }

  function isMuted() {
    return isSpeaking || Date.now() < muteUntil;
  }

  async function initMicLevelMeter() {
    try {
      if (micStream) return;
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var src = audioCtx.createMediaStreamSource(micStream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      var data = new Uint8Array(analyser.frequencyBinCount);
      (function tick() {
        requestAnimationFrame(tick);
        if (!analyser) return;
        analyser.getByteFrequencyData(data);
        var sum = 0;
        for (var i = 0; i < data.length; i++) sum += data[i];
        emit('micLevel', Math.min(1, sum / data.length / 80));
      })();
    } catch (e) {
      emit('micError', { message: 'Allow microphone for JARVIS' });
    }
  }

  function scheduleKeepAlive() {
    if (keepAliveTimer) clearTimeout(keepAliveTimer);
    keepAliveTimer = setTimeout(function () {
      if (!continuousWanted || isMuted()) return;
      try { if (recognition) recognition.stop(); } catch (_) {}
      setTimeout(function () {
        if (continuousWanted && !isMuted()) startContinuousListening(true);
      }, 300);
    }, 20000);
  }

  function normalizeForDedupe(t) {
    return String(t || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
  }

  function bindHandlers(rec) {
    rec.onstart = function () { restarting = false; scheduleKeepAlive(); };
    rec.onresult = function (event) {
      if (isMuted()) return;
      scheduleKeepAlive();
      var finalText = '';
      var interim = '';
      for (var i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalText += event.results[i][0].transcript;
        else interim += event.results[i][0].transcript;
      }
      if (interim && !isMuted()) emit('interim', interim);
      if (!finalText) return;
      var text = finalText.trim();
      if (!text) return;
      var now = Date.now();
      if (now - lastTranscriptAt < 1000) return;
      var norm = normalizeForDedupe(text);
      if (norm && norm === lastTranscriptText && now - lastTranscriptAt < DUPLICATE_WINDOW_MS) return;
      lastTranscriptAt = now;
      lastTranscriptText = norm;
      if (wakeWordEnabled) {
        var lower = text.toLowerCase();
        if (lower.indexOf(wakeWord) === -1) return;
        text = text.replace(new RegExp(wakeWord, 'ig'), '').trim();
        emit('wake');
        if (!text) return;
      }
      emit('transcript', text);
    };
    rec.onerror = function (e) {
      var err = (e && e.error) || '';
      if (err === 'not-allowed') {
        continuousWanted = false;
        emit('micError', { message: 'Microphone blocked' });
        return;
      }
      if (err !== 'no-speech' && err !== 'aborted') scheduleKeepAlive();
    };
    rec.onend = function () {
      if (!continuousWanted || isMuted()) return;
      if (restarting) return;
      restarting = true;
      setTimeout(function () {
        restarting = false;
        if (!continuousWanted || isMuted()) return;
        try {
          recognition.start();
          scheduleKeepAlive();
        } catch (_) {
          setTimeout(function () {
            if (continuousWanted && !isMuted()) startContinuousListening(true);
          }, 500);
        }
      }, 250);
    };
  }

  function startContinuousListening() {
    continuousWanted = true;
    listeningMode = 'continuous';
    if (isMuted()) {
      setTimeout(function () {
        if (continuousWanted && !isMuted()) startContinuousListening(true);
      }, Math.max(300, muteUntil - Date.now() + 50));
      return;
    }
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      emit('micError', { message: 'Speech recognition not supported in this browser engine' });
      return;
    }
    try {
      if (recognition) {
        try { recognition.onend = null; recognition.stop(); } catch (_) {}
      }
      recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || 'en-US';
      bindHandlers(recognition);
      recognition.start();
      scheduleKeepAlive();
    } catch (err) {
      emit('micError', { message: (err && err.message) || String(err) });
    }
  }

  function stopContinuousListening() {
    continuousWanted = false;
    if (keepAliveTimer) { clearTimeout(keepAliveTimer); keepAliveTimer = null; }
    try { if (recognition) recognition.stop(); } catch (_) {}
  }

  async function startPushToTalkRecording() {}
  async function stopPushToTalkRecording() { startContinuousListening(); }

  async function speak(text) {
    text = String(text || '').trim();
    if (!text) return;
    isSpeaking = true;
    muteUntil = Date.now() + 60 * 60 * 1000;
    stopSpeaking(true);
    stopContinuousListening();
    emit('ttsLevel', 0.3);
    try {
      var res = await window.jarvis.tts.synthesize(text);
      if (res && res.ok && res.audio) {
        var bin = atob(res.audio);
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        var blob = new Blob([bytes], { type: res.mimeType || 'audio/mpeg' });
        var url = URL.createObjectURL(blob);
        speakingAudio = new Audio(url);
        await new Promise(function (resolve) {
          var pulse = setInterval(function () { emit('ttsLevel', 0.45 + Math.random() * 0.4); }, 80);
          speakingAudio.onended = function () {
            clearInterval(pulse);
            URL.revokeObjectURL(url);
            speakingAudio = null;
            emit('ttsLevel', 0);
            resolve();
          };
          speakingAudio.onerror = function () { clearInterval(pulse); resolve(); };
          speakingAudio.play().catch(function () { resolve(); });
        });
      } else {
        emit('micError', { message: (res && res.error) || 'Fish Audio failed — set API key in Settings' });
      }
    } catch (e) {
      emit('micError', { message: 'Voice error — set Fish API key in Settings' });
    }
    isSpeaking = false;
    muteUntil = Date.now() + POST_SPEAK_MUTE_MS;
    continuousWanted = true;
    lastTranscriptText = normalizeForDedupe(text);
    lastTranscriptAt = Date.now();
    setTimeout(function () {
      if (continuousWanted && !isSpeaking) startContinuousListening();
    }, POST_SPEAK_MUTE_MS + 100);
  }

  function stopSpeaking() {
    if (speakingAudio) {
      try { speakingAudio.pause(); } catch (_) {}
      speakingAudio = null;
    }
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (_) {}
    emit('ttsLevel', 0);
    if (isSpeaking) {
      isSpeaking = false;
      muteUntil = Date.now() + 800;
    }
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
