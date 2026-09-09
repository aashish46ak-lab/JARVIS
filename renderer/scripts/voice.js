'use strict';

const JarvisVoice = (function () {
  const listeners = {};
  let recognition = null;
  let modeContinuous = true;
  let activelyListening = false;
  let wakeWord = 'jarvis';
  let wakeWordEnabled = false;
  let mediaRecorder = null;
  let audioChunks = [];
  let micStream = null;
  let analyser = null;
  let dataArray = null;
  let levelRaf = null;
  let speakingAudio = null;
  let ttsAnalyser = null;
  let ttsData = null;
  let ttsRaf = null;
  let failedAttempts = 0;
  let preferredVoice = null;
  let restartTimer = null;

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
    var voices = speechSynthesis.getVoices();
    if (!voices.length) return null;
    var preferred = [/google uk english male/i, /microsoft george/i, /microsoft ryan/i, /daniel/i, /british/i, /en-gb/i, /uk english/i];
    for (var i = 0; i < preferred.length; i++) {
      var v = voices.find(function (x) { return preferred[i].test(x.name) || preferred[i].test(x.lang); });
      if (v) return v;
    }
    return voices.find(function (v) { return v.lang && v.lang.indexOf('en') === 0; }) || voices[0];
  }

  function loadVoices() {
    preferredVoice = pickVoice();
    if (window.speechSynthesis) {
      speechSynthesis.onvoiceschanged = function () { preferredVoice = pickVoice(); };
    }
  }
  loadVoices();

  async function initMicLevelMeter() {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
      emit('micError', { message: 'Microphone access denied. Allow mic permission and restart.' });
    }
  }

  function startContinuousListening() {
    if (!modeContinuous) return;
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      emit('fallbackPushToTalk', { message: 'Speech recognition not available.' });
      return;
    }
    try {
      if (recognition) {
        try {
          recognition.onend = null;
          recognition.onerror = null;
          recognition.onresult = null;
          recognition.stop();
        } catch (_) {}
        recognition = null;
      }

      recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onstart = function () {
        activelyListening = true;
        failedAttempts = 0;
      };

      recognition.onresult = function (event) {
        var interim = '';
        var finalText = '';
        for (var i = event.resultIndex; i < event.results.length; i++) {
          var t = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalText += t;
          else interim += t;
        }
        if (interim) emit('interim', interim);
        if (finalText) {
          var text = finalText.trim();
          if (!text) return;
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

      recognition.onerror = function (e) {
        var err = (e && e.error) || '';
        if (err === 'no-speech' || err === 'aborted' || err === 'audio-capture') return;
        if (err === 'not-allowed') {
          emit('micError', { message: 'Microphone permission blocked.' });
          activelyListening = false;
          return;
        }
        failedAttempts += 1;
        if (err === 'network' || failedAttempts >= 5) {
          emit('fallbackPushToTalk', { message: 'Speech recognition trouble. Type or use mic button.' });
        }
      };

      recognition.onend = function () {
        activelyListening = false;
        if (modeContinuous) {
          if (restartTimer) clearTimeout(restartTimer);
          restartTimer = setTimeout(function () {
            if (!modeContinuous) return;
            try {
              if (recognition) recognition.start();
              else startContinuousListening();
            } catch (_) {
              try { startContinuousListening(); } catch (e2) {}
            }
          }, 300);
        }
      };

      recognition.start();
      activelyListening = true;
      failedAttempts = 0;
    } catch (err) {
      activelyListening = false;
      emit('fallbackPushToTalk', { message: 'Could not start listening: ' + (err.message || err) });
    }
  }

  function stopContinuousListening() {
    // Pause only — do NOT clear modeContinuous (that was the bug)
    if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
    if (recognition) {
      try {
        recognition.onend = null;
        recognition.stop();
      } catch (_) {}
    }
    activelyListening = false;
  }

  async function startPushToTalkRecording() {
    try {
      if (!micStream) micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      var mime = (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm')) ? 'audio/webm' : '';
      mediaRecorder = mime ? new MediaRecorder(micStream, { mimeType: mime }) : new MediaRecorder(micStream);
      mediaRecorder.ondataavailable = function (e) { if (e.data && e.data.size) audioChunks.push(e.data); };
      mediaRecorder.start(100);
    } catch (err) {
      emit('micError', { message: 'Could not start recording: ' + err.message });
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
            else if (!res.ok) emit('micError', { message: res.error || 'Transcription failed' });
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
      u.rate = 1.0;
      u.pitch = 0.95;
      preferredVoice = preferredVoice || pickVoice();
      if (preferredVoice) u.voice = preferredVoice;
      var pulse = setInterval(function () { emit('ttsLevel', 0.3 + Math.random() * 0.4); }, 120);
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
            var audioBlob = await (await fetch('data:' + res.mimeType + ';base64,' + res.audio)).blob();
            var url = URL.createObjectURL(audioBlob);
            speakingAudio = new Audio(url);
            var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            var source = audioCtx.createMediaElementSource(speakingAudio);
            ttsAnalyser = audioCtx.createAnalyser();
            ttsAnalyser.fftSize = 256;
            source.connect(ttsAnalyser);
            ttsAnalyser.connect(audioCtx.destination);
            ttsData = new Uint8Array(ttsAnalyser.frequencyBinCount);
            var tickTts = function () {
              ttsRaf = requestAnimationFrame(tickTts);
              if (!ttsAnalyser) return;
              ttsAnalyser.getByteFrequencyData(ttsData);
              var sum = 0;
              for (var i = 0; i < ttsData.length; i++) sum += ttsData[i];
              emit('ttsLevel', Math.min(1, (sum / ttsData.length) / 60));
            };
            tickTts();
            speakingAudio.onended = function () {
              cancelAnimationFrame(ttsRaf); emit('ttsLevel', 0);
              URL.revokeObjectURL(url); speakingAudio = null; resolve();
            };
            speakingAudio.onerror = function () {
              cancelAnimationFrame(ttsRaf); emit('ttsLevel', 0); resolve();
            };
            await speakingAudio.play();
          } catch (err) {
            await speakFree(text);
            resolve();
          }
        });
        return;
      }
    } catch (_) {}
    await speakFree(text);
  }

  function stopSpeaking() {
    if (speakingAudio) {
      speakingAudio.pause(); speakingAudio = null;
      cancelAnimationFrame(ttsRaf); emit('ttsLevel', 0);
    }
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
