import { describe, it, expect } from "vitest";
import {
  HEX_ANGLES, HEX_VERTICES, HEX_EDGES, HEX_EDGE_COLORS,
  HEX_VERTEX_ALTS, HEX_EDGE_ALTS, HEX_DOTS, HEX_VP,
  HEX_CX, HEX_CY, HEX_R,
} from "../hex-data";
import { NUM_VERTICES } from "../constants";
import { LEVEL_CANDIDATES } from "../color-engine";

describe("HEX_ANGLES", () => {
  it("has 6 entries at 60° intervals", () => {
    expect(HEX_ANGLES).toEqual([0, 60, 120, 180, 240, 300]);
  });
});

describe("HEX_VERTICES", () => {
  it("has 6 vertices (one per primary/secondary color)", () => {
    expect(HEX_VERTICES.length).toBe(6);
  });

  it("covers all 6 color names", () => {
    const names = HEX_VERTICES.map(v => v.c).sort();
    expect(names).toEqual(["B", "C", "G", "M", "R", "Y"]);
  });

  it("each vertex has a valid luminance level 0-7", () => {
    for (const v of HEX_VERTICES) {
      expect(v.lv).toBeGreaterThanOrEqual(0);
      expect(v.lv).toBeLessThanOrEqual(7);
    }
  });
});

describe("HEX_EDGES", () => {
  it("has 6 edges connecting consecutive vertices", () => {
    expect(HEX_EDGES.length).toBe(6);
  });

  it("edge.t wraps correctly for last edge", () => {
    const last = HEX_EDGES[HEX_EDGES.length - 1];
    expect(last.t % NUM_VERTICES).toBe(0); // wraps back to vertex 0
  });

  it("each edge lv entries are valid levels", () => {
    for (const e of HEX_EDGES) {
      for (const lv of e.lv) {
        expect(lv).toBeGreaterThanOrEqual(0);
        expect(lv).toBeLessThanOrEqual(7);
      }
    }
  });
});

describe("HEX_EDGE_COLORS", () => {
  it("has same number of outer arrays as HEX_EDGES", () => {
    expect(HEX_EDGE_COLORS.length).toBe(HEX_EDGES.length);
  });

  it("inner array length matches edge lv count", () => {
    for (let i = 0; i < HEX_EDGES.length; i++) {
      expect(HEX_EDGE_COLORS[i].length).toBe(HEX_EDGES[i].lv.length);
    }
  });

  it("all edge colors have valid hex strings", () => {
    for (const colors of HEX_EDGE_COLORS) {
      for (const c of colors) {
        expect(c.hex).toMatch(/^#[0-9a-f]{6}$/);
        expect(typeof c.hue).toBe("number");
        expect(c.hue).toBeGreaterThanOrEqual(0);
        expect(c.hue).toBeLessThanOrEqual(360);
      }
    }
  });

  it("handles edges with zero luminance difference (ts=0) safely", () => {
    // Edges 2 (G→C) and 5 (M→R) have empty lv arrays and
    // their ts values (|4-5|=1 and |3-2|=1) are non-zero.
    // But the guard should still be present for robustness.
    // Verify no NaN or Infinity in any hue values.
    for (const colors of HEX_EDGE_COLORS) {
      for (const c of colors) {
        expect(Number.isFinite(c.hue)).toBe(true);
      }
    }
  });
});

describe("HEX_VERTEX_ALTS", () => {
  it("has one alt index per vertex", () => {
    expect(HEX_VERTEX_ALTS.length).toBe(HEX_VERTICES.length);
  });

  it("each alt is a valid candidate index", () => {
    for (let i = 0; i < HEX_VERTICES.length; i++) {
      const lv = HEX_VERTICES[i].lv;
      const alt = HEX_VERTEX_ALTS[i];
      expect(alt).toBeGreaterThanOrEqual(0);
      expect(alt).toBeLessThan(LEVEL_CANDIDATES[lv].length);
    }
  });
});

describe("HEX_EDGE_ALTS", () => {
  it("has correct shape matching HEX_EDGES", () => {
    expect(HEX_EDGE_ALTS.length).toBe(HEX_EDGES.length);
    for (let i = 0; i < HEX_EDGES.length; i++) {
      expect(HEX_EDGE_ALTS[i].length).toBe(HEX_EDGES[i].lv.length);
    }
  });

  it("each alt is a valid candidate index for its level", () => {
    for (let ei = 0; ei < HEX_EDGES.length; ei++) {
      for (let li = 0; li < HEX_EDGES[ei].lv.length; li++) {
        const lv = HEX_EDGES[ei].lv[li];
        const alt = HEX_EDGE_ALTS[ei][li];
        expect(alt).toBeGreaterThanOrEqual(0);
        expect(alt).toBeLessThan(LEVEL_CANDIDATES[lv].length);
      }
    }
  });
});

describe("HEX_DOTS", () => {
  it("has 6 vertex dots + sum of edge lv lengths", () => {
    const edgeDots = HEX_EDGES.reduce((sum, e) => sum + e.lv.length, 0);
    expect(HEX_DOTS.length).toBe(6 + edgeDots);
  });

  it("vertex dots have vi >= 0 and ei = -1", () => {
    const vertexDots = HEX_DOTS.filter(d => d.vi >= 0);
    expect(vertexDots.length).toBe(6);
    for (const d of vertexDots) {
      expect(d.ei).toBe(-1);
      expect(d.si).toBe(-1);
    }
  });

  it("edge dots have ei >= 0 and vi = -1", () => {
    const edgeDots = HEX_DOTS.filter(d => d.ei >= 0);
    for (const d of edgeDots) {
      expect(d.vi).toBe(-1);
    }
  });
});

describe("HEX_VP (vertex positions)", () => {
  it("has 6 positions", () => {
    expect(HEX_VP.length).toBe(6);
  });

  it("all positions are within expected SVG bounds", () => {
    for (const p of HEX_VP) {
      expect(p.x).toBeGreaterThan(HEX_CX - HEX_R - 1);
      expect(p.x).toBeLessThan(HEX_CX + HEX_R + 1);
      expect(p.y).toBeGreaterThan(HEX_CY - HEX_R - 1);
      expect(p.y).toBeLessThan(HEX_CY + HEX_R + 1);
    }
  });

  it("positions form a regular hexagon (equidistant from center)", () => {
    for (const p of HEX_VP) {
      const dist = Math.sqrt((p.x - HEX_CX) ** 2 + (p.y - HEX_CY) ** 2);
      expect(dist).toBeCloseTo(HEX_R, 5);
    }
  });
});
