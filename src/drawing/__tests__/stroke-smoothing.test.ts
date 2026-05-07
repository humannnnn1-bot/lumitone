import { describe, expect, it } from "vitest";
import { createStrokeSmoother, smoothStrokePoint } from "../stroke-smoothing";

describe("stroke smoothing", () => {
  it("starts from the exact down point", () => {
    const smoother = createStrokeSmoother({ x: 5, y: 7 });

    expect(smoother).toEqual({ x: 5, y: 7 });
  });

  it("softens a jagged movement while keeping lag under a pixel", () => {
    const smoother = createStrokeSmoother({ x: 5, y: 5 });

    const p = smoothStrokePoint(smoother, { x: 7, y: 5 });

    expect(p).toEqual({ x: 6, y: 5 });
    expect(Math.abs(7 - smoother.x)).toBeLessThanOrEqual(0.8);
  });

  it("keeps long moves close to the raw pointer position", () => {
    const smoother = createStrokeSmoother({ x: 5, y: 5 });

    const p = smoothStrokePoint(smoother, { x: 20, y: 5 });

    expect(p.x).toBeGreaterThanOrEqual(19);
    expect(p.y).toBe(5);
  });
});
