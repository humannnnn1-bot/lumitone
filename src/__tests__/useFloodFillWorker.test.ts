// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFloodFillWorker } from "../hooks/useFloodFillWorker";

// Mock the Worker import so it throws (forcing sync fallback)
vi.mock("../workers/flood-fill.worker?worker", () => {
  return {
    default: class MockWorker {
      constructor() {
        throw new Error("Worker not available in test");
      }
    },
  };
});

describe("useFloodFillWorker", () => {
  it("small canvas (w*h < 10000) uses sync fallback", async () => {
    const { result } = renderHook(() => useFloodFillWorker());
    const w = 50, h = 50; // 2500 < 10000
    const buf = new Uint8Array(w * h).fill(3);
    // Set a starting pixel to a different value than newVal
    buf[0] = 3;
    const fillResult = await result.current.requestCanvasFill(buf, 0, 0, 5, w, h);
    // Should resolve (sync fallback) without error
    expect(fillResult).toBeDefined();
    expect(fillResult.data).toBeInstanceOf(Uint8Array);
    expect(fillResult.changed).toBeInstanceOf(Uint32Array);
    expect(typeof fillResult.truncated).toBe("boolean");
  });

  it("sync fallback returns correct result for small fill", async () => {
    const { result } = renderHook(() => useFloodFillWorker());
    const w = 5, h = 5;
    const buf = new Uint8Array(w * h).fill(2);
    // Fill from (0,0) changing level 2 -> 4
    const fillResult = await result.current.requestCanvasFill(buf, 0, 0, 4, w, h);
    // All pixels should have changed since they were all the same level
    expect(fillResult.changed.length).toBe(w * h);
    // The buffer should now contain the new value
    expect(fillResult.data[0]).toBe(4);
  });
});
