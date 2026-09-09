'use strict';

const { EventEmitter } = require('events');

class EventBus extends EventEmitter {
  safeEmit(event, payload) {
    try {
      this.emit(event, payload);
    } catch (err) {
      console.error(`[EventBus] Error emitting ${event}:`, err.message);
    }
  }
}

module.exports = new EventBus();
