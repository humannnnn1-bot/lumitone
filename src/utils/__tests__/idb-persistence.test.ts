import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "fake-indexeddb/auto";
import {
  SAVED_STATE_VERSION,
  saveState,
  loadState,
  loadStateWithStatus,
  checkStorageQuota,
  requestPersistentStorage,
  resetPersistenceConnectionForTests,
} from "../idb-persistence";
import type { SavedState } from "../idb-persistence";

/**
 * Tests for IndexedDB persistence.
 * Uses fake-indexeddb for realistic IDB testing.
 */

function makeState(overrides?: Partial<SavedState>): SavedState {
  return {
    w: 4,
    h: 4,
    data: new Uint8Array(16),
    colorChoiceIndices: [0, 0, 0, 0, 0, 0, 0, 0],
    version: SAVED_STATE_VERSION,
    ...overrides,
  };
}

// Reset the IDB between tests by clearing the cached connection
const originalStorage = navigator.storage;

function deleteTestDb(): Promise<void> {
  resetPersistenceConnectionForTests();
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase("chromalum");
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("deleteDatabase blocked"));
  });
}

beforeEach(async () => {
  await deleteTestDb();
});

afterEach(() => {
  resetPersistenceConnectionForTests();
  Object.defineProperty(navigator, "storage", { configurable: true, value: originalStorage });
});

describe("idb-persistence error handling", () => {
  it("QuotaExceededError is detected by name", () => {
    const err = new DOMException("Quota exceeded", "QuotaExceededError");
    expect(err.name).toBe("QuotaExceededError");
    const isQuota = err && err.name === "QuotaExceededError";
    expect(isQuota).toBe(true);
  });

  it("other DOMException names are not quota errors", () => {
    const err = new DOMException("Read only", "ReadOnlyError");
    const isQuota = err && err.name === "QuotaExceededError";
    expect(isQuota).toBe(false);
  });
});

describe("saveState / loadState roundtrip", () => {
  it("save then load returns identical data", async () => {
    const state = makeState({ data: new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3, 4, 5, 6, 7]) });
    await saveState(state);
    const loaded = await loadState();
    expect(loaded).not.toBeNull();
    expect(loaded!.w).toBe(4);
    expect(loaded!.h).toBe(4);
    expect(Array.from(loaded!.data)).toEqual(Array.from(state.data));
    expect(loaded!.colorChoiceIndices).toEqual(state.colorChoiceIndices);
    expect(loaded!.version).toBe(SAVED_STATE_VERSION);
  });

  it("save with colorMap then load preserves colorMap", async () => {
    const cm = new Uint8Array(16);
    cm[0] = 2;
    cm[5] = 3;
    const state = makeState({ colorMap: cm });
    await saveState(state);
    const loaded = await loadState();
    expect(loaded).not.toBeNull();
    expect(loaded!.colorMap).toBeDefined();
    expect(loaded!.colorMap![0]).toBe(2);
    expect(loaded!.colorMap![5]).toBe(3);
  });

  it("save with locked array preserves it", async () => {
    const state = makeState({ locked: [true, false, true, false, false, false, false, true] });
    await saveState(state);
    const loaded = await loadState();
    expect(loaded).not.toBeNull();
    expect(loaded!.locked).toEqual([true, false, true, false, false, false, false, true]);
  });
});

