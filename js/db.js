// ======= db.js — IndexedDB storage (everything stays on this device) =======
const DB_NAME = 'OtterDB';
const DB_VERSION = 5; // v5 adds the generic 'records' store for area tools, research, logs

// Dedicated stores (from earlier versions). Everything else lives in 'records' with a 'kind'.
const CORE_STORES = ['tracks', 'modes', 'templates', 'dayInstances', 'inbox', 'settings', 'shifts', 'areas',
  'boards', 'cards', 'waitingOn', 'deadlines', 'wins', 'clinicalQuestions', 'topics', 'logs'];
const KEY_PATHS = { dayInstances: 'date', shifts: 'date' };

class Database {
  constructor() { this.db = null; }

  init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        for (const name of CORE_STORES) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: KEY_PATHS[name] || 'id' });
        }
        if (!db.objectStoreNames.contains('records')) {
          const st = db.createObjectStore('records', { keyPath: 'id' });
          st.createIndex('kind', 'kind', { unique: false });
        }
      };
      request.onsuccess = (event) => { this.db = event.target.result; resolve(); };
      request.onerror = (event) => reject(event.target.error);
      request.onblocked = () => reject(new Error('The app is open in another tab. Close the other tab and reload.'));
    });
  }

  _req(storeName, mode, fn) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([storeName], mode);
      const request = fn(tx.objectStore(storeName));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  get(storeName, key) { return this._req(storeName, 'readonly', s => s.get(key)); }
  getAll(storeName) { return this._req(storeName, 'readonly', s => s.getAll()); }
  getByKind(kind) { return this._req('records', 'readonly', s => s.index('kind').getAll(kind)); }
  put(storeName, data) { return this._req(storeName, 'readwrite', s => s.put(data)); }
  delete(storeName, key) { return this._req(storeName, 'readwrite', s => s.delete(key)); }
  clear(storeName) { return this._req(storeName, 'readwrite', s => s.clear()); }

  // Writes many items in ONE transaction (fast, all-or-nothing).
  putMany(storeName, items) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([storeName], 'readwrite');
      const st = tx.objectStore(storeName);
      for (const it of items) st.put(it);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async exportData() {
    const stores = Array.from(this.db.objectStoreNames);
    const data = { _otterBackup: true, _exportedAt: new Date().toISOString(), _dbVersion: DB_VERSION };
    for (const store of stores) data[store] = await this.getAll(store);
    return JSON.stringify(data);
  }

  // Adds the items in a merge file (e.g. your publications and videos) WITHOUT replacing your data:
  // items whose id already exists are skipped, so importing the same file twice changes nothing.
  // The one exception: an item that came from an earlier profile file (_profile) and that you have
  // never edited (updatedAt still equals createdAt) is refreshed with the newer version.
  async mergeData(jsonString) {
    let data;
    try { data = JSON.parse(jsonString); } catch (e) { throw new Error('This file is not valid JSON. Nothing was changed.'); }
    if (!data || data._otterMerge !== true) throw new Error('This is not an Otter merge file. (To restore a full backup, use "Import backup".) Nothing was changed.');
    const stores = Array.from(this.db.objectStoreNames).filter(n => n !== 'settings');
    const out = { added: 0, updated: 0, skipped: 0, byStore: {} };
    for (const name of stores) {
      if (!Array.isArray(data[name])) continue;
      const key = KEY_PATHS[name] || 'id';
      for (const item of data[name]) {
        if (!item || !item[key] || (name === 'records' && !item.kind)) { out.skipped++; continue; }
        const old = await this.get(name, item[key]);
        if (old) {
          const unedited = old._profile && item._profile && old.updatedAt === old.createdAt;
          if (unedited && JSON.stringify(old) !== JSON.stringify(item)) { await this.put(name, item); out.updated++; } else out.skipped++;
          continue;
        }
        await this.put(name, item);
        out.added++; out.byStore[name] = (out.byStore[name] || 0) + 1;
      }
    }
    return out;
  }

  // Replaces ALL data with the backup. Validates first, so a wrong file changes nothing.
  async importData(jsonString) {
    let data;
    try { data = JSON.parse(jsonString); } catch (e) { throw new Error('This file is not valid JSON. Nothing was changed.'); }
    if (!data || typeof data !== 'object' || !Array.isArray(data.settings) || !data.settings.find(s => s.id === 'global')) {
      throw new Error('This file is not an Otter backup (no settings found). Nothing was changed.');
    }
    const all = Array.from(this.db.objectStoreNames);
    await new Promise((resolve, reject) => {
      const tx = this.db.transaction(all, 'readwrite');
      for (const name of all) {
        const st = tx.objectStore(name);
        st.clear();
        if (Array.isArray(data[name])) for (const item of data[name]) st.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Import was aborted. Nothing was changed.'));
    });
  }
}

window.DB = new Database();

// Repo: one way to read/write any kind of item, whether it has its own store or lives in 'records'.
const Repo = {
  isCore(kind) { return CORE_STORES.includes(kind); },
  keyOf(kind) { return KEY_PATHS[kind] || 'id'; },
  all(kind) { return Repo.isCore(kind) ? DB.getAll(kind) : DB.getByKind(kind); },
  async get(kind, id) {
    if (Repo.isCore(kind)) return DB.get(kind, id);
    const r = await DB.get('records', id);
    return r && r.kind === kind ? r : undefined;
  },
  prep(kind, obj) {
    if (!Repo.isCore(kind)) obj.kind = kind;
    const key = Repo.keyOf(kind);
    if (!obj[key]) obj[key] = U.uid(kind.slice(0, 4));
    obj.updatedAt = new Date().toISOString();
    if (!obj.createdAt) obj.createdAt = obj.updatedAt;
    return obj;
  },
  async put(kind, obj) {
    Repo.prep(kind, obj);
    await DB.put(Repo.isCore(kind) ? kind : 'records', obj);
    return obj;
  },
  async putMany(kind, list) {
    list.forEach(o => Repo.prep(kind, o));
    await DB.putMany(Repo.isCore(kind) ? kind : 'records', list);
  },
  del(kind, id) { return DB.delete(Repo.isCore(kind) ? kind : 'records', id); }
};
window.Repo = Repo;
