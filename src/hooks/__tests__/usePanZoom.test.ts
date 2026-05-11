// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePanZoom } from "../usePanZoom";
import type { CanvasData } from "../../types";
import { ZOOM_MAX, ZOOM_MIN } from "../../constants";

function makeMocks() {
  const cvs: CanvasData = {
    w: 320,
    h: 320,
    data: new Uint8Array(320 * 320),
    colorMap: new Uint8Array(320 * 320),
  };
  const displayW = 320;
  const schedCursorRef = { current: null as (() => void) | null };
  return { cvs, displayW, schedCursorRef };
}

describe("usePanZoom", () => {
  function makeFakePointerEvent(overrides?: Partial<React.PointerEvent>): React.PointerEvent {
    return {
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerId: 1,
      preventDefault: vi.fn(),
      target: { setPointerCapture: vi.fn() },
      ...overrides,
    } as unknown as React.PointerEvent;
  }

  function makeWheelEvent(overrides?: Partial<WheelEvent> & { rect?: Partial<DOMRect> }): WheelEvent {
    const rect = {
      left: 0,
      top: 0,
      width: 320,
      height: 320,
      right: 320,
      bottom: 320,
      x: 0,
      y: 0,
      toJSON: () => ({}),
      ...overrides?.rect,
    } as DOMRect;
    return {
      deltaY: -100,
      clientX: 160,
      clientY: 160,
      preventDefault: vi.fn(),
      currentTarget: { getBoundingClientRect: () => rect },
      ...overrides,
    } as unknown as WheelEvent;
  }

  it("initial zoom is 1", () => {
    const { cvs, displayW, schedCursorRef } = makeMocks();
    const { result } = renderHook(() => usePanZoom(cvs, displayW, schedCursorRef));
    expect(result.current.zoom).toBe(1);
  });

  it("initial pan is {x:0, y:0}", () => {
    const { cvs, displayW, schedCursorRef } = makeMocks();
    const { result } = renderHook(() => usePanZoom(cvs, displayW, schedCursorRef));
    expect(result.current.pan).toEqual({ x: 0, y: 0 });
  });

  it("initial cursorMode is null", () => {
    const { cvs, displayW, schedCursorRef } = makeMocks();
    const { result } = renderHook(() => usePanZoom(cvs, displayW, schedCursorRef));
    expect(result.current.cursorMode).toBeNull();
  });

  it("setZoom changes zoom", () => {
    const { cvs, displayW, schedCursorRef } = makeMocks();
    const { result } = renderHook(() => usePanZoom(cvs, displayW, schedCursorRef));
    act(() => {
      result.current.setZoom(2);
    });
    expect(result.current.zoom).toBe(2);
  });

  it("setPan changes pan", () => {
    const { cvs, displayW, schedCursorRef } = makeMocks();
    const { result } = renderHook(() => usePanZoom(cvs, displayW, schedCursorRef));
    act(() => {
      result.current.setPan({ x: 10, y: 20 });
    });
    expect(result.current.pan).toEqual({ x: 10, y: 20 });
  });

  it("setPan with same values does not cause new reference (equality check)", () => {
    const { cvs, displayW, schedCursorRef } = makeMocks();
    const { result } = renderHook(() => usePanZoom(cvs, displayW, schedCursorRef));

    act(() => {
      result.current.setPan({ x: 5, y: 10 });
    });
    const ref1 = result.current.pan;

    // Set to same values
    act(() => {
      result.current.setPan({ x: 5, y: 10 });
    });
    const ref2 = result.current.pan;

    // Should be the same reference due to equality optimization
    expect(ref2).toBe(ref1);
  });

  it("setPan with function updater works", () => {
    const { cvs, displayW, schedCursorRef } = makeMocks();
    const { result } = renderHook(() => usePanZoom(cvs, displayW, schedCursorRef));

    act(() => {
      result.current.setPan({ x: 5, y: 10 });
    });
    act(() => {
      result.current.setPan((prev) => ({ x: prev.x + 1, y: prev.y + 2 }));
    });
    expect(result.current.pan).toEqual({ x: 6, y: 12 });
  });

  it("refs are exposed and initialized", () => {
    const { cvs, displayW, schedCursorRef } = makeMocks();
    const { result } = renderHook(() => usePanZoom(cvs, displayW, schedCursorRef));
    expect(result.current.panningRef.current).toBe(false);
    expect(result.current.spaceRef.current).toBe(false);
    expect(result.current.panStartRef.current).toEqual({ x: 0, y: 0 });
    expect(result.current.panOriginRef.current).toEqual({ x: 0, y: 0 });
  });

  it("clears transient pan state when pan-zoom mode is disabled", () => {
    const { cvs, displayW, schedCursorRef } = makeMocks();
    const schedCursor = vi.fn();
    schedCursorRef.current = schedCursor;
    const { result } = renderHook(() => usePanZoom(cvs, displayW, schedCursorRef));

    act(() => {
      result.current.setPanZoomMode(true);
      result.current.setCursorMode("grab");
      result.current.panningRef.current = true;
      result.current.spaceRef.current = true;
    });
    act(() => {
      result.current.setPanZoomMode((prev) => !prev);
    });

    expect(result.current.panZoomMode).toBe(false);
    expect(result.current.cursorMode).toBeNull();
    expect(result.current.panningRef.current).toBe(false);
    expect(result.current.spaceRef.current).toBe(false);
    expect(schedCursor).toHaveBeenCalled();
  });

  it("movePan clamps pan to canvas bounds and schedules cursor redraw", () => {
    const { cvs, displayW, schedCursorRef } = makeMocks();
    let scheduledPan: { x: number; y: number } | null = null;
    let readCurrentPan: (() => { x: number; y: number }) | null = null;
    const schedCursor = vi.fn(() => {
      scheduledPan = readCurrentPan?.() ?? null;
    });
    schedCursorRef.current = schedCursor;
    const { result } = renderHook(() => usePanZoom(cvs, displayW, schedCursorRef));
    readCurrentPan = () => result.current.panRef.current;

    act(() => {
      result.current.startPan(makeFakePointerEvent({ clientX: 0, clientY: 0 }));
    });
    act(() => {
      result.current.movePan(makeFakePointerEvent({ clientX: 10_000, clientY: -10_000 }));
    });

    expect(result.current.pan).toEqual({ x: cvs.w, y: -cvs.h });
    expect(scheduledPan).toEqual({ x: cvs.w, y: -cvs.h });
    expect(schedCursor).toHaveBeenCalled();
  });

  describe("onWheel", () => {
    it("zooms in and out around the pointer", () => {
      const { cvs, displayW, schedCursorRef } = makeMocks();
      const schedCursor = vi.fn();
      schedCursorRef.current = schedCursor;
      const { result } = renderHook(() => usePanZoom(cvs, displayW, schedCursorRef));

      act(() => {
        result.current.onWheel(makeWheelEvent({ deltaY: -100 }));
      });
      expect(result.current.zoom).toBeGreaterThan(1);

      act(() => {
        result.current.onWheel(makeWheelEvent({ deltaY: 100 }));
      });
      expect(result.current.zoom).toBeCloseTo(1);
      expect(schedCursor).toHaveBeenCalled();
    });

    it("clamps wheel zoom to configured min and max", () => {
      const { cvs, displayW, schedCursorRef } = makeMocks();
      const { result } = renderHook(() => usePanZoom(cvs, displayW, schedCursorRef));

      act(() => {
        result.current.setZoom(ZOOM_MAX / 1.01);
      });
      act(() => {
        result.current.onWheel(makeWheelEvent({ deltaY: -100 }));
      });
      expect(result.current.zoom).toBe(ZOOM_MAX);

      act(() => {
        result.current.setZoom(ZOOM_MIN * 1.01);
      });
      act(() => {
        result.current.onWheel(makeWheelEvent({ deltaY: 100 }));
      });
      expect(result.current.zoom).toBe(ZOOM_MIN);
    });

    it("clamps wheel-generated pan to canvas bounds", () => {
      const { cvs, displayW, schedCursorRef } = makeMocks();
      const { result } = renderHook(() => usePanZoom(cvs, displayW, schedCursorRef));

      act(() => {
        result.current.setPan({ x: 10_000, y: -10_000 });
      });
      act(() => {
        result.current.onWheel(makeWheelEvent({ deltaY: -100, clientX: 0, clientY: 320 }));
      });

      expect(result.current.pan.x).toBeGreaterThanOrEqual(-cvs.w);
      expect(result.current.pan.x).toBeLessThanOrEqual(cvs.w);
      expect(result.current.pan.y).toBeGreaterThanOrEqual(-cvs.h);
      expect(result.current.pan.y).toBeLessThanOrEqual(cvs.h);
    });
  });

  describe("pinch handlers", () => {
    it("uses one pointer as pan input and clamps the result", () => {
      const { cvs, displayW, schedCursorRef } = makeMocks();
      const { result } = renderHook(() => usePanZoom(cvs, displayW, schedCursorRef));

      act(() => {
        result.current.onPinchDown(makeFakePointerEvent({ pointerId: 1, clientX: 0, clientY: 0 }));
      });
      expect(result.current.panningRef.current).toBe(true);

      act(() => {
        result.current.onPinchMove(makeFakePointerEvent({ pointerId: 1, clientX: 10_000, clientY: 10_000 }));
      });
      expect(result.current.pan).toEqual({ x: cvs.w, y: cvs.h });

      act(() => {
        result.current.onPinchUp(makeFakePointerEvent({ pointerId: 1 }));
      });
      expect(result.current.panningRef.current).toBe(false);
    });

    it("pinch-zooms with two pointers and resumes pan when one remains", () => {
      const { cvs, displayW, schedCursorRef } = makeMocks();
      const { result } = renderHook(() => usePanZoom(cvs, displayW, schedCursorRef));

      act(() => {
        result.current.onPinchDown(makeFakePointerEvent({ pointerId: 1, clientX: 0, clientY: 0 }));
        result.current.onPinchDown(makeFakePointerEvent({ pointerId: 2, clientX: 0, clientY: 100 }));
      });
      expect(result.current.panningRef.current).toBe(false);

      act(() => {
        result.current.onPinchMove(makeFakePointerEvent({ pointerId: 2, clientX: 0, clientY: 200 }));
      });
      expect(result.current.zoom).toBe(2);

      act(() => {
        result.current.onPinchUp(makeFakePointerEvent({ pointerId: 2 }));
      });
      expect(result.current.panningRef.current).toBe(true);
    });

    it("pans with two pointers when the pinch center moves", () => {
      const { cvs, displayW, schedCursorRef } = makeMocks();
      const schedCursor = vi.fn();
      schedCursorRef.current = schedCursor;
      const { result } = renderHook(() => usePanZoom(cvs, displayW, schedCursorRef));

      act(() => {
        result.current.onPinchDown(makeFakePointerEvent({ pointerId: 1, clientX: 100, clientY: 100 }));
        result.current.onPinchDown(makeFakePointerEvent({ pointerId: 2, clientX: 200, clientY: 100 }));
      });

      act(() => {
        result.current.onPinchMove(makeFakePointerEvent({ pointerId: 1, clientX: 140, clientY: 130 }));
        result.current.onPinchMove(makeFakePointerEvent({ pointerId: 2, clientX: 240, clientY: 130 }));
      });

      expect(result.current.zoom).toBeCloseTo(1);
      expect(result.current.pan).toEqual({ x: 40, y: 30 });
      expect(schedCursor).toHaveBeenCalled();
    });
  });

  /* ---------- handleMiddleDown ---------- */

  describe("handleMiddleDown", () => {
    it("first middle-click starts pan (delegates to startPan)", () => {
      const { cvs, displayW, schedCursorRef } = makeMocks();
      const { result } = renderHook(() => usePanZoom(cvs, displayW, schedCursorRef));

      act(() => {
        result.current.handleMiddleDown(makeFakePointerEvent({ button: 1 }));
      });

      expect(result.current.panningRef.current).toBe(true);
    });

    it("double middle-click within 400ms resets zoom and pan", () => {
      const { cvs, displayW, schedCursorRef } = makeMocks();
      const { result } = renderHook(() => usePanZoom(cvs, displayW, schedCursorRef));

      // Set non-default zoom/pan
      act(() => {
        result.current.setZoom(3);
        result.current.setPan({ x: 50, y: 50 });
      });
      expect(result.current.zoom).toBe(3);

      // First middle-click
      act(() => {
        result.current.handleMiddleDown(makeFakePointerEvent({ button: 1 }));
      });
      // End pan (simulate pointer up)
      act(() => {
        result.current.endPan();
      });

      // Second middle-click quickly
      act(() => {
        result.current.handleMiddleDown(makeFakePointerEvent({ button: 1 }));
      });

      expect(result.current.zoom).toBe(1);
      expect(result.current.pan).toEqual({ x: 0, y: 0 });
      // Should NOT start panning after reset
      expect(result.current.panningRef.current).toBe(false);
    });

    it("two middle-clicks spaced > 400ms apart both start pan", () => {
      const { cvs, displayW, schedCursorRef } = makeMocks();
      const { result } = renderHook(() => usePanZoom(cvs, displayW, schedCursorRef));

      act(() => {
        result.current.setZoom(2);
        result.current.setPan({ x: 10, y: 10 });
      });

      // First click
      act(() => {
        result.current.handleMiddleDown(makeFakePointerEvent({ button: 1 }));
      });
      act(() => {
        result.current.endPan();
      });

      // Simulate 500ms delay by mocking performance.now
      const origNow = performance.now;
      let offset = 0;
      vi.spyOn(performance, "now").mockImplementation(() => origNow.call(performance) + offset);
      offset = 500;

      // Second click after delay — should NOT reset
      act(() => {
        result.current.handleMiddleDown(makeFakePointerEvent({ button: 1 }));
      });

      expect(result.current.zoom).toBe(2);
      expect(result.current.panningRef.current).toBe(true);

      vi.restoreAllMocks();
    });
  });
});
