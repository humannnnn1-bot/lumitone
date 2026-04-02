/* ═══════════════════════════════════════════
   COLOR ENGINE
   8-level pure-color mapping using BT.601 luminance coefficients

   NOTE: These BT.601 luma coefficients are applied directly to sRGB [0-255]
   values (gamma-compressed). Strictly, BT.601 assumes linear-light input;
   for WCAG 2.0 relative luminance the sRGB transfer function should be
   inverted first (coefficients 0.2126, 0.7152, 0.0722 on linear RGB).
   We intentionally use the simpler BT.601 formula because:
     1. The relative ordering of the 8 binary colors is preserved.
     2. Complement symmetry Y_c + Y_(7−c) = 255 holds exactly.
     3. The zigzag slope ratios directly reflect coefficient magnitudes.
   ═══════════════════════════════════════════ */
export const LUMA_R = 0.299,
  LUMA_G = 0.587,
  LUMA_B = 0.114;
export const lum = (r: number, g: number, b: number): number => LUMA_R * r + LUMA_G * g + LUMA_B * b;

export const EIGHT_LEVELS = [0, lum(0, 0, 255), lum(255, 0, 0), lum(255, 0, 255), lum(0, 255, 0), lum(0, 255, 255), lum(255, 255, 0), 255];

export interface LevelInfo {
  name: string;
  gray: number;
}

export const LEVEL_INFO: LevelInfo[] = ["Black", "Blue", "Red", "Magenta", "Green", "Cyan", "Yellow", "White"].map((name, i) => ({
  name,
  gray: Math.round(EIGHT_LEVELS[i]),
}));

export function hue2rgb(h: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  const s = Math.min(5, Math.floor(h / 60)),
    f = (h % 60) / 60;
  return (
    [
      [255, Math.round(255 * f), 0],
      [Math.round(255 * (1 - f)), 255, 0],
      [0, 255, Math.round(255 * f)],
      [0, Math.round(255 * (1 - f)), 255],
      [Math.round(255 * f), 0, 255],
      [255, 0, Math.round(255 * (1 - f))],
    ] as [number, number, number][]
  )[s];
}

/**
 * Convert a pure RGB color to its hue angle (0–360).
 * PRECONDITION: the color must be "pure" — exactly one channel is 255
 * and exactly one channel is 0. For non-pure colors (e.g. grays or
 * desaturated values) the result is 0, which is intentional since
 * this function is only used via findPure() / LEVEL_CANDIDATES.
 */
export function rgb2hue(r: number, g: number, b: number): number {
  if (r === 255 && b === 0) return (g / 255) * 60;
  if (g === 255 && b === 0) return 120 - (r / 255) * 60;
  if (g === 255 && r === 0) return 120 + (b / 255) * 60;
  if (b === 255 && r === 0) return 240 - (g / 255) * 60;
  if (b === 255 && g === 0) return 240 + (r / 255) * 60;
  if (r === 255 && g === 0) return 360 - (b / 255) * 60;
  return 0;
}

/**
 * Minimum RGB Manhattan distance (|Δr|+|Δg|+|Δb|) to treat two
 * candidates as distinct colors. Rounding in solve() can produce
 * nearly-identical colors from different formulas; 8 filters those
 * out while keeping perceptually different hues.
 */
const PURE_DUPL_THRESHOLD = 8;

export interface ColorCandidate {
  angle: number;
  rgb: [number, number, number];
  hueLabel: string;
}

