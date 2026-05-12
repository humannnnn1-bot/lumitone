import { describe, it, expect } from "vitest";
import { generateAllVariants } from "../useGallery";
import { LEVEL_CANDIDATES } from "../../color-engine";

describe("generateAllVariants", () => {
  const defaultCc = [0, 0, 0, 0, 0, 0, 0, 0];
  const allLocked = [true, true, true, true, true, true, true, true];
  const noneLocked = [false, false, false, false, false, false, false, false];

  it("returns single variant when all locked", () => {
    const levelHistogram = [100, 100, 100, 100, 100, 100, 100, 100];
    const result = generateAllVariants(defaultCc, allLocked, levelHistogram);
    expect(result).toHaveLength(1);
  });

  it("returns single variant when all histogram counts are zero", () => {
    const levelHistogram = [0, 0, 0, 0, 0, 0, 0, 0];
    const result = generateAllVariants(defaultCc, noneLocked, levelHistogram);
    expect(result).toHaveLength(1);
  });

  it("generates multiple variants for unlocked levels with candidates", () => {
    // Level 0 (Black) has 1 candidate, so it contributes 1
    // Most levels have multiple candidates
    const levelHistogram = [100, 100, 0, 0, 0, 0, 0, 0];
    const result = generateAllVariants(defaultCc, noneLocked, levelHistogram);
    expect(result.length).toBeGreaterThan(0);
    // All variants should have length 8
    for (const v of result) {
      expect(v).toHaveLength(8);
    }
  });

  it("generates the current maximum of 81 variants when all levels are used and unlocked", () => {
    const levelHistogram = [100, 100, 100, 100, 100, 100, 100, 100];
    const currentMax = LEVEL_CANDIDATES.reduce((total, candidates) => total * candidates.length, 1);

    const result = generateAllVariants(defaultCc, noneLocked, levelHistogram);

    expect(currentMax).toBe(81);
    expect(result).toHaveLength(81);
  });

  it("variant values are valid indices", () => {
    const levelHistogram = [100, 100, 100, 100, 100, 100, 100, 100];
    const result = generateAllVariants(defaultCc, noneLocked, levelHistogram);
    for (const v of result) {
      for (let lv = 0; lv < 8; lv++) {
        expect(v[lv]).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
