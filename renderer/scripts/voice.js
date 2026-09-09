'use strict';

const JarvisVoice = (function () {
  const listeners = {};
  let recognition = null;
  let continuous = false;
  let wakeWord = 'jarvis';
  let wakeWordEnabled = true;
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

  function on(event, cb) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(cb);
  }
  function emit(event, payload) {
    (listeners[event] || []).forEach((cb) => {
      try { cb(payload); } catch (_) {}
    });
  }

  function configure(opts = {}) {
    if (opts.wakeWordEnabled !== undefined) wakeWordEnabled = opts.wakeWordEnabled;
    if (opts.wakeWord) wakeWord = (opts.wakeWord || 'jarvis').toLowerCase();
    if (opts.listeningMode) continuous = opts.listeningMode === 'continuous';
  }

  async function initMicLevelMeter() {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createMediaStreamSource(micStream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        levelRaf = requestAnimationFrame(tick);
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const level = Math.min(1, (sum / dataArray.length) / 80);
        emit('micLevel', level);
      };
      tick();
    } catch (err) {
      emit('micError', { message: 'Microphone access denied or unavailable.' });
    }
  }

  function startContinuousListening() {
    if (!continuous) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      emit('fallbackPushToTalk', { message: 'SpeechRecognition unavailable — switched to push-to-talk.' });
      continuous = false;
      return;
    }
    try {
      if (recognition) {
        try { recognition.stop(); } catch (_) {}
      }
      recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) final += t;
          else interim += t;
        }
        if (interim) emit('interim', interim);
        if (final) {
          const text = final.trim();
          if (wakeWordEnabled) {
            const lower = text.toLowerCase();
            if (lower.includes(wakeWord)) {
              emit('wake');
              const after = text.slice(lower.indexOf(wakeWord) + wakeWord.length).trim();
              if (after) emit('transcript', after);
            }
          } else {
            emit('transcript', text);
          }
        }
      };

      recognition.onerror = (e) => {
        failedAttempts += 1;
        if (e.error === 'network' || failedAttempts >= 3) {
          emit('fallbackPushToTalk', {
            message: 'Continuous recognition failed — switched to push-to-talk (hold mic button).',
          });
          continuous = false;
          stopContinuousListening();
        }
      };

      recognition.onend = () => {
        if (continuous) {
          try { recognition.start(); } catch (_) {}
        }
      };

      recognition.start();
      failedAttempts = 0;
    } catch (err) {
      emit('fallbackPushToTalk', { message: 'Could not start continuous listening. Use push-to-talk.' });
      continuous = false;
    }
  }

  function stopContinuousListening() {
    continuous = false;
    if (recognition) {
      try { recognition.onend = null; recognition.stop(); } catch (_) {}
      recognition = null;
    }
  }

  async function startPushToTalkRecording() {
    try {
      if (!micStream) micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      mediaRecorder = new MediaRecorder(micStream, { mimeType: 'audio/webm' });
      mediaRecorder.ondataavailable = (e) => { if (e.data.size) audioChunks.push(e.data); };
      mediaRecorder.start(100);
    } catch (err) {
      emit('micError', { message: 'Could not start recording: ' + err.message });
    }
  }

  async function stopPushToTalkRecording() {
    return new Promise((resolve) => {
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        resolve();
        return;
      }
      mediaRecorder.onstop = async () => {
        emit('transcribing', true);
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result.split(',')[1];
          try {
            const res = await window.jarvis.voice.transcribeFallback(base64, 'audio/webm');
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

  async function speak(text) {
    return new Promise(async (resolve) => {
      try {
        const res = await window.jarvis.tts.synthesize(text);
        if (!res.ok) {
          console.warn('TTS failed:', res.error);
          resolve();
          return;
        }
        const audioBlob = await (await fetch(`data:${res.mimeType};base64,${res.audio}`)).blob();
        const url = URL.createObjectURL(audioBlob);
        speakingAudio = new Audio(url);

        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaElementSource(speakingAudio);
        ttsAnalyser = audioCtx.createAnalyser();
        ttsAnalyser.fftSize = 256;
        source.connect(ttsAnalyser);
        ttsAnalyser.connect(audioCtx.destination);
        ttsData = new Uint8Array(ttsAnalyser.frequencyBinCount);

        const tickTts = () => {
          ttsRaf = requestAnimationFrame(tickTts);
          if (!ttsAnalyser) return;
          ttsAnalyser.getByteFrequencyData(ttsData);
          let sum = 0;
          for (let i = 0; i < ttsData.length; i++) sum += ttsData[i];
          const level = Math.min(1, (sum / ttsData.length) / 60);
          emit('ttsLevel', level);
        };
        tickTts();

        speakingAudio.onended = () => {
          cancelAnimationFrame(ttsRaf);
          emit('ttsLevel', 0);
          URL.revokeObjectURL(url);
          speakingAudio = null;
          resolve();
        };
        speakingAudio.onerror = () => {
          cancelAnimationFrame(ttsRaf);
          emit('ttsLevel', 0);
          resolve();
        };
        await speakingAudio.play();
      } catch (err) {
        console.warn('speak error', err);
        resolve();
      }
    });
  }

  function stopSpeaking() {
    if (speakingAudio) {
      speakingAudio.pause();
      speakingAudio = null;
      cancelAnimationFrame(ttsRaf);
      emit('ttsLevel', 0);
    }
  }

  return {
    on, configure, initMicLevelMeter,
    startContinuousListening, stopContinuousListening,
    startPushToTalkRecording, stopPushToTalkRecording,
    speak, stopSpeaking,
  };
})();
