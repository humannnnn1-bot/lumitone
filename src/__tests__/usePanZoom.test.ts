// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
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
    act(() => { result.current.setZoom(2); });
    expect(result.current.zoom).toBe(2);
  });

  it("setPan changes pan", () => {
    const { cvs, displayW, schedCursorRef } = makeMocks();
    const { result } = renderHook(() => usePanZoom(cvs, displayW, schedCursorRef));
    act(() => { result.current.setPan({ x: 10, y: 20 }); });
    expect(result.current.pan).toEqual({ x: 10, y: 20 });
  });

  it("setPan with same values does not cause new reference (equality check)", () => {
    const { cvs, displayW, schedCursorRef } = makeMocks();
    const { result } = renderHook(() => usePanZoom(cvs, displayW, schedCursorRef));

    act(() => { result.current.setPan({ x: 5, y: 10 }); });
    const ref1 = result.current.pan;

    // Set to same values
    act(() => { result.current.setPan({ x: 5, y: 10 }); });
    const ref2 = result.current.pan;

    // Should be the same reference due to equality optimization
    expect(ref2).toBe(ref1);
  });

  it("setPan with function updater works", () => {
    const { cvs, displayW, schedCursorRef } = makeMocks();
    const { result } = renderHook(() => usePanZoom(cvs, displayW, schedCursorRef));

    act(() => { result.current.setPan({ x: 5, y: 10 }); });
    act(() => { result.current.setPan(prev => ({ x: prev.x + 1, y: prev.y + 2 })); });
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
});
