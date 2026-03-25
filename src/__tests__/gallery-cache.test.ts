import { describe, it, expect } from "vitest";
import { generateAllVariants } from "../hooks/useGallery";

describe("generateAllVariants", () => {
  const defaultCc = [0, 0, 0, 0, 0, 0, 0, 0];
  const allLocked = [true, true, true, true, true, true, true, true];
  const noneLocked = [false, false, false, false, false, false, false, false];

  it("returns single variant when all locked", () => {
    const hist = [100, 100, 100, 100, 100, 100, 100, 100];
    const result = generateAllVariants(defaultCc, allLocked, hist);
    expect(result).toHaveLength(1);
  });

  it("returns single variant when all histogram counts are zero", () => {
    const hist = [0, 0, 0, 0, 0, 0, 0, 0];
    const result = generateAllVariants(defaultCc, noneLocked, hist);
    expect(result).toHaveLength(1);
  });

  it("generates multiple variants for unlocked levels with candidates", () => {
    // Level 0 (Black) has 1 candidate, so it contributes 1
    // Most levels have multiple candidates
    const hist = [100, 100, 0, 0, 0, 0, 0, 0];
    const result = generateAllVariants(defaultCc, noneLocked, hist);
    expect(result.length).toBeGreaterThan(0);
    // All variants should have length 8
    for (const v of result) {
      expect(v).toHaveLength(8);
    }
  });

  it("respects MAX_VARIANTS cap", () => {
    // Unlocking all levels with all having pixels should generate many variants
    const hist = [100, 100, 100, 100, 100, 100, 100, 100];
    const result = generateAllVariants(defaultCc, noneLocked, hist);
    expect(result.length).toBeLessThanOrEqual(10_000);
  });

  it("variant values are valid indices", () => {
    const hist = [100, 100, 100, 100, 100, 100, 100, 100];
    const result = generateAllVariants(defaultCc, noneLocked, hist);
    for (const v of result) {
      for (let lv = 0; lv < 8; lv++) {
        expect(v[lv]).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
