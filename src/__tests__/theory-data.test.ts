import { describe, expect, it } from "vitest";
import {
  COMPLEMENT_EDGES,
  CUBE_EDGES,
  FANO_LINES,
  GRAY_PATH,
  GRAY_TOGGLES,
  STELLA_EDGES,
  TETRA_T0,
  hammingDist,
} from "../components/theory/theory-data";

function edgeKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

describe("theory-data invariants", () => {
  it("models the Fano plane as a Steiner triple system", () => {
    const pairCounts = new Map<string, number>();

    for (const [a, b, c] of FANO_LINES) {
      expect(a ^ b ^ c).toBe(0);
      const points = [a, b, c];
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const key = edgeKey(points[i], points[j]);
          pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
        }
      }
    }

    expect(pairCounts.size).toBe(21);
    for (const count of pairCounts.values()) expect(count).toBe(1);
  });

  it("keeps the Gray cycle on chromatic vertices with one bit flip per step", () => {
    expect(new Set(GRAY_PATH).size).toBe(6);
    expect([...GRAY_PATH].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);

    const diffToToggle: Record<number, string> = { 1: "B", 2: "R", 4: "G" };
    GRAY_PATH.forEach((lv, i) => {
      const next = GRAY_PATH[(i + 1) % GRAY_PATH.length];
      const diff = lv ^ next;
      expect(hammingDist(lv, next)).toBe(1);
      expect(GRAY_TOGGLES[i]).toBe(diffToToggle[diff]);
    });
  });

  it("partitions K8 edges by Hamming distance", () => {
    const q3 = new Set(CUBE_EDGES.map(([a, b]) => edgeKey(a, b)));
    const stella = new Set(STELLA_EDGES.map(([a, b]) => edgeKey(a, b)));
    const complements = new Set(COMPLEMENT_EDGES.map(([a, b]) => edgeKey(a, b)));
    const union = new Set([...q3, ...stella, ...complements]);

    expect(q3.size).toBe(12);
    expect(stella.size).toBe(12);
    expect(complements.size).toBe(4);
    expect(union.size).toBe(28);

    for (const [a, b] of CUBE_EDGES) expect(hammingDist(a, b)).toBe(1);
    for (const [a, b] of STELLA_EDGES) expect(hammingDist(a, b)).toBe(2);
    for (const [a, b] of COMPLEMENT_EDGES) expect(hammingDist(a, b)).toBe(3);

    expect(COMPLEMENT_EDGES).toEqual([
      [0, 7],
      [1, 6],
      [2, 5],
      [3, 4],
    ]);
  });

  it("keeps T0 closed under XOR", () => {
    const t0 = new Set(TETRA_T0);
    for (const a of TETRA_T0) {
      for (const b of TETRA_T0) {
        expect(t0.has(a ^ b)).toBe(true);
      }
    }
  });
});
