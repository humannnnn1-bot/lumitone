import { describe, expect, it } from "vitest";
import { FANO_LINES, GRAY_PATH, GRAY_TOGGLES } from "../theory-data";
import {
  BT601_VALUES,
  CHROMA_LEVELS,
  COMPLEMENT_PAIRS,
  FANO_RHYTHM_PATTERNS,
  LUMA_VALUES,
  ZIGZAG_CHANNELS,
  ZIGZAG_PATH,
  fanoLinesThrough,
  freqToNote,
} from "../music-data";

describe("music-data invariants", () => {
  it("CHROMA_LEVELS lists the six non-monochrome levels in ascending order", () => {
    expect([...CHROMA_LEVELS]).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("LUMA_VALUES are the BT.601 quantized lumas with complement symmetry Y_c + Y_(7-c) = 255", () => {
    expect(LUMA_VALUES).toHaveLength(8);
    for (let c = 0; c < 8; c++) {
      expect(LUMA_VALUES[c] + LUMA_VALUES[7 - c]).toBe(255);
    }
    for (let c = 1; c < 8; c++) {
      expect(LUMA_VALUES[c]).toBeGreaterThan(LUMA_VALUES[c - 1]);
    }
    // Reproduce the table by applying BT.601 weights to the GRB bit decomposition.
    const R = 0.299;
    const G = 0.587;
    const B = 0.114;
    const derived = Array.from({ length: 8 }, (_, lv) => {
      const g = (lv >> 2) & 1;
      const r = (lv >> 1) & 1;
      const b = lv & 1;
      return Math.round(255 * (G * g + R * r + B * b));
    });
    expect([...LUMA_VALUES]).toEqual(derived);
  });

  it("BT601_VALUES sums to 1 across each complement pair and to 3 over the chromatic levels", () => {
    for (const [a, b] of COMPLEMENT_PAIRS) {
      expect(BT601_VALUES[a] + BT601_VALUES[b]).toBeCloseTo(1, 10);
    }
    const total = CHROMA_LEVELS.reduce((s, c) => s + BT601_VALUES[c], 0);
    expect(total).toBeCloseTo(3, 10);
    // Each chromatic level's weight is the BT.601 luma of its bit pattern.
    const expected: Record<number, number> = {
      1: 0.114, // B
      2: 0.299, // R
      3: 0.114 + 0.299, // M
      4: 0.587, // G
      5: 0.587 + 0.114, // C
      6: 0.587 + 0.299, // Y
    };
    for (const c of CHROMA_LEVELS) {
      expect(BT601_VALUES[c]).toBeCloseTo(expected[c], 10);
    }
  });

  it("COMPLEMENT_PAIRS partitions the chromatic levels via XOR with 7", () => {
    expect(COMPLEMENT_PAIRS).toHaveLength(3);
    const seen = new Set<number>();
    for (const [a, b] of COMPLEMENT_PAIRS) {
      expect(a ^ b).toBe(7);
      expect(seen.has(a)).toBe(false);
      expect(seen.has(b)).toBe(false);
      seen.add(a);
      seen.add(b);
    }
    expect([...seen].sort((x, y) => x - y)).toEqual([...CHROMA_LEVELS]);
  });

  it("ZIGZAG_PATH/CHANNELS mirror GRAY_PATH/TOGGLES and toggle exactly one bit per step", () => {
    expect([...ZIGZAG_PATH]).toEqual([...GRAY_PATH]);
    expect([...ZIGZAG_CHANNELS]).toEqual([...GRAY_TOGGLES]);

    const channelOfBit: Record<number, "G" | "R" | "B"> = { 4: "G", 2: "R", 1: "B" };
    ZIGZAG_PATH.forEach((lv, i) => {
      const next = ZIGZAG_PATH[(i + 1) % ZIGZAG_PATH.length];
      const diff = lv ^ next;
      expect(channelOfBit[diff]).toBeDefined();
      expect(ZIGZAG_CHANNELS[i]).toBe(channelOfBit[diff]);
    });
  });

  it("FANO_RHYTHM_PATTERNS form a Steiner triple system on Z_7 from the {0,1,3} difference set", () => {
    expect(FANO_RHYTHM_PATTERNS).toHaveLength(7);

    for (const pat of FANO_RHYTHM_PATTERNS) {
      expect(pat).toHaveLength(3);
      expect(new Set(pat).size).toBe(3);
      for (const p of pat) {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThan(7);
      }
    }

    // Each Z_7 point appears in exactly 3 triples (Steiner replication number).
    const incidences = new Map<number, number>();
    for (const pat of FANO_RHYTHM_PATTERNS) {
      for (const p of pat) incidences.set(p, (incidences.get(p) ?? 0) + 1);
    }
    expect(incidences.size).toBe(7);
    for (const count of incidences.values()) expect(count).toBe(3);

    // Each unordered pair appears in exactly 1 triple — the defining S(2,3,7) property.
    const pairCounts = new Map<string, number>();
    for (const pat of FANO_RHYTHM_PATTERNS) {
      for (let i = 0; i < pat.length; i++) {
        for (let j = i + 1; j < pat.length; j++) {
          const a = Math.min(pat[i], pat[j]);
          const b = Math.max(pat[i], pat[j]);
          pairCounts.set(`${a}-${b}`, (pairCounts.get(`${a}-${b}`) ?? 0) + 1);
        }
      }
    }
    expect(pairCounts.size).toBe(21);
    for (const c of pairCounts.values()) expect(c).toBe(1);

    // The 7 triples are pairwise distinct as sets (no degenerate rotations).
    const triples = new Set(FANO_RHYTHM_PATTERNS.map((pat) => [...pat].sort((a, b) => a - b).join(",")));
    expect(triples.size).toBe(7);
  });

  it("fanoLinesThrough returns the three Fano lines incident to each chromatic point", () => {
    for (let p = 1; p <= 7; p++) {
      const indices = fanoLinesThrough(p);
      expect(indices).toHaveLength(3);
      const seen = new Set<number>();
      for (const idx of indices) {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(FANO_LINES.length);
        expect(FANO_LINES[idx]).toContain(p);
        expect(seen.has(idx)).toBe(false);
        seen.add(idx);
      }
    }
    // 0 is not a Fano point — it lies on no line.
    expect(fanoLinesThrough(0)).toEqual([]);
  });

  describe("freqToNote", () => {
    it("returns em-dash for non-positive or non-finite input", () => {
      expect(freqToNote(0)).toBe("—");
      expect(freqToNote(-1)).toBe("—");
      expect(freqToNote(-440)).toBe("—");
      expect(freqToNote(Number.NaN)).toBe("—");
      expect(freqToNote(Number.POSITIVE_INFINITY)).toBe("—");
      expect(freqToNote(Number.NEGATIVE_INFINITY)).toBe("—");
    });

    it("names exact equal-temperament pitches without a cent suffix", () => {
      expect(freqToNote(440)).toBe("A4");
      expect(freqToNote(880)).toBe("A5");
      expect(freqToNote(220)).toBe("A3");
      expect(freqToNote(110)).toBe("A2");
    });

    it("crosses the C boundary between octaves correctly", () => {
      // C4 = 440 * 2^(-9/12) ≈ 261.626
      expect(freqToNote(440 * Math.pow(2, -9 / 12))).toBe("C4");
      // C5 = 440 * 2^(3/12) ≈ 523.251
      expect(freqToNote(440 * Math.pow(2, 3 / 12))).toBe("C5");
    });

    it("annotates positive cents with '+' and a U+2212 minus for negatives", () => {
      // +25 cents above A4 → still nearest to A4.
      expect(freqToNote(440 * Math.pow(2, 25 / 1200))).toBe("A4+25¢");
      // −12 cents below A4 → still nearest to A4 with U+2212 sign.
      const label = freqToNote(440 * Math.pow(2, -12 / 1200));
      expect(label).toBe("A4−12¢");
      expect(label.includes("−")).toBe(true);
      expect(label.includes("-12")).toBe(false);
    });

    it("rounds the half-semitone boundary up so +50¢ becomes the next note minus 50¢", () => {
      // +50 cents above A4 rounds up to A♯4 with a −50¢ correction.
      expect(freqToNote(440 * Math.pow(2, 50 / 1200))).toBe("A♯4−50¢");
    });
  });
});
