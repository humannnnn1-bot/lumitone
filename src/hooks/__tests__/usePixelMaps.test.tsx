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

    postMessage(req: { id: number; width: number; height: number; mode: string }) {
      MockPixelAnalysisWorker.postedIds.push(req.id);
      MockPixelAnalysisWorker.postedModes.push(req.mode);
      const n = req.width * req.height;
      const delay = MockPixelAnalysisWorker.delays.shift() ?? 0;
      setTimeout(() => {
        if (this.terminated) return;
        const neighborIsolation = new Float32Array(n);
        neighborIsolation[0] = req.id;
        for (const handler of this.messageHandlers) {
          handler({
            data: {
              id: req.id,
              neighborIsolation,
              boundaryDistance: new Float32Array(0),
              gradientAngle: new Float32Array(0),
              gradientMagnitude: new Float32Array(0),
              regionId: new Int32Array(0),
              edgeMask: new Uint8Array(0),
              levelTone: new Float32Array(0),
              localDiversity: new Float32Array(0),
              width: req.width,
              height: req.height,
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

vi.mock("../../workers/pixel-analysis.worker?worker", () => ({
  default: MockPixelAnalysisWorker,
}));

import { usePixelMaps } from "../usePixelMaps";

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
    const canvasData = {
      width: 2,
      height: 2,
      levelData: new Uint8Array([0, 7, 3, 4]),
      pixelCandidateOverrideMap: new Uint8Array(4),
    };
    const { result } = renderHook(() => usePixelMaps(canvasData, "levelTone"));

    await waitFor(() => expect(result.current.levelTone[1]).toBeCloseTo(1));
    expect(result.current.width).toBe(2);
    expect(MockPixelAnalysisWorker.instances).toHaveLength(0);
  });

  it("ignores stale worker responses after inputs change", async () => {
    vi.useFakeTimers();
    MockPixelAnalysisWorker.delays = [50, 0];
    const first = { width: 4, height: 4, levelData: new Uint8Array(16), pixelCandidateOverrideMap: new Uint8Array(16) };
    const second = { width: 6, height: 6, levelData: new Uint8Array(36), pixelCandidateOverrideMap: new Uint8Array(36) };
    const { result, rerender } = renderHook(({ canvasData }) => usePixelMaps(canvasData, "isolation"), {
      initialProps: { canvasData: first },
    });

    await act(async () => {
      rerender({ canvasData: second });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.width).toBe(6);
    expect(result.current.height).toBe(6);
    expect(result.current.neighborIsolation[0]).toBe(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(result.current.width).toBe(6);
    expect(result.current.height).toBe(6);
    expect(result.current.neighborIsolation[0]).toBe(2);
    expect(MockPixelAnalysisWorker.instances).toHaveLength(1);
  });

  it("reuses cached maps when switching back to the same mode on the same canvas", async () => {
    const canvasData = { width: 4, height: 4, levelData: new Uint8Array(16), pixelCandidateOverrideMap: new Uint8Array(16) };
    const initialProps: { mode: "isolation" | "boundaryDistance" } = { mode: "isolation" };
    const { result, rerender } = renderHook(({ mode }: { mode: "isolation" | "boundaryDistance" }) => usePixelMaps(canvasData, mode), {
      initialProps,
    });

    await waitFor(() => expect(result.current.neighborIsolation[0]).toBe(1));

    await act(async () => {
      rerender({ mode: "boundaryDistance" as const });
    });
    await waitFor(() => expect(result.current.neighborIsolation[0]).toBe(2));

    await act(async () => {
      rerender({ mode: "isolation" as const });
    });
    await waitFor(() => expect(result.current.neighborIsolation[0]).toBe(1));
    expect(MockPixelAnalysisWorker.postedIds).toEqual([1, 2]);
    expect(MockPixelAnalysisWorker.instances).toHaveLength(1);
  });

  it("drops cached maps when the canvas data changes", async () => {
    const first = { width: 4, height: 4, levelData: new Uint8Array(16), pixelCandidateOverrideMap: new Uint8Array(16) };
    const second = { width: 4, height: 4, levelData: new Uint8Array(16), pixelCandidateOverrideMap: new Uint8Array(16) };
    const initialProps: { canvasData: typeof first; mode: "isolation" | "boundaryDistance" } = { canvasData: first, mode: "isolation" };
    const { result, rerender } = renderHook(
      ({ canvasData, mode }: { canvasData: typeof first; mode: "isolation" | "boundaryDistance" }) => usePixelMaps(canvasData, mode),
      {
        initialProps,
      },
    );

    await waitFor(() => expect(result.current.neighborIsolation[0]).toBe(1));

    await act(async () => {
      rerender({ canvasData: first, mode: "boundaryDistance" as const });
    });
    await waitFor(() => expect(result.current.neighborIsolation[0]).toBe(2));

    await act(async () => {
      rerender({ canvasData: second, mode: "isolation" as const });
    });
    await waitFor(() => expect(result.current.neighborIsolation[0]).toBe(3));
    expect(MockPixelAnalysisWorker.postedIds).toEqual([1, 2, 3]);
  });

  it("preloads remaining maps in the background when enabled", async () => {
    const canvasData = { width: 4, height: 4, levelData: new Uint8Array(16), pixelCandidateOverrideMap: new Uint8Array(16) };
    const { result } = renderHook(() => usePixelMaps(canvasData, "isolation", true));

    await waitFor(() => expect(result.current.neighborIsolation[0]).toBe(1));
    await waitFor(() =>
      expect(MockPixelAnalysisWorker.postedModes).toEqual([
        "isolation",
        "levelTone",
        "gradient",
        "region",
        "boundaryDistance",
        "diversity",
      ]),
    );
    expect(MockPixelAnalysisWorker.instances).toHaveLength(2);
  });

  it("uses preloaded maps without sending another worker request when switching modes", async () => {
    const canvasData = { width: 4, height: 4, levelData: new Uint8Array(16), pixelCandidateOverrideMap: new Uint8Array(16) };
    const initialProps: { mode: "isolation" | "boundaryDistance" } = { mode: "isolation" };
    const { result, rerender } = renderHook(
      ({ mode }: { mode: "isolation" | "boundaryDistance" }) => usePixelMaps(canvasData, mode, true),
      {
        initialProps,
      },
    );

    await waitFor(() =>
      expect(MockPixelAnalysisWorker.postedModes).toEqual([
        "isolation",
        "levelTone",
        "gradient",
        "region",
        "boundaryDistance",
        "diversity",
      ]),
    );
    const postedBeforeSwitch = MockPixelAnalysisWorker.postedModes.slice();

    await act(async () => {
      rerender({ mode: "boundaryDistance" as const });
    });
    await waitFor(() => expect(result.current.neighborIsolation[0]).toBe(4));
    expect(MockPixelAnalysisWorker.postedModes).toEqual(postedBeforeSwitch);
  });
});
