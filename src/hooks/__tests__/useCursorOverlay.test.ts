// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type * as React from "react";
import type { ToolId } from "../../constants";
import { useCursorOverlay } from "../useCursorOverlay";

type CursorRefs = Parameters<typeof useCursorOverlay>[0];

type Mock2dContext = Pick<CanvasRenderingContext2D, "beginPath" | "clearRect" | "lineTo" | "moveTo" | "rect" | "stroke"> & {
  lineWidth: number;
  strokeStyle: string | CanvasGradient | CanvasPattern;
};

function makeRefs(overrides?: Partial<CursorRefs>): CursorRefs {
  return {
    zoomRef: { current: 1 },
    panRef: { current: { x: 0, y: 0 } },
    cvsRef: {
      current: {
        width: 8,
        height: 8,
        levelData: new Uint8Array(64),
        pixelCandidateOverrideMap: new Uint8Array(64),
      },
    },
    displayWRef: { current: 80 },
    displayHRef: { current: 80 },
    panningRef: { current: false },
    brushSizeRef: { current: 1 },
    toolRef: { current: "brush" as ToolId },
    ...overrides,
  };
}

function pointerEvent(clientX: number, clientY: number): React.PointerEvent {
  return { clientX, clientY } as React.PointerEvent;
}

function mockRect(canvas: HTMLCanvasElement, left: number, top: number) {
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    left,
    top,
    right: left + 80,
    bottom: top + 80,
    width: 80,
    height: 80,
    x: left,
    y: top,
    toJSON: () => ({}),
  });
}

function makeContext(): Mock2dContext {
  return {
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    rect: vi.fn(),
    stroke: vi.fn(),
    lineWidth: 1,
    strokeStyle: "",
  };
}

function installCanvasContexts(contexts: Map<HTMLCanvasElement, Mock2dContext>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- HTMLCanvasElement#getContext has incompatible overloads in tests
  return vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement, contextId: string): any {
    if (contextId !== "2d") return null;
    return contexts.get(this) ?? null;
  });
}

function installRafQueue() {
  const rafCallbacks: FrameRequestCallback[] = [];
  const rafSpy = vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
    rafCallbacks.push(cb);
    return rafCallbacks.length;
  });
  return {
    rafCallbacks,
    rafSpy,
    flushNextFrame() {
      const cb = rafCallbacks.shift();
      if (!cb) throw new Error("No animation frame callback queued");
      act(() => {
        cb(0);
      });
    },
  };
}

