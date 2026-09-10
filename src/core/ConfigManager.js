'use strict';

const Store = require('electron-store');

const DEFAULTS = {
  firstRunComplete: false,
  aiProvider: process.env.AI_PROVIDER || 'groq',
  groqApiKey: process.env.GROQ_API_KEY || '',
  groqModel: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  fishApiKey: process.env.FISH_API_KEY || '',
  fishVoiceId: process.env.FISH_VOICE_ID || '14129c3e320149449d6bada6862f7338',
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || '',
  elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID || '',
  voiceEnabled: true,
  speakingSpeed: 1.0,
  listeningMode: 'continuous',
  wakeWordEnabled: false,
  wakeWord: 'jarvis',
  animationIntensity: 'high',
  alwaysOnTop: false,
  startWithWindows: true,
  startMinimized: false,
  permissionMode: 'dangerous-only',
  enrollmentFace: false,
  enrollmentVoice: false,
  enrollmentFacePath: '',
  enrollmentVoicePath: '',
  enrollmentComplete: false,
  updateLastSha: '',
  updateLastAt: '',
  autoCheckUpdates: true,
};

class ConfigManager {
  constructor() {
    this.store = new Store({ name: 'jarvis-config', defaults: DEFAULTS });
  }

  get(key) {
    return this.store.get(key);
  }

  set(key, value) {
    this.store.set(key, value);
  }

  update(partial) {
    for (const [k, v] of Object.entries(partial)) {
      if (v !== undefined) this.store.set(k, v);
    }
    return this.getAllMasked();
  }

  getAll() {
    return { ...DEFAULTS, ...this.store.store };
  }

  getAllMasked() {
    const all = this.getAll();
    const mask = (s) => (s && s.length > 8 ? s.slice(0, 4) + '••••' + s.slice(-4) : s ? '••••' : '');
    return {
      ...all,
      groqApiKey: mask(all.groqApiKey),
      geminiApiKey: mask(all.geminiApiKey),
      fishApiKey: mask(all.fishApiKey),
      elevenLabsApiKey: mask(all.elevenLabsApiKey),
    };
  }
}

module.exports = ConfigManager;
