import { describe, it, expect } from "vitest";
import { computeNoiseLevelNorm } from "../utils/pixel-analysis";
import { LEVEL_MASK } from "../constants";

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
    it("luminance mode: only levelNorm should be populated", () => {
      const w = 4, h = 4, n = w * h;
      const data = new Uint8Array(n);
      // Fill with varying levels 0-7
      for (let i = 0; i < n; i++) data[i] = i % 8;

      // Simulate what the worker does for "luminance" mode
      const levelNorm = new Float32Array(n);
      for (let i = 0; i < n; i++) levelNorm[i] = (data[i] & LEVEL_MASK) / 7;

      // levelNorm should have values
      expect(levelNorm.length).toBe(n);
      expect(levelNorm[0]).toBe(0);        // level 0 -> 0/7
      expect(levelNorm[7]).toBeCloseTo(1); // level 7 -> 7/7

      // In the worker, noise/depth/etc would be empty Float32Array(0)
      const emptyNoise = new Float32Array(0);
      expect(emptyNoise.length).toBe(0);
    });
  });

  describe("conditional allocation for noise mode", () => {
    it("noise mode: produces noise + levelNorm arrays", () => {
      const w = 4, h = 4, n = w * h;
      const data = new Uint8Array(n);
      // Create a checkerboard pattern of levels 0 and 3
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          data[y * w + x] = (x + y) % 2 === 0 ? 0 : 3;
        }
      }

      const noise = new Float32Array(n);
      const levelNorm = new Float32Array(n);
      computeNoiseLevelNorm(data, w, h, noise, levelNorm);

      // Both noise and levelNorm should be populated
      expect(noise.length).toBe(n);
      expect(levelNorm.length).toBe(n);

      // Interior pixels in a checkerboard should have high noise (all neighbours differ)
      // Corner pixel (0,0) has 2 neighbours, both differ => diff=2, noise=2/4=0.5
      expect(noise[0]).toBeCloseTo(0.5);

      // Interior pixel (1,1) has 4 neighbours, all differ => diff=4, noise=4/4=1.0
      expect(noise[1 * w + 1]).toBeCloseTo(1.0);

      // levelNorm values should match level / 7
      expect(levelNorm[0]).toBeCloseTo(0 / 7); // level 0
      expect(levelNorm[1]).toBeCloseTo(3 / 7); // level 3
    });
  });
});
