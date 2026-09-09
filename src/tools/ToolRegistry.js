'use strict';

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const open = require('open');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const si = require('systeminformation');

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
        description: 'Open an application, file, folder, or URL',
        parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
        execute: async ({ name }) => {
          const map = {
            chrome: process.platform === 'win32' ? 'chrome' : 'google-chrome',
            edge: 'msedge', notepad: 'notepad',
            calculator: process.platform === 'win32' ? 'calc' : 'gnome-calculator',
            explorer: process.platform === 'win32' ? 'explorer' : 'xdg-open',
            terminal: process.platform === 'win32' ? 'wt' : 'x-terminal-emulator',
          };
          await open(map[String(name).toLowerCase()] || name);
          return { ok: true, message: 'Opened ' + name };
        },
      },
      open_folder: {
        description: 'Open a folder. Use home, desktop, downloads, documents, or a full path.',
        parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
        execute: async ({ path: p }) => {
          const home = os.homedir();
          const aliases = { home, desktop: path.join(home, 'Desktop'), downloads: path.join(home, 'Downloads'), documents: path.join(home, 'Documents') };
          const target = aliases[String(p).toLowerCase()] || p;
          await open(target);
          return { ok: true, message: 'Opened folder ' + target };
        },
      },
      web_search: {
        description: 'Search the web',
        parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
        execute: async ({ query }) => {
          await open('https://www.google.com/search?q=' + encodeURIComponent(query));
          return { ok: true, message: 'Searching for ' + query };
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
        description: 'CPU, RAM, disk, battery',
        parameters: { type: 'object', properties: {} },
        execute: async () => require('./system').getSystemStatus(),
      },
      get_time: {
        description: 'Current date and time',
        parameters: { type: 'object', properties: {} },
        execute: async () => {
          const now = new Date();
          return { local: now.toLocaleString(), time: now.toLocaleTimeString(), date: now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) };
        },
      },
      list_processes: {
        description: 'List top processes by CPU or memory',
        parameters: { type: 'object', properties: { sort: { type: 'string' } } },
        execute: async ({ sort }) => {
          const procs = await si.processes();
          return {
            processes: (procs.list || []).sort((a, b) => (sort === 'mem' ? b.memRss - a.memRss : b.cpu - a.cpu)).slice(0, 15)
              .map((p) => ({ name: p.name, pid: p.pid, cpu: Math.round(p.cpu * 10) / 10, memMB: Math.round((p.memRss || 0) / 1024) })),
          };
        },
      },
      list_files: {
        description: 'List files in a directory',
        parameters: { type: 'object', properties: { dir: { type: 'string' } }, required: ['dir'] },
        execute: async ({ dir }) => {
          const home = os.homedir();
          const aliases = { home, desktop: path.join(home, 'Desktop'), downloads: path.join(home, 'Downloads'), documents: path.join(home, 'Documents') };
          const target = aliases[String(dir).toLowerCase()] || dir;
          const entries = await fs.readdir(target, { withFileTypes: true });
          return entries.slice(0, 80).map((e) => ({ name: e.name, isDirectory: e.isDirectory() }));
        },
      },
      read_file: {
        description: 'Read a text file (max 8KB). Requires confirmation.',
        parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
        execute: async ({ path: p }) => {
          const data = await fs.readFile(p, 'utf8');
          return { ok: true, content: data.slice(0, 8000), truncated: data.length > 8000 };
        },
      },
      write_file: {
        description: 'Write text to a file. Always requires confirmation.',
        parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] },
        execute: async ({ path: p, content }) => {
          await fs.writeFile(p, content, 'utf8');
          return { ok: true, message: 'Wrote file ' + p };
        },
      },
      shell_command: {
        description: 'Run any shell command on the computer. Requires confirmation. Use for advanced PC tasks.',
        parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
        execute: async ({ command }) => {
          const { stdout, stderr } = await execAsync(command, { timeout: 30000, maxBuffer: 2 * 1024 * 1024, shell: true, windowsHide: true });
          return { ok: true, stdout: (stdout || '').slice(0, 6000), stderr: (stderr || '').slice(0, 1500) };
        },
      },
      type_text: {
        description: 'Type text into the focused window (Windows). Requires confirmation.',
        parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
        execute: async ({ text }) => {
          if (process.platform !== 'win32') return { ok: false, message: 'type_text is supported on Windows' };
          const escaped = String(text).replace(/'/g, "''");
          await execAsync("powershell -Command \"$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys('" + escaped + "')\"", { timeout: 10000 });
          return { ok: true, message: 'Typed into focused window' };
        },
      },
      take_screenshot_note: {
        description: 'Open the Windows screenshot / snipping tool',
        parameters: { type: 'object', properties: {} },
        execute: async () => {
          if (process.platform === 'win32') {
            await execAsync('start ms-screenclip:', { shell: true }).catch(() => open('ms-screenclip:'));
            return { ok: true, message: 'Opened screenshot tool' };
          }
          return { ok: true, message: 'Use your system screenshot shortcut' };
        },
      },
      remember: {
        description: 'Save a fact to memory',
        parameters: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' } }, required: ['key', 'value'] },
        execute: async ({ key, value }) => { this.memoryStore.save(key, value); return { ok: true, message: 'Remembered ' + key }; },
      },
      recall: {
        description: 'Recall memories',
        parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
        execute: async ({ query }) => this.memoryStore.getRelevant(query),
      },
      show_hologram: {
        description: 'Project a 3D wireframe hologram. Prefer object: jarvis, core, suit, head, sphere, planet, cube, pyramid, torus, molecule, car, robot, building, aircraft, plane, satellite. Set label to what the user asked for.',
        parameters: { type: 'object', properties: { object: { type: 'string' }, label: { type: 'string' }, color: { type: 'string' }, note: { type: 'string' } }, required: ['object'] },
        execute: async ({ object, label, color, note }) => {
          const payload = { object: String(object || 'jarvis').toLowerCase(), label: label || object || 'Model', color: color || '#4fd8ff', note: note || '' };
          if (this.eventBus) this.eventBus.safeEmit('hologram:show', payload);
          return { ok: true, message: 'Hologram projected: ' + payload.label };
        },
      },
      hide_hologram: {
        description: 'Hide hologram',
        parameters: { type: 'object', properties: {} },
        execute: async () => { if (this.eventBus) this.eventBus.safeEmit('hologram:hide', {}); return { ok: true, message: 'Hologram dismissed' }; },
      },
      set_hologram_view: {
        description: 'Hologram view: front, side, top, orbit, isometric',
        parameters: { type: 'object', properties: { view: { type: 'string' } }, required: ['view'] },
        execute: async ({ view }) => { if (this.eventBus) this.eventBus.safeEmit('hologram:view', { view: String(view || 'orbit') }); return { ok: true, message: 'View set to ' + view }; },
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
