import { describe, it, expect } from "vitest";
import { shapeBBox, unionBBox, brushBBox, restoreRect } from "../dirty-rect";

describe("shapeBBox", () => {
  it("computes correct bounding box", () => {
    const bb = shapeBBox(5, 5, 10, 10, 2, 20, 20);
    expect(bb).not.toBeNull();
    expect(bb!.x).toBe(3); // min(5,10) - 2
    expect(bb!.y).toBe(3);
    expect(bb!.w).toBe(10); // (12 - 3 + 1)
    expect(bb!.h).toBe(10);
  });

  it("clamps to canvas bounds", () => {
    const bb = shapeBBox(0, 0, 5, 5, 3, 10, 10);
    expect(bb).not.toBeNull();
    expect(bb!.x).toBe(0);
    expect(bb!.y).toBe(0);
  });

  it("clamps max to canvas edge", () => {
    const bb = shapeBBox(8, 8, 12, 12, 2, 10, 10);
    expect(bb).not.toBeNull();
    expect(bb!.x + bb!.w).toBeLessThanOrEqual(10);
    expect(bb!.y + bb!.h).toBeLessThanOrEqual(10);
  });

  it("handles reversed coordinates", () => {
    const bb1 = shapeBBox(10, 10, 5, 5, 1, 20, 20);
    const bb2 = shapeBBox(5, 5, 10, 10, 1, 20, 20);
    expect(bb1).toEqual(bb2);
  });

  it("returns null when shape is entirely outside canvas", () => {
    expect(shapeBBox(-20, -20, -10, -10, 2, 100, 100)).toBeNull();
    expect(shapeBBox(110, 110, 120, 120, 2, 100, 100)).toBeNull();
  });
});

describe("unionBBox", () => {
  it("returns b when a is null", () => {
    const b = { x: 1, y: 2, w: 3, h: 4 };
    expect(unionBBox(null, b)).toEqual(b);
  });

  it("returns a when b is null", () => {
    const a = { x: 1, y: 2, w: 3, h: 4 };
    expect(unionBBox(a, null)).toEqual(a);
  });

  it("returns null when both are null", () => {
    expect(unionBBox(null, null)).toBeNull();
  });

  it("computes union of two rects", () => {
    const a = { x: 0, y: 0, w: 5, h: 5 };
    const b = { x: 3, y: 3, w: 5, h: 5 };
    const u = unionBBox(a, b)!;
    expect(u.x).toBe(0);
    expect(u.y).toBe(0);
    expect(u.w).toBe(8); // max(0+5, 3+5) - 0 = 8
    expect(u.h).toBe(8);
  });
});

describe("brushBBox", () => {
  it("returns null for empty points", () => {
    expect(brushBBox([], 5, 10, 10)).toBeNull();
  });

  it("single point with r=0", () => {
    const bb = brushBBox([[5, 5]], 0, 10, 10);
    expect(bb).not.toBeNull();
    expect(bb!.x).toBe(5);
    expect(bb!.y).toBe(5);
    expect(bb!.w).toBe(1);
    expect(bb!.h).toBe(1);
  });

  it("multiple points covers all", () => {
    const bb = brushBBox(
      [
        [2, 3],
        [8, 7],
      ],
      1,
      20,
      20,
    );
    expect(bb).not.toBeNull();
    expect(bb!.x).toBeLessThanOrEqual(1);
    expect(bb!.y).toBeLessThanOrEqual(2);
  });
});

describe("restoreRect", () => {
  it("restores only the rect region", () => {
    const w = 5;
    const pre = new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
    const buf = new Uint8Array(25).fill(9);
    restoreRect(buf, pre, w, { x: 1, y: 1, w: 3, h: 3 });
    // Inside rect should be restored to 1
    expect(buf[1 * 5 + 1]).toBe(1);
    expect(buf[1 * 5 + 3]).toBe(1);
    expect(buf[3 * 5 + 3]).toBe(1);
    // Outside rect should remain 9
    expect(buf[0]).toBe(9);
    expect(buf[4]).toBe(9);
    expect(buf[4 * 5 + 4]).toBe(9);
  });
});
