import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { floodFill } from "../flood-fill";

const PROPERTY_OPTIONS = { numRuns: 100 };

interface GridCase {
  w: number;
  h: number;
  data: Uint8Array;
  sx: number;
  sy: number;
  newVal: number;
}

function gridCase(): fc.Arbitrary<GridCase> {
  return fc
    .record({
      w: fc.integer({ min: 1, max: 12 }),
      h: fc.integer({ min: 1, max: 12 }),
    })
    .chain(({ w, h }) =>
      fc.record({
        w: fc.constant(w),
        h: fc.constant(h),
        data: fc.array(fc.integer({ min: 0, max: 7 }), { minLength: w * h, maxLength: w * h }).map((values) => new Uint8Array(values)),
        sx: fc.integer({ min: 0, max: w - 1 }),
        sy: fc.integer({ min: 0, max: h - 1 }),
        newVal: fc.integer({ min: 0, max: 7 }),
      }),
    );
}

function outOfBoundsCase(): fc.Arbitrary<GridCase> {
  return fc
    .record({
      w: fc.integer({ min: 1, max: 12 }),
      h: fc.integer({ min: 1, max: 12 }),
    })
    .chain(({ w, h }) =>
      fc.constantFrom({ sx: -1, sy: 0 }, { sx: w, sy: 0 }, { sx: 0, sy: -1 }, { sx: 0, sy: h }).chain(({ sx, sy }) =>
        fc.record({
          w: fc.constant(w),
          h: fc.constant(h),
          data: fc.array(fc.integer({ min: 0, max: 7 }), { minLength: w * h, maxLength: w * h }).map((values) => new Uint8Array(values)),
          sx: fc.constant(sx),
          sy: fc.constant(sy),
          newVal: fc.integer({ min: 0, max: 7 }),
        }),
      ),
    );
}

function connectedComponent(data: Uint8Array, w: number, h: number, sx: number, sy: number): Set<number> {
  const seed = sy * w + sx;
  const target = data[seed];
  const seen = new Set<number>([seed]);
  const stack = [seed];

  while (stack.length > 0) {
    const indices = stack.pop()!;
    const x = indices % w;
    const y = (indices / w) | 0;
    const neighbors = [y > 0 ? indices - w : -1, y + 1 < h ? indices + w : -1, x > 0 ? indices - 1 : -1, x + 1 < w ? indices + 1 : -1];

    for (const next of neighbors) {
      if (next < 0 || seen.has(next) || data[next] !== target) continue;
      seen.add(next);
      stack.push(next);
    }
  }

  return seen;
}

describe("floodFill properties", () => {
  it("returns null and leaves data unchanged for out-of-bounds seeds", () => {
    fc.assert(
      fc.property(outOfBoundsCase(), ({ data, sx, sy, newVal, w, h }) => {
        const before = new Uint8Array(data);

        expect(floodFill(data, sx, sy, newVal, w, h)).toBeNull();
        expect(Array.from(data)).toEqual(Array.from(before));
      }),
      PROPERTY_OPTIONS,
    );
  });

  it("fills exactly the 4-connected component containing the seed", () => {
    fc.assert(
      fc.property(gridCase(), ({ data, sx, sy, newVal, w, h }) => {
        const before = new Uint8Array(data);
        const working = new Uint8Array(data);
        const seedIdx = sy * w + sx;
        const component = connectedComponent(before, w, h, sx, sy);
        const result = floodFill(working, sx, sy, newVal, w, h);

        if (before[seedIdx] === newVal) {
          expect(result).toBeNull();
          expect(Array.from(working)).toEqual(Array.from(before));
          return;
        }

        expect(result).not.toBeNull();
        expect(result!.truncated).toBe(false);

        const changed = new Set(Array.from(result!.changedIndices));
        expect(changed.size).toBe(component.size);
        expect(changed).toEqual(component);

        for (let i = 0; i < working.length; i++) {
          expect(working[i]).toBe(component.has(i) ? newVal : before[i]);
        }
      }),
      PROPERTY_OPTIONS,
    );
  });
});
