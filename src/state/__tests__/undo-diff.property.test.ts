import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { applyDiff, buildDiffFromFill, compressDiff, computeDiff, decompressDiff } from "../undo-diff";

const PROPERTY_OPTIONS = { numRuns: 100 };

function bytesOfLength(length: number): fc.Arbitrary<Uint8Array> {
  return fc.array(fc.integer({ min: 0, max: 255 }), { minLength: length, maxLength: length }).map((values) => new Uint8Array(values));
}

function equalLengthBuffers(maxLength: number): fc.Arbitrary<[Uint8Array, Uint8Array]> {
  return fc.integer({ min: 0, max: maxLength }).chain((length) => fc.tuple(bytesOfLength(length), bytesOfLength(length)));
}

function expectBytes(actual: Uint8Array | Uint32Array, expected: Uint8Array | Uint32Array) {
  expect(Array.from(actual)).toEqual(Array.from(expected));
}

describe("undo diff properties", () => {
  it("round-trips arbitrary equal-length buffers", () => {
    fc.assert(
      fc.property(equalLengthBuffers(256), ([before, after]) => {
        const beforeSnapshot = new Uint8Array(before);
        const afterSnapshot = new Uint8Array(after);
        const diff = computeDiff(before, after);

        expectBytes(applyDiff(before, diff, false), after);
        expectBytes(applyDiff(after, diff, true), before);
        expectBytes(before, beforeSnapshot);
        expectBytes(after, afterSnapshot);
      }),
      PROPERTY_OPTIONS,
    );
  });

  it("preserves diff semantics through compression and decompression", () => {
    fc.assert(
      fc.property(equalLengthBuffers(256), ([before, after]) => {
        const diff = computeDiff(before, after);
        const roundTrip = decompressDiff(compressDiff(diff));

        expectBytes(roundTrip.indices, diff.indices);
        expectBytes(roundTrip.oldValues, diff.oldValues);
        expectBytes(roundTrip.newValues, diff.newValues);
        expectBytes(applyDiff(before, roundTrip, false), after);
        expectBytes(applyDiff(after, roundTrip, true), before);
      }),
      PROPERTY_OPTIONS,
    );
  });

  it("builds fill diffs equivalent to full diffs when given actual changed indices", () => {
    fc.assert(
      fc.property(equalLengthBuffers(256), ([before, after]) => {
        const fullDiff = computeDiff(before, after);
        const fillDiff = buildDiffFromFill(before, after, fullDiff.indices);

        expectBytes(fillDiff.indices, fullDiff.indices);
        expectBytes(fillDiff.oldValues, fullDiff.oldValues);
        expectBytes(fillDiff.newValues, fullDiff.newValues);
        expectBytes(applyDiff(before, fillDiff, false), after);
      }),
      PROPERTY_OPTIONS,
    );
  });
});
