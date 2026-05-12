// @vitest-environment jsdom
import { beforeEach, describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCanvasDrawing } from "../useCanvasDrawing";
import { renderCanvasBuffers } from "../../drawing/render-buf";
import type { CanvasData } from "../../types";
import type { ToolId } from "../../constants";

/* ── Mocks ──────────────────────────────────── */

const mockStartPan = vi.fn();
const mockMovePan = vi.fn();
const mockEndPan = vi.fn();
const mockAnnounce = vi.fn();
const mockPanningRef = { current: false };
const mockSpaceRef = { current: false };
const mockZoomRef = { current: 1 };
const mockPanRef = { current: { x: 0, y: 0 } };
const cursorOverlayMocks = vi.hoisted(() => ({
  trackCursor: vi.fn(),
  clearCursor: vi.fn(),
  trackCursorPrv: vi.fn(),
  clearCursorPrv: vi.fn(),
}));

vi.mock("../../state/DrawingContext", () => ({
  useDrawingContext: () => ({
    displayW: 320,
    displayH: 320,
    panningRef: mockPanningRef,
    spaceRef: mockSpaceRef,
    zoomRef: mockZoomRef,
    panRef: mockPanRef,
    startPan: mockStartPan,
    movePan: mockMovePan,
    endPan: mockEndPan,
    announce: mockAnnounce,
    t: (k: string) => k,
  }),
}));

vi.mock("../useFloodFillWorker", () => ({
  useFloodFillWorker: () => ({
    requestCanvasFill: vi.fn(() => Promise.resolve({ levelData: new Uint8Array(100), changed: new Uint32Array(0), truncated: false })),
  }),
}));

vi.mock("../useCursorOverlay", () => ({
  useCursorOverlay: () => ({
    curRef: { current: document.createElement("canvas") },
    prvCurRef: { current: document.createElement("canvas") },
    cursorRafRef: { current: null },
    schedCursorRef: { current: null },
    cursorPosRef: { current: null },
    trackCursor: cursorOverlayMocks.trackCursor,
    clearCursor: cursorOverlayMocks.clearCursor,
    trackCursorPrv: cursorOverlayMocks.trackCursorPrv,
    clearCursorPrv: cursorOverlayMocks.clearCursorPrv,
  }),
}));

vi.mock("../../drawing/render-buf", () => ({
  renderCanvasBuffers: vi.fn(),
}));

function makeCvs(w = 10, h = 10): CanvasData {
  return {
    width: w,
    height: h,
    levelData: new Uint8Array(w * h),
    pixelCandidateOverrideMap: new Uint8Array(w * h),
  };
}

