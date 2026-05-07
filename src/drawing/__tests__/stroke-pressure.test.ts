import { describe, expect, it } from "vitest";
import { pressureAdjustedBrushSize } from "../stroke-pressure";

describe("pressureAdjustedBrushSize", () => {
  it("keeps mouse input at the configured brush size", () => {
    expect(pressureAdjustedBrushSize(10, { pointerType: "mouse", pressure: 1 })).toBe(10);
  });

  it("maps pen pressure to a narrow brush-size range around the configured size", () => {
    expect(pressureAdjustedBrushSize(10, { pointerType: "pen", pressure: 0 })).toBe(6);
    expect(pressureAdjustedBrushSize(10, { pointerType: "pen", pressure: 0.5 })).toBe(10);
    expect(pressureAdjustedBrushSize(10, { pointerType: "pen", pressure: 1 })).toBe(12);
  });

  it("falls back to the configured brush size for invalid pen pressure", () => {
    expect(pressureAdjustedBrushSize(10, { pointerType: "pen", pressure: Number.NaN })).toBe(10);
  });

  it("keeps very small pen brushes usable", () => {
    expect(pressureAdjustedBrushSize(1, { pointerType: "pen", pressure: 0 })).toBe(1);
  });
});
