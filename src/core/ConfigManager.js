'use strict';

const Store = require('electron-store');
const path = require('path');

const DEFAULTS = {
  firstRunComplete: false,
  aiProvider: process.env.AI_PROVIDER || 'gemini',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || '',
  elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID || 'wDsJlOXPqcvIUKdLXjDs',
  voiceEnabled: true,
  speakingSpeed: 1.0,
  listeningMode: 'continuous', // continuous | push-to-talk
  wakeWordEnabled: true,
  wakeWord: 'jarvis',
  animationIntensity: 'normal',
  alwaysOnTop: false,
  startMinimized: false,
  permissionMode: 'dangerous-only', // always | dangerous-only | never
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
    // Never send real API keys to the renderer
    return {
      ...all,
      geminiApiKey: mask(all.geminiApiKey),
      openaiApiKey: mask(all.openaiApiKey),
      anthropicApiKey: mask(all.anthropicApiKey),
      elevenLabsApiKey: mask(all.elevenLabsApiKey),
    };
  }
}

module.exports = ConfigManager;
