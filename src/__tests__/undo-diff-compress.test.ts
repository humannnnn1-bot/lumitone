import { describe, it, expect } from "vitest";
import { compressDiff, decompressDiff, computeGlazeDiff } from "../undo-diff";
import type { Diff } from "../types";

function makeDiff(indices: number[], oldVals: number[], newVals: number[]): Diff {
  return {
    idx: new Uint32Array(indices),
    ov: new Uint8Array(oldVals),
    nv: new Uint8Array(newVals),
  };
}

describe("compressDiff / decompressDiff", () => {
  it("empty diff compresses and decompresses correctly", () => {
    const diff = makeDiff([], [], []);
    const compressed = compressDiff(diff);
    expect(compressed.runs.length).toBe(0);

    const decompressed = decompressDiff(compressed);
    expect(decompressed.idx.length).toBe(0);
    expect(decompressed.ov.length).toBe(0);
    expect(decompressed.nv.length).toBe(0);
  });

  it("single pixel diff", () => {
    const diff = makeDiff([42], [10], [20]);
    const compressed = compressDiff(diff);
    // Single run: [start=42, len=1]
    expect(compressed.runs.length).toBe(2);
    expect(compressed.runs[0]).toBe(42);
    expect(compressed.runs[1]).toBe(1);

    const decompressed = decompressDiff(compressed);
    expect(Array.from(decompressed.idx)).toEqual([42]);
  });

  it("consecutive indices compress to a single run", () => {
    const diff = makeDiff([10, 11, 12, 13, 14], [1, 2, 3, 4, 5], [6, 7, 8, 9, 10]);
    const compressed = compressDiff(diff);
    // Should be one run: [start=10, len=5]
    expect(compressed.runs.length).toBe(2);
    expect(compressed.runs[0]).toBe(10);
    expect(compressed.runs[1]).toBe(5);
  });

  it("non-consecutive indices create multiple runs", () => {
    const diff = makeDiff([1, 2, 3, 10, 11, 20], [0, 0, 0, 0, 0, 0], [1, 1, 1, 1, 1, 1]);
    const compressed = compressDiff(diff);
    // Three runs: [1,3], [10,2], [20,1] => 6 elements
    expect(compressed.runs.length).toBe(6);
    expect(compressed.runs[0]).toBe(1);
    expect(compressed.runs[1]).toBe(3);
    expect(compressed.runs[2]).toBe(10);
    expect(compressed.runs[3]).toBe(2);
    expect(compressed.runs[4]).toBe(20);
    expect(compressed.runs[5]).toBe(1);
  });

  it("roundtrip: decompressDiff(compressDiff(diff)) equals original diff", () => {
    const diff = makeDiff(
      [0, 1, 2, 5, 6, 10, 100, 101, 102, 103],
      [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
      [11, 21, 31, 41, 51, 61, 71, 81, 91, 101],
    );
    const roundtripped = decompressDiff(compressDiff(diff));
    expect(Array.from(roundtripped.idx)).toEqual(Array.from(diff.idx));
    expect(Array.from(roundtripped.ov)).toEqual(Array.from(diff.ov));
    expect(Array.from(roundtripped.nv)).toEqual(Array.from(diff.nv));
  });

  it("diff with cmOv/cmNv fields preserved through compress/decompress", () => {
    const oldCm = new Uint8Array([0, 0, 1, 0, 2]);
    const newCm = new Uint8Array([0, 3, 1, 4, 2]);
    const data = new Uint8Array([5, 5, 5, 5, 5]);
    const diff = computeGlazeDiff(oldCm, newCm, data);
    // Indices 1 and 3 changed
    expect(diff.cmOv).toBeDefined();
    expect(diff.cmNv).toBeDefined();

    const compressed = compressDiff(diff);
    expect(compressed.cmOv).toBeDefined();
    expect(compressed.cmNv).toBeDefined();

    const decompressed = decompressDiff(compressed);
    expect(Array.from(decompressed.idx)).toEqual(Array.from(diff.idx));
    expect(Array.from(decompressed.cmOv!)).toEqual(Array.from(diff.cmOv!));
    expect(Array.from(decompressed.cmNv!)).toEqual(Array.from(diff.cmNv!));
  });
});
