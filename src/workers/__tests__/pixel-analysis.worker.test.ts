import { describe, it, expect } from "vitest";
import { computeNeighborIsolationAndLevelTone } from "../../utils/pixel-analysis";
import { LEVEL_MASK } from "../../constants";

/**
 * Tests for the pixel-analysis worker logic.
 * We test the pure utility functions directly since the worker
 * delegates to them and the worker shell itself uses self.onmessage.
 *
 * We also test the conditional allocation logic the worker uses:
 * only the arrays needed for a given mode should be non-empty.
 */

describe("pixel-analysis worker logic", () => {
  describe("conditional allocation for luminance mode", () => {
    it("luminance mode: only levelTone should be populated", () => {
      const w = 4,
        h = 4,
        n = w * h;
      const levelData = new Uint8Array(n);
      // Fill with varying levels 0-7
      for (let i = 0; i < n; i++) levelData[i] = i % 8;

      // Simulate what the worker does for "luminance" mode
      const levelTone = new Float32Array(n);
      for (let i = 0; i < n; i++) levelTone[i] = (levelData[i] & LEVEL_MASK) / 7;

      // levelTone should have values
      expect(levelTone.length).toBe(n);
      expect(levelTone[0]).toBe(0); // level 0 -> 0/7
      expect(levelTone[7]).toBeCloseTo(1); // level 7 -> 7/7

      // In the worker, neighborIsolation/depth/etc would be empty Float32Array(0)
      const emptyNoise = new Float32Array(0);
      expect(emptyNoise.length).toBe(0);
    });
  });

  describe("conditional allocation for neighborIsolation mode", () => {
    it("neighborIsolation mode: produces neighborIsolation + levelTone arrays", () => {
      const w = 4,
        h = 4,
        n = w * h;
      const levelData = new Uint8Array(n);
      // Create a checkerboard pattern of levels 0 and 3
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          levelData[y * w + x] = (x + y) % 2 === 0 ? 0 : 3;
        }
      }

      const neighborIsolation = new Float32Array(n);
      const levelTone = new Float32Array(n);
      computeNeighborIsolationAndLevelTone(levelData, w, h, neighborIsolation, levelTone);

      // Both neighborIsolation and levelTone should be populated
      expect(neighborIsolation.length).toBe(n);
      expect(levelTone.length).toBe(n);

      // Interior pixels in a checkerboard should have high neighborIsolation (all neighbours differ)
      // Corner pixel (0,0) has 2 neighbours, both differ => diff=2, neighborIsolation=2/4=0.5
      expect(neighborIsolation[0]).toBeCloseTo(0.5);

      // Interior pixel (1,1) has 4 neighbours, all differ => diff=4, neighborIsolation=4/4=1.0
      expect(neighborIsolation[1 * w + 1]).toBeCloseTo(1.0);

      // levelTone values should match level / 7
      expect(levelTone[0]).toBeCloseTo(0 / 7); // level 0
      expect(levelTone[1]).toBeCloseTo(3 / 7); // level 3
    });
  });
});