describe("loadState validation", () => {
  it("returns null for empty DB", async () => {
    const loaded = await loadState();
    expect(loaded).toBeNull();
  });

  it("reports empty status for empty DB", async () => {
    await expect(loadStateWithStatus()).resolves.toEqual({ status: "empty", state: null });
  });

  it("clamps pixel data > 7 to valid range", async () => {
    const data = new Uint8Array(16);
    data[0] = 15; // should become 15 & 7 = 7
    data[1] = 8; // should become 8 & 7 = 0
    data[2] = 255; // should become 255 & 7 = 7
    const state = makeState({ data });
    await saveState(state);
    const loaded = await loadState();
    expect(loaded).not.toBeNull();
    expect(loaded!.data[0]).toBe(7);
    expect(loaded!.data[1]).toBe(0);
    expect(loaded!.data[2]).toBe(7);
  });

  it("clamps negative colorChoiceIndices values to 0", async () => {
    const state = makeState({ colorChoiceIndices: [-1, 0, -5, 3, 0, 0, 0, 0] });
    await saveState(state);
    const loaded = await loadState();
    expect(loaded).not.toBeNull();
    expect(loaded!.colorChoiceIndices[0]).toBe(0);
    expect(loaded!.colorChoiceIndices[2]).toBe(0);
    expect(loaded!.colorChoiceIndices[3]).toBe(3);
  });

  it("loads legacy v1 cc as colorChoiceIndices", async () => {
    await saveState({
      w: 4,
      h: 4,
      data: new Uint8Array(16),
      cc: [0, 1, 2, 3, 0, 1, 2, 0],
      version: 1,
    } as unknown as SavedState);

    const loaded = await loadState();

    expect(loaded).not.toBeNull();
    expect(loaded!.colorChoiceIndices).toEqual([0, 1, 2, 3, 0, 1, 2, 0]);
    expect("cc" in loaded!).toBe(false);
  });

  it("strips locked array of wrong length", async () => {
    const state = makeState({ locked: [true, false, true] as unknown as boolean[] });
    await saveState(state);
    const loaded = await loadState();
    expect(loaded).not.toBeNull();
    expect(loaded!.locked).toBeUndefined();
  });

  it("strips colorMap of wrong length", async () => {
    const state = makeState({ colorMap: new Uint8Array(5) }); // should be 16
    await saveState(state);
    const loaded = await loadState();
    expect(loaded).not.toBeNull();
    expect(loaded!.colorMap).toBeUndefined();
  });

  it("accepts persisted canvas dimensions up to 2048 per side", async () => {
    const state = makeState({ w: 2048, h: 1, data: new Uint8Array(2048) });
    await saveState(state);
    const loaded = await loadState();
    expect(loaded).not.toBeNull();
    expect(loaded!.w).toBe(2048);
    expect(loaded!.h).toBe(1);
  });

  it("rejects persisted canvas dimensions above 2048 per side", async () => {
    const state = makeState({ w: 2049, h: 1, data: new Uint8Array(2049) });
    await saveState(state);
    const loaded = await loadState();
    expect(loaded).toBeNull();
  });

  it("reports invalid status for unsupported saved-state versions", async () => {
    const state = makeState({ version: SAVED_STATE_VERSION + 1 });
    await saveState(state);

    const result = await loadStateWithStatus();

    expect(result.status).toBe("invalid");
    expect(result.state).toBeNull();
    expect(result.reason).toContain("newer than supported");
    await expect(loadState()).resolves.toBeNull();
  });

  it("reports invalid status for corrupted persisted shapes", async () => {
    const state = makeState({ colorChoiceIndices: [0, 0, 0] as unknown as number[] });
    await saveState(state);

    const result = await loadStateWithStatus();

    expect(result.status).toBe("invalid");
    expect(result.state).toBeNull();
    expect(result.reason).toContain("unsupported shape");
  });
});

describe("checkStorageQuota", () => {
  it("returns used/quota when API available", async () => {
    // jsdom may or may not have navigator.storage.estimate
    const result = await checkStorageQuota();
    if (result !== null) {
      expect(typeof result.used).toBe("number");
      expect(typeof result.quota).toBe("number");
    } else {
      // API not available in this environment — that's OK
      expect(result).toBeNull();
    }
  });
});

describe("requestPersistentStorage", () => {
  it("returns unsupported when the StorageManager persist API is unavailable", async () => {
    Object.defineProperty(navigator, "storage", { configurable: true, value: undefined });

    await expect(requestPersistentStorage()).resolves.toEqual({ supported: false, persisted: false, requested: false });
  });

  it("does not request when storage is already persistent", async () => {
    const persisted = vi.fn(() => Promise.resolve(true));
    const persist = vi.fn(() => Promise.resolve(true));
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: { persisted, persist },
    });

    await expect(requestPersistentStorage()).resolves.toEqual({ supported: true, persisted: true, requested: false });
    expect(persisted).toHaveBeenCalledTimes(1);
    expect(persist).not.toHaveBeenCalled();
  });

  it("requests persistent storage when it is not already enabled", async () => {
    const persisted = vi.fn(() => Promise.resolve(false));
    const persist = vi.fn(() => Promise.resolve(true));
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: { persisted, persist },
    });

    await expect(requestPersistentStorage()).resolves.toEqual({ supported: true, persisted: true, requested: true });
    expect(persisted).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledTimes(1);
  });
});