function makeOpts(overrides?: Partial<Parameters<typeof useCanvasDrawing>[0]>) {
  return {
    canvasData: makeCvs(),
    dispatch: vi.fn(),
    colorLUT: Array.from({ length: 8 }, () => [128, 128, 128] as [number, number, number]),
    candidateIndexByLevel: [0, 0, 0, 0, 0, 0, 0, 0],
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
    buttons: 1,
    altKey: false,
    pointerId: 1,
    target: { setPointerCapture: vi.fn() },
    currentTarget: { hasPointerCapture: vi.fn(() => false) },
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
    mockZoomRef.current = 1;
    mockPanRef.current = { x: 0, y: 0 };
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
    expect(result.current.strokeRef.current?.workingData[centerIndex]).toBe(3);

    act(() => {
      result.current.onUp();
    });

    expect(result.current.drawingRef.current).toBe(false);
    expect(result.current.strokeRef.current).toBeNull();
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "stroke_end",
        finalLevelData: expect.any(Uint8Array),
        diff: expect.objectContaining({
          indices: expect.any(Uint32Array),
          newValues: expect.any(Uint8Array),
        }),
      }),
    );
    const action = dispatch.mock.calls[0][0];
    expect(action.finalLevelData[centerIndex]).toBe(3);
    expect(Array.from(action.diff.indices)).toContain(centerIndex);
  });

  it("uses pen pressure for brush size while keeping mouse input fixed", () => {
    const mouse = renderHook(() => useCanvasDrawing(makeOpts({ canvasData: makeCvs(20, 20), brushLevel: 3, brushSize: 10 })));
    const mouseCanvas = mouse.result.current.curRef.current!;
    mockCanvasRect(mouseCanvas);

    act(() => {
      mouse.result.current.onDown(
        pointerEvent({
          target: mouseCanvas,
          nativeEvent: { clientX: 160, clientY: 160, pointerType: "mouse", pressure: 1 } as PointerEvent,
        }),
      );
    });

    expect(mouse.result.current.strokeRef.current?.workingData[10 * 20 + 16]).toBe(0);

    const pen = renderHook(() => useCanvasDrawing(makeOpts({ canvasData: makeCvs(20, 20), brushLevel: 3, brushSize: 10 })));
    const penCanvas = pen.result.current.curRef.current!;
    mockCanvasRect(penCanvas);

    act(() => {
      pen.result.current.onDown(
        pointerEvent({
          target: penCanvas,
          nativeEvent: { clientX: 160, clientY: 160, pointerType: "pen", pressure: 1 } as PointerEvent,
        }),
      );
    });

    expect(pen.result.current.strokeRef.current?.workingData[10 * 20 + 16]).toBe(3);
  });

  it.each([
    { tool: "brush" as ToolId, initialLevel: 0, expectedCenter: 3, expectedEdge: 3 },
    { tool: "eraser" as ToolId, initialLevel: 7, expectedCenter: 0, expectedEdge: 0 },
  ])(
    "clips a crossing $tool stroke at the canvas edge when the pointer moves outside",
    ({ tool, initialLevel, expectedCenter, expectedEdge }) => {
      const canvasData = makeCvs(10, 10);
      canvasData.levelData.fill(initialLevel);
      const { result } = renderHook(() => useCanvasDrawing(makeOpts({ canvasData, tool, brushLevel: 3, brushSize: 1 })));
      const canvas = result.current.curRef.current!;
      mockCanvasRect(canvas);

      act(() => {
        result.current.onDown(pointerEvent({ target: canvas }));
      });
      act(() => {
        result.current.onMove(pointerEvent({ clientX: 400, clientY: 160, target: canvas }));
      });

      const buf = result.current.strokeRef.current?.workingData;
      expect(buf?.[5 * 10 + 5]).toBe(expectedCenter);
      expect(buf?.[5 * 10 + 9]).toBe(expectedEdge);
    },
  );

  it("keeps outside brush movement from smearing along the nearest edge and connects on re-entry", () => {
    const { result } = renderHook(() => useCanvasDrawing(makeOpts({ brushLevel: 3, brushSize: 1 })));
    const canvas = result.current.curRef.current!;
    mockCanvasRect(canvas);

    act(() => {
      result.current.onDown(pointerEvent({ clientX: 160, clientY: 256, target: canvas }));
    });
    act(() => {
      result.current.onMove(pointerEvent({ clientX: 160, clientY: -160, target: canvas }));
    });
    act(() => {
      result.current.onMove(pointerEvent({ clientX: 256, clientY: -160, target: canvas }));
    });

    let buf = result.current.strokeRef.current?.workingData;
    expect(buf?.[0 * 10 + 5]).toBe(3);
    expect(buf?.[0 * 10 + 6]).toBe(0);

    act(() => {
      result.current.onMove(pointerEvent({ clientX: 256, clientY: 160, target: canvas }));
    });

    buf = result.current.strokeRef.current?.workingData;
    expect(buf?.[1 * 10 + 8]).toBe(3);

    act(() => {
      result.current.onUp();
    });
  });

  it("uses the true outside endpoint for line strokes instead of clamping to the edge", () => {
    const { result } = renderHook(() => useCanvasDrawing(makeOpts({ tool: "line", brushLevel: 3, brushSize: 1 })));
    const canvas = result.current.curRef.current!;
    mockCanvasRect(canvas);

    act(() => {
      result.current.onDown(pointerEvent({ clientX: 160, clientY: 160, target: canvas }));
    });
    act(() => {
      result.current.onMove(pointerEvent({ clientX: 256, clientY: -160, target: canvas }));
    });

    const buf = result.current.strokeRef.current?.workingData;
    expect(buf?.[0 * 10 + 6]).toBe(3);
    expect(buf?.[0 * 10 + 8]).toBe(0);

    act(() => {
      result.current.onUp();
    });
  });

  it("uses the true outside endpoint for rectangle strokes instead of drawing a clamped edge", () => {
    const { result } = renderHook(() => useCanvasDrawing(makeOpts({ tool: "rect", brushLevel: 3, brushSize: 1 })));
    const canvas = result.current.curRef.current!;
    mockCanvasRect(canvas);

    act(() => {
      result.current.onDown(pointerEvent({ clientX: 160, clientY: 160, target: canvas }));
    });
    act(() => {
      result.current.onMove(pointerEvent({ clientX: 256, clientY: -160, target: canvas }));
    });

    const buf = result.current.strokeRef.current?.workingData;
    expect(buf?.[0 * 10 + 5]).toBe(3);
    expect(buf?.[0 * 10 + 6]).toBe(0);
    expect(buf?.[0 * 10 + 8]).toBe(3);

    act(() => {
      result.current.onUp();
    });
  });

  it("uses the true outside endpoint for ellipse strokes instead of clamping the radius", () => {
    const { result } = renderHook(() => useCanvasDrawing(makeOpts({ tool: "ellipse", brushLevel: 3, brushSize: 1 })));
    const canvas = result.current.curRef.current!;
    mockCanvasRect(canvas);

    act(() => {
      result.current.onDown(pointerEvent({ clientX: 160, clientY: 160, target: canvas }));
    });
    act(() => {
      result.current.onMove(pointerEvent({ clientX: 160, clientY: -160, target: canvas }));
    });

    const buf = result.current.strokeRef.current?.workingData;
    expect(buf?.[0 * 10 + 5]).toBe(3);

    act(() => {
      result.current.onUp();
    });
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
      vi.mocked(renderCanvasBuffers).mockClear();

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

      expect(renderCanvasBuffers).toHaveBeenCalledTimes(1);
      expect(vi.mocked(renderCanvasBuffers).mock.calls[0][7]).toEqual({ x: 5, y: 5, w: 3, h: 1 });
    } finally {
      rafSpy.mockRestore();
      cancelSpy.mockRestore();
    }
  });

  it("right-click samples the source level instead of drawing", () => {
    const canvasData = makeCvs();
    canvasData.levelData[55] = 5;
    const setBrushLevel = vi.fn();
    const { result } = renderHook(() => useCanvasDrawing(makeOpts({ canvasData, setBrushLevel })));
    const canvas = result.current.curRef.current!;
    mockCanvasRect(canvas);

    act(() => {
      result.current.onDown(pointerEvent({ button: 2, target: canvas }));
    });

    expect(setBrushLevel).toHaveBeenCalledWith(5);
    expect(mockAnnounce).toHaveBeenCalledWith("announce_level");
    expect(result.current.drawingRef.current).toBe(false);
  });

  it("arms a background drag and starts a brush stroke only after entering the canvas", () => {
    mockZoomRef.current = 0.5;
    const { result } = renderHook(() => useCanvasDrawing(makeOpts({ brushLevel: 3, brushSize: 1 })));
    const canvas = result.current.curRef.current!;
    mockCanvasRect(canvas);

    act(() => {
      result.current.onWorkspaceDown(pointerEvent({ clientX: 40, clientY: 160, target: canvas }));
    });

    expect(result.current.drawingRef.current).toBe(false);
    expect(result.current.strokeRef.current).toBeNull();

    act(() => {
      result.current.onWorkspaceMove(pointerEvent({ clientX: 160, clientY: 160, target: canvas }));
    });

    const buf = result.current.strokeRef.current?.workingData;
    expect(result.current.drawingRef.current).toBe(true);
    expect(buf?.[5 * 10 + 5]).toBe(3);
    expect(buf?.[5 * 10 + 0]).toBe(3);
  });

  it("tracks the custom cursor over checkerboard background without starting a stroke", () => {
    mockZoomRef.current = 0.5;
    const { result } = renderHook(() => useCanvasDrawing(makeOpts({ brushLevel: 3, brushSize: 1 })));
    const canvas = result.current.curRef.current!;
    mockCanvasRect(canvas);

    act(() => {
      result.current.onWorkspaceMove(pointerEvent({ clientX: 40, clientY: 160, target: canvas }));
    });

    expect(cursorOverlayMocks.trackCursor).toHaveBeenCalled();
    expect(cursorOverlayMocks.clearCursor).not.toHaveBeenCalled();
    expect(result.current.drawingRef.current).toBe(false);
  });

  it("clears the custom cursor when the pointer leaves the workspace", () => {
    const { result } = renderHook(() => useCanvasDrawing(makeOpts({ brushLevel: 3, brushSize: 1 })));
    const canvas = result.current.curRef.current!;
    mockCanvasRect(canvas);

    act(() => {
      result.current.onWorkspaceMove(pointerEvent({ clientX: -32, clientY: 160, target: canvas }));
    });

    expect(cursorOverlayMocks.trackCursor).not.toHaveBeenCalled();
    expect(cursorOverlayMocks.clearCursor).toHaveBeenCalled();
    expect(result.current.drawingRef.current).toBe(false);
  });

  it("does not arm fill from the checkerboard background", () => {
    mockZoomRef.current = 0.5;
    const { result } = renderHook(() => useCanvasDrawing(makeOpts({ tool: "fill", brushLevel: 3, brushSize: 1 })));
    const canvas = result.current.curRef.current!;
    mockCanvasRect(canvas);

    act(() => {
      result.current.onWorkspaceDown(pointerEvent({ clientX: 40, clientY: 160, target: canvas }));
    });
    act(() => {
      result.current.onWorkspaceMove(pointerEvent({ clientX: 160, clientY: 160, target: canvas }));
    });

    expect(result.current.drawingRef.current).toBe(false);
    expect(result.current.strokeRef.current).toBeNull();
  });

  it("uses the canvas entry point as the start of a background-armed line stroke", () => {
    mockZoomRef.current = 0.5;
    const { result } = renderHook(() => useCanvasDrawing(makeOpts({ tool: "line", brushLevel: 3, brushSize: 1 })));
    const canvas = result.current.curRef.current!;
    mockCanvasRect(canvas);

    act(() => {
      result.current.onWorkspaceDown(pointerEvent({ clientX: 40, clientY: 160, target: canvas }));
    });
    act(() => {
      result.current.onWorkspaceMove(pointerEvent({ clientX: 160, clientY: 160, target: canvas }));
    });
    act(() => {
      result.current.onWorkspaceMove(pointerEvent({ clientX: 256, clientY: 160, target: canvas }));
    });

    const buf = result.current.strokeRef.current?.workingData;
    expect(buf?.[5 * 10 + 0]).toBe(3);
    expect(buf?.[5 * 10 + 5]).toBe(3);
    expect(buf?.[5 * 10 + 8]).toBe(3);
  });
});
