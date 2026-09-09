'use strict';

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const open = require('open');
const fs = require('fs').promises;
const path = require('path');
const platform = require('../platform');
const si = require('systeminformation');

class ToolRegistry {
  constructor({ memoryStore, logger }) {
    this.memoryStore = memoryStore;
    this.logger = logger;
    this.tools = this._buildTools();
  }

  _buildTools() {
    return {
      open_app: {
        description: 'Open an application or URL by name',
        parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
        execute: async ({ name }) => {
          await open(name);
          return { ok: true, message: `Opened ${name}` };
        },
      },
      web_search: {
        description: 'Open a web search in the default browser',
        parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
        execute: async ({ query }) => {
          await open(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
          return { ok: true, message: `Searched for: ${query}` };
        },
      },
      youtube_search: {
        description: 'Search YouTube',
        parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
        execute: async ({ query }) => {
          await open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
          return { ok: true, message: `YouTube search: ${query}` };
        },
      },
      get_system_info: {
        description: 'Get current CPU, RAM, disk and battery status',
        parameters: { type: 'object', properties: {} },
        execute: async () => {
          const system = require('./system');
          return await system.getSystemStatus();
        },
      },
      remember: {
        description: 'Save a fact to long-term memory',
        parameters: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' } }, required: ['key', 'value'] },
        execute: async ({ key, value }) => {
          this.memoryStore.save(key, value);
          return { ok: true, message: `Remembered: ${key}` };
        },
      },
      recall: {
        description: 'Recall memories matching a query',
        parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
        execute: async ({ query }) => {
          return this.memoryStore.getRelevant(query);
        },
      },
      shell_command: {
        description: 'Run a shell command (requires confirmation)',
        parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
        execute: async ({ command }) => {
          const { stdout, stderr } = await execAsync(command, { timeout: 15000, maxBuffer: 1024 * 1024 });
          return { ok: true, stdout: stdout.slice(0, 4000), stderr: stderr.slice(0, 1000) };
        },
      },
      list_files: {
        description: 'List files in a directory',
        parameters: { type: 'object', properties: { dir: { type: 'string' } }, required: ['dir'] },
        execute: async ({ dir }) => {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          return entries.map((e) => ({ name: e.name, isDirectory: e.isDirectory() }));
        },
      },
    };
  }

  getToolDefinitions() {
    return Object.entries(this.tools).map(([name, t]) => ({
      name,
      description: t.description,
      parameters: t.parameters,
    }));
  }

  async execute(name, args) {
    const tool = this.tools[name];
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    this.logger.info('TOOL', `Executing ${name}`, { args });
    return tool.execute(args || {});
  }
}

module.exports = ToolRegistry;
