// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useToolState } from "../hooks/useToolState";

describe("useToolState", () => {
  it("initial tool is 'brush'", () => {
    const { result } = renderHook(() => useToolState());
    expect(result.current.tool).toBe("brush");
  });

  it("initial brushLevel is 7", () => {
    const { result } = renderHook(() => useToolState());
    expect(result.current.brushLevel).toBe(7);
  });

  it("initial brushSize is 12", () => {
    const { result } = renderHook(() => useToolState());
    expect(result.current.brushSize).toBe(12);
  });

  it("initial glazeTool is 'glaze_brush'", () => {
    const { result } = renderHook(() => useToolState());
    expect(result.current.glazeTool).toBe("glaze_brush");
  });

  it("setTool changes tool", () => {
    const { result } = renderHook(() => useToolState());
    act(() => { result.current.setTool("eraser"); });
    expect(result.current.tool).toBe("eraser");
  });

  it("setBrushLevel changes brushLevel", () => {
    const { result } = renderHook(() => useToolState());
    act(() => { result.current.setBrushLevel(3); });
    expect(result.current.brushLevel).toBe(3);
  });

  it("setBrushSize changes brushSize", () => {
    const { result } = renderHook(() => useToolState());
    act(() => { result.current.setBrushSize(24); });
    expect(result.current.brushSize).toBe(24);
  });

  it("setGlazeTool changes glazeTool", () => {
    const { result } = renderHook(() => useToolState());
    act(() => { result.current.setGlazeTool("glaze_fill"); });
    expect(result.current.glazeTool).toBe("glaze_fill");
  });
});
