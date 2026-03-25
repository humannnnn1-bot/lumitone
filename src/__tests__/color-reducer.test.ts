import { describe, it, expect } from "vitest";
import { colorReducer } from "../color-reducer";
import { LEVEL_CANDIDATES, DEFAULT_CC } from "../color-engine";

describe("colorReducer", () => {
  describe("set_color", () => {
    it("sets color index for a valid level", () => {
      const state = [...DEFAULT_CC];
      const next = colorReducer(state, { type: "set_color", lv: 2, idx: 1 });
      expect(next[2]).toBe(1);
      // Other levels unchanged
      expect(next[0]).toBe(state[0]);
      expect(next[7]).toBe(state[7]);
    });

    it("returns same state for out-of-range level (negative)", () => {
      const state = [...DEFAULT_CC];
      const next = colorReducer(state, { type: "set_color", lv: -1, idx: 0 });
      expect(next).toBe(state);
    });

    it("returns same state for out-of-range level (too high)", () => {
      const state = [...DEFAULT_CC];
      const next = colorReducer(state, { type: "set_color", lv: 8, idx: 0 });
      expect(next).toBe(state);
    });

    it("returns same state for out-of-range idx (negative)", () => {
      const state = [...DEFAULT_CC];
      const next = colorReducer(state, { type: "set_color", lv: 2, idx: -1 });
      expect(next).toBe(state);
    });

    it("returns same state for out-of-range idx (too high)", () => {
      const state = [...DEFAULT_CC];
      const alts = LEVEL_CANDIDATES[2].length;
      const next = colorReducer(state, { type: "set_color", lv: 2, idx: alts });
      expect(next).toBe(state);
    });
  });

  describe("cycle_color", () => {
    it("cycles forward", () => {
      const state = [...DEFAULT_CC];
      state[3] = 0;
      const alts = LEVEL_CANDIDATES[3].length;
      if (alts > 1) {
        const next = colorReducer(state, { type: "cycle_color", lv: 3, dir: 1 });
        expect(next[3]).toBe(1);
      }
    });

    it("cycles backward with wrap", () => {
      const state = [...DEFAULT_CC];
      state[3] = 0;
      const alts = LEVEL_CANDIDATES[3].length;
      if (alts > 1) {
        const next = colorReducer(state, { type: "cycle_color", lv: 3, dir: -1 });
        expect(next[3]).toBe(alts - 1);
      }
    });

    it("no-op for single-candidate levels (black/white)", () => {
      const state = [...DEFAULT_CC];
      const next0 = colorReducer(state, { type: "cycle_color", lv: 0, dir: 1 });
      expect(next0).toBe(state);
      const next7 = colorReducer(state, { type: "cycle_color", lv: 7, dir: 1 });
      expect(next7).toBe(state);
    });

    it("returns same state for out-of-range level", () => {
      const state = [...DEFAULT_CC];
      const next = colorReducer(state, { type: "cycle_color", lv: -1, dir: 1 });
      expect(next).toBe(state);
    });
  });

  describe("randomize", () => {
    it("returns array of length 8", () => {
      const state = [...DEFAULT_CC];
      const next = colorReducer(state, { type: "randomize" });
      expect(next.length).toBe(8);
    });

    it("each value is within valid range", () => {
      const state = [...DEFAULT_CC];
      const next = colorReducer(state, { type: "randomize" });
      for (let lv = 0; lv < 8; lv++) {
        expect(next[lv]).toBeGreaterThanOrEqual(0);
        expect(next[lv]).toBeLessThan(LEVEL_CANDIDATES[lv].length);
      }
    });

    it("single-candidate levels are always 0", () => {
      const state = [...DEFAULT_CC];
      const next = colorReducer(state, { type: "randomize" });
      // Level 0 (black) and 7 (white) have only 1 candidate
      expect(next[0]).toBe(0);
      expect(next[7]).toBe(0);
    });

    it("preserves locked levels", () => {
      const state = [...DEFAULT_CC];
      state[2] = 3; // set a specific value
      const locked = [false, false, true, false, false, false, false, false];
      const next = colorReducer(state, { type: "randomize", locked });
      expect(next[2]).toBe(3); // locked level preserved
    });

    it("randomizes unlocked levels even when some are locked", () => {
      const state = [...DEFAULT_CC];
      const locked = [false, false, true, true, false, false, false, false];
      const next = colorReducer(state, { type: "randomize", locked });
      // Locked levels preserved
      expect(next[2]).toBe(state[2]);
      expect(next[3]).toBe(state[3]);
      // Unlocked levels have valid values
      for (let lv = 0; lv < 8; lv++) {
        expect(next[lv]).toBeGreaterThanOrEqual(0);
        expect(next[lv]).toBeLessThan(LEVEL_CANDIDATES[lv].length);
      }
    });

    it("works without locked array (backward compatible)", () => {
      const state = [...DEFAULT_CC];
      const next = colorReducer(state, { type: "randomize" });
      expect(next.length).toBe(8);
    });
  });
});
