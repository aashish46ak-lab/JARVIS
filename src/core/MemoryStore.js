'use strict';

const Store = require('electron-store');

class MemoryStore {
  constructor() {
    this.store = new Store({ name: 'jarvis-memory', defaults: { items: [] } });
  }

  list() {
    return this.store.get('items') || [];
  }

  save(key, value) {
    const items = this.list();
    const existing = items.findIndex((i) => i.key === key);
    const entry = { id: Date.now().toString(36), key, value, updatedAt: new Date().toISOString() };
    if (existing >= 0) items[existing] = entry;
    else items.push(entry);
    this.store.set('items', items);
    return entry;
  }

  forgetById(id) {
    const items = this.list().filter((i) => i.id !== id);
    this.store.set('items', items);
    return true;
  }

  clear() {
    this.store.set('items', []);
  }

  getRelevant(query, limit = 5) {
    const items = this.list();
    const q = (query || '').toLowerCase();
    return items
      .filter((i) => i.key.toLowerCase().includes(q) || String(i.value).toLowerCase().includes(q))
      .slice(0, limit);
  }
}

module.exports = MemoryStore;
