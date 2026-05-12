// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { generateAllVariants, renderThumbnail, useGallery } from "../useGallery";
import { DEFAULT_CANDIDATE_INDEX_BY_LEVEL, buildColorLUT, LEVEL_CANDIDATES } from "../../color-engine";
import type { CanvasData } from "../../types";

function makeCvs(w = 4, h = 4): CanvasData {
  const data = new Uint8Array(w * h);
  for (let i = 0; i < data.length; i++) data[i] = i % 8;
  return { width: w, height: h, levelData: data, pixelCandidateOverrideMap: new Uint8Array(w * h) };
}

describe("generateAllVariants", () => {
  it("returns single variant when all levels are locked", () => {
    const locked = new Array(8).fill(true);
    const levelHistogram = new Array(8).fill(100);
    const result = generateAllVariants([...DEFAULT_CANDIDATE_INDEX_BY_LEVEL], locked, levelHistogram);
    expect(result.length).toBe(1);
  });

  it("returns single variant when all levels have single candidate", () => {
    // Levels 0 (black) and 7 (white) have only 1 candidate each
    const locked = new Array(8).fill(false);
    const levelHistogram = new Array(8).fill(0);
    levelHistogram[0] = 100; // only black
    levelHistogram[7] = 100; // only white
    const result = generateAllVariants([...DEFAULT_CANDIDATE_INDEX_BY_LEVEL], locked, levelHistogram);
    expect(result.length).toBe(1);
  });

  it("returns correct count for unlocked levels with multiple candidates", () => {
    const locked = new Array(8).fill(true);
    const levelHistogram = new Array(8).fill(100);
    // Unlock level 2 (Red vertex, has candidates)
    locked[2] = false;
    const expected = LEVEL_CANDIDATES[2].length;
    const result = generateAllVariants([...DEFAULT_CANDIDATE_INDEX_BY_LEVEL], locked, levelHistogram);
    expect(result.length).toBe(expected);
  });

  it("excludes levels with 0 pixels from variation", () => {
    const locked = new Array(8).fill(false);
    const levelHistogram = new Array(8).fill(0);
    levelHistogram[0] = 100; // only level 0 used
    const result = generateAllVariants([...DEFAULT_CANDIDATE_INDEX_BY_LEVEL], locked, levelHistogram);
    // level 0 has only 1 candidate, all others unused → 1 variant
    expect(result.length).toBe(1);
  });

  it("generates the current maximum of 81 variants when all levels are used and unlocked", () => {
    const locked = new Array(8).fill(false);
    const levelHistogram = new Array(8).fill(100);
    const currentMax = LEVEL_CANDIDATES.reduce((total, candidates) => total * candidates.length, 1);

    const result = generateAllVariants([...DEFAULT_CANDIDATE_INDEX_BY_LEVEL], locked, levelHistogram);

    expect(currentMax).toBe(81);
    expect(result).toHaveLength(81);
  });

  it("each variant has exactly 8 elements", () => {
    const locked = new Array(8).fill(false);
    const levelHistogram = new Array(8).fill(100);
    locked[0] = true;
    locked[7] = true; // lock extremes
    const result = generateAllVariants([...DEFAULT_CANDIDATE_INDEX_BY_LEVEL], locked, levelHistogram);
    for (const v of result) {
      expect(v.length).toBe(8);
    }
  });

  it("variant indices are valid for each level's candidates", () => {
    const locked = new Array(8).fill(false);
    const levelHistogram = new Array(8).fill(100);
    locked[0] = true;
    locked[7] = true;
    const result = generateAllVariants([...DEFAULT_CANDIDATE_INDEX_BY_LEVEL], locked, levelHistogram);
    for (const v of result) {
      for (let lv = 0; lv < 8; lv++) {
        expect(v[lv]).toBeGreaterThanOrEqual(0);
        expect(v[lv]).toBeLessThan(LEVEL_CANDIDATES[lv].length);
      }
    }
  });

  it("locked levels preserve their candidateIndexByLevel value", () => {
    const candidateIndexByLevel = [...DEFAULT_CANDIDATE_INDEX_BY_LEVEL];
    const locked = new Array(8).fill(true);
    locked[3] = false; // only unlock level 3
    const levelHistogram = new Array(8).fill(100);
    const result = generateAllVariants(candidateIndexByLevel, locked, levelHistogram);
    for (const v of result) {
      for (let lv = 0; lv < 8; lv++) {
        if (lv !== 3) {
          expect(v[lv]).toBe(candidateIndexByLevel[lv] % LEVEL_CANDIDATES[lv].length);
        }
      }
    }
  });
});

