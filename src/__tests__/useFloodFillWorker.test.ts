// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

const { MockWorker } = vi.hoisted(() => {
  class MockWorker {
    static nextModes: ("throw" | "hang" | "error" | "success")[] = [];
    static instances: MockWorker[] = [];

    mode: "throw" | "hang" | "error" | "success";
    terminated = false;
    private messageHandlers = new Set<(event: MessageEvent) => void>();
    private errorHandlers = new Set<(event: ErrorEvent) => void>();

    constructor() {
      this.mode = MockWorker.nextModes.shift() ?? "throw";
      if (this.mode === "throw") throw new Error("Worker not available in test");
      MockWorker.instances.push(this);
    }

    addEventListener(type: string, handler: EventListenerOrEventListenerObject) {
      if (typeof handler !== "function") return;
      if (type === "message") this.messageHandlers.add(handler as (event: MessageEvent) => void);
      if (type === "error") this.errorHandlers.add(handler as (event: ErrorEvent) => void);
    }

    removeEventListener(type: string, handler: EventListenerOrEventListenerObject) {
      if (typeof handler !== "function") return;
      if (type === "message") this.messageHandlers.delete(handler as (event: MessageEvent) => void);
      if (type === "error") this.errorHandlers.delete(handler as (event: ErrorEvent) => void);
    }

    postMessage(req: { id: number; kind: "canvas" | "glaze"; data: Uint8Array; newVal: number; colorMap?: Uint8Array; newCmVal?: number }) {
      if (this.mode === "hang") return;
      if (this.mode === "error") {
        setTimeout(() => {
          if (this.terminated) return;
          for (const handler of this.errorHandlers) handler({ message: "Worker error" } as ErrorEvent);
        }, 0);
        return;
      }

      setTimeout(() => {
        if (this.terminated) return;
        if (req.kind === "glaze") {
          const colorMap = req.colorMap ?? new Uint8Array(0);
          if (colorMap.length > 0) colorMap[0] = req.newCmVal ?? colorMap[0];
          for (const handler of this.messageHandlers) {
            handler({
              data: { id: req.id, data: req.data, colorMap, changed: new Uint32Array([0]), truncated: false },
            } as MessageEvent);
          }
          return;
        }

        if (req.data.length > 0) req.data[0] = req.newVal;
        for (const handler of this.messageHandlers) {
          handler({
            data: { id: req.id, data: req.data, changed: new Uint32Array([0]), truncated: false },
          } as MessageEvent);
        }
      }, 0);
    }

    terminate() {
      this.terminated = true;
    }
  }

  return { MockWorker };
});

vi.mock("../workers/flood-fill.worker?worker", () => ({
  default: MockWorker,
}));

import { useFloodFillWorker } from "../hooks/useFloodFillWorker";

describe("useFloodFillWorker", () => {
  beforeEach(() => {
    MockWorker.nextModes = [];
    MockWorker.instances = [];
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("small canvas (w*h < 10000) uses sync fallback", async () => {
    const { result } = renderHook(() => useFloodFillWorker());
    const w = 50,
      h = 50; // 2500 < 10000
    const buf = new Uint8Array(w * h).fill(3);
    const fillResult = await result.current.requestCanvasFill(buf, 0, 0, 5, w, h);
    expect(fillResult).toBeDefined();
    expect(fillResult.data).toBeInstanceOf(Uint8Array);
    expect(fillResult.changed).toBeInstanceOf(Uint32Array);
    expect(typeof fillResult.truncated).toBe("boolean");
    expect(MockWorker.instances).toHaveLength(0);
  });

  it("sync fallback returns correct result for small fill", async () => {
    const { result } = renderHook(() => useFloodFillWorker());
    const w = 5,
      h = 5;
    const buf = new Uint8Array(w * h).fill(2);
    const fillResult = await result.current.requestCanvasFill(buf, 0, 0, 4, w, h);
    expect(fillResult.changed.length).toBe(w * h);
    expect(fillResult.data[0]).toBe(4);
  });

  it("recreates the worker after a timeout", async () => {
    vi.useFakeTimers();
    MockWorker.nextModes = ["hang", "success"];
    const { result } = renderHook(() => useFloodFillWorker());
    const w = 120,
      h = 120; // 14400 > 10000

    const hungRequest = result.current.requestCanvasFill(new Uint8Array(w * h).fill(1), 0, 0, 3, w, h);
    const hungAssertion = expect(hungRequest).rejects.toThrow("Flood fill timed out");
    await vi.advanceTimersByTimeAsync(10_000);
    await hungAssertion;
    expect(MockWorker.instances).toHaveLength(1);
    expect(MockWorker.instances[0].terminated).toBe(true);

    const nextRequest = result.current.requestCanvasFill(new Uint8Array(w * h).fill(1), 0, 0, 4, w, h);
    await vi.runOnlyPendingTimersAsync();
    await expect(nextRequest).resolves.toMatchObject({ truncated: false });
    expect(MockWorker.instances).toHaveLength(2);
  });

  it("recreates the worker after an error", async () => {
    vi.useFakeTimers();
    MockWorker.nextModes = ["error", "success"];
    const { result } = renderHook(() => useFloodFillWorker());
    const w = 120,
      h = 120;

    const failedRequest = result.current.requestGlazeFill(new Uint8Array(w * h), new Uint8Array(w * h), 0, 0, 2, w, h);
    const failedAssertion = expect(failedRequest).rejects.toThrow("Worker error");
    await vi.runOnlyPendingTimersAsync();
    await failedAssertion;
    expect(MockWorker.instances).toHaveLength(1);
    expect(MockWorker.instances[0].terminated).toBe(true);

    const nextRequest = result.current.requestGlazeFill(new Uint8Array(w * h), new Uint8Array(w * h), 0, 0, 3, w, h);
    await vi.runOnlyPendingTimersAsync();
    await expect(nextRequest).resolves.toMatchObject({ truncated: false });
    expect(MockWorker.instances).toHaveLength(2);
  });
});
