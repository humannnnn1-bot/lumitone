import { describe, expect, it } from "vitest";
import { LEVEL_CANDIDATES } from "../../color-engine";
import {
  ACTIVE_LEVELS,
  bottomProjectionY,
  buildLinkedVisualizationDots,
  BY,
  clampHueFromBottomGraphY,
  clampHueFromRightGraphX,
  compositeSinePath,
  cosinePath,
  CX,
  CY,
  lumR0,
  lumR7,
  rightProjectionX,
  RX,
  sinePath,
  wheelPoint,
} from "../linked-visualization-geometry";

function pathPoints(path: string) {
  return path.split(" ").map((point) => {
    const [x, y] = point.slice(1).split(",").map(Number);
    return { x, y };
  });
}

describe("linked-visualization geometry", () => {
  it("builds one active visible candidate per chromatic level", () => {
    const dots = buildLinkedVisualizationDots(0);

    expect(dots.some((dot) => dot.levelIndex === 0 || dot.levelIndex === 7)).toBe(false);
    expect(dots.every((dot) => dot.angleDeg >= 0)).toBe(true);
    expect(ACTIVE_LEVELS.map((levelIndex) => dots.filter((dot) => dot.levelIndex === levelIndex && dot.isActive).length)).toEqual([
      1, 1, 1, 1, 1, 1,
    ]);
  });

  it("respects direct candidate overrides when selecting active dots", () => {
    expect(LEVEL_CANDIDATES[2].length).toBeGreaterThan(1);

    const dots = buildLinkedVisualizationDots(0, new Map([[2, 1]]));

    expect(dots.find((dot) => dot.levelIndex === 2 && dot.isActive)?.candidateIndex).toBe(1);
  });

  it("keeps L0 and L7 radii complementary", () => {
    expect(lumR0(0)).toBe(0);
    expect(lumR7(7)).toBe(0);
    expect(lumR0(1)).toBeCloseTo(lumR7(6), 6);
    expect(lumR0(3)).toBeCloseTo(lumR7(4), 6);
  });

  it("maps wheel and projection coordinates consistently", () => {
    const radius = lumR0(6);
    const point = wheelPoint(0, 6, 0, lumR0);

    expect(point.x).toBeCloseTo(CX, 6);
    expect(point.y).toBeCloseTo(CY - radius, 6);
    expect(rightProjectionX(0)).toBe(RX + 10);
    expect(rightProjectionX(360)).toBeGreaterThan(rightProjectionX(0));
    expect(bottomProjectionY(0)).toBe(BY + 8);
  });

  it("clamps hue drag coordinates to the valid range", () => {
    expect(clampHueFromRightGraphX(-100)).toBe(0);
    expect(clampHueFromRightGraphX(rightProjectionX(180))).toBeCloseTo(180, 6);
    expect(clampHueFromRightGraphX(9999)).toBe(360);

    expect(clampHueFromBottomGraphY(-100)).toBe(0);
    expect(clampHueFromBottomGraphY(bottomProjectionY(240))).toBeCloseTo(240, 6);
    expect(clampHueFromBottomGraphY(9999)).toBe(360);
  });

  it("generates stable sine, cosine, and composite projection paths", () => {
    expect(sinePath(0, lumR0, 0)).toBe("");
    expect(cosinePath(7, lumR7, 0)).toBe("");

    const sine = pathPoints(sinePath(6, lumR0, 0));
    const cosine = pathPoints(cosinePath(6, lumR0, 0));
    const cancelledComposite = pathPoints(compositeSinePath(lumR0(1), 0, 180));

    expect(sine).toHaveLength(181);
    expect(cosine).toHaveLength(181);
    expect(sine[0].x).toBeCloseTo(rightProjectionX(0), 1);
    expect(sine[0].y).toBeCloseTo(CY - lumR0(6), 1);
    expect(cosine[0].x).toBeCloseTo(CX, 1);
    expect(cosine[0].y).toBeCloseTo(bottomProjectionY(0), 1);
    expect(cancelledComposite.every((point) => Math.abs(point.y - CY) < 0.2)).toBe(true);
  });
});
