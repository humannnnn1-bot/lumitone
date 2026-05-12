import { MAX_IMAGE_SIZE } from "../constants";

const DB_NAME = "chromalum";
const STORE_NAME = "state";
const KEY = "current";
/** Increment when schema changes; add migration logic in onupgradeneeded. */
const DB_VERSION = 2;
/** Increment when the serialized SavedState shape changes. */
export const SAVED_STATE_VERSION = 2;

export interface SavedState {
  w: number;
  h: number;
  data: Uint8Array;
  colorMap?: Uint8Array;
  colorChoiceIndices: number[];
  version: number;
  locked?: boolean[];
}

type RawSavedState = Partial<SavedState> & {
  /** Legacy v1 name for colorChoiceIndices. */
  cc?: number[];
};

type LoadStateStatus = "loaded" | "empty" | "invalid";

interface LoadStateResult {
  status: LoadStateStatus;
  state: SavedState | null;
  reason?: string;
}

interface PersistentStorageResult {
  supported: boolean;
  persisted: boolean;
  requested: boolean;
}

const _db = { conn: null as IDBDatabase | null };

function emptyResult(): LoadStateResult {
  return { status: "empty", state: null };
}

function invalidResult(reason: string): LoadStateResult {
  return { status: "invalid", state: null, reason };
}

function loadedResult(state: SavedState): LoadStateResult {
  return { status: "loaded", state };
}

/** Detect quota-exceeded errors across browsers (Chrome/Safari name + Firefox name + legacy code). */
function isQuotaError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: string }).name ?? "";
  const code = (err as { code?: number }).code;
  return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED" || code === 22 || code === 1014;
}

function openDB(): Promise<IDBDatabase> {
  if (_db.conn) return Promise.resolve(_db.conn);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      const oldVersion = e.oldVersion;
      // v0→v1: create state store
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      }
      // v1→v2: no schema changes, version bump for migration framework
      // Future migrations go here: if (oldVersion < 3) { ... }
    };
    req.onblocked = () => reject(new Error("Database upgrade blocked by another tab. Close other tabs and retry."));
    req.onsuccess = () => {
      _db.conn = req.result;
      _db.conn.onclose = () => {
        _db.conn = null;
      };
      _db.conn.onversionchange = () => {
        _db.conn?.close();
        _db.conn = null;
      };
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
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };
    const rejectWith = (err: DOMException | null) => {
      if (isQuotaError(err)) {
        settle(() => reject(new Error("Storage quota exceeded. Try reducing canvas size or clearing browser data.")));
      } else {
        settle(() => reject(err ?? new Error("Transaction aborted")));
      }
    };
    tx.oncomplete = () => settle(() => resolve());
    tx.onerror = () => rejectWith(tx.error);
    tx.onabort = () => rejectWith(tx.error);
  });
}

/** Check approximate storage usage (returns null if API unavailable). */
export async function checkStorageQuota(): Promise<{ used: number; quota: number } | null> {
  if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.estimate) {
    const est = await navigator.storage.estimate();
    return { used: est.usage ?? 0, quota: est.quota ?? 0 };
  }
  return null;
}

export async function requestPersistentStorage(): Promise<PersistentStorageResult> {
  const storage = typeof navigator !== "undefined" ? navigator.storage : undefined;
  if (!storage?.persist) {
    return { supported: false, persisted: false, requested: false };
  }

  if (storage.persisted && (await storage.persisted())) {
    return { supported: true, persisted: true, requested: false };
  }

  const persisted = await storage.persist();
  return { supported: true, persisted, requested: true };
}

function normalizeLoadedState(val: unknown): LoadStateResult {
  if (!val) return emptyResult();
  if (typeof val !== "object") return invalidResult("saved state is not an object");

  const saved = val as RawSavedState;
  const colorChoiceIndices = Array.isArray(saved.colorChoiceIndices) ? saved.colorChoiceIndices : saved.cc;
  if (
    typeof saved.w !== "number" ||
    typeof saved.h !== "number" ||
    typeof saved.version !== "number" ||
    !(saved.data instanceof Uint8Array) ||
    !Array.isArray(colorChoiceIndices) ||
    colorChoiceIndices.length !== 8
  ) {
    return invalidResult("saved state has an unsupported shape");
  }

  if (!Number.isInteger(saved.version) || saved.version < 1) {
    return invalidResult("saved state version is invalid");
  }

  if (saved.version > SAVED_STATE_VERSION) {
    return invalidResult(`saved state version ${saved.version} is newer than supported version ${SAVED_STATE_VERSION}`);
  }

  if (
    !Number.isInteger(saved.w) ||
    !Number.isInteger(saved.h) ||
    saved.data.length !== saved.w * saved.h ||
    saved.w <= 0 ||
    saved.h <= 0 ||
    saved.w > MAX_IMAGE_SIZE ||
    saved.h > MAX_IMAGE_SIZE
  ) {
    return invalidResult("saved state canvas dimensions are invalid");
  }

  saved.colorChoiceIndices = colorChoiceIndices;
  delete saved.cc;

  // Clamp pixel data to valid range [0, 7] and colorChoiceIndices indices to valid bounds.
  for (let i = 0; i < saved.data.length; i++) {
    if (saved.data[i] > 7) saved.data[i] = saved.data[i] & 7;
  }
  for (let i = 0; i < saved.colorChoiceIndices.length; i++) {
    if (typeof saved.colorChoiceIndices[i] !== "number" || saved.colorChoiceIndices[i] < 0) saved.colorChoiceIndices[i] = 0;
  }
  if (saved.locked && (!Array.isArray(saved.locked) || saved.locked.length !== 8)) {
    delete saved.locked;
  }
  if (saved.colorMap && (!(saved.colorMap instanceof Uint8Array) || saved.colorMap.length !== saved.w * saved.h)) {
    delete saved.colorMap;
  }

  return loadedResult(saved as SavedState);
}

export async function loadStateWithStatus(): Promise<LoadStateResult> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(KEY);
    req.onsuccess = () => {
      resolve(normalizeLoadedState(req.result));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function loadState(): Promise<SavedState | null> {
  return (await loadStateWithStatus()).state;
}

export function resetPersistenceConnectionForTests(): void {
  _db.conn?.close();
  _db.conn = null;
}
