'use strict';

const { GoogleGenAI } = require('@google/genai');

class STTService {
  constructor({ apiKey, logger }) {
    this.apiKey = apiKey;
    this.logger = logger;
    this.client = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }

  updateConfig({ apiKey }) {
    if (apiKey) {
      this.apiKey = apiKey;
      this.client = new GoogleGenAI({ apiKey });
    }
  }

  async transcribe(buffer, mimeType = 'audio/webm') {
    if (!this.client) throw new Error('Gemini API key required for fallback transcription');

    const base64 = buffer.toString('base64');
    const response = await this.client.models.generateContent({
      model: 'gemini-2.5-flash',
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
  }
}

module.exports = STTService;
