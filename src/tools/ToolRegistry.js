'use strict';

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const open = require('open');
const fs = require('fs').promises;

class ToolRegistry {
  constructor({ memoryStore, logger, eventBus }) {
    this.memoryStore = memoryStore;
    this.logger = logger;
    this.eventBus = eventBus;
    this.tools = this._buildTools();
  }

  _buildTools() {
    return {
      open_app: {
        description: 'Open an application, file, or URL by name or path',
        parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
        execute: async ({ name }) => { await open(name); return { ok: true, message: 'Opened ' + name }; },
      },
      web_search: {
        description: 'Search the web in the default browser',
        parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
        execute: async ({ query }) => {
          await open('https://www.google.com/search?q=' + encodeURIComponent(query));
          return { ok: true, message: 'Searching the web for ' + query };
        },
      },
      youtube_search: {
        description: 'Search YouTube',
        parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
        execute: async ({ query }) => {
          await open('https://www.youtube.com/results?search_query=' + encodeURIComponent(query));
          return { ok: true, message: 'YouTube: ' + query };
        },
      },
      get_system_info: {
        description: 'Report CPU, RAM, disk, and battery status',
        parameters: { type: 'object', properties: {} },
        execute: async () => { const system = require('./system'); return await system.getSystemStatus(); },
      },
      get_time: {
        description: 'Get current local date and time',
        parameters: { type: 'object', properties: {} },
        execute: async () => {
          const now = new Date();
          return { local: now.toLocaleString(), time: now.toLocaleTimeString(), date: now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) };
        },
      },
      remember: {
        description: 'Save a fact to long-term memory',
        parameters: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' } }, required: ['key', 'value'] },
        execute: async ({ key, value }) => { this.memoryStore.save(key, value); return { ok: true, message: 'Remembered ' + key }; },
      },
      recall: {
        description: 'Recall memories matching a query',
        parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
        execute: async ({ query }) => this.memoryStore.getRelevant(query),
      },
      shell_command: {
        description: 'Run a shell command (requires user confirmation)',
        parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
        execute: async ({ command }) => {
          const { stdout, stderr } = await execAsync(command, { timeout: 20000, maxBuffer: 1024 * 1024 });
          return { ok: true, stdout: (stdout || '').slice(0, 4000), stderr: (stderr || '').slice(0, 1000) };
        },
      },
      list_files: {
        description: 'List files in a directory',
        parameters: { type: 'object', properties: { dir: { type: 'string' } }, required: ['dir'] },
        execute: async ({ dir }) => {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          return entries.slice(0, 80).map((e) => ({ name: e.name, isDirectory: e.isDirectory() }));
        },
      },
      show_hologram: {
        description: 'Display a 3D holographic model on screen when user asks to build, show, design or visualize a 3D object. object types: sphere, cube, pyramid, torus, car, robot, building, aircraft, planet, molecule, satellite, custom.',
        parameters: {
          type: 'object',
          properties: {
            object: { type: 'string' },
            label: { type: 'string' },
            color: { type: 'string' },
            note: { type: 'string' },
          },
          required: ['object'],
        },
        execute: async ({ object, label, color, note }) => {
          const payload = { object: String(object || 'cube').toLowerCase(), label: label || object || 'Model', color: color || '#4fd8ff', note: note || '' };
          if (this.eventBus) this.eventBus.safeEmit('hologram:show', payload);
          return { ok: true, message: 'Hologram projected: ' + payload.label };
        },
      },
      hide_hologram: {
        description: 'Close the 3D hologram display',
        parameters: { type: 'object', properties: {} },
        execute: async () => {
          if (this.eventBus) this.eventBus.safeEmit('hologram:hide', {});
          return { ok: true, message: 'Hologram dismissed' };
        },
      },
      set_hologram_view: {
        description: 'Change hologram camera: front, side, top, orbit, isometric',
        parameters: { type: 'object', properties: { view: { type: 'string' } }, required: ['view'] },
        execute: async ({ view }) => {
          if (this.eventBus) this.eventBus.safeEmit('hologram:view', { view: String(view || 'orbit') });
          return { ok: true, message: 'View set to ' + view };
        },
      },
    };
  }

  getToolDefinitions() {
    return Object.entries(this.tools).map(([name, t]) => ({ name, description: t.description, parameters: t.parameters }));
  }

  async execute(name, args) {
    const tool = this.tools[name];
    if (!tool) throw new Error('Unknown tool: ' + name);
    this.logger.info('TOOL', 'Executing ' + name, { args });
    return tool.execute(args || {});
  }
}

module.exports = ToolRegistry;
