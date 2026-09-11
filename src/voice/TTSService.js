'use strict';

const fetch = require('node-fetch');

class TTSService {
  constructor({ apiKey, voiceId, enabled, speed, logger }) {
    this.apiKey = apiKey;
    this.voiceId = voiceId || '14129c3e320149449d6bada6862f7338';
    this.enabled = enabled !== false;
    this.speed = speed || 1.0;
    this.logger = logger;
  }

  updateConfig({ apiKey, voiceId, enabled, speed }) {
    if (apiKey !== undefined) this.apiKey = apiKey;
    if (voiceId) this.voiceId = voiceId;
    if (enabled !== undefined) this.enabled = enabled;
    if (speed !== undefined) this.speed = speed;
  }

  async synthesize(text) {
    if (!this.enabled) throw new Error('Voice output is disabled');
    if (!this.apiKey) throw new Error('Fish Audio API key not set (FISH_API_KEY)');

    const models = ['s1', 's2.1-pro-free', 's2-pro'];
    let lastErr = null;

    for (const model of models) {
      try {
        const res = await fetch('https://api.fish.audio/v1/tts', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            model,
          },
          body: JSON.stringify({
            text: String(text).slice(0, 1200),
            reference_id: this.voiceId,
            format: 'mp3',
            normalize: true,
            latency: 'low',
            prosody: { speed: this.speed || 1.05, volume: 0 },
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          lastErr = new Error(`Fish Audio ${model} ${res.status}: ${errText.slice(0, 200)}`);
          continue;
        }

        const arrayBuffer = await res.arrayBuffer();
        if (!arrayBuffer.byteLength) {
          lastErr = new Error('Empty audio from Fish Audio');
          continue;
        }
        return Buffer.from(arrayBuffer);
      } catch (err) {
        lastErr = err;
      }
    }

    throw lastErr || new Error('Fish Audio TTS failed');
  }

  async testVoice() {
    try {
      const audio = await this.synthesize('Systems online, sir.');
      return { ok: true, size: audio.length };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
}

module.exports = TTSService;
