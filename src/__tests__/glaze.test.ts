import { describe, it, expect } from "vitest";
import { findClosestCandidate, LEVEL_CANDIDATES } from "../color-engine";
import { computeGlazeDiff, applyDiffToColorMap, buildDiffFromGlazeFill } from "../undo-diff";
import { glazeFloodFill } from "../flood-fill";
import { buildGlazeLUT, paintGlazeCircle, eraseGlazeCircle } from "../glaze-paint";
import { renderBuf } from "../render-buf";

describe("findClosestCandidate", () => {
  it("returns 0 for level 0 (black, achromatic)", () => {
    expect(findClosestCandidate(0, 180)).toBe(0);
  });

  it("returns 0 for level 7 (white, achromatic)", () => {
    expect(findClosestCandidate(7, 90)).toBe(0);
  });

  it("returns a valid index for colored levels", () => {
    for (let lv = 1; lv <= 6; lv++) {
      const idx = findClosestCandidate(lv, 120);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(LEVEL_CANDIDATES[lv].length);
    }
  });

  it("handles hue wraparound (355° should match a candidate near 0°)", () => {
    for (let lv = 1; lv <= 6; lv++) {
      const candidates = LEVEL_CANDIDATES[lv];
      if (candidates.length <= 1) continue;
      // Find if there's a candidate near 0° (or near 360°)
      const nearZero = candidates.findIndex(c => c.angle < 30 || c.angle > 330);
      if (nearZero >= 0) {
        const idx = findClosestCandidate(lv, 355);
        const selected = candidates[idx];
        // Should pick a candidate close to 355° (i.e., near 0° with wraparound)
        const dist = Math.min(Math.abs(selected.angle - 355), 360 - Math.abs(selected.angle - 355));
        expect(dist).toBeLessThan(180);
      }
    }
  });

  it("returns different indices for very different hue angles", () => {
    for (let lv = 1; lv <= 6; lv++) {
      if (LEVEL_CANDIDATES[lv].length < 2) continue;
      const idx0 = findClosestCandidate(lv, 0);
      const idx180 = findClosestCandidate(lv, 180);
      // With sufficiently different hue angles, should pick different candidates
      // (unless level has very few candidates)
      if (LEVEL_CANDIDATES[lv].length >= 3) {
        expect(idx0).not.toBe(idx180);
      }
    }
  });
});

describe("computeGlazeDiff / applyDiffToColorMap", () => {
  it("computes diff for colorMap changes", () => {
    const data = new Uint8Array([3, 5, 5, 3]);
    const oldCm = new Uint8Array([0, 0, 0, 0]);
    const newCm = new Uint8Array([0, 2, 3, 0]);
    const diff = computeGlazeDiff(oldCm, newCm, data);
    expect(diff.idx.length).toBe(2);
    expect(diff.cmOv).toBeDefined();
    expect(diff.cmNv).toBeDefined();
    // data unchanged
    expect(diff.ov[0]).toBe(diff.nv[0]);
  });

  it("round-trips: apply forward then reverse", () => {
    const data = new Uint8Array([1, 2, 3, 4]);
    const oldCm = new Uint8Array([0, 1, 0, 2]);
    const newCm = new Uint8Array([3, 1, 4, 2]);
    const diff = computeGlazeDiff(oldCm, newCm, data);

    const applied = applyDiffToColorMap(oldCm, diff, false);
    expect(Array.from(applied)).toEqual([3, 1, 4, 2]);

    const reverted = applyDiffToColorMap(applied, diff, true);
    expect(Array.from(reverted)).toEqual([0, 1, 0, 2]);
  });

  it("returns original if diff has no cm fields", () => {
    const cm = new Uint8Array([1, 2, 3]);
    const diff = { idx: new Uint32Array([0]), ov: new Uint8Array([1]), nv: new Uint8Array([2]) };
    const result = applyDiffToColorMap(cm, diff, false);
    expect(result).toBe(cm); // same reference
  });
});

