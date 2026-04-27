import { describe, it, expect } from "vitest";

/**
 * Tests for pan clamping logic extracted from usePanZoom.
 * The clampPan function bounds pan to ±w, ±h.
 */
function clampPan(p: { x: number; y: number }, cv: { w: number; h: number }) {
  return {
    x: Math.max(-cv.w, Math.min(cv.w, p.x)),
    y: Math.max(-cv.h, Math.min(cv.h, p.y)),
  };
}

describe("clampPan", () => {
  const cv = { w: 320, h: 240 };

  it("does not change values within bounds", () => {
    expect(clampPan({ x: 100, y: -50 }, cv)).toEqual({ x: 100, y: -50 });
  });

  it("clamps positive overflow", () => {
    expect(clampPan({ x: 500, y: 400 }, cv)).toEqual({ x: 320, y: 240 });
  });

  it("clamps negative overflow", () => {
    expect(clampPan({ x: -500, y: -400 }, cv)).toEqual({ x: -320, y: -240 });
  });

  it("allows exact boundary values", () => {
    expect(clampPan({ x: 320, y: -240 }, cv)).toEqual({ x: 320, y: -240 });
  });

  it("handles zero pan", () => {
    expect(clampPan({ x: 0, y: 0 }, cv)).toEqual({ x: 0, y: 0 });
  });

  it("handles 1x1 canvas", () => {
    expect(clampPan({ x: 5, y: -5 }, { w: 1, h: 1 })).toEqual({ x: 1, y: -1 });
  });
});
