'use strict';

const fetch = require('node-fetch');

class TTSService {
  constructor({ apiKey, voiceId, speed, enabled, logger }) {
    this.apiKey = apiKey;
    this.voiceId = voiceId || 'wDsJlOXPqcvIUKdLXjDs';
    this.speed = speed || 1.0;
    this.enabled = enabled !== false;
    this.logger = logger;
  }

  updateConfig({ apiKey, voiceId, speed, enabled }) {
    if (apiKey !== undefined) this.apiKey = apiKey;
    if (voiceId) this.voiceId = voiceId;
    if (speed !== undefined) this.speed = speed;
    if (enabled !== undefined) this.enabled = enabled;
  }

  async synthesize(text) {
    if (!this.enabled) throw new Error('Voice output is disabled');
    if (!this.apiKey) throw new Error('ElevenLabs API key not set');

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`;
    const body = {
      text: text.slice(0, 2500),
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.75,
        style: 0.35,
        use_speaker_boost: true,
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`ElevenLabs error ${res.status}: ${errText.slice(0, 200)}`);
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