describe("renderThumbnail", () => {
  it("produces ImageData of correct dimensions", () => {
    const data = new Uint8Array(16).fill(0); // 4x4 canvas
    const lut = buildColorLUT([...DEFAULT_CANDIDATE_INDEX_BY_LEVEL]);
    const img = renderThumbnail(data, 4, 4, lut, 2, 2);
    expect(img.width).toBe(2);
    expect(img.height).toBe(2);
    expect(img.data.length).toBe(2 * 2 * 4);
  });

  it("maps level 0 to correct LUT color", () => {
    const data = new Uint8Array(4).fill(0); // 2x2 all level 0
    const lut = buildColorLUT([...DEFAULT_CANDIDATE_INDEX_BY_LEVEL]);
    const img = renderThumbnail(data, 2, 2, lut, 2, 2);
    const rgb = lut[0];
    // Check first pixel
    expect(img.data[0]).toBe(rgb[0]);
    expect(img.data[1]).toBe(rgb[1]);
    expect(img.data[2]).toBe(rgb[2]);
    expect(img.data[3]).toBe(255);
  });

  it("downscales by nearest-neighbor sampling", () => {
    // 4x4 canvas with different levels in quadrants
    const data = new Uint8Array(16);
    data[0] = 0;
    data[1] = 0;
    data[4] = 0;
    data[5] = 0; // top-left: level 0
    data[2] = 3;
    data[3] = 3;
    data[6] = 3;
    data[7] = 3; // top-right: level 3
    data[8] = 5;
    data[9] = 5;
    data[12] = 5;
    data[13] = 5; // bottom-left: level 5
    data[10] = 7;
    data[11] = 7;
    data[14] = 7;
    data[15] = 7; // bottom-right: level 7

    const lut = buildColorLUT([...DEFAULT_CANDIDATE_INDEX_BY_LEVEL]);
    const img = renderThumbnail(data, 4, 4, lut, 2, 2);

    // Each pixel of 2x2 thumbnail samples from a different quadrant
    expect(img.data[0]).toBe(lut[0][0]); // top-left → level 0
    expect(img.data[4]).toBe(lut[3][0]); // top-right → level 3
    expect(img.data[8]).toBe(lut[5][0]); // bottom-left → level 5
    expect(img.data[12]).toBe(lut[7][0]); // bottom-right → level 7
  });

  it("handles 1x1 thumbnail", () => {
    const data = new Uint8Array(100).fill(4);
    const lut = buildColorLUT([...DEFAULT_CANDIDATE_INDEX_BY_LEVEL]);
    const img = renderThumbnail(data, 10, 10, lut, 1, 1);
    expect(img.width).toBe(1);
    expect(img.height).toBe(1);
    const rgb = lut[4];
    expect(img.data[0]).toBe(rgb[0]);
    expect(img.data[1]).toBe(rgb[1]);
    expect(img.data[2]).toBe(rgb[2]);
  });

  it("masks pixel values to 3 bits", () => {
    // Value 0xFF should be masked to 7
    const data = new Uint8Array(4).fill(0xff);
    const lut = buildColorLUT([...DEFAULT_CANDIDATE_INDEX_BY_LEVEL]);
    const img = renderThumbnail(data, 2, 2, lut, 2, 2);
    const rgb = lut[7]; // 0xFF & 7 = 7
    expect(img.data[0]).toBe(rgb[0]);
  });
});

describe("useGallery", () => {
  const locked = new Array(8).fill(true);
  const levelHistogram = new Array(8).fill(1);

  it("waits while inactive and generates when activated", async () => {
    const canvasData = makeCvs();
    const hook = renderHook(({ active }) => useGallery(canvasData, [...DEFAULT_CANDIDATE_INDEX_BY_LEVEL], locked, levelHistogram, active), {
      initialProps: { active: false },
    });

    expect(hook.result.current.items).toHaveLength(0);

    hook.rerender({ active: true });

    await waitFor(() => expect(hook.result.current.items).toHaveLength(1));
    expect(hook.result.current.items[0].imageData).not.toBeNull();

    hook.unmount();
  });

  it("reuses generated items for the same canvas data and regenerates when data changes", async () => {
    const first = makeCvs();
    const second = makeCvs();
    const candidateIndexByLevel = [...DEFAULT_CANDIDATE_INDEX_BY_LEVEL];
    const hook = renderHook(({ canvasData }) => useGallery(canvasData, candidateIndexByLevel, locked, levelHistogram, true), {
      initialProps: { canvasData: first },
    });

    await waitFor(() => expect(hook.result.current.items).toHaveLength(1));
    const firstItems = hook.result.current.items;

    hook.rerender({ canvasData: { ...first } });
    expect(hook.result.current.items).toBe(firstItems);

    hook.rerender({ canvasData: second });
    await waitFor(() => expect(hook.result.current.items).not.toBe(firstItems));

    hook.unmount();
  });
});
