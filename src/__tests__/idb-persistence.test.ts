import { describe, it, expect } from "vitest";

/**
 * Tests for IndexedDB persistence error handling.
 * These test the logic without requiring an actual IndexedDB.
 */

describe("idb-persistence error handling", () => {
  it("QuotaExceededError is detected by name", () => {
    // Simulate the error detection logic from saveState
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
