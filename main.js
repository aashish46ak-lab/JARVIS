'use strict';

require('dotenv').config();

const { app, BrowserWindow, ipcMain, shell, Menu, Tray, nativeImage, session } = require('electron');
const path = require('path');
const fs = require('fs');

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
let tray = null;

const config = new ConfigManager();
const logger = new Logger({ logDir: path.join(app.getPath('userData'), 'logs') });
const memoryStore = new MemoryStore();
const toolRegistry = new ToolRegistry({ memoryStore, logger, eventBus });
const permissionManager = new PermissionManager({ config, logger });
const conversationManager = new ConversationManager({
  config, toolRegistry, permissionManager, memoryStore, eventBus, logger,
});
const ttsService = new TTSService({
  apiKey: config.get('fishApiKey'),
  voiceId: config.get('fishVoiceId') || '14129c3e320149449d6bada6862f7338',
  enabled: config.get('voiceEnabled'),
  speed: config.get('speakingSpeed') || 1.0,
  logger,
});
const sttService = new STTService({ apiKey: config.get('geminiApiKey') || config.get('groqApiKey'), logger });

function createTray() {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAKElEQVQ4T2NkYGD4z0A6+M+ACzAyMjL8Z2BgmNEwYdQAhtGAYTRgGA0AABbuAf/kH0X2AAAAAElFTkSuQmCC',
    'base64'
  );
  let icon = nativeImage.createFromBuffer(png);
  if (icon.isEmpty()) icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('J.A.R.V.I.S. — click to open');
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open JARVIS',
      click: () => {
        if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
      },
    },
    {
      label: 'Start with Windows',
      type: 'checkbox',
      checked: !!app.getLoginItemSettings().openAtLogin,
      click: (item) => {
        app.setLoginItemSettings({ openAtLogin: item.checked, openAsHidden: true });
        config.set('startWithWindows', item.checked);
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => { app.isQuitting = true; app.quit(); },
    },
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) mainWindow.hide();
    else { mainWindow.show(); mainWindow.focus(); }
  });
}

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

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

const FORWARDED_EVENTS = [
  'state:change', 'activity', 'assistant:interim', 'assistant:final',
  'confirmation:request', 'tool:executing', 'tool:result', 'error',
  'assistant:speaking', 'assistant:interrupted',
  'hologram:show', 'hologram:hide', 'hologram:view',
];
for (const evt of FORWARDED_EVENTS) {
  eventBus.on(evt, (payload) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('bus:' + evt, payload);
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
    apiKey: config.get('fishApiKey'),
    voiceId: config.get('fishVoiceId') || '14129c3e320149449d6bada6862f7338',
    enabled: config.get('voiceEnabled'),
    speed: config.get('speakingSpeed') || 1.0,
  });
  sttService.updateConfig({ apiKey: config.get('geminiApiKey') || config.get('groqApiKey') });
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

ipcMain.handle('window:minimize', async () => mainWindow && mainWindow.minimize());
ipcMain.handle('window:close', async () => mainWindow && mainWindow.close());
ipcMain.handle('window:toggleAlwaysOnTop', async () => {
  const next = !config.get('alwaysOnTop');
  config.set('alwaysOnTop', next);
  if (mainWindow) mainWindow.setAlwaysOnTop(next);
  return next;
});
ipcMain.handle('shell:openExternal', async (_evt, url) => shell.openExternal(url));

const enrollDir = path.join(app.getPath('userData'), 'enrollment');

ipcMain.handle('enroll:saveFace', async (_evt, { dataUrl }) => {
  try {
    await fs.promises.mkdir(enrollDir, { recursive: true });
    const b64 = String(dataUrl || '').split(',')[1];
    if (!b64) return { ok: false, error: 'No image data' };
    const file = path.join(enrollDir, 'face.png');
    await fs.promises.writeFile(file, Buffer.from(b64, 'base64'));
    config.set('enrollmentFace', true);
    config.set('enrollmentFacePath', file);
    return { ok: true, path: file };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('enroll:saveVoice', async (_evt, { base64, mimeType }) => {
  try {
    await fs.promises.mkdir(enrollDir, { recursive: true });
    const file = path.join(enrollDir, 'voice.webm');
    await fs.promises.writeFile(file, Buffer.from(base64, 'base64'));
    config.set('enrollmentVoice', true);
    config.set('enrollmentVoicePath', file);
    return { ok: true, path: file };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('enroll:status', async () => ({
  face: !!config.get('enrollmentFace'),
  voice: !!config.get('enrollmentVoice'),
  facePath: config.get('enrollmentFacePath') || null,
  complete: !!(config.get('enrollmentFace') && config.get('enrollmentVoice')),
}));

ipcMain.handle('enroll:getFaceDataUrl', async () => {
  try {
    const file = config.get('enrollmentFacePath');
    if (!file) return { ok: false };
    const buf = await fs.promises.readFile(file);
    return { ok: true, dataUrl: 'data:image/png;base64,' + buf.toString('base64') };
  } catch (_) {
    return { ok: false };
  }
});

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
        text: "Sir, storage is getting rather full. Shall I investigate what's using the space?",
        proactive: true,
      });
    }
    if (battery && battery.hasBattery && battery.percent <= 15 && !battery.isCharging && !suggestionState.lowBatteryWarned) {
      suggestionState.lowBatteryWarned = true;
      eventBus.safeEmit('assistant:final', {
        text: 'Battery is down to ' + battery.percent + ' percent. You may want to connect the charger.',
        proactive: true,
      });
    }
    if (battery && battery.isCharging) suggestionState.lowBatteryWarned = false;
    if (load && load.currentLoad >= 90) suggestionState.highCpuStreak += 1;
    else suggestionState.highCpuStreak = 0;
    if (suggestionState.highCpuStreak === 6) {
      eventBus.safeEmit('assistant:final', {
        text: 'Something has been consuming a considerable amount of CPU. Shall I check running processes?',
        proactive: true,
      });
    }
  } catch (err) {
    logger.debug('SYSTEM', 'Proactive check skipped', { error: err.message });
  }
}
let proactiveTimer = null;

app.whenReady().then(() => {
  try {
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
      if (['media', 'microphone', 'camera', 'mediaKeySystem'].includes(permission)) {
        callback(true);
        return;
      }
      callback(false);
    });
    session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
      return ['media', 'microphone', 'camera'].includes(permission);
    });
  } catch (err) {
    console.warn('Permission handler setup failed', err);
  }

  createWindow();
  try { createTray(); } catch (_) {}
  if (config.get('startWithWindows')) {
    app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true });
  }
  proactiveTimer = setInterval(checkProactiveSuggestions, 30 * 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (proactiveTimer) clearInterval(proactiveTimer);
  if (process.platform !== 'darwin') {
    if (!app.isQuitting) return;
    app.quit();
  }
});

process.on('uncaughtException', (err) => {
  logger.error('ERROR', 'Uncaught exception', { error: err.message, stack: err.stack });
});
process.on('unhandledRejection', (err) => {
  logger.error('ERROR', 'Unhandled rejection', { error: (err && err.message) || String(err) });
});
