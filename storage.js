import { get, set, del, keys } from 'idb-keyval';

// Drop-in replacement for window.storage used in Claude artifacts
// Uses IndexedDB under the hood -- works offline, persists across sessions

const storage = {
  async get(key) {
    try {
      const value = await get(key);
      if (value === undefined) return null;
      return { key, value };
    } catch {
      return null;
    }
  },

  async set(key, value) {
    try {
      await set(key, value);
      return { key, value };
    } catch {
      return null;
    }
  },

  async delete(key) {
    try {
      await del(key);
      return { key, deleted: true };
    } catch {
      return null;
    }
  },

  async list(prefix = '') {
    try {
      const allKeys = await keys();
      const filtered = prefix
        ? allKeys.filter(k => typeof k === 'string' && k.startsWith(prefix))
        : allKeys;
      return { keys: filtered };
    } catch {
      return { keys: [] };
    }
  },
};

// Make it globally available (same API as Claude artifact storage)
window.storage = storage;

export default storage;
