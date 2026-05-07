// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { defaultBrushSizeForCanvas } from "../../constants";
import { useToolState } from "../useToolState";

describe("useToolState", () => {
  it("scales default brush size from the canvas short edge", () => {
    expect(defaultBrushSizeForCanvas(64, 64)).toBe(2);
    expect(defaultBrushSizeForCanvas(320, 320)).toBe(12);
    expect(defaultBrushSizeForCanvas(1024, 1024)).toBe(38);
    expect(defaultBrushSizeForCanvas(2048, 2048)).toBe(77);
    expect(defaultBrushSizeForCanvas(2048, 64)).toBe(2);
    expect(defaultBrushSizeForCanvas(8, 8)).toBe(1);
  });

  it("exposes the default drawing tools", () => {
    const { result } = renderHook(() => useToolState());

    expect(result.current).toMatchObject({
      tool: "brush",
      brushLevel: 7,
      brushSize: 12,
      glazeTool: "glaze_brush",
    });
  });

  it("updates the selected tool state through React setters", () => {
    const { result } = renderHook(() => useToolState());
    act(() => {
      result.current.setTool("eraser");
      result.current.setBrushLevel(3);
      result.current.setBrushSize(24);
      result.current.setGlazeTool("glaze_fill");
    });

    expect(result.current.tool).toBe("eraser");
    expect(result.current.brushLevel).toBe(3);
    expect(result.current.brushSize).toBe(24);
    expect(result.current.glazeTool).toBe("glaze_fill");
  });

  it("adjusts brush size for canvas dimensions until the user changes it", () => {
    const { result } = renderHook(() => useToolState());

    act(() => {
      result.current.resetBrushSizeForCanvas(64, 64);
    });
    expect(result.current.brushSize).toBe(2);

    act(() => {
      result.current.resetBrushSizeForCanvas(1024, 1024);
    });
    expect(result.current.brushSize).toBe(38);

    act(() => {
      result.current.setBrushSize(24);
      result.current.resetBrushSizeForCanvas(2048, 2048);
    });
    expect(result.current.brushSize).toBe(24);
  });
});
