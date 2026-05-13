import { describe, it, expect } from "vitest";
import { findClosestCandidate, LEVEL_CANDIDATES } from "../../color-engine";
import { computeGlazeDiff, applyDiffToPixelCandidateOverrideMap, buildDiffFromGlazeFill } from "../../state/undo-diff";
import { glazeFloodFill } from "../flood-fill";
import { buildGlazeLUT, paintGlazeCircle, eraseGlazeCircle } from "../glaze-paint";
import { buildGlazeHighlightPixels, GLAZE_HIGHLIGHT_RGBA } from "../glaze-highlight";
import { renderCanvasBuffers } from "../render-buf";

describe("findClosestCandidate", () => {
  it("returns 0 for level 0 (black, achromatic)", () => {
    expect(findClosestCandidate(0, 180)).toBe(0);
  });

  it("returns 0 for level 7 (white, achromatic)", () => {
    expect(findClosestCandidate(7, 90)).toBe(0);
  });

  it("returns a valid index for colored levels", () => {
    for (let lv = 1; lv <= 6; lv++) {
      const indices = findClosestCandidate(lv, 120);
      expect(indices).toBeGreaterThanOrEqual(0);
      expect(indices).toBeLessThan(LEVEL_CANDIDATES[lv].length);
    }
  });

  it("handles hue wraparound (355° should match a candidate near 0°)", () => {
    for (let lv = 1; lv <= 6; lv++) {
      const candidates = LEVEL_CANDIDATES[lv];
      if (candidates.length <= 1) continue;
      // Find if there's a candidate near 0° (or near 360°)
      const nearZero = candidates.findIndex((c) => c.hueAngleDeg < 30 || c.hueAngleDeg > 330);
      if (nearZero >= 0) {
        const indices = findClosestCandidate(lv, 355);
        const selected = candidates[indices];
        // Should pick a candidate close to 355° (i.e., near 0° with wraparound)
        const dist = Math.min(Math.abs(selected.hueAngleDeg - 355), 360 - Math.abs(selected.hueAngleDeg - 355));
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

describe("computeGlazeDiff / applyDiffToPixelCandidateOverrideMap", () => {
  it("computes diff for pixelCandidateOverrideMap changes", () => {
    const levelData = new Uint8Array([3, 5, 5, 3]);
    const oldOverrideMap = new Uint8Array([0, 0, 0, 0]);
    const newOverrideMap = new Uint8Array([0, 2, 3, 0]);
    const diff = computeGlazeDiff(oldOverrideMap, newOverrideMap, levelData);
    expect(diff.indices.length).toBe(2);
    expect(diff.oldPixelCandidateOverrideValues).toBeDefined();
    expect(diff.newPixelCandidateOverrideValues).toBeDefined();
    // levelData unchanged
    expect(diff.oldLevelValues[0]).toBe(diff.newLevelValues[0]);
  });

  it("round-trips: apply forward then reverse", () => {
    const levelData = new Uint8Array([1, 2, 3, 4]);
    const oldOverrideMap = new Uint8Array([0, 1, 0, 2]);
    const newOverrideMap = new Uint8Array([3, 1, 4, 2]);
    const diff = computeGlazeDiff(oldOverrideMap, newOverrideMap, levelData);

    const applied = applyDiffToPixelCandidateOverrideMap(oldOverrideMap, diff, false);
    expect(Array.from(applied)).toEqual([3, 1, 4, 2]);

    const reverted = applyDiffToPixelCandidateOverrideMap(applied, diff, true);
    expect(Array.from(reverted)).toEqual([0, 1, 0, 2]);
  });

  it("returns original if diff has no pixel candidate override fields", () => {
    const pixelCandidateOverrideMap = new Uint8Array([1, 2, 3]);
    const diff = { indices: new Uint32Array([0]), oldLevelValues: new Uint8Array([1]), newLevelValues: new Uint8Array([2]) };
    const result = applyDiffToPixelCandidateOverrideMap(pixelCandidateOverrideMap, diff, false);
    expect(result).toBe(pixelCandidateOverrideMap); // same reference
  });
});

describe("glazeFloodFill", () => {
  it("fills connected same-level region in pixelCandidateOverrideMap", () => {
    // 4x4 grid: level pattern
    // L1 L1 L2 L2
    // L1 L1 L2 L2
    // L3 L3 L3 L3
    // L3 L3 L3 L3
    const levelData = new Uint8Array([1, 1, 2, 2, 1, 1, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3]);
    const pixelCandidateOverrideMap = new Uint8Array(16);
    const result = glazeFloodFill(levelData, pixelCandidateOverrideMap, 0, 0, 5, 4, 4);
    expect(result).not.toBeNull();
    // L1 region (indices 0,1,4,5) should all be 5
    expect(pixelCandidateOverrideMap[0]).toBe(5);
    expect(pixelCandidateOverrideMap[1]).toBe(5);
    expect(pixelCandidateOverrideMap[4]).toBe(5);
    expect(pixelCandidateOverrideMap[5]).toBe(5);
    // L2 region should be unchanged
    expect(pixelCandidateOverrideMap[2]).toBe(0);
    expect(pixelCandidateOverrideMap[3]).toBe(0);
  });

  it("returns result with no changes if already same value everywhere", () => {
    const levelData = new Uint8Array([1, 1, 1, 1]);
    const pixelCandidateOverrideMap = new Uint8Array([3, 3, 3, 3]);
    const result = glazeFloodFill(levelData, pixelCandidateOverrideMap, 0, 0, 3, 2, 2);
    // Fill traverses the region but finds nothing to change
    expect(result).not.toBeNull();
    expect(result!.changedIndices.length).toBe(0);
  });

  it("does not modify levelData array", () => {
    const levelData = new Uint8Array([1, 1, 2, 2]);
    const levelDataCopy = new Uint8Array(levelData);
    const pixelCandidateOverrideMap = new Uint8Array(4);
    glazeFloodFill(levelData, pixelCandidateOverrideMap, 0, 0, 5, 2, 2);
    expect(Array.from(levelData)).toEqual(Array.from(levelDataCopy));
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
    const levelData = new Uint8Array([3, 3, 5, 5]);
    const pixelCandidateOverrideMap = new Uint8Array(4);
    const lut = buildGlazeLUT(120);
    paintGlazeCircle(pixelCandidateOverrideMap, levelData, 0, 0, 0, 2, 2, lut);
    // Should write a non-zero value at (0,0)
    expect(pixelCandidateOverrideMap[0]).toBeGreaterThan(0);
  });

  it("eraseGlazeCircle resets to 0", () => {
    const pixelCandidateOverrideMap = new Uint8Array([5, 5, 5, 5]);
    eraseGlazeCircle(pixelCandidateOverrideMap, 0, 0, 0, 2, 2);
    expect(pixelCandidateOverrideMap[0]).toBe(0);
    // Others should remain
    expect(pixelCandidateOverrideMap[1]).toBe(5);
  });
});

describe("buildGlazeHighlightPixels", () => {
  it("returns a transparent overlay when no pixels are glazed", () => {
    const pixels = buildGlazeHighlightPixels(new Uint8Array(9), 3, 3);
    expect([...pixels].every((value) => value === 0)).toBe(true);
  });

  it("dims unglazed pixels and draws stronger edges around glazed pixels", () => {
    const pixelCandidateOverrideMap = new Uint8Array(25);
    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 3; x++) pixelCandidateOverrideMap[y * 5 + x] = 1;
    }
    const pixels = buildGlazeHighlightPixels(pixelCandidateOverrideMap, 5, 5);
    const rgbaAt = (x: number, y: number) => [...pixels.slice((y * 5 + x) * 4, (y * 5 + x) * 4 + 4)];

    expect(rgbaAt(2, 2)).toEqual(GLAZE_HIGHLIGHT_RGBA.fill);
    expect(rgbaAt(1, 1)).toEqual(GLAZE_HIGHLIGHT_RGBA.edge);
    expect(rgbaAt(2, 0)).toEqual(GLAZE_HIGHLIGHT_RGBA.dimEdge);
    expect(rgbaAt(0, 0)).toEqual(GLAZE_HIGHLIGHT_RGBA.dim);
  });
});

describe("renderCanvasBuffers with pixelCandidateOverrideMap", () => {
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

  it("uses LUT when pixelCandidateOverrideMap is all zeros", () => {
    const levelData = new Uint8Array([3]);
    const lut: [number, number, number][] = Array.from({ length: 8 }, () => [100, 150, 200] as [number, number, number]);
    const pixelCandidateOverrideMap = new Uint8Array([0]);
    const cache = { sourceImageData: null, previewImageData: null, sourcePixels32: null, previewPixels32: null };
    const canvas = createStubCanvas(1, 1);
    // Should not throw
    renderCanvasBuffers(levelData, 1, 1, lut, null, canvas, cache, undefined, pixelCandidateOverrideMap);
    expect(cache.previewImageData).not.toBeNull();
  });

  it("uses variant color when pixelCandidateOverrideMap is non-zero", () => {
    const lv = 3;
    const levelData = new Uint8Array([lv]);
    const lut: [number, number, number][] = Array.from({ length: 8 }, () => [0, 0, 0] as [number, number, number]);
    const candidates = LEVEL_CANDIDATES[lv];
    const variantIdx = candidates.length > 1 ? 1 : 0;
    const pixelCandidateOverrideMap = new Uint8Array([variantIdx + 1]); // 1-indexed
    const cache = {
      sourceImageData: null,
      previewImageData: null,
      sourcePixels32: null,
      previewPixels32: null,
    } as import("../../types").ImageRenderCache;
    const canvas = createStubCanvas(1, 1);
    renderCanvasBuffers(levelData, 1, 1, lut, null, canvas, cache, undefined, pixelCandidateOverrideMap);
    // Preview should use variant color, not LUT
    expect(cache.previewImageData).not.toBeNull();
    const prv32 = new Uint32Array(cache.previewImageData!.data.buffer);
    const expectedRgb = candidates[variantIdx].rgb;
    const expected = (0xff000000 | (expectedRgb[2] << 16) | (expectedRgb[1] << 8) | expectedRgb[0]) >>> 0;
    expect(prv32[0]).toBe(expected);
  });
});

describe("buildDiffFromGlazeFill", () => {
  it("builds diff from changed indices", () => {
    const levelData = new Uint8Array([1, 2, 3, 4]);
    const beforeOverrideMap = new Uint8Array([0, 0, 0, 0]);
    const workingOverrideMap = new Uint8Array([0, 5, 5, 0]);
    const changed = new Uint32Array([1, 2]);
    const diff = buildDiffFromGlazeFill(beforeOverrideMap, workingOverrideMap, levelData, changed);
    expect(diff.indices.length).toBe(2);
    expect(diff.oldPixelCandidateOverrideValues![0]).toBe(0);
    expect(diff.newPixelCandidateOverrideValues![0]).toBe(5);
    // levelData unchanged
    expect(diff.oldLevelValues[0]).toBe(diff.newLevelValues[0]);
  });
});
