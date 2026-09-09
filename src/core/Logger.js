'use strict';

const fs = require('fs');
const path = require('path');

class Logger {
  constructor({ logDir }) {
    this.logDir = logDir;
    this.buffer = [];
    try {
      fs.mkdirSync(logDir, { recursive: true });
    } catch (_) {}
  }

  _redact(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const copy = { ...obj };
    for (const k of Object.keys(copy)) {
      if (/key|token|secret|password|api/i.test(k) && typeof copy[k] === 'string') {
        copy[k] = copy[k].slice(0, 4) + '…' + copy[k].slice(-4);
      }
    }
    return copy;
  }

  _log(level, tag, msg, meta = {}) {
    const entry = {
      ts: new Date().toISOString(),
      level,
      tag,
      msg,
      meta: this._redact(meta),
    };
    this.buffer.push(entry);
    if (this.buffer.length > 500) this.buffer.shift();
    const line = `[${entry.ts}] [${level}] [${tag}] ${msg} ${Object.keys(meta).length ? JSON.stringify(entry.meta) : ''}`;
    if (level === 'error') console.error(line);
    else console.log(line);
  }

  info(tag, msg, meta) { this._log('info', tag, msg, meta); }
  warn(tag, msg, meta) { this._log('warn', tag, msg, meta); }
  error(tag, msg, meta) { this._log('error', tag, msg, meta); }
  debug(tag, msg, meta) { this._log('debug', tag, msg, meta); }

  getRecent(limit = 100) {
    return this.buffer.slice(-limit);
  }

  exportToFile() {
    const file = path.join(this.logDir, `jarvis-${Date.now()}.log`);
    fs.writeFileSync(file, this.buffer.map(e => JSON.stringify(e)).join('\n'));
    return file;
  }
}

module.exports = { Logger };
