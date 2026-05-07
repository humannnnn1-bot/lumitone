import { describe, expect, it } from "vitest";
import { brushMaskBBox, brushMaskHas, getBrushMask } from "../brush-mask";

describe("brush masks", () => {
  it("treats brush size as the footprint diameter", () => {
    const size2 = getBrushMask(2);
    expect(size2).toMatchObject({ size: 2, minDx: 0, maxDx: 1, minDy: 0, maxDy: 1 });
    expect(size2.offsets).toHaveLength(4);
    expect(brushMaskHas(size2, 0, 0)).toBe(true);
    expect(brushMaskHas(size2, 1, 1)).toBe(true);

    const size3 = getBrushMask(3);
    expect(size3).toMatchObject({ size: 3, minDx: -1, maxDx: 1, minDy: -1, maxDy: 1 });
    expect(size3.offsets).toHaveLength(5);
    expect(brushMaskHas(size3, -1, -1)).toBe(false);
    expect(brushMaskHas(size3, 0, -1)).toBe(true);

    const size4 = getBrushMask(4);
    expect(size4).toMatchObject({ size: 4, minDx: -1, maxDx: 2, minDy: -1, maxDy: 2 });
    expect(brushMaskHas(size4, -1, -1)).toBe(false);
    expect(brushMaskHas(size4, 0, -1)).toBe(true);
    expect(brushMaskHas(size4, 2, 2)).toBe(false);
  });

  it("computes dirty bounds from the mask footprint", () => {
    expect(brushMaskBBox([[5, 5]], getBrushMask(2), 20, 20)).toEqual({ x: 5, y: 5, w: 2, h: 2 });
    expect(brushMaskBBox([[5, 5]], getBrushMask(4), 20, 20)).toEqual({ x: 4, y: 4, w: 4, h: 4 });
  });

  it("clamps dirty bounds to the canvas", () => {
    expect(brushMaskBBox([[0, 0]], getBrushMask(4), 20, 20)).toEqual({ x: 0, y: 0, w: 3, h: 3 });
    expect(brushMaskBBox([], getBrushMask(4), 20, 20)).toBeNull();
  });
});
