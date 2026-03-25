import { describe, it, expect } from "vitest";
import { generateAllVariants, renderThumbnail } from "../hooks/useGallery";
import { DEFAULT_CC, buildColorLUT, LEVEL_CANDIDATES } from "../color-engine";

describe("generateAllVariants", () => {
  it("returns single variant when all levels are locked", () => {
    const locked = new Array(8).fill(true);
    const hist = new Array(8).fill(100);
    const result = generateAllVariants([...DEFAULT_CC], locked, hist);
    expect(result.length).toBe(1);
  });

  it("returns single variant when all levels have single candidate", () => {
    // Levels 0 (black) and 7 (white) have only 1 candidate each
    const locked = new Array(8).fill(false);
    const hist = new Array(8).fill(0);
    hist[0] = 100; // only black
    hist[7] = 100; // only white
    const result = generateAllVariants([...DEFAULT_CC], locked, hist);
    expect(result.length).toBe(1);
  });

  it("returns correct count for unlocked levels with multiple candidates", () => {
    const locked = new Array(8).fill(true);
    const hist = new Array(8).fill(100);
    // Unlock level 2 (Red vertex, has candidates)
    locked[2] = false;
    const expected = LEVEL_CANDIDATES[2].length;
    const result = generateAllVariants([...DEFAULT_CC], locked, hist);
    expect(result.length).toBe(expected);
  });

  it("excludes levels with 0 pixels from variation", () => {
    const locked = new Array(8).fill(false);
    const hist = new Array(8).fill(0);
    hist[0] = 100; // only level 0 used
    const result = generateAllVariants([...DEFAULT_CC], locked, hist);
    // level 0 has only 1 candidate, all others unused → 1 variant
    expect(result.length).toBe(1);
  });

  it("caps at MAX_VARIANTS (10000) for large Cartesian products", () => {
    const locked = new Array(8).fill(false);
    const hist = new Array(8).fill(100);
    // All levels used and unlocked — product will exceed 10000
    const result = generateAllVariants([...DEFAULT_CC], locked, hist);
    expect(result.length).toBeLessThanOrEqual(10_000);
  });

  it("each variant has exactly 8 elements", () => {
    const locked = new Array(8).fill(false);
    const hist = new Array(8).fill(100);
    locked[0] = true; locked[7] = true; // lock extremes
    const result = generateAllVariants([...DEFAULT_CC], locked, hist);
    for (const v of result) {
      expect(v.length).toBe(8);
    }
  });

  it("variant indices are valid for each level's candidates", () => {
    const locked = new Array(8).fill(false);
    const hist = new Array(8).fill(100);
    locked[0] = true; locked[7] = true;
    const result = generateAllVariants([...DEFAULT_CC], locked, hist);
    for (const v of result) {
      for (let lv = 0; lv < 8; lv++) {
        expect(v[lv]).toBeGreaterThanOrEqual(0);
        expect(v[lv]).toBeLessThan(LEVEL_CANDIDATES[lv].length);
      }
    }
  });

  it("locked levels preserve their cc value", () => {
    const cc = [...DEFAULT_CC];
    const locked = new Array(8).fill(true);
    locked[3] = false; // only unlock level 3
    const hist = new Array(8).fill(100);
    const result = generateAllVariants(cc, locked, hist);
    for (const v of result) {
      for (let lv = 0; lv < 8; lv++) {
        if (lv !== 3) {
          expect(v[lv]).toBe(cc[lv] % LEVEL_CANDIDATES[lv].length);
        }
      }
    }
  });
});

describe("renderThumbnail", () => {
  it("produces ImageData of correct dimensions", () => {
    const data = new Uint8Array(16).fill(0); // 4x4 canvas
    const lut = buildColorLUT([...DEFAULT_CC]);
    const img = renderThumbnail(data, 4, 4, lut, 2, 2);
    expect(img.width).toBe(2);
    expect(img.height).toBe(2);
    expect(img.data.length).toBe(2 * 2 * 4);
  });

  it("maps level 0 to correct LUT color", () => {
    const data = new Uint8Array(4).fill(0); // 2x2 all level 0
    const lut = buildColorLUT([...DEFAULT_CC]);
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
    data[0] = 0; data[1] = 0; data[4] = 0; data[5] = 0; // top-left: level 0
    data[2] = 3; data[3] = 3; data[6] = 3; data[7] = 3; // top-right: level 3
    data[8] = 5; data[9] = 5; data[12] = 5; data[13] = 5; // bottom-left: level 5
    data[10] = 7; data[11] = 7; data[14] = 7; data[15] = 7; // bottom-right: level 7

    const lut = buildColorLUT([...DEFAULT_CC]);
    const img = renderThumbnail(data, 4, 4, lut, 2, 2);

    // Each pixel of 2x2 thumbnail samples from a different quadrant
    expect(img.data[0]).toBe(lut[0][0]); // top-left → level 0
    expect(img.data[4]).toBe(lut[3][0]); // top-right → level 3
    expect(img.data[8]).toBe(lut[5][0]); // bottom-left → level 5
    expect(img.data[12]).toBe(lut[7][0]); // bottom-right → level 7
  });

  it("handles 1x1 thumbnail", () => {
    const data = new Uint8Array(100).fill(4);
    const lut = buildColorLUT([...DEFAULT_CC]);
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
    const data = new Uint8Array(4).fill(0xFF);
    const lut = buildColorLUT([...DEFAULT_CC]);
    const img = renderThumbnail(data, 2, 2, lut, 2, 2);
    const rgb = lut[7]; // 0xFF & 7 = 7
    expect(img.data[0]).toBe(rgb[0]);
  });
});
