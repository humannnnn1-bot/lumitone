import { describe, it, expect } from "vitest";
import { compressDiff, decompressDiff, computeGlazeDiff } from "../undo-diff";
import type { Diff } from "../../types";

function makeDiff(indices: number[], oldVals: number[], newVals: number[]): Diff {
  return {
    indices: new Uint32Array(indices),
    oldValues: new Uint8Array(oldVals),
    newValues: new Uint8Array(newVals),
  };
}

describe("compressDiff / decompressDiff", () => {
  it("empty diff compresses and decompresses correctly", () => {
    const diff = makeDiff([], [], []);
    const compressed = compressDiff(diff);
    expect(compressed.runs.length).toBe(0);

    const decompressed = decompressDiff(compressed);
    expect(decompressed.indices.length).toBe(0);
    expect(decompressed.oldValues.length).toBe(0);
    expect(decompressed.newValues.length).toBe(0);
  });

  it("single pixel diff", () => {
    const diff = makeDiff([42], [10], [20]);
    const compressed = compressDiff(diff);
    // Single run: [start=42, len=1]
    expect(compressed.runs.length).toBe(2);
    expect(compressed.runs[0]).toBe(42);
    expect(compressed.runs[1]).toBe(1);

    const decompressed = decompressDiff(compressed);
    expect(Array.from(decompressed.indices)).toEqual([42]);
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
    expect(Array.from(roundtripped.indices)).toEqual(Array.from(diff.indices));
    expect(Array.from(roundtripped.oldValues)).toEqual(Array.from(diff.oldValues));
    expect(Array.from(roundtripped.newValues)).toEqual(Array.from(diff.newValues));
  });

  it("diff with pixel candidate override fields preserved through compress/decompress", () => {
    const oldOverrideMap = new Uint8Array([0, 0, 1, 0, 2]);
    const newOverrideMap = new Uint8Array([0, 3, 1, 4, 2]);
    const levelData = new Uint8Array([5, 5, 5, 5, 5]);
    const diff = computeGlazeDiff(oldOverrideMap, newOverrideMap, levelData);
    // Indices 1 and 3 changed
    expect(diff.oldPixelCandidateOverrideValues).toBeDefined();
    expect(diff.newPixelCandidateOverrideValues).toBeDefined();

    const compressed = compressDiff(diff);
    expect(compressed.oldPixelCandidateOverrideValues).toBeDefined();
    expect(compressed.newPixelCandidateOverrideValues).toBeDefined();

    const decompressed = decompressDiff(compressed);
    expect(Array.from(decompressed.indices)).toEqual(Array.from(diff.indices));
    expect(Array.from(decompressed.oldPixelCandidateOverrideValues!)).toEqual(Array.from(diff.oldPixelCandidateOverrideValues!));
    expect(Array.from(decompressed.newPixelCandidateOverrideValues!)).toEqual(Array.from(diff.newPixelCandidateOverrideValues!));
  });
});
