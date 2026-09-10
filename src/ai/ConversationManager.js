'use strict';

const systemPrompt = require('./SystemPrompt');
const GroqClient = require('./GroqClient');

class ConversationManager {
  constructor({ config, toolRegistry, permissionManager, memoryStore, eventBus, logger }) {
    this.config = config;
    this.toolRegistry = toolRegistry;
    this.permissionManager = permissionManager;
    this.memoryStore = memoryStore;
    this.eventBus = eventBus;
    this.logger = logger;
    this.history = [];
    this.provider = null;
    this.refreshProvider();
  }

  refreshProvider() {
    let provider = this.config.get('aiProvider') || 'groq';
    if (this.config.get('groqApiKey')) {
      provider = 'groq';
    }

    if (provider === 'gemini' && this.config.get('geminiApiKey')) {
      try {
        const GeminiClient = require('./GeminiClient');
        this.provider = new GeminiClient({
          apiKey: this.config.get('geminiApiKey'),
          model: this.config.get('geminiModel') || 'gemini-2.0-flash',
          logger: this.logger,
        });
        return;
      } catch (err) {
        if (this.logger) this.logger.warn('AI', 'Gemini unavailable, using Groq', { error: err.message });
      }
    }

    this.provider = new GroqClient({
      apiKey: this.config.get('groqApiKey'),
      model: this.config.get('groqModel') || 'llama-3.1-8b-instant',
      logger: this.logger,
    });
  }

  resetHistory() {
    this.history = [];
  }

  async handleUserMessage(text) {
    this.eventBus.safeEmit('state:change', { state: 'thinking' });
    this.history.push({ role: 'user', content: text });

    const tools = this.toolRegistry.getToolDefinitions();
    let replyText = '';
    let iterations = 0;
    const maxIterations = 5;

    while (iterations < maxIterations) {
      iterations += 1;
      const messages = [
        { role: 'system', content: systemPrompt + '\n\nCurrent time: ' + new Date().toLocaleString() },
        ...this.history,
      ];

      const { text: out, functionCalls } = await this.provider.chat({ messages, tools });

      if (functionCalls && functionCalls.length > 0) {
        for (const fc of functionCalls) {
          this.eventBus.safeEmit('tool:executing', { name: fc.name });
          let approved = true;
          if (this.permissionManager.needsConfirmation(fc.name)) {
            approved = await this.permissionManager.requestConfirmation(
              fc.name,
              `Authorize "${fc.name}" with args: ${JSON.stringify(fc.args).slice(0, 120)}?`
            );
          }
          if (!approved) {
            this.history.push({ role: 'assistant', content: `Tool ${fc.name} was cancelled by user.` });
            continue;
          }
          try {
            const result = await this.toolRegistry.execute(fc.name, fc.args);
            this.eventBus.safeEmit('tool:result', { name: fc.name, result });
            this.history.push({
              role: 'assistant',
              content: `Tool ${fc.name} result: ${JSON.stringify(result).slice(0, 2000)}`,
            });
          } catch (err) {
            this.history.push({ role: 'assistant', content: `Tool ${fc.name} failed: ${err.message}` });
          }
        }
        continue;
      }

      replyText = out || "I'm afraid I didn't catch that, sir.";
      break;
    }

    this.history.push({ role: 'assistant', content: replyText });
    if (this.history.length > 30) this.history = this.history.slice(-20);

    this.eventBus.safeEmit('state:change', { state: 'idle' });
    return replyText;
  }

  async testConnection() {
    return this.provider.testConnection();
  }
}

module.exports = ConversationManager;
