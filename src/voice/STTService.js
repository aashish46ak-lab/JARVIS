'use strict';

let GoogleGenAI = null;
try {
  GoogleGenAI = require('@google/genai').GoogleGenAI;
} catch (_) {
  GoogleGenAI = null;
}

class STTService {
  constructor({ apiKey, logger }) {
    this.apiKey = apiKey;
    this.logger = logger;
    this.client = (apiKey && GoogleGenAI) ? new GoogleGenAI({ apiKey }) : null;
    this.models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];
  }

  updateConfig({ apiKey }) {
    if (apiKey) {
      this.apiKey = apiKey;
      this.client = (apiKey && GoogleGenAI) ? new GoogleGenAI({ apiKey }) : null;
    }
  }

  async transcribe(buffer, mimeType = 'audio/webm') {
    if (!GoogleGenAI || !this.client) {
      throw new Error('Fallback STT needs @google/genai and a Gemini API key. Browser speech recognition is preferred.');
    }

    const base64 = buffer.toString('base64');
    let lastErr = null;
    for (const model of this.models) {
      try {
        const response = await this.client.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType, data: base64 } },
                { text: 'Transcribe the spoken words exactly. Return only the transcript text, nothing else.' },
              ],
            },
          ],
        });
        return (response.text || '').trim();
      } catch (err) {
        lastErr = err;
        if (this.logger) this.logger.warn('STT', 'Model failed: ' + model, { error: err.message });
      }
    }
    throw lastErr || new Error('STT failed');
  }
}

module.exports = STTService;
