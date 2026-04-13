// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePanZoom } from "../hooks/usePanZoom";
import type { CanvasData } from "../types";

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

  /* ---------- handleMiddleDown ---------- */

  describe("handleMiddleDown", () => {
    function makeFakePointerEvent(overrides?: Partial<React.PointerEvent>): React.PointerEvent {
      return {
        button: 1,
        clientX: 100,
        clientY: 100,
        pointerId: 1,
        preventDefault: vi.fn(),
        target: { setPointerCapture: vi.fn() },
        ...overrides,
      } as unknown as React.PointerEvent;
    }

    it("first middle-click starts pan (delegates to startPan)", () => {
      const { cvs, displayW, schedCursorRef } = makeMocks();
      const { result } = renderHook(() => usePanZoom(cvs, displayW, schedCursorRef));

      act(() => {
        result.current.handleMiddleDown(makeFakePointerEvent());
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
        result.current.handleMiddleDown(makeFakePointerEvent());
      });
      // End pan (simulate pointer up)
      act(() => {
        result.current.endPan();
      });

      // Second middle-click quickly
      act(() => {
        result.current.handleMiddleDown(makeFakePointerEvent());
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
        result.current.handleMiddleDown(makeFakePointerEvent());
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
        result.current.handleMiddleDown(makeFakePointerEvent());
      });

      expect(result.current.zoom).toBe(2);
      expect(result.current.panningRef.current).toBe(true);

      vi.restoreAllMocks();
    });
  });
});
