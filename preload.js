'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const ALLOWED_BUS_EVENTS = new Set([
  'bus:state:change', 'bus:activity', 'bus:assistant:interim', 'bus:assistant:final',
  'bus:confirmation:request', 'bus:tool:executing', 'bus:tool:result', 'bus:error',
  'bus:assistant:speaking', 'bus:assistant:interrupted',
]);

contextBridge.exposeInMainWorld('jarvis', {
  config: {
    getAll: () => ipcRenderer.invoke('config:getAll'),
    update: (partial) => ipcRenderer.invoke('config:update', partial),
    testAI: () => ipcRenderer.invoke('config:testAI'),
    testVoice: () => ipcRenderer.invoke('config:testVoice'),
  },
  chat: {
    sendMessage: (text) => ipcRenderer.invoke('chat:sendMessage', text),
    resetHistory: () => ipcRenderer.invoke('chat:resetHistory'),
  },
  confirmation: {
    respond: (id, approved) => ipcRenderer.invoke('confirmation:respond', { id, approved }),
  },
  voice: {
    transcribeFallback: (base64, mimeType) => ipcRenderer.invoke('voice:transcribeFallback', { base64, mimeType }),
  },
  tts: {
    synthesize: (text) => ipcRenderer.invoke('tts:synthesize', text),
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
    /** Subscribe to a whitelisted EventBus channel forwarded from main. Returns an unsubscribe fn. */
    on(channel, callback) {
      const full = `bus:${channel}`;
      if (!ALLOWED_BUS_EVENTS.has(full)) {
        throw new Error(`Channel "${channel}" is not on the allowed list.`);
      }
      const listener = (_evt, payload) => callback(payload);
      ipcRenderer.on(full, listener);
      return () => ipcRenderer.removeListener(full, listener);
    },
  },
});