function findPure(target: number): ColorCandidate[] {
  if (target <= 0 || target >= 255) return [];
  const formulas = [
    { solve: (L: number) => (L - 255 * LUMA_R) / LUMA_G, make: (v: number): [number, number, number] => [255, v, 0] },
    { solve: (L: number) => (L - 255 * LUMA_G) / LUMA_R, make: (v: number): [number, number, number] => [v, 255, 0] },
    { solve: (L: number) => (L - 255 * LUMA_G) / LUMA_B, make: (v: number): [number, number, number] => [0, 255, v] },
    { solve: (L: number) => (L - 255 * LUMA_B) / LUMA_G, make: (v: number): [number, number, number] => [0, v, 255] },
    { solve: (L: number) => (L - 255 * LUMA_B) / LUMA_R, make: (v: number): [number, number, number] => [v, 0, 255] },
    { solve: (L: number) => (L - 255 * LUMA_R) / LUMA_B, make: (v: number): [number, number, number] => [255, 0, v] },
  ];
  const results: ColorCandidate[] = [];
  for (const f of formulas) {
    const v = Math.round(f.solve(target));
    if (v < 0 || v > 255) continue;
    const c = f.make(v);
    if (Math.max(...c) !== 255 || Math.min(...c) !== 0) continue;
    if (
      results.some(
        (prev) => Math.abs(prev.rgb[0] - c[0]) + Math.abs(prev.rgb[1] - c[1]) + Math.abs(prev.rgb[2] - c[2]) < PURE_DUPL_THRESHOLD,
      )
    )
      continue;
    const angle = rgb2hue(...c);
    results.push({ angle, rgb: c, hueLabel: Math.round(angle) + "°" });
  }
  return results.sort((a, b) => a.angle - b.angle);
}

const CANONICAL_COLORS: [number, number, number][] = [
  [0, 0, 0],
  [0, 0, 255],
  [255, 0, 0],
  [255, 0, 255],
  [0, 255, 0],
  [0, 255, 255],
  [255, 255, 0],
  [255, 255, 255],
];

export const LEVEL_CANDIDATES: ColorCandidate[][] = LEVEL_INFO.map((_, i) => {
  if (i === 0) return [{ angle: -1, rgb: [0, 0, 0] as [number, number, number], hueLabel: "—" }];
  if (i === 7) return [{ angle: -1, rgb: [255, 255, 255] as [number, number, number], hueLabel: "—" }];
  const a = findPure(EIGHT_LEVELS[i]);
  if (!a.length) {
    // Fallback for levels with no pure-color solution (should not occur with BT.601 coefficients)
    return [{ angle: -1, rgb: [128, 128, 128] as [number, number, number], hueLabel: "?" }];
  }
  // Sort by hue angle ascending (0°→360°)
  return a.sort((x, y) => x.angle - y.angle);
});

export const DEFAULT_CC: number[] = LEVEL_CANDIDATES.map((alts, i) => {
  let best = 0,
    bestDist = Infinity;
  alts.forEach((x, j) => {
    const d =
      Math.abs(x.rgb[0] - CANONICAL_COLORS[i][0]) +
      Math.abs(x.rgb[1] - CANONICAL_COLORS[i][1]) +
      Math.abs(x.rgb[2] - CANONICAL_COLORS[i][2]);
    if (d < bestDist) {
      bestDist = d;
      best = j;
    }
  });
  return best;
});

export const GRAY_LUT = new Uint8Array(256);
(() => {
  for (let g = 0; g < 256; g++) {
    let best = 0,
      bestDist = Infinity;
    for (let i = 0; i < 8; i++) {
      const d = Math.abs(g - LEVEL_INFO[i].gray);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    GRAY_LUT[g] = best;
  }
})();

export function buildColorLUT(cc: number[]): [number, number, number][] {
  return LEVEL_CANDIDATES.map((alts, lv) => {
    const raw = lv < cc.length ? cc[lv] : 0;
    const ci = alts.length > 0 ? ((raw % alts.length) + alts.length) % alts.length : 0;
    return alts[ci]?.rgb ?? [128, 128, 128];
  });
}

/** Pre-computed lookup table: CANDIDATE_LUT[level][degree] → candidate index */
const CANDIDATE_LUT: number[][] = LEVEL_CANDIDATES.map((cands) => {
  if (cands.length <= 1 || cands[0].angle < 0) return Array(360).fill(0);
  return Array.from({ length: 360 }, (_, deg) => {
    let best = 0,
      bestDist = Infinity;
    for (let i = 0; i < cands.length; i++) {
      const diff = Math.abs(cands[i].angle - deg);
      const d = Math.min(diff, 360 - diff);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  });
});

/** Find the candidate index in LEVEL_CANDIDATES[level] closest to the given hue angle. O(1) lookup. */
export function findClosestCandidate(level: number, hueAngle: number): number {
  return CANDIDATE_LUT[level][Math.round(((hueAngle % 360) + 360) % 360) % 360];
}
