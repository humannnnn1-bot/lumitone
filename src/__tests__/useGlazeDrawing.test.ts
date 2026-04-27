// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGlazeDrawing } from "../hooks/useGlazeDrawing";
import type { CanvasData } from "../types";

/* ── Mocks ──────────────────────────────────── */

const mockAnnounce = vi.fn();
const mockEndPan = vi.fn();
const mockSetHueAngle = vi.fn();
const mockPanningRef = { current: false };

vi.mock("../state/DrawingContext", () => ({
  useDrawingContext: () => ({
    displayW: 320,
    displayH: 320,
    panningRef: mockPanningRef,
    spaceRef: { current: false },
    zoomRef: { current: 1 },
    panRef: { current: { x: 0, y: 0 } },
    startPan: vi.fn(),
    movePan: vi.fn(),
    endPan: mockEndPan,
    announce: mockAnnounce,
    t: (k: string) => k,
  }),
}));

vi.mock("../hooks/useFloodFillWorker", () => ({
  useFloodFillWorker: () => ({
    requestCanvasFill: vi.fn(() => Promise.resolve({ data: new Uint8Array(100), changed: new Uint32Array(0), truncated: false })),
    requestGlazeFill: vi.fn(() => Promise.resolve({ colorMap: new Uint8Array(100), changed: new Uint32Array(0), truncated: false })),
  }),
}));

vi.mock("../hooks/useCursorOverlay", () => ({
  useCursorOverlay: () => ({
    curRef: { current: document.createElement("canvas") },
    cursorRafRef: { current: null },
    schedCursorRef: { current: null },
    cursorPosRef: { current: null },
    trackCursor: vi.fn(),
    clearCursor: vi.fn(),
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

function makeOpts(overrides?: Partial<Parameters<typeof useGlazeDrawing>[0]>) {
  return {
    cvs: makeCvs(),
    dispatch: vi.fn(),
    colorLUT: Array.from({ length: 8 }, () => [128, 128, 128] as [number, number, number]),
    hueAngle: 180,
    setHueAngle: mockSetHueAngle,
    glazeTool: "glaze_brush" as const,
    brushSize: 1,
    prvRef: { current: null as HTMLCanvasElement | null },
    directCandidates: new Map<number, number>(),
    ...overrides,
  };
}

/* ── Tests ──────────────────────────────────── */

describe("useGlazeDrawing", () => {
  it("returns all expected properties", () => {
    const { result } = renderHook(() => useGlazeDrawing(makeOpts()));
    const r = result.current;
    expect(r.srcRef).toBeDefined();
    expect(r.curRef).toBeDefined();
    expect(r.statusRef).toBeDefined();
    expect(r.imgCacheRef).toBeDefined();
    expect(r.drawingRef).toBeDefined();
    expect(typeof r.onDown).toBe("function");
    expect(typeof r.onMove).toBe("function");
    expect(typeof r.onUp).toBe("function");
    expect(typeof r.pickHue).toBe("function");
    expect(typeof r.trackCursor).toBe("function");
    expect(typeof r.clearCursor).toBe("function");
  });

  it("drawingRef starts as false", () => {
    const { result } = renderHook(() => useGlazeDrawing(makeOpts()));
    expect(result.current.drawingRef.current).toBe(false);
  });

  it("onUp during pan calls endPan", () => {
    const { result } = renderHook(() => useGlazeDrawing(makeOpts()));
    mockPanningRef.current = true;
    act(() => {
      result.current.onUp();
    });
    expect(mockEndPan).toHaveBeenCalled();
    mockPanningRef.current = false;
  });

  it("pickHue on achromatic pixel (L0) announces error", () => {
    const cvs = makeCvs(10, 10);
    // L0 at pixel (0,0)
    cvs.data[0] = 0;
    const { result } = renderHook(() => useGlazeDrawing(makeOpts({ cvs })));
    // Create a mock PointerEvent positioned at canvas origin
    const canvas = result.current.curRef.current;
    if (canvas) {
      vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
        left: 0,
        top: 0,
        right: 320,
        bottom: 320,
        width: 320,
        height: 320,
        x: 0,
        y: 0,
        toJSON: () => {},
      });
    }
    const mockEvent = new PointerEvent("pointerdown", { clientX: 0, clientY: 0 }) as unknown as React.PointerEvent;
    act(() => {
      result.current.pickHue(mockEvent);
    });
    expect(mockAnnounce).toHaveBeenCalledWith("announce_hue_achromatic");
  });

  it("pickHue on achromatic pixel (L7) announces error", () => {
    const cvs = makeCvs(10, 10);
    cvs.data[0] = 7;
    const { result } = renderHook(() => useGlazeDrawing(makeOpts({ cvs })));
    const canvas = result.current.curRef.current;
    if (canvas) {
      vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
        left: 0,
        top: 0,
        right: 320,
        bottom: 320,
        width: 320,
        height: 320,
        x: 0,
        y: 0,
        toJSON: () => {},
      });
    }
    const mockEvent = new PointerEvent("pointerdown", { clientX: 0, clientY: 0 }) as unknown as React.PointerEvent;
    act(() => {
      result.current.pickHue(mockEvent);
    });
    expect(mockAnnounce).toHaveBeenCalledWith("announce_hue_achromatic");
  });
});
