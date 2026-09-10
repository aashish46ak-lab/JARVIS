'use strict';

let GoogleGenAI = null;
try {
  GoogleGenAI = require('@google/genai').GoogleGenAI;
} catch (_) {
  GoogleGenAI = null;
}

class GeminiClient {
  constructor({ apiKey, model, logger }) {
    this.apiKey = apiKey;
    this.model = model || 'gemini-2.0-flash';
    this.fallbackModels = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];
    this.logger = logger;
    this.client = (apiKey && GoogleGenAI) ? new GoogleGenAI({ apiKey }) : null;
  }

  updateConfig({ apiKey, model }) {
    if (apiKey) {
      this.apiKey = apiKey;
      this.client = (apiKey && GoogleGenAI) ? new GoogleGenAI({ apiKey }) : null;
    }
    if (model) this.model = model;
  }

  async chat({ messages, tools = [] }) {
    if (!GoogleGenAI) {
      throw new Error('Gemini package not installed. Run: npm install @google/genai — or switch Provider to Groq in Settings.');
    }
    if (!this.client) throw new Error('Gemini API key not configured');

    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const toolDefs = tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));

    const modelsToTry = [this.model, ...this.fallbackModels.filter((m) => m !== this.model)];
    let lastErr = null;

    for (const model of modelsToTry) {
      try {
        const request = { model, contents };
        if (toolDefs.length) {
          request.config = { tools: [{ functionDeclarations: toolDefs }] };
        }
        const response = await this.client.models.generateContent(request);

        let text = '';
        let functionCalls = [];

        if (typeof response.text === 'string') {
          text = response.text;
        } else if (response.candidates && response.candidates[0]) {
          const parts = response.candidates[0].content?.parts || [];
          for (const part of parts) {
            if (part.text) text += part.text;
            if (part.functionCall) {
              functionCalls.push({
                name: part.functionCall.name,
                args: part.functionCall.args || {},
              });
            }
          }
        }

        if (response.functionCalls && Array.isArray(response.functionCalls)) {
          functionCalls = response.functionCalls.map((fc) => ({
            name: fc.name,
            args: fc.args || fc.arguments || {},
          }));
        }

        return { text: text.trim(), functionCalls };
      } catch (err) {
        lastErr = err;
        if (this.logger) this.logger.warn('GEMINI', 'Model failed: ' + model, { error: err.message });
      }
    }

    throw lastErr || new Error('All Gemini models failed');
  }

  async testConnection() {
    try {
      const res = await this.chat({
        messages: [{ role: 'user', content: 'Reply with the single word: online' }],
      });
      return { ok: true, reply: res.text };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
}

module.exports = GeminiClient;
