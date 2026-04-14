// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const { MockPixelAnalysisWorker } = vi.hoisted(() => {
  class MockPixelAnalysisWorker {
    static delays: number[] = [];
    static instances: MockPixelAnalysisWorker[] = [];
    static postedIds: number[] = [];
    static postedModes: string[] = [];

    private messageHandlers = new Set<(event: MessageEvent) => void>();
    private errorHandlers = new Set<(event: ErrorEvent) => void>();
    terminated = false;

    constructor() {
      MockPixelAnalysisWorker.instances.push(this);
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

    postMessage(req: { id: number; w: number; h: number; mode: string }) {
      MockPixelAnalysisWorker.postedIds.push(req.id);
      MockPixelAnalysisWorker.postedModes.push(req.mode);
      const n = req.w * req.h;
      const delay = MockPixelAnalysisWorker.delays.shift() ?? 0;
      setTimeout(() => {
        if (this.terminated) return;
        const noise = new Float32Array(n);
        noise[0] = req.id;
        for (const handler of this.messageHandlers) {
          handler({
            data: {
              id: req.id,
              noise,
              depth: new Float32Array(0),
              gradAngle: new Float32Array(0),
              gradMag: new Float32Array(0),
              regionId: new Int32Array(0),
              isEdge: new Uint8Array(0),
              levelNorm: new Float32Array(0),
              localDiversity: new Float32Array(0),
              w: req.w,
              h: req.h,
            },
          } as MessageEvent);
        }
      }, delay);
    }

    terminate() {
      this.terminated = true;
    }
  }

  return { MockPixelAnalysisWorker };
});

vi.mock("../workers/pixel-analysis.worker?worker", () => ({
  default: MockPixelAnalysisWorker,
}));

import { usePixelMaps } from "../hooks/usePixelMaps";

describe("usePixelMaps", () => {
  beforeEach(() => {
    MockPixelAnalysisWorker.delays = [];
    MockPixelAnalysisWorker.instances = [];
    MockPixelAnalysisWorker.postedIds = [];
    MockPixelAnalysisWorker.postedModes = [];
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("computes lightweight modes synchronously without creating a worker", async () => {
    const cvs = {
      w: 2,
      h: 2,
      data: new Uint8Array([0, 7, 3, 4]),
      colorMap: new Uint8Array(4),
    };
    const { result } = renderHook(() => usePixelMaps(cvs, "luminance"));

    await waitFor(() => expect(result.current.levelNorm[1]).toBeCloseTo(1));
    expect(result.current.w).toBe(2);
    expect(MockPixelAnalysisWorker.instances).toHaveLength(0);
  });

  it("ignores stale worker responses after inputs change", async () => {
    vi.useFakeTimers();
    MockPixelAnalysisWorker.delays = [50, 0];
    const first = { w: 4, h: 4, data: new Uint8Array(16), colorMap: new Uint8Array(16) };
    const second = { w: 6, h: 6, data: new Uint8Array(36), colorMap: new Uint8Array(36) };
    const { result, rerender } = renderHook(({ cvs }) => usePixelMaps(cvs, "noise"), { initialProps: { cvs: first } });

    await act(async () => {
      rerender({ cvs: second });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.w).toBe(6);
    expect(result.current.h).toBe(6);
    expect(result.current.noise[0]).toBe(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(result.current.w).toBe(6);
    expect(result.current.h).toBe(6);
    expect(result.current.noise[0]).toBe(2);
    expect(MockPixelAnalysisWorker.instances).toHaveLength(1);
  });

  it("reuses cached maps when switching back to the same mode on the same canvas", async () => {
    const cvs = { w: 4, h: 4, data: new Uint8Array(16), colorMap: new Uint8Array(16) };
    const initialProps: { mode: "noise" | "depth" } = { mode: "noise" };
    const { result, rerender } = renderHook(({ mode }: { mode: "noise" | "depth" }) => usePixelMaps(cvs, mode), { initialProps });

    await waitFor(() => expect(result.current.noise[0]).toBe(1));

    await act(async () => {
      rerender({ mode: "depth" as const });
    });
    await waitFor(() => expect(result.current.noise[0]).toBe(2));

    await act(async () => {
      rerender({ mode: "noise" as const });
    });
    await waitFor(() => expect(result.current.noise[0]).toBe(1));
    expect(MockPixelAnalysisWorker.postedIds).toEqual([1, 2]);
    expect(MockPixelAnalysisWorker.instances).toHaveLength(1);
  });

  it("drops cached maps when the canvas data changes", async () => {
    const first = { w: 4, h: 4, data: new Uint8Array(16), colorMap: new Uint8Array(16) };
    const second = { w: 4, h: 4, data: new Uint8Array(16), colorMap: new Uint8Array(16) };
    const initialProps: { cvs: typeof first; mode: "noise" | "depth" } = { cvs: first, mode: "noise" };
    const { result, rerender } = renderHook(({ cvs, mode }: { cvs: typeof first; mode: "noise" | "depth" }) => usePixelMaps(cvs, mode), {
      initialProps,
    });

    await waitFor(() => expect(result.current.noise[0]).toBe(1));

    await act(async () => {
      rerender({ cvs: first, mode: "depth" as const });
    });
    await waitFor(() => expect(result.current.noise[0]).toBe(2));

    await act(async () => {
      rerender({ cvs: second, mode: "noise" as const });
    });
    await waitFor(() => expect(result.current.noise[0]).toBe(3));
    expect(MockPixelAnalysisWorker.postedIds).toEqual([1, 2, 3]);
  });

  it("preloads remaining maps in the background when enabled", async () => {
    const cvs = { w: 4, h: 4, data: new Uint8Array(16), colorMap: new Uint8Array(16) };
    const { result } = renderHook(() => usePixelMaps(cvs, "noise", true));

    await waitFor(() => expect(result.current.noise[0]).toBe(1));
    await waitFor(() =>
      expect(MockPixelAnalysisWorker.postedModes).toEqual(["noise", "luminance", "region", "gradient", "depth", "entropy"]),
    );
    expect(MockPixelAnalysisWorker.instances).toHaveLength(2);
  });

  it("uses preloaded maps without sending another worker request when switching modes", async () => {
    const cvs = { w: 4, h: 4, data: new Uint8Array(16), colorMap: new Uint8Array(16) };
    const initialProps: { mode: "noise" | "depth" } = { mode: "noise" };
    const { result, rerender } = renderHook(({ mode }: { mode: "noise" | "depth" }) => usePixelMaps(cvs, mode, true), { initialProps });

    await waitFor(() =>
      expect(MockPixelAnalysisWorker.postedModes).toEqual(["noise", "luminance", "region", "gradient", "depth", "entropy"]),
    );
    const postedBeforeSwitch = MockPixelAnalysisWorker.postedModes.slice();

    await act(async () => {
      rerender({ mode: "depth" as const });
    });
    await waitFor(() => expect(result.current.noise[0]).toBe(4));
    expect(MockPixelAnalysisWorker.postedModes).toEqual(postedBeforeSwitch);
  });
});
