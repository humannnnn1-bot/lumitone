import { describe, it, expect } from "vitest";
import {
  computeNeighborIsolationAndLevelTone,
  computeLocalDiversity,
  computeBoundaryDistance,
  computeGradient,
  computeRegion,
} from "../pixel-analysis";

describe("pixel-analysis", () => {
  describe("computeNeighborIsolationAndLevelTone", () => {
    it("returns zero neighborIsolation for uniform image", () => {
      const w = 4,
        h = 4;
      const data = new Uint8Array(w * h).fill(3);
      const neighborIsolation = new Float32Array(w * h);
      const levelTone = new Float32Array(w * h);
      computeNeighborIsolationAndLevelTone(data, w, h, neighborIsolation, levelTone);
      for (let i = 0; i < w * h; i++) {
        expect(neighborIsolation[i]).toBe(0);
        expect(levelTone[i]).toBeCloseTo(3 / 7);
      }
    });

    it("detects neighborIsolation at boundaries", () => {
      // 2x2 image: top-left=0, others=7
      const data = new Uint8Array([0, 7, 7, 7]);
      const neighborIsolation = new Float32Array(4);
      const levelTone = new Float32Array(4);
      computeNeighborIsolationAndLevelTone(data, 2, 2, neighborIsolation, levelTone);
      // pixel (0,0) has 2 neighbors different (right and below), out of 4 possible
      expect(neighborIsolation[0]).toBe(0.5); // 2/4 neighbors different
      expect(levelTone[0]).toBe(0);
      expect(levelTone[1]).toBe(1);
    });
  });

  describe("computeLocalDiversity", () => {
    it("returns zero diversity for uniform image", () => {
      const w = 5,
        h = 5;
      const data = new Uint8Array(w * h).fill(2);
      const diversity = new Float32Array(w * h);
      computeLocalDiversity(data, w, h, diversity);
      for (let i = 0; i < w * h; i++) {
        expect(diversity[i]).toBe(0);
      }
    });

    it("detects diversity at level boundaries", () => {
      // 5x5 image: left half level 0, right half level 7
      const w = 5,
        h = 5;
      const data = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          data[y * w + x] = x < 3 ? 0 : 7;
        }
      }
      const diversity = new Float32Array(w * h);
      computeLocalDiversity(data, w, h, diversity);
      // Center pixel (2,2) should see both levels → diversity > 0
      expect(diversity[2 * w + 2]).toBeGreaterThan(0);
    });
  });

  describe("computeBoundaryDistance", () => {
    it("marks edges between different levels", () => {
      // 4x4 image: left half 0, right half 3
      const w = 4,
        h = 4;
      const data = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          data[y * w + x] = x < 2 ? 0 : 3;
        }
      }
      const edgeMask = new Uint8Array(w * h);
      const depth = new Float32Array(w * h);
      computeBoundaryDistance(data, w, h, edgeMask, depth);
      // Pixels at x=1 and x=2 should be edges (boundary)
      expect(edgeMask[0 * w + 1]).toBe(1); // (1,0) is next to (2,0) which is different
      expect(edgeMask[0 * w + 2]).toBe(1);
      // Corner pixel (0,0) is not directly on boundary
      expect(edgeMask[0]).toBe(0);
    });

    it("assigns zero depth to edge pixels", () => {
      const w = 4,
        h = 4;
      const data = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          data[y * w + x] = x < 2 ? 0 : 3;
        }
      }
      const edgeMask = new Uint8Array(w * h);
      const depth = new Float32Array(w * h);
      computeBoundaryDistance(data, w, h, edgeMask, depth);
      // Edge pixels have depth 0
      for (let i = 0; i < w * h; i++) {
        if (edgeMask[i]) expect(depth[i]).toBe(0);
      }
    });
  });

  describe("computeGradient", () => {
    it("computes zero gradient for uniform image", () => {
      const w = 4,
        h = 4;
      const data = new Uint8Array(w * h).fill(3);
      const levelTone = new Float32Array(w * h);
      const gradientAngle = new Float32Array(w * h);
      const gradientMagnitude = new Float32Array(w * h);
      computeGradient(data, w, h, levelTone, gradientAngle, gradientMagnitude);
      for (let i = 0; i < w * h; i++) {
        expect(gradientMagnitude[i]).toBe(0);
      }
    });

    it("detects horizontal gradient", () => {
      // 4x1 image: [0, 2, 5, 7]
      const data = new Uint8Array([0, 2, 5, 7]);
      const levelTone = new Float32Array(4);
      const gradientAngle = new Float32Array(4);
      const gradientMagnitude = new Float32Array(4);
      computeGradient(data, 4, 1, levelTone, gradientAngle, gradientMagnitude);
      // Interior pixels should have non-zero gradient magnitude
      expect(gradientMagnitude[1]).toBeGreaterThan(0);
      expect(gradientMagnitude[2]).toBeGreaterThan(0);
    });

    it("populates levelTone even when the first pixel is black", () => {
      const data = new Uint8Array([0, 2, 5, 7]);
      const levelTone = new Float32Array(4);
      const gradientAngle = new Float32Array(4);
      const gradientMagnitude = new Float32Array(4);
      computeGradient(data, 4, 1, levelTone, gradientAngle, gradientMagnitude);
      expect(levelTone[0]).toBe(0);
      expect(levelTone[1]).toBeCloseTo(2 / 7);
      expect(levelTone[2]).toBeCloseTo(5 / 7);
      expect(levelTone[3]).toBe(1);
    });
  });

  describe("computeRegion", () => {
    it("assigns same region ID to connected same-level pixels", () => {
      const w = 4,
        h = 4;
      const data = new Uint8Array(w * h).fill(2);
      const regionId = new Int32Array(w * h);
      const edgeMask = new Uint8Array(w * h);
      computeRegion(data, w, h, regionId, edgeMask);
      // All pixels should have the same region ID
      const id = regionId[0];
      for (let i = 1; i < w * h; i++) {
        expect(regionId[i]).toBe(id);
      }
    });

    it("assigns different region IDs to disconnected regions", () => {
      // 3x3 image with a cross pattern: center is level 7, corners are level 0
      const data = new Uint8Array([0, 7, 0, 7, 7, 7, 0, 7, 0]);
      const regionId = new Int32Array(9);
      const edgeMask = new Uint8Array(9);
      computeRegion(data, 3, 3, regionId, edgeMask);
      // The four corner pixels (0,2,6,8) are all level 0 but disconnected
      // They should have different region IDs
      const cornerIds = new Set([regionId[0], regionId[2], regionId[6], regionId[8]]);
      expect(cornerIds.size).toBe(4);
    });

    it("marks edges between different levels", () => {
      const data = new Uint8Array([0, 0, 7, 7, 0, 0, 7, 7, 0, 0, 7, 7, 0, 0, 7, 7]);
      const regionId = new Int32Array(16);
      const edgeMask = new Uint8Array(16);
      computeRegion(data, 4, 4, regionId, edgeMask);
      // Pixels at boundary (x=1 and x=2) should be edges
      expect(edgeMask[0 * 4 + 1]).toBe(1);
      expect(edgeMask[0 * 4 + 2]).toBe(1);
      // Interior pixels should not be edges
      expect(edgeMask[0]).toBe(0);
      expect(edgeMask[3]).toBe(0);
    });
  });
});
