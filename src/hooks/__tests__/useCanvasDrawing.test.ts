// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCanvasDrawing } from "../useCanvasDrawing";
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

/* ── Tests ──────────────────────────────────── */

describe("useCanvasDrawing", () => {
  it("returns all expected properties", () => {
    const { result } = renderHook(() => useCanvasDrawing(makeOpts()));
    const r = result.current;
    expect(r.srcRef).toBeDefined();
    expect(r.curRef).toBeDefined();
    expect(r.statusRef).toBeDefined();
    expect(r.imgCacheRef).toBeDefined();
    expect(r.strokeRef).toBeDefined();
    expect(r.drawingRef).toBeDefined();
    expect(typeof r.onDown).toBe("function");
    expect(typeof r.onMove).toBe("function");
    expect(typeof r.onUp).toBe("function");
    expect(typeof r.onDownPrv).toBe("function");
    expect(typeof r.onMovePrv).toBe("function");
    expect(typeof r.trackCursor).toBe("function");
    expect(typeof r.clearCursor).toBe("function");
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

  it("drawingRef starts as false", () => {
    const { result } = renderHook(() => useCanvasDrawing(makeOpts()));
    expect(result.current.drawingRef.current).toBe(false);
  });

  it("strokeRef starts as null", () => {
    const { result } = renderHook(() => useCanvasDrawing(makeOpts()));
    expect(result.current.strokeRef.current).toBeNull();
  });
});
