const DB_NAME = "chromalum";
const STORE_NAME = "state";
const KEY = "current";

export interface SavedState {
  w: number;
  h: number;
  data: Uint8Array;
  colorMap?: Uint8Array;
  cc: number[];
  version: number;
  locked?: boolean[];
}

const _db = { conn: null as IDBDatabase | null };

function openDB(): Promise<IDBDatabase> {
  if (_db.conn) return Promise.resolve(_db.conn);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => {
      _db.conn = req.result;
      _db.conn.onclose = () => { _db.conn = null; };
      resolve(_db.conn);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveState(state: SavedState): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(state, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => {
      const err = tx.error;
      // Detect quota exceeded (DOMException name "QuotaExceededError")
      if (err && err.name === "QuotaExceededError") {
        reject(new Error("Storage quota exceeded. Try reducing canvas size or clearing browser data."));
      } else {
        reject(err);
      }
    };
  });
}

/** Check approximate storage usage (returns null if API unavailable). */
export async function checkStorageQuota(): Promise<{ used: number; quota: number } | null> {
  if (navigator.storage && navigator.storage.estimate) {
    const est = await navigator.storage.estimate();
    return { used: est.usage ?? 0, quota: est.quota ?? 0 };
  }
  return null;
}

export async function loadState(): Promise<SavedState | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(KEY);
    req.onsuccess = () => {
      const val = req.result;
      if (!val || typeof val.w !== "number" || typeof val.h !== "number"
        || typeof val.version !== "number"
        || !(val.data instanceof Uint8Array) || !Array.isArray(val.cc) || val.cc.length !== 8
        || val.data.length !== val.w * val.h
        || val.w <= 0 || val.h <= 0 || val.w > 1024 || val.h > 1024) {
        resolve(null);
        return;
      }
      // Clamp pixel data to valid range [0, 7] and cc indices to valid bounds
      for (let i = 0; i < val.data.length; i++) {
        if (val.data[i] > 7) val.data[i] = val.data[i] & 7;
      }
      for (let i = 0; i < val.cc.length; i++) {
        if (typeof val.cc[i] !== "number" || val.cc[i] < 0) val.cc[i] = 0;
      }
      if (val.locked && (!Array.isArray(val.locked) || val.locked.length !== 8)) {
        val.locked = undefined;
      }
      // Validate colorMap (optional, backward compatible)
      if (val.colorMap && (!(val.colorMap instanceof Uint8Array) || val.colorMap.length !== val.w * val.h)) {
        val.colorMap = undefined;
      }
      resolve(val as SavedState);
    };
    req.onerror = () => reject(req.error);
  });
}
