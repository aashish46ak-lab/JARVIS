'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const ALLOWED_BUS_EVENTS = new Set([
  'bus:state:change', 'bus:activity', 'bus:assistant:interim', 'bus:assistant:final',
  'bus:confirmation:request', 'bus:tool:executing', 'bus:tool:result', 'bus:error',
  'bus:assistant:speaking', 'bus:assistant:interrupted',
  'bus:hologram:show', 'bus:hologram:hide', 'bus:hologram:view',
  'bus:update:available',
]);

contextBridge.exposeInMainWorld('jarvis', {
  config: {
    getAll: () => ipcRenderer.invoke('config:getAll'),
    update: (partial) => ipcRenderer.invoke('config:update', partial),
    testAI: () => ipcRenderer.invoke('config:testAI'),
    testVoice: () => ipcRenderer.invoke('config:testVoice'),
  },
  remote: {
    status: () => ipcRenderer.invoke('remote:status'),
    setEnabled: (enabled) => ipcRenderer.invoke('remote:setEnabled', enabled),
    regeneratePin: () => ipcRenderer.invoke('remote:regeneratePin'),
  },
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    apply: () => ipcRenderer.invoke('update:apply'),
  },
  chat: {
    sendMessage: (text) => ipcRenderer.invoke('chat:sendMessage', text),
    resetHistory: () => ipcRenderer.invoke('chat:resetHistory'),
  },
  confirmation: {
    respond: (id, approved) => ipcRenderer.invoke('confirmation:respond', { id, approved }),
  },
  voice: {
    transcribeFallback: (base64, mimeType) =>
      ipcRenderer.invoke('voice:transcribeFallback', { base64, mimeType }),
  },
  tts: {
    synthesize: (text) => ipcRenderer.invoke('tts:synthesize', text),
  },
  enroll: {
    saveFace: (dataUrl) => ipcRenderer.invoke('enroll:saveFace', { dataUrl }),
    saveVoice: (base64, mimeType) => ipcRenderer.invoke('enroll:saveVoice', { base64, mimeType }),
    status: () => ipcRenderer.invoke('enroll:status'),
    getFaceDataUrl: () => ipcRenderer.invoke('enroll:getFaceDataUrl'),
  },
  memory: {
    list: () => ipcRenderer.invoke('memory:list'),
    save: (key, value) => ipcRenderer.invoke('memory:save', { key, value }),
    forgetById: (id) => ipcRenderer.invoke('memory:forgetById', id),
    clear: () => ipcRenderer.invoke('memory:clear'),
  },
  system: {
    getStatus: () => ipcRenderer.invoke('system:getStatus'),
  },
  logs: {
    getRecent: (limit) => ipcRenderer.invoke('logs:getRecent', limit),
    export: () => ipcRenderer.invoke('logs:export'),
  },
  win: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    close: () => ipcRenderer.invoke('window:close'),
    toggleAlwaysOnTop: () => ipcRenderer.invoke('window:toggleAlwaysOnTop'),
  },
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  },
  events: {
    on(channel, callback) {
      const full = 'bus:' + channel;
      if (!ALLOWED_BUS_EVENTS.has(full)) {
        console.warn('Channel not allowed:', channel);
        return function () {};
      }
      const listener = function (_evt, payload) { callback(payload); };
      ipcRenderer.on(full, listener);
      return function () { ipcRenderer.removeListener(full, listener); };
    },
  },
});
