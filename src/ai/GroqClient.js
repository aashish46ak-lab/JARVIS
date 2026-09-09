'use strict';

const fetch = require('node-fetch');

class GroqClient {
  constructor({ apiKey, model, logger }) {
    this.apiKey = apiKey;
    this.model = model || 'llama-3.1-8b-instant';
    this.fallbackModels = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'openai/gpt-oss-20b'];
    this.logger = logger;
    this.baseUrl = 'https://api.groq.com/openai/v1';
  }

  updateConfig({ apiKey, model }) {
    if (apiKey) this.apiKey = apiKey;
    if (model) this.model = model;
  }

  async chat({ messages, tools = [] }) {
    if (!this.apiKey) throw new Error('Groq API key not configured');

    const openaiMessages = messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
      content: m.content,
    }));

    const body = {
      model: this.model,
      messages: openaiMessages,
      temperature: 0.7,
      max_tokens: 1024,
    };

    if (tools.length) {
      body.tools = tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
      body.tool_choice = 'auto';
    }

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
      if (res.status === 404 || errText.includes('model_not_found') || errText.includes('does not exist')) {
        for (const m of this.fallbackModels) {
          if (m === body.model) continue;
          body.model = m;
          this.model = m;
          const retry = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          });
          if (retry.ok) {
            const data = await retry.json();
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
          }
        }
      }
      throw new Error(`Groq error ${res.status}: ${errText.slice(0, 400)}`);
    }

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

module.exports = GroqClient;
