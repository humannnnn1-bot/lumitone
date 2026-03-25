import { describe, it, expect } from "vitest";
import {
  computeNoiseLevelNorm,
  computeDiversity,
  computeEdgeDepth,
  computeGradient,
  computeRegion,
} from "../utils/pixel-analysis";

describe("pixel-analysis", () => {
  describe("computeNoiseLevelNorm", () => {
    it("returns zero noise for uniform image", () => {
      const w = 4, h = 4;
      const data = new Uint8Array(w * h).fill(3);
      const noise = new Float32Array(w * h);
      const levelNorm = new Float32Array(w * h);
      computeNoiseLevelNorm(data, w, h, noise, levelNorm);
      for (let i = 0; i < w * h; i++) {
        expect(noise[i]).toBe(0);
        expect(levelNorm[i]).toBeCloseTo(3 / 7);
      }
    });

    it("detects noise at boundaries", () => {
      // 2x2 image: top-left=0, others=7
      const data = new Uint8Array([0, 7, 7, 7]);
      const noise = new Float32Array(4);
      const levelNorm = new Float32Array(4);
      computeNoiseLevelNorm(data, 2, 2, noise, levelNorm);
      // pixel (0,0) has 2 neighbors different (right and below), out of 4 possible
      expect(noise[0]).toBe(0.5); // 2/4 neighbors different
      expect(levelNorm[0]).toBe(0);
      expect(levelNorm[1]).toBe(1);
    });
  });

  describe("computeDiversity", () => {
    it("returns zero diversity for uniform image", () => {
      const w = 5, h = 5;
      const data = new Uint8Array(w * h).fill(2);
      const diversity = new Float32Array(w * h);
      computeDiversity(data, w, h, diversity);
      for (let i = 0; i < w * h; i++) {
        expect(diversity[i]).toBe(0);
      }
    });

    it("detects diversity at level boundaries", () => {
      // 5x5 image: left half level 0, right half level 7
      const w = 5, h = 5;
      const data = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          data[y * w + x] = x < 3 ? 0 : 7;
        }
      }
      const diversity = new Float32Array(w * h);
      computeDiversity(data, w, h, diversity);
      // Center pixel (2,2) should see both levels → diversity > 0
      expect(diversity[2 * w + 2]).toBeGreaterThan(0);
    });
  });

  describe("computeEdgeDepth", () => {
    it("marks edges between different levels", () => {
      // 4x4 image: left half 0, right half 3
      const w = 4, h = 4;
      const data = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          data[y * w + x] = x < 2 ? 0 : 3;
        }
      }
      const isEdge = new Uint8Array(w * h);
      const depth = new Float32Array(w * h);
      computeEdgeDepth(data, w, h, isEdge, depth);
      // Pixels at x=1 and x=2 should be edges (boundary)
      expect(isEdge[0 * w + 1]).toBe(1); // (1,0) is next to (2,0) which is different
      expect(isEdge[0 * w + 2]).toBe(1);
      // Corner pixel (0,0) is not directly on boundary
      expect(isEdge[0]).toBe(0);
    });

    it("assigns zero depth to edge pixels", () => {
      const w = 4, h = 4;
      const data = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          data[y * w + x] = x < 2 ? 0 : 3;
        }
      }
      const isEdge = new Uint8Array(w * h);
      const depth = new Float32Array(w * h);
      computeEdgeDepth(data, w, h, isEdge, depth);
      // Edge pixels have depth 0
      for (let i = 0; i < w * h; i++) {
        if (isEdge[i]) expect(depth[i]).toBe(0);
      }
    });
  });

  describe("computeGradient", () => {
    it("computes zero gradient for uniform image", () => {
      const w = 4, h = 4;
      const data = new Uint8Array(w * h).fill(3);
      const levelNorm = new Float32Array(w * h);
      const gradAngle = new Float32Array(w * h);
      const gradMag = new Float32Array(w * h);
      computeGradient(data, w, h, levelNorm, gradAngle, gradMag);
      for (let i = 0; i < w * h; i++) {
        expect(gradMag[i]).toBe(0);
      }
    });

    it("detects horizontal gradient", () => {
      // 4x1 image: [0, 2, 5, 7]
      const data = new Uint8Array([0, 2, 5, 7]);
      const levelNorm = new Float32Array(4);
      const gradAngle = new Float32Array(4);
      const gradMag = new Float32Array(4);
      computeGradient(data, 4, 1, levelNorm, gradAngle, gradMag);
      // Interior pixels should have non-zero gradient magnitude
      expect(gradMag[1]).toBeGreaterThan(0);
      expect(gradMag[2]).toBeGreaterThan(0);
    });
  });

  describe("computeRegion", () => {
    it("assigns same region ID to connected same-level pixels", () => {
      const w = 4, h = 4;
      const data = new Uint8Array(w * h).fill(2);
      const regionId = new Int32Array(w * h);
      const isEdge = new Uint8Array(w * h);
      computeRegion(data, w, h, regionId, isEdge);
      // All pixels should have the same region ID
      const id = regionId[0];
      for (let i = 1; i < w * h; i++) {
        expect(regionId[i]).toBe(id);
      }
    });

    it("assigns different region IDs to disconnected regions", () => {
      // 3x3 image with a cross pattern: center is level 7, corners are level 0
      const data = new Uint8Array([
        0, 7, 0,
        7, 7, 7,
        0, 7, 0,
      ]);
      const regionId = new Int32Array(9);
      const isEdge = new Uint8Array(9);
      computeRegion(data, 3, 3, regionId, isEdge);
      // The four corner pixels (0,2,6,8) are all level 0 but disconnected
      // They should have different region IDs
      const cornerIds = new Set([regionId[0], regionId[2], regionId[6], regionId[8]]);
      expect(cornerIds.size).toBe(4);
    });

    it("marks edges between different levels", () => {
      const data = new Uint8Array([
        0, 0, 7, 7,
        0, 0, 7, 7,
        0, 0, 7, 7,
        0, 0, 7, 7,
      ]);
      const regionId = new Int32Array(16);
      const isEdge = new Uint8Array(16);
      computeRegion(data, 4, 4, regionId, isEdge);
      // Pixels at boundary (x=1 and x=2) should be edges
      expect(isEdge[0 * 4 + 1]).toBe(1);
      expect(isEdge[0 * 4 + 2]).toBe(1);
      // Interior pixels should not be edges
      expect(isEdge[0]).toBe(0);
      expect(isEdge[3]).toBe(0);
    });
  });
});
