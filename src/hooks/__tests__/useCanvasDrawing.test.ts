// @vitest-environment jsdom
import { beforeEach, describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCanvasDrawing } from "../useCanvasDrawing";
import { renderBuf } from "../../drawing/render-buf";
import type { CanvasData } from "../../types";
import type { ToolId } from "../../constants";

/* ── Mocks ──────────────────────────────────── */

const mockStartPan = vi.fn();
const mockMovePan = vi.fn();
const mockEndPan = vi.fn();
const mockAnnounce = vi.fn();
const mockPanningRef = { current: false };
const mockSpaceRef = { current: false };

vi.mock("../../state/DrawingContext", () => ({
  useDrawingContext: () => ({
    displayW: 320,
    displayH: 320,
    panningRef: mockPanningRef,
    spaceRef: mockSpaceRef,
    zoomRef: { current: 1 },
    panRef: { current: { x: 0, y: 0 } },
    startPan: mockStartPan,
    movePan: mockMovePan,
    endPan: mockEndPan,
    announce: mockAnnounce,
    t: (k: string) => k,
  }),
}));

vi.mock("../useFloodFillWorker", () => ({
  useFloodFillWorker: () => ({
    requestCanvasFill: vi.fn(() => Promise.resolve({ data: new Uint8Array(100), changed: new Uint32Array(0), truncated: false })),
  }),
}));

vi.mock("../useCursorOverlay", () => ({
  useCursorOverlay: () => ({
    curRef: { current: document.createElement("canvas") },
    prvCurRef: { current: document.createElement("canvas") },
    cursorRafRef: { current: null },
    schedCursorRef: { current: null },
    cursorPosRef: { current: null },
    trackCursor: vi.fn(),
    clearCursor: vi.fn(),
    trackCursorPrv: vi.fn(),
    clearCursorPrv: vi.fn(),
  }),
}));

vi.mock("../../drawing/render-buf", () => ({
  renderBuf: vi.fn(),
}));

function makeCvs(w = 10, h = 10): CanvasData {
  return {
    w,
    h,
    data: new Uint8Array(w * h),
    colorMap: new Uint8Array(w * h),
  };
}

function makeOpts(overrides?: Partial<Parameters<typeof useCanvasDrawing>[0]>) {
  return {
    cvs: makeCvs(),
    dispatch: vi.fn(),
    colorLUT: Array.from({ length: 8 }, () => [128, 128, 128] as [number, number, number]),
    cc: [0, 0, 0, 0, 0, 0, 0, 0],
    brushLevel: 3,
    brushSize: 1,
    tool: "brush" as ToolId,
    prvRef: { current: null as HTMLCanvasElement | null },
    setBrushLevel: vi.fn(),
    ...overrides,
  };
}