describe("useCursorOverlay", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("tracks and clears source and preview cursor positions", () => {
    const refs = makeRefs();
    const status = document.createElement("div");
    status.title = "old status";
    status.textContent = "ready";
    const statusRef = { current: status };
    const cur = document.createElement("canvas");
    const prv = document.createElement("canvas");
    const curCtx = makeContext();
    const prvCtx = makeContext();
    installCanvasContexts(
      new Map([
        [cur, curCtx],
        [prv, prvCtx],
      ]),
    );
    const raf = installRafQueue();
    mockRect(cur, 10, 20);
    mockRect(prv, 100, 120);

    const { result } = renderHook(() => useCursorOverlay(refs, statusRef));
    result.current.curRef.current = cur;
    result.current.prvCurRef.current = prv;

    act(() => {
      result.current.trackCursor(pointerEvent(22, 45));
      result.current.trackCursorPrv(pointerEvent(125, 150));
    });

    expect(result.current.cursorPosRef.current).toEqual({ dx: 12, dy: 25 });
    expect(result.current.prvCursorPosRef.current).toEqual({ dx: 25, dy: 30 });
    expect(raf.rafCallbacks).toHaveLength(1);

    raf.flushNextFrame();
    expect(result.current.cursorRafRef.current).toBeNull();
    expect(curCtx.clearRect).toHaveBeenCalledWith(0, 0, cur.width, cur.height);
    expect(prvCtx.clearRect).toHaveBeenCalledWith(0, 0, prv.width, prv.height);

    act(() => {
      result.current.clearCursor();
      result.current.clearCursorPrv();
    });

    expect(result.current.cursorPosRef.current).toBeNull();
    expect(result.current.prvCursorPosRef.current).toBeNull();
    expect(status.textContent).toBe("\u2014");
    expect(status.title).toBe("");

    raf.flushNextFrame();
    expect(curCtx.clearRect).toHaveBeenCalledTimes(2);
    expect(prvCtx.clearRect).toHaveBeenCalledTimes(2);
  });

  it("coalesces redraws and redraws both overlays when the grid state changes", () => {
    const refs = makeRefs({
      zoomRef: { current: 8 },
      brushSizeRef: { current: 3 },
    });
    const cur = document.createElement("canvas");
    const prv = document.createElement("canvas");
    const curCtx = makeContext();
    const prvCtx = makeContext();
    installCanvasContexts(
      new Map([
        [cur, curCtx],
        [prv, prvCtx],
      ]),
    );
    const raf = installRafQueue();

    const { result } = renderHook(() => useCursorOverlay(refs, { current: null }));
    result.current.curRef.current = cur;
    result.current.prvCurRef.current = prv;

    act(() => {
      result.current.schedCursor();
      result.current.schedCursor();
    });

    expect(raf.rafCallbacks).toHaveLength(1);
    raf.flushNextFrame();
    expect(curCtx.lineTo).toHaveBeenCalled();
    expect(prvCtx.lineTo).toHaveBeenCalled();
  });

  it("snaps grid lines to device-pixel centers", () => {
    const refs = makeRefs({
      zoomRef: { current: 4.25 },
      panRef: { current: { x: 0.1, y: 0 } },
      brushSizeRef: { current: 3 },
    });
    const cur = document.createElement("canvas");
    const ctx = makeContext();
    installCanvasContexts(new Map([[cur, ctx]]));
    const raf = installRafQueue();

    const { result } = renderHook(() => useCursorOverlay(refs, { current: null }));
    result.current.curRef.current = cur;

    act(() => {
      result.current.schedCursor();
    });

    raf.flushNextFrame();
    const firstVerticalX = vi.mocked(ctx.moveTo).mock.calls[0]?.[0] as number | undefined;
    expect(firstVerticalX).toBeDefined();
    expect(firstVerticalX! - Math.floor(firstVerticalX!)).toBeCloseTo(0.5);
    expect(ctx.lineWidth).toBe(0.5);
  });

  it("draws brush, eraser, fill, and shape cursor overlays", () => {
    const refs = makeRefs({ zoomRef: { current: 2 } });
    const cur = document.createElement("canvas");
    const ctx = makeContext();
    installCanvasContexts(new Map([[cur, ctx]]));
    const raf = installRafQueue();
    mockRect(cur, 0, 0);

    const { result } = renderHook(() => useCursorOverlay(refs, { current: null }));
    result.current.curRef.current = cur;

    act(() => {
      result.current.trackCursor(pointerEvent(40, 40));
    });
    raf.flushNextFrame();
    expect(ctx.rect).toHaveBeenCalled();

    vi.mocked(ctx.rect).mockClear();
    vi.mocked(ctx.moveTo).mockClear();
    refs.toolRef.current = "eraser";
    refs.brushSizeRef.current = 5;
    act(() => {
      result.current.schedCursor();
    });
    raf.flushNextFrame();
    expect(ctx.rect).not.toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalled();
    expect(ctx.strokeStyle).toBe("rgba(255,100,100,.8)");

    vi.mocked(ctx.moveTo).mockClear();
    refs.toolRef.current = "fill";
    act(() => {
      result.current.schedCursor();
    });
    raf.flushNextFrame();
    expect(ctx.moveTo).toHaveBeenCalledTimes(2);

    vi.mocked(ctx.moveTo).mockClear();
    refs.toolRef.current = "line";
    act(() => {
      result.current.schedCursor();
    });
    raf.flushNextFrame();
    expect(ctx.moveTo).toHaveBeenCalled();
  });

  it("skips cursor painting while panning and tolerates missing canvases or contexts", () => {
    const refs = makeRefs();
    const cur = document.createElement("canvas");
    const ctx = makeContext();
    const getContextSpy = installCanvasContexts(new Map([[cur, ctx]]));
    const raf = installRafQueue();
    mockRect(cur, 0, 0);

    const { result } = renderHook(() => useCursorOverlay(refs, { current: null }));

    act(() => {
      result.current.trackCursor(pointerEvent(10, 10));
      result.current.trackCursorPrv(pointerEvent(10, 10));
    });
    expect(result.current.cursorPosRef.current).toBeNull();
    expect(result.current.prvCursorPosRef.current).toBeNull();

    result.current.curRef.current = cur;
    refs.panningRef.current = true;
    act(() => {
      result.current.trackCursor(pointerEvent(40, 40));
    });
    raf.flushNextFrame();
    expect(ctx.clearRect).toHaveBeenCalled();
    expect(ctx.beginPath).not.toHaveBeenCalled();

    getContextSpy.mockImplementation(() => null);
    act(() => {
      result.current.schedCursor();
    });
    raf.flushNextFrame();
    expect(ctx.clearRect).toHaveBeenCalledTimes(1);
  });
});
