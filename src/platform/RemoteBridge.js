'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const DEFAULT_PORT = 4747;

class RemoteBridge {
  constructor({ config, conversationManager, eventBus, logger, appRoot }) {
    this.config = config;
    this.conversationManager = conversationManager;
    this.eventBus = eventBus;
    this.logger = logger;
    this.appRoot = appRoot;
    this.server = null;
    this.port = DEFAULT_PORT;
    this.sessions = new Map();
  }

  ensurePin() {
    let pin = this.config.get('remotePin');
    if (!pin || String(pin).length < 4) {
      pin = String(Math.floor(1000 + Math.random() * 9000));
      this.config.set('remotePin', pin);
    }
    return String(pin);
  }

  isEnabled() {
    return this.config.get('remoteEnabled') !== false;
  }

  getLanUrls() {
    const nets = os.networkInterfaces();
    const urls = [];
    for (const name of Object.keys(nets || {})) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          urls.push(`http://${net.address}:${this.port}`);
        }
      }
    }
    urls.push(`http://127.0.0.1:${this.port}`);
    return [...new Set(urls)];
  }

  status() {
    return {
      enabled: this.isEnabled() && !!this.server,
      port: this.port,
      pin: this.ensurePin(),
      urls: this.getLanUrls(),
      clients: this.sessions.size,
    };
  }

  auth(req, body) {
    const pin = this.ensurePin();
    const headerPin = req.headers['x-jarvis-pin'];
    const bodyPin = body && body.pin;
    const token = req.headers['x-jarvis-token'] || (body && body.token);
    if (token && this.sessions.has(token)) {
      this.sessions.set(token, { at: Date.now() });
      return { ok: true, token };
    }
    if (String(headerPin || bodyPin || '') === pin) {
      const t = crypto.randomBytes(16).toString('hex');
      this.sessions.set(t, { at: Date.now() });
      return { ok: true, token: t };
    }
    return { ok: false };
  }

  async start() {
    if (!this.isEnabled()) return this.status();
    if (this.server) return this.status();
    this.ensurePin();
    this.port = Number(this.config.get('remotePort')) || DEFAULT_PORT;

    this.server = http.createServer(async (req, res) => {
      try {
        await this.handle(req, res);
      } catch (err) {
        if (this.logger) this.logger.error('REMOTE', err.message);
        this.json(res, 500, { ok: false, error: err.message });
      }
    });

    await new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(this.port, '0.0.0.0', resolve);
    });

    if (this.logger) this.logger.info('REMOTE', 'Phone bridge listening', { port: this.port });
    this.eventBus.safeEmit('activity', { text: 'Phone bridge online on port ' + this.port, level: 'info' });
    return this.status();
  }

  stop() {
    if (this.server) {
      try { this.server.close(); } catch (_) {}
      this.server = null;
    }
    return this.status();
  }

  json(res, code, obj) {
    const body = JSON.stringify(obj);
    res.writeHead(code, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, X-Jarvis-Pin, X-Jarvis-Token',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    });
    res.end(body);
  }

  readBody(req) {
    return new Promise((resolve) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        try { resolve(raw ? JSON.parse(raw) : {}); }
        catch (_) { resolve({}); }
      });
    });
  }

  async handle(req, res) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-Jarvis-Pin, X-Jarvis-Token',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      });
      return res.end();
    }

    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      const file = path.join(this.appRoot, 'mobile', 'index.html');
      const html = fs.readFileSync(file, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    }

    if (req.method === 'GET' && url.pathname === '/api/status') {
      return this.json(res, 200, { ok: true, name: 'J.A.R.V.I.S.', version: '2.2.0', online: true, needPin: true });
    }

    if (req.method === 'POST' && url.pathname === '/api/pair') {
      const body = await this.readBody(req);
      const auth = this.auth(req, body);
      if (!auth.ok) return this.json(res, 401, { ok: false, error: 'Invalid PIN' });
      return this.json(res, 200, { ok: true, token: auth.token, urls: this.getLanUrls() });
    }

    if (req.method === 'POST' && url.pathname === '/api/chat') {
      const body = await this.readBody(req);
      const auth = this.auth(req, body);
      if (!auth.ok) return this.json(res, 401, { ok: false, error: 'Unauthorized — pair with PIN first' });
      const text = String(body.text || body.message || '').trim();
      if (!text) return this.json(res, 400, { ok: false, error: 'Empty message' });
      this.eventBus.safeEmit('activity', { text: 'PHONE: ' + text.slice(0, 80), level: 'info' });
      const reply = await this.conversationManager.handleUserMessage(text);
      return this.json(res, 200, { ok: true, reply, token: auth.token });
    }

    if (req.method === 'GET' && url.pathname === '/api/bridge') {
      return this.json(res, 200, this.status());
    }

    this.json(res, 404, { ok: false, error: 'Not found' });
  }
}

module.exports = RemoteBridge;