function mockCanvasRect(canvas: HTMLCanvasElement) {
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    right: 320,
    bottom: 320,
    width: 320,
    height: 320,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

function pointerEvent(overrides?: Partial<React.PointerEvent>): React.PointerEvent {
  const clientX = overrides?.clientX ?? 160;
  const clientY = overrides?.clientY ?? 160;
  return {
    button: 0,
    altKey: false,
    pointerId: 1,
    target: { setPointerCapture: vi.fn() },
    clientX,
    clientY,
    preventDefault: vi.fn(),
    nativeEvent: { clientX, clientY },
    ...overrides,
  } as unknown as React.PointerEvent;
}

/* ── Tests ──────────────────────────────────── */

describe("useCanvasDrawing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPanningRef.current = false;
    mockSpaceRef.current = false;
  });

  it("onUp during pan calls endPan", () => {
    const { result } = renderHook(() => useCanvasDrawing(makeOpts()));
    mockPanningRef.current = true;
    act(() => {
      result.current.onUp();
    });
    expect(mockEndPan).toHaveBeenCalled();
    mockPanningRef.current = false;
  });

  it("paints a brush dot and dispatches the completed stroke", () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useCanvasDrawing(makeOpts({ dispatch, brushLevel: 3, brushSize: 1 })));
    const canvas = result.current.curRef.current!;
    mockCanvasRect(canvas);

    const down = pointerEvent({ target: canvas });
    act(() => {
      result.current.onDown(down);
    });

    const centerIndex = 5 * 10 + 5;
    expect(down.preventDefault).toHaveBeenCalled();
    expect(result.current.drawingRef.current).toBe(true);
    expect(result.current.strokeRef.current?.buf[centerIndex]).toBe(3);

    act(() => {
      result.current.onUp();
    });

    expect(result.current.drawingRef.current).toBe(false);
    expect(result.current.strokeRef.current).toBeNull();
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "stroke_end",
        finalData: expect.any(Uint8Array),
        diff: expect.objectContaining({
          idx: expect.any(Uint32Array),
          nv: expect.any(Uint8Array),
        }),
      }),
    );
    const action = dispatch.mock.calls[0][0];
    expect(action.finalData[centerIndex]).toBe(3);
    expect(Array.from(action.diff.idx)).toContain(centerIndex);
  });

  it.each([
    { tool: "brush" as ToolId, initialLevel: 0, expectedCenter: 3, expectedEdge: 0 },
    { tool: "eraser" as ToolId, initialLevel: 7, expectedCenter: 0, expectedEdge: 7 },
  ])("does not paint an edge trail when $tool moves outside the canvas", ({ tool, initialLevel, expectedCenter, expectedEdge }) => {
    const cvs = makeCvs(10, 10);
    cvs.data.fill(initialLevel);
    const { result } = renderHook(() => useCanvasDrawing(makeOpts({ cvs, tool, brushLevel: 3, brushSize: 1 })));
    const canvas = result.current.curRef.current!;
    mockCanvasRect(canvas);

    act(() => {
      result.current.onDown(pointerEvent({ target: canvas }));
    });
    act(() => {
      result.current.onMove(pointerEvent({ clientX: 400, clientY: 160, target: canvas }));
    });

    const buf = result.current.strokeRef.current?.buf;
    expect(buf?.[5 * 10 + 5]).toBe(expectedCenter);
    expect(buf?.[5 * 10 + 9]).toBe(expectedEdge);
  });

  it("accumulates dirty rects while a brush render frame is pending", () => {
    const rafCallbacks: FrameRequestCallback[] = [];
    const rafSpy = vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    const cancelSpy = vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    try {
      const { result } = renderHook(() => useCanvasDrawing(makeOpts({ brushLevel: 3, brushSize: 1 })));
      const canvas = result.current.curRef.current!;
      mockCanvasRect(canvas);

      act(() => {
        result.current.onDown(pointerEvent({ target: canvas }));
      });
      vi.mocked(renderBuf).mockClear();

      act(() => {
        result.current.onMove(pointerEvent({ clientX: 192, clientY: 160, target: canvas }));
      });
      act(() => {
        result.current.onMove(pointerEvent({ clientX: 224, clientY: 160, target: canvas }));
      });

      expect(rafCallbacks).toHaveLength(1);
      expect(cancelSpy).not.toHaveBeenCalled();

      act(() => {
        rafCallbacks[0](0);
      });

      expect(renderBuf).toHaveBeenCalledTimes(1);
      expect(vi.mocked(renderBuf).mock.calls[0][7]).toEqual({ x: 5, y: 5, w: 3, h: 1 });
    } finally {
      rafSpy.mockRestore();
      cancelSpy.mockRestore();
    }
  });

  it("right-click samples the source level instead of drawing", () => {
    const cvs = makeCvs();
    cvs.data[55] = 5;
    const setBrushLevel = vi.fn();
    const { result } = renderHook(() => useCanvasDrawing(makeOpts({ cvs, setBrushLevel })));
    const canvas = result.current.curRef.current!;
    mockCanvasRect(canvas);

    act(() => {
      result.current.onDown(pointerEvent({ button: 2, target: canvas }));
    });

    expect(setBrushLevel).toHaveBeenCalledWith(5);
    expect(mockAnnounce).toHaveBeenCalledWith("announce_level");
    expect(result.current.drawingRef.current).toBe(false);
  });
});
