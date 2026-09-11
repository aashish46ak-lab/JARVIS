'use strict';

const fetch = require('node-fetch');

class GroqClient {
  constructor({ apiKey, model, logger }) {
    this.apiKey = apiKey;
    this.model = model || 'llama-3.1-8b-instant';
    this.fallbackModels = [
      'llama-3.1-8b-instant',
      'llama-3.3-70b-versatile',
      'openai/gpt-oss-20b',
    ];
    this.logger = logger;
    this.baseUrl = 'https://api.groq.com/openai/v1';
  }

  updateConfig({ apiKey, model }) {
    if (apiKey !== undefined) this.apiKey = apiKey;
    if (model) this.model = model;
  }

  async chat({ messages, tools, maxTokens, temperature, forceNoTools }) {
    if (!this.apiKey) {
      throw new Error('Groq API key missing. Open Settings and paste your key from console.groq.com');
    }

    const body = {
      model: this.model,
      messages,
      temperature: temperature != null ? temperature : 0.45,
      max_tokens: maxTokens != null ? maxTokens : 280,
    };

    if (!forceNoTools && tools && tools.length) {
      body.tools = tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters || { type: 'object', properties: {} },
        },
      }));
      body.tool_choice = 'auto';
    }

    const modelsToTry = [this.model, ...this.fallbackModels.filter((m) => m !== this.model)];
    let lastErr = null;

    for (const model of modelsToTry) {
      body.model = model;
      try {
        const res = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errText = await res.text();
          lastErr = new Error(`Groq ${res.status}: ${errText.slice(0, 180)}`);
          if (res.status === 404 || /model/i.test(errText)) continue;
          throw lastErr;
        }

        this.model = model;
        const data = await res.json();
        const choice = data.choices && data.choices[0];
        const msg = choice && choice.message;
        let text = (msg && msg.content) || '';
        let functionCalls = [];
        if (msg && msg.tool_calls && Array.isArray(msg.tool_calls)) {
          functionCalls = msg.tool_calls.map((tc) => {
            let args = {};
            try {
              args = typeof tc.function.arguments === 'string'
                ? JSON.parse(tc.function.arguments)
                : (tc.function.arguments || {});
            } catch (_) {}
            return { name: tc.function.name, args };
          });
        }
        return { text: text.trim(), functionCalls };
      } catch (err) {
        lastErr = err;
        if (err.message && /model|404/i.test(err.message)) continue;
        throw err;
      }
    }

    throw lastErr || new Error('Groq request failed');
  }

  async testConnection() {
    try {
      const res = await this.chat({
        messages: [{ role: 'user', content: 'Reply with the single word: online' }],
        forceNoTools: true,
        maxTokens: 8,
      });
      return { ok: true, reply: res.text };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
}

module.exports = GroqClient;
