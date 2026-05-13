import { describe, expect, it } from "vitest";
import { LEVEL_CANDIDATES, LEVEL_INFO, findClosestCandidate } from "../../color-engine";
import {
  buildActiveMusicLevels,
  buildMusicHueTicks,
  buildMusicLevelPreview,
  buildMusicSonificationLevels,
  findMusicFanoLine,
} from "../music-panel-derived";

describe("music panel derived data", () => {
  it("finds Fano line indices from XOR operands independent of order", () => {
    expect(findMusicFanoLine(1, 2)).toBe(0);
    expect(findMusicFanoLine(2, 1)).toBe(0);
    expect(findMusicFanoLine(1, 6)).toBe(3);
    expect(findMusicFanoLine(1, 1)).toBe(-1);
  });

  it("builds sonification levels from direct candidates and hue fallback", () => {
    const directCandidate = Math.min(1, LEVEL_CANDIDATES[2].length - 1);
    const candidateOverridesByLevel = new Map<number, number>([[2, directCandidate]]);
    const levels = buildMusicSonificationLevels(candidateOverridesByLevel, 123);

    expect(levels.map((level) => level.levelIndex)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(levels[1]).toEqual({
      levelIndex: 2,
      hueAngleDeg: LEVEL_CANDIDATES[2][directCandidate].angle,
      luma255: LEVEL_INFO[2].gray,
    });

    const fallbackCandidate = findClosestCandidate(3, 123);
    expect(levels[2]).toEqual({
      levelIndex: 3,
      hueAngleDeg: LEVEL_CANDIDATES[3][fallbackCandidate].angle,
      luma255: LEVEL_INFO[3].gray,
    });
  });

  it("builds level previews for all eight levels", () => {
    const directCandidate = Math.min(1, LEVEL_CANDIDATES[4].length - 1);
    const preview = buildMusicLevelPreview(new Map([[4, directCandidate]]), 90);

    expect(preview).toHaveLength(8);
    expect(preview[0]).toMatchObject({ levelIndex: 0, name: "Black", hex: "rgb(0,0,0)" });
    expect(preview[4]).toEqual({
      levelIndex: 4,
      name: LEVEL_INFO[4].name,
      rgb: LEVEL_CANDIDATES[4][directCandidate].rgb,
      hex: `rgb(${LEVEL_CANDIDATES[4][directCandidate].rgb.join(",")})`,
    });
  });

  it("filters active levels to L1-L6 for visual components", () => {
    const preview = buildMusicLevelPreview(new Map(), 180);
    const active = buildActiveMusicLevels(preview);

    expect(active.map((level) => level.levelIndex)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(active[0].rgb).toEqual(preview[1].rgb);
  });

  it("builds stable hue tick positions for chromatic levels", () => {
    const ticks = buildMusicHueTicks();
    const expectedCount = [2, 3, 4, 5].reduce((sum, levelIndex) => sum + LEVEL_CANDIDATES[levelIndex].length, 0);

    expect(ticks).toHaveLength(expectedCount);
    expect(ticks.every((tick) => tick.deg >= 0 && tick.deg < 360)).toBe(true);
    expect(ticks[0].color).toBe(`rgb(${LEVEL_CANDIDATES[2][0].rgb.join(",")})`);
  });
});
