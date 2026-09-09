'use strict';

const { GoogleGenAI } = require('@google/genai');

class GeminiClient {
  constructor({ apiKey, model, logger }) {
    this.apiKey = apiKey;
    this.model = model || 'gemini-2.5-flash';
    this.logger = logger;
    this.client = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }

  updateConfig({ apiKey, model }) {
    if (apiKey) {
      this.apiKey = apiKey;
      this.client = new GoogleGenAI({ apiKey });
    }
    if (model) this.model = model;
  }

  async chat({ messages, tools = [] }) {
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

    const request = {
      model: this.model,
      contents,
    };

    if (toolDefs.length) {
      request.config = {
        tools: [{ functionDeclarations: toolDefs }],
      };
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
