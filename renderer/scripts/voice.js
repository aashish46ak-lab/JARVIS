'use strict';

const JarvisVoice = (function () {
  const listeners = {};
  let recognition = null;
  let modeContinuous = true;
  let pausedForSpeech = false;
  let wakeWord = 'jarvis';
  let wakeWordEnabled = false;
  let mediaRecorder = null;
  let audioChunks = [];
  let micStream = null;
  let analyser = null;
  let dataArray = null;
  let levelRaf = null;
  let speakingAudio = null;
  let preferredVoice = null;
  let keepAliveTimer = null;
  let lastFinalAt = 0;

  function on(event, cb) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(cb);
  }
  function emit(event, payload) {
    (listeners[event] || []).forEach(function (cb) {
      try { cb(payload); } catch (_) {}
    });
  }

  function configure(opts) {
    opts = opts || {};
    if (opts.wakeWordEnabled !== undefined) wakeWordEnabled = !!opts.wakeWordEnabled;
    if (opts.wakeWord) wakeWord = String(opts.wakeWord || 'jarvis').toLowerCase();
    if (opts.listeningMode) modeContinuous = opts.listeningMode === 'continuous';
  }

  function pickVoice() {
    if (!window.speechSynthesis) return null;
    var voices = speechSynthesis.getVoices() || [];
    var preferred = [/google uk english male/i, /microsoft george/i, /daniel/i, /en-gb/i, /british/i];
    for (var i = 0; i < preferred.length; i++) {
      var v = voices.find(function (x) { return preferred[i].test(x.name) || preferred[i].test(x.lang); });
      if (v) return v;
    }
    return voices.find(function (v) { return v.lang && v.lang.indexOf('en') === 0; }) || voices[0] || null;
  }
  if (window.speechSynthesis) {
    speechSynthesis.onvoiceschanged = function () { preferredVoice = pickVoice(); };
    preferredVoice = pickVoice();
  }

  async function initMicLevelMeter() {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var source = ctx.createMediaStreamSource(micStream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      dataArray = new Uint8Array(analyser.frequencyBinCount);
      var tick = function () {
        levelRaf = requestAnimationFrame(tick);
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);
        var sum = 0;
        for (var i = 0; i < dataArray.length; i++) sum += dataArray[i];
        emit('micLevel', Math.min(1, (sum / dataArray.length) / 80));
      };
      tick();
    } catch (err) {
      emit('micError', { message: 'Allow microphone permission for JARVIS, then restart.' });
    }
  }

  function createRecognition() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    var r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-US';
    r.maxAlternatives = 1;

    r.onresult = function (event) {
      var interim = '';
      var finalText = '';
      for (var i = event.resultIndex; i < event.results.length; i++) {
        var t = event.results[i][0].transcript;
        var conf = event.results[i][0].confidence;
        if (event.results[i].isFinal) {
          if (conf === undefined || conf === 0 || conf > 0.25) finalText += t;
        } else interim += t;
      }
      if (interim) emit('interim', interim);
      if (finalText) {
        var text = finalText.trim();
        if (!text) return;
        var now = Date.now();
        if (now - lastFinalAt < 800) return;
        lastFinalAt = now;
        if (wakeWordEnabled) {
          var lower = text.toLowerCase();
          if (lower.indexOf(wakeWord) !== -1) {
            emit('wake');
            var after = text.slice(lower.indexOf(wakeWord) + wakeWord.length).replace(/^[,.\s]+/, '').trim();
            if (after) emit('transcript', after);
          }
        } else {
          emit('transcript', text);
        }
      }
    };

    r.onerror = function (e) {
      var err = (e && e.error) || '';
      if (err === 'no-speech' || err === 'aborted' || err === 'audio-capture') return;
      if (err === 'not-allowed') {
        emit('micError', { message: 'Microphone blocked. Enable it in system settings.' });
        return;
      }
      scheduleRestart(600);
    };

    r.onend = function () {
      if (modeContinuous && !pausedForSpeech) scheduleRestart(200);
    };

    return r;
  }

  function scheduleRestart(delay) {
    if (keepAliveTimer) clearTimeout(keepAliveTimer);
    keepAliveTimer = setTimeout(function () {
      if (!modeContinuous || pausedForSpeech) return;
      hardStart();
    }, delay || 300);
  }

  function hardStart() {
    if (!modeContinuous || pausedForSpeech) return;
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      emit('fallbackPushToTalk', { message: 'Speech recognition unavailable. Type or use mic button.' });
      return;
    }
    try {
      if (recognition) {
        try { recognition.onend = null; recognition.onerror = null; recognition.stop(); } catch (_) {}
      }
      recognition = createRecognition();
      if (!recognition) return;
      recognition.start();
      emit('listeningStarted', true);
    } catch (err) {
      scheduleRestart(800);
    }
  }

  function startContinuousListening() {
    modeContinuous = true;
    pausedForSpeech = false;
    hardStart();
  }

  function stopContinuousListening() {
    pausedForSpeech = true;
    if (keepAliveTimer) { clearTimeout(keepAliveTimer); keepAliveTimer = null; }
    if (recognition) {
      try { recognition.onend = null; recognition.stop(); } catch (_) {}
    }
  }

  async function startPushToTalkRecording() {
    try {
      if (!micStream) micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      mediaRecorder = new MediaRecorder(micStream);
      mediaRecorder.ondataavailable = function (e) { if (e.data && e.data.size) audioChunks.push(e.data); };
      mediaRecorder.start(100);
    } catch (err) {
      emit('micError', { message: 'Recording failed: ' + err.message });
    }
  }

  async function stopPushToTalkRecording() {
    return new Promise(function (resolve) {
      if (!mediaRecorder || mediaRecorder.state === 'inactive') { resolve(); return; }
      mediaRecorder.onstop = async function () {
        emit('transcribing', true);
        var blob = new Blob(audioChunks, { type: 'audio/webm' });
        var reader = new FileReader();
        reader.onloadend = async function () {
          var base64 = String(reader.result).split(',')[1];
          try {
            var res = await window.jarvis.voice.transcribeFallback(base64, 'audio/webm');
            if (res.ok && res.text) emit('transcript', res.text.trim());
            else emit('micError', { message: (res && res.error) || 'Transcription failed' });
          } catch (err) {
            emit('micError', { message: err.message });
          }
          emit('transcribing', false);
          resolve();
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorder.stop();
    });
  }

  function speakFree(text) {
    return new Promise(function (resolve) {
      if (!window.speechSynthesis) { resolve(); return; }
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.rate = 1.02; u.pitch = 0.95;
      preferredVoice = preferredVoice || pickVoice();
      if (preferredVoice) u.voice = preferredVoice;
      var pulse = setInterval(function () { emit('ttsLevel', 0.3 + Math.random() * 0.4); }, 100);
      u.onend = function () { clearInterval(pulse); emit('ttsLevel', 0); resolve(); };
      u.onerror = function () { clearInterval(pulse); emit('ttsLevel', 0); resolve(); };
      speechSynthesis.speak(u);
    });
  }

  async function speak(text) {
    if (!text) return;
    stopContinuousListening();
    try {
      var res = await window.jarvis.tts.synthesize(text);
      if (res && res.ok && res.audio) {
        await new Promise(async function (resolve) {
          try {
            var blob = await (await fetch('data:' + res.mimeType + ';base64,' + res.audio)).blob();
            var url = URL.createObjectURL(blob);
            speakingAudio = new Audio(url);
            var pulse = setInterval(function () { emit('ttsLevel', 0.35 + Math.random() * 0.4); }, 100);
            speakingAudio.onended = function () {
              clearInterval(pulse); URL.revokeObjectURL(url); speakingAudio = null; emit('ttsLevel', 0); resolve();
            };
            speakingAudio.onerror = function () { clearInterval(pulse); resolve(); };
            await speakingAudio.play();
          } catch (_) {
            await speakFree(text); resolve();
          }
        });
        return;
      }
    } catch (_) {}
    await speakFree(text);
  }

  function stopSpeaking() {
    if (speakingAudio) { speakingAudio.pause(); speakingAudio = null; }
    if (window.speechSynthesis) speechSynthesis.cancel();
    emit('ttsLevel', 0);
  }

  return {
    on: on, configure: configure, initMicLevelMeter: initMicLevelMeter,
    startContinuousListening: startContinuousListening,
    stopContinuousListening: stopContinuousListening,
    startPushToTalkRecording: startPushToTalkRecording,
    stopPushToTalkRecording: stopPushToTalkRecording,
    speak: speak, stopSpeaking: stopSpeaking,
  };
})();
