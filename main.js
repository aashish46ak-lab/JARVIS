'use strict';

require('dotenv').config();

const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');

const eventBus = require('./src/core/EventBus');
const { Logger } = require('./src/core/Logger');
const ConfigManager = require('./src/core/ConfigManager');
const MemoryStore = require('./src/core/MemoryStore');
const ToolRegistry = require('./src/tools/ToolRegistry');
const PermissionManager = require('./src/tools/PermissionManager');
const ConversationManager = require('./src/ai/ConversationManager');
const TTSService = require('./src/voice/TTSService');
const STTService = require('./src/voice/STTService');
const si = require('systeminformation');

let mainWindow = null;

const config = new ConfigManager();
const logger = new Logger({ logDir: path.join(app.getPath('userData'), 'logs') });
const memoryStore = new MemoryStore();
const toolRegistry = new ToolRegistry({ memoryStore, logger });
const permissionManager = new PermissionManager({ config, logger });
const conversationManager = new ConversationManager({
  config, toolRegistry, permissionManager, memoryStore, eventBus, logger,
});
const ttsService = new TTSService({
  apiKey: config.get('elevenLabsApiKey'),
  voiceId: config.get('elevenLabsVoiceId'),
  speed: config.get('speakingSpeed'),
  enabled: config.get('voiceEnabled'),
  logger,
});
const sttService = new STTService({ apiKey: config.get('geminiApiKey'), logger });

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#05070a',
    show: false,
    alwaysOnTop: config.get('alwaysOnTop'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  Menu.setApplicationMenu(null);
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    if (!config.get('startMinimized')) mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

const FORWARDED_EVENTS = [
  'state:change', 'activity', 'assistant:interim', 'assistant:final',
  'confirmation:request', 'tool:executing', 'tool:result', 'error',
  'assistant:speaking', 'assistant:interrupted',
];
for (const evt of FORWARDED_EVENTS) {
  eventBus.on(evt, (payload) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(`bus:${evt}`, payload);
    }
  });
}

ipcMain.handle('chat:sendMessage', async (_evt, text) => {
  try {
    const reply = await conversationManager.handleUserMessage(text);
    return { ok: true, reply };
  } catch (err) {
    logger.error('JARVIS', 'chat:sendMessage failed', { error: err.message });
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('chat:resetHistory', async () => {
  conversationManager.resetHistory();
  return { ok: true };
});

ipcMain.handle('confirmation:respond', async (_evt, { id, approved }) => {
  permissionManager.resolve(id, approved);
  eventBus.safeEmit('confirmation:resolved', { id, approved });
  return { ok: true };
});

ipcMain.handle('voice:transcribeFallback', async (_evt, { base64, mimeType }) => {
  try {
    const buf = Buffer.from(base64, 'base64');
    const text = await sttService.transcribe(buf, mimeType);
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('tts:synthesize', async (_evt, text) => {
  try {
    if (!config.get('voiceEnabled')) return { ok: false, error: 'Voice output is disabled.' };
    const audio = await ttsService.synthesize(text);
    return { ok: true, audio: audio.toString('base64'), mimeType: 'audio/mpeg' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('config:getAll', async () => config.getAllMasked());

ipcMain.handle('config:update', async (_evt, partial) => {
  const updated = config.update(partial);
  ttsService.updateConfig({
    apiKey: config.get('elevenLabsApiKey'),
    voiceId: config.get('elevenLabsVoiceId'),
    speed: config.get('speakingSpeed'),
    enabled: config.get('voiceEnabled'),
  });
  sttService.updateConfig({ apiKey: config.get('geminiApiKey') });
  conversationManager.refreshProvider();
  if (mainWindow) mainWindow.setAlwaysOnTop(config.get('alwaysOnTop'));
  return updated;
});

ipcMain.handle('config:testAI', async () => {
  conversationManager.refreshProvider();
  return conversationManager.testConnection();
});

ipcMain.handle('config:testVoice', async () => ttsService.testVoice());

ipcMain.handle('memory:list', async () => memoryStore.list());
ipcMain.handle('memory:save', async (_evt, { key, value }) => memoryStore.save(key, value));
ipcMain.handle('memory:forgetById', async (_evt, id) => memoryStore.forgetById(id));
ipcMain.handle('memory:clear', async () => { memoryStore.clear(); return true; });

ipcMain.handle('system:getStatus', async () => {
  const systemTools = require('./src/tools/system');
  return systemTools.getSystemStatus();
});

ipcMain.handle('logs:getRecent', async (_evt, limit) => logger.getRecent(limit));
ipcMain.handle('logs:export', async () => {
  try {
    const file = logger.exportToFile();
    return { ok: true, file };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('window:minimize', async () => mainWindow?.minimize());
ipcMain.handle('window:close', async () => mainWindow?.close());
ipcMain.handle('window:toggleAlwaysOnTop', async () => {
  const next = !config.get('alwaysOnTop');
  config.set('alwaysOnTop', next);
  mainWindow?.setAlwaysOnTop(next);
  return next;
});
ipcMain.handle('shell:openExternal', async (_evt, url) => shell.openExternal(url));

const suggestionState = { lowDiskWarned: false, lowBatteryWarned: false, highCpuStreak: 0 };

async function checkProactiveSuggestions() {
  try {
    const status = await si.fsSize();
    const battery = await si.battery();
    const load = await si.currentLoad();

    const primaryDisk = status.sort((a, b) => b.size - a.size)[0];
    if (primaryDisk && primaryDisk.use >= 90 && !suggestionState.lowDiskWarned) {
      suggestionState.lowDiskWarned = true;
      eventBus.safeEmit('assistant:final', {
        text: "Sir, storage is getting rather full — you're above ninety percent used. Shall I find what's consuming the most space?",
        proactive: true,
      });
    }

    if (battery?.hasBattery && battery.percent <= 15 && !battery.isCharging && !suggestionState.lowBatteryWarned) {
      suggestionState.lowBatteryWarned = true;
      eventBus.safeEmit('assistant:final', {
        text: `Battery is down to ${battery.percent} percent. You may want to connect the charger.`,
        proactive: true,
      });
    }
    if (battery?.isCharging) suggestionState.lowBatteryWarned = false;

    if (load && load.currentLoad >= 90) {
      suggestionState.highCpuStreak += 1;
    } else {
      suggestionState.highCpuStreak = 0;
    }
    if (suggestionState.highCpuStreak === 6) {
      eventBus.safeEmit('assistant:final', {
        text: "Something has been consuming a considerable amount of CPU for a while now. Would you like me to check what's running?",
        proactive: true,
      });
    }
  } catch (err) {
    logger.debug('SYSTEM', 'Proactive check skipped', { error: err.message });
  }
}
let proactiveTimer = null;

app.whenReady().then(() => {
  createWindow();
  proactiveTimer = setInterval(checkProactiveSuggestions, 30 * 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (proactiveTimer) clearInterval(proactiveTimer);
  if (process.platform !== 'darwin') app.quit();
});

process.on('uncaughtException', (err) => {
  logger.error('ERROR', 'Uncaught exception', { error: err.message, stack: err.stack });
});
process.on('unhandledRejection', (err) => {
  logger.error('ERROR', 'Unhandled rejection', { error: err?.message || String(err) });
});
