// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock idb-persistence so IndexedDB is not required
vi.mock("../utils/idb-persistence", () => ({
  loadState: vi.fn(() => Promise.resolve(null)),
  saveState: vi.fn(() => Promise.resolve()),
}));

import { useAppState } from "../hooks/useAppState";
import { W0, H0 } from "../constants";

// Minimal translation stub
const t = ((key: string) => key) as import("../i18n").TranslationFn;

describe("useAppState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns correct initial state shape", () => {
    const { result } = renderHook(() => useAppState(t));
    const s = result.current;

    // Canvas state
    expect(s.cvs).toBeDefined();
    expect(s.cvs.w).toBe(W0);
    expect(s.cvs.h).toBe(H0);
    expect(s.cvs.data).toBeInstanceOf(Uint8Array);
    expect(s.cvs.data.length).toBe(W0 * H0);

    // Undo/redo stacks exist on the reducer state
    expect(s.state.undoStack).toBeDefined();
    expect(s.state.redoStack).toBeDefined();

    // Histogram
    expect(s.state.hist).toBeDefined();
    expect(s.state.hist.length).toBe(8);

    // Other top-level properties
    expect(typeof s.brushLevel).toBe("number");
    expect(typeof s.brushSize).toBe("number");
    expect(typeof s.tool).toBe("string");
    expect(Array.isArray(s.locked)).toBe(true);
    expect(s.colorLUT).toBeDefined();
  });

  it("initial brushLevel is 7", () => {
    const { result } = renderHook(() => useAppState(t));
    expect(result.current.brushLevel).toBe(7);
  });

  it("setBrushLevel updates brushLevel", () => {
    const { result } = renderHook(() => useAppState(t));
    act(() => { result.current.setBrushLevel(3); });
    expect(result.current.brushLevel).toBe(3);
  });

  it("initial brushSize is 12", () => {
    const { result } = renderHook(() => useAppState(t));
    expect(result.current.brushSize).toBe(12);
  });

  it("setBrushSize updates brushSize", () => {
    const { result } = renderHook(() => useAppState(t));
    act(() => { result.current.setBrushSize(24); });
    expect(result.current.brushSize).toBe(24);
  });

  it("initial tool is brush", () => {
    const { result } = renderHook(() => useAppState(t));
    expect(result.current.tool).toBe("brush");
  });

  it("setTool switches to eraser", () => {
    const { result } = renderHook(() => useAppState(t));
    act(() => { result.current.setTool("eraser"); });
    expect(result.current.tool).toBe("eraser");
  });

  it("setTool switches to fill", () => {
    const { result } = renderHook(() => useAppState(t));
    act(() => { result.current.setTool("fill"); });
    expect(result.current.tool).toBe("fill");
  });

  it("setTool switches to line", () => {
    const { result } = renderHook(() => useAppState(t));
    act(() => { result.current.setTool("line"); });
    expect(result.current.tool).toBe("line");
  });

  it("setTool switches to rect", () => {
    const { result } = renderHook(() => useAppState(t));
    act(() => { result.current.setTool("rect"); });
    expect(result.current.tool).toBe("rect");
  });

  it("setTool switches to ellipse", () => {
    const { result } = renderHook(() => useAppState(t));
    act(() => { result.current.setTool("ellipse"); });
    expect(result.current.tool).toBe("ellipse");
  });

  it("locked array has 8 entries, all false initially", () => {
    const { result } = renderHook(() => useAppState(t));
    expect(result.current.locked.length).toBe(8);
    expect(result.current.locked.every(v => v === false)).toBe(true);
  });

  it("toggleLock flips a single lock", () => {
    const { result } = renderHook(() => useAppState(t));
    act(() => { result.current.toggleLock(2); });
    expect(result.current.locked[2]).toBe(true);
    expect(result.current.locked[0]).toBe(false);
  });

  it("colorLUT has 8 RGB tuples", () => {
    const { result } = renderHook(() => useAppState(t));
    expect(result.current.colorLUT.length).toBe(8);
    for (const rgb of result.current.colorLUT) {
      expect(rgb.length).toBe(3);
    }
  });
});
