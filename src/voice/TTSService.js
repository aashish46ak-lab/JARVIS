'use strict';

const fetch = require('node-fetch');

class TTSService {
  constructor({ apiKey, voiceId, enabled, logger }) {
    this.apiKey = apiKey;
    this.voiceId = voiceId || '14129c3e320149449d6bada6862f7338';
    this.enabled = enabled !== false;
    this.logger = logger;
  }

  updateConfig({ apiKey, voiceId, enabled }) {
    if (apiKey !== undefined) this.apiKey = apiKey;
    if (voiceId) this.voiceId = voiceId;
    if (enabled !== undefined) this.enabled = enabled;
  }

  async synthesize(text) {
    if (!this.enabled) throw new Error('Voice output is disabled');
    if (!this.apiKey) throw new Error('Fish Audio API key not set (FISH_API_KEY)');

    const url = 'https://api.fish.audio/v1/tts';
    const body = {
      text: String(text).slice(0, 2000),
      reference_id: this.voiceId,
      format: 'mp3',
      normalize: true,
      latency: 'normal',
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        model: 's1',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Fish Audio error ${res.status}: ${errText.slice(0, 300)}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
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
