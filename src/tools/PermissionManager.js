'use strict';

class PermissionManager {
  constructor({ config, logger }) {
    this.config = config;
    this.logger = logger;
    this.pending = new Map();
  }

  needsConfirmation(toolName) {
    const mode = this.config.get('permissionMode') || 'dangerous-only';
    if (mode === 'never') return false;
    if (mode === 'always') return true;
    const dangerous = ['shell_command', 'delete_file', 'write_file', 'run_command'];
    return dangerous.includes(toolName);
  }

  async requestConfirmation(toolName, summary) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      const eventBus = require('../core/EventBus');
      eventBus.safeEmit('confirmation:request', { id, summary: summary || `Authorize tool: ${toolName}?` });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          resolve(false);
        }
      }, 60000);
    });
  }

  resolve(id, approved) {
    const resolve = this.pending.get(id);
    if (resolve) {
      this.pending.delete(id);
      resolve(!!approved);
    }
  }
}

module.exports = PermissionManager;
