import { describe, it, expect } from "vitest";
import { computeDiff, applyDiff, buildDiffFromFill } from "../undo-diff";

describe("computeDiff", () => {
  it("returns empty diff for identical data", () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([1, 2, 3, 4]);
    const diff = computeDiff(a, b);
    expect(diff.idx.length).toBe(0);
    expect(diff.ov.length).toBe(0);
    expect(diff.nv.length).toBe(0);
  });

  it("detects changed pixels", () => {
    const a = new Uint8Array([0, 1, 2, 3]);
    const b = new Uint8Array([0, 5, 2, 7]);
    const diff = computeDiff(a, b);
    expect(diff.idx.length).toBe(2);
    expect(Array.from(diff.idx)).toEqual([1, 3]);
    expect(Array.from(diff.ov)).toEqual([1, 3]);
    expect(Array.from(diff.nv)).toEqual([5, 7]);
  });

  it("detects all changed when fully different", () => {
    const a = new Uint8Array([0, 0, 0]);
    const b = new Uint8Array([1, 1, 1]);
    const diff = computeDiff(a, b);
    expect(diff.idx.length).toBe(3);
  });
});

describe("applyDiff", () => {
  it("applies forward diff", () => {
    const original = new Uint8Array([0, 1, 2, 3]);
    const modified = new Uint8Array([0, 5, 2, 7]);
    const diff = computeDiff(original, modified);
    const result = applyDiff(original, diff, false);
    expect(Array.from(result)).toEqual([0, 5, 2, 7]);
  });

  it("applies reverse diff (undo)", () => {
    const original = new Uint8Array([0, 1, 2, 3]);
    const modified = new Uint8Array([0, 5, 2, 7]);
    const diff = computeDiff(original, modified);
    const result = applyDiff(modified, diff, true);
    expect(Array.from(result)).toEqual([0, 1, 2, 3]);
  });

  it("does not mutate source data", () => {
    const data = new Uint8Array([1, 2, 3]);
    const diff = computeDiff(new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6]));
    applyDiff(data, diff, false);
    expect(Array.from(data)).toEqual([1, 2, 3]);
  });

  it("roundtrip: apply forward then reverse returns original", () => {
    const a = new Uint8Array([10, 20, 30, 40, 50]);
    const b = new Uint8Array([10, 99, 30, 77, 50]);
    const diff = computeDiff(a, b);
    const forward = applyDiff(a, diff, false);
    const back = applyDiff(forward, diff, true);
    expect(Array.from(back)).toEqual(Array.from(a));
  });
});

describe("buildDiffFromFill", () => {
  it("builds correct diff from changed indices", () => {
    const pre = new Uint8Array([0, 0, 0, 0, 0]);
    const buf = new Uint8Array([0, 3, 0, 3, 0]);
    const changed = new Uint32Array([1, 3]);
    const diff = buildDiffFromFill(pre, buf, changed);
    expect(diff.idx.length).toBe(2);
    expect(Array.from(diff.idx)).toEqual([1, 3]);
    expect(Array.from(diff.ov)).toEqual([0, 0]);
    expect(Array.from(diff.nv)).toEqual([3, 3]);
  });

  it("produces equivalent result to computeDiff for same changes", () => {
    const pre = new Uint8Array([0, 1, 2, 3, 4]);
    const buf = new Uint8Array([0, 5, 2, 7, 4]);
    const changed = new Uint32Array([1, 3]);
    const fillDiff = buildDiffFromFill(pre, buf, changed);
    const fullDiff = computeDiff(pre, buf);
    expect(Array.from(fillDiff.idx)).toEqual(Array.from(fullDiff.idx));
    expect(Array.from(fillDiff.ov)).toEqual(Array.from(fullDiff.ov));
    expect(Array.from(fillDiff.nv)).toEqual(Array.from(fullDiff.nv));
  });

  it("empty changed array produces empty diff", () => {
    const pre = new Uint8Array([1, 2, 3]);
    const buf = new Uint8Array([1, 2, 3]);
    const changed = new Uint32Array(0);
    const diff = buildDiffFromFill(pre, buf, changed);
    expect(diff.idx.length).toBe(0);
  });
});