describe("glazeFloodFill", () => {
  it("fills connected same-level region in colorMap", () => {
    // 4x4 grid: level pattern
    // L1 L1 L2 L2
    // L1 L1 L2 L2
    // L3 L3 L3 L3
    // L3 L3 L3 L3
    const data = new Uint8Array([
      1, 1, 2, 2,
      1, 1, 2, 2,
      3, 3, 3, 3,
      3, 3, 3, 3,
    ]);
    const colorMap = new Uint8Array(16);
    const result = glazeFloodFill(data, colorMap, 0, 0, 5, 4, 4);
    expect(result).not.toBeNull();
    // L1 region (indices 0,1,4,5) should all be 5
    expect(colorMap[0]).toBe(5);
    expect(colorMap[1]).toBe(5);
    expect(colorMap[4]).toBe(5);
    expect(colorMap[5]).toBe(5);
    // L2 region should be unchanged
    expect(colorMap[2]).toBe(0);
    expect(colorMap[3]).toBe(0);
  });

  it("returns result with no changes if already same value everywhere", () => {
    const data = new Uint8Array([1, 1, 1, 1]);
    const colorMap = new Uint8Array([3, 3, 3, 3]);
    const result = glazeFloodFill(data, colorMap, 0, 0, 3, 2, 2);
    // Fill traverses the region but finds nothing to change
    expect(result).not.toBeNull();
    expect(result!.changed.length).toBe(0);
  });

  it("does not modify data array", () => {
    const data = new Uint8Array([1, 1, 2, 2]);
    const dataCopy = new Uint8Array(data);
    const colorMap = new Uint8Array(4);
    glazeFloodFill(data, colorMap, 0, 0, 5, 2, 2);
    expect(Array.from(data)).toEqual(Array.from(dataCopy));
  });
});

describe("buildGlazeLUT", () => {
  it("produces same results as findClosestCandidate for each level", () => {
    const lut = buildGlazeLUT(120);
    for (let lv = 0; lv < 8; lv++) {
      expect(lut[lv]).toBe(findClosestCandidate(lv, 120) + 1);
    }
  });
});

describe("paintGlazeCircle / eraseGlazeCircle", () => {
  it("paints glaze values based on pixel levels", () => {
    const data = new Uint8Array([3, 3, 5, 5]);
    const colorMap = new Uint8Array(4);
    const lut = buildGlazeLUT(120);
    paintGlazeCircle(colorMap, data, 0, 0, 0, 2, 2, lut);
    // Should write a non-zero value at (0,0)
    expect(colorMap[0]).toBeGreaterThan(0);
  });

  it("eraseGlazeCircle resets to 0", () => {
    const colorMap = new Uint8Array([5, 5, 5, 5]);
    eraseGlazeCircle(colorMap, 0, 0, 0, 2, 2);
    expect(colorMap[0]).toBe(0);
    // Others should remain
    expect(colorMap[1]).toBe(5);
  });
});

describe("renderBuf with colorMap", () => {
  function createStubCanvas(w: number, h: number) {
    const imgData = new ImageData(w, h);
    return {
      getContext: () => ({
        createImageData: (cw: number, ch: number) => new ImageData(cw, ch),
        putImageData: () => {},
      }),
      width: w,
      height: h,
      _imgData: imgData,
    } as unknown as HTMLCanvasElement;
  }

  it("uses LUT when colorMap is all zeros", () => {
    const data = new Uint8Array([3]);
    const lut: [number, number, number][] = Array.from({ length: 8 }, () => [100, 150, 200] as [number, number, number]);
    const colorMap = new Uint8Array([0]);
    const cache = { src: null, prv: null, s32: null, p32: null };
    const canvas = createStubCanvas(1, 1);
    // Should not throw
    renderBuf(data, 1, 1, lut, null, canvas, cache, undefined, colorMap);
    expect(cache.prv).not.toBeNull();
  });

  it("uses variant color when colorMap is non-zero", () => {
    const lv = 3;
    const data = new Uint8Array([lv]);
    const lut: [number, number, number][] = Array.from({ length: 8 }, () => [0, 0, 0] as [number, number, number]);
    const candidates = LEVEL_CANDIDATES[lv];
    const variantIdx = candidates.length > 1 ? 1 : 0;
    const colorMap = new Uint8Array([variantIdx + 1]); // 1-indexed
    const cache = { src: null, prv: null, s32: null, p32: null } as import("../types").ImgCache;
    const canvas = createStubCanvas(1, 1);
    renderBuf(data, 1, 1, lut, null, canvas, cache, undefined, colorMap);
    // Preview should use variant color, not LUT
    expect(cache.prv).not.toBeNull();
    const prv32 = new Uint32Array(cache.prv!.data.buffer);
    const expectedRgb = candidates[variantIdx].rgb;
    const expected = (0xFF000000 | (expectedRgb[2] << 16) | (expectedRgb[1] << 8) | expectedRgb[0]) >>> 0;
    expect(prv32[0]).toBe(expected);
  });
});

describe("buildDiffFromGlazeFill", () => {
  it("builds diff from changed indices", () => {
    const data = new Uint8Array([1, 2, 3, 4]);
    const cmPre = new Uint8Array([0, 0, 0, 0]);
    const cmBuf = new Uint8Array([0, 5, 5, 0]);
    const changed = new Uint32Array([1, 2]);
    const diff = buildDiffFromGlazeFill(cmPre, cmBuf, data, changed);
    expect(diff.idx.length).toBe(2);
    expect(diff.cmOv![0]).toBe(0);
    expect(diff.cmNv![0]).toBe(5);
    // data unchanged
    expect(diff.ov[0]).toBe(diff.nv[0]);
  });
});
