import { FANO_LINES } from "./theory-data";
export { freqToNote } from "./music-frequency";

export const CHROMA_LEVELS = [1, 2, 3, 4, 5, 6] as const;

export const LUMA_VALUES = [0, 29, 76, 105, 150, 179, 226, 255] as const;

export const BT601_VALUES: Record<number, number> = {
  1: 0.114,
  2: 0.299,
  3: 0.413,
  4: 0.587,
  5: 0.701,
  6: 0.886,
};

export const COMPLEMENT_PAIRS: [number, number][] = [
  [1, 6],
  [2, 5],
  [3, 4],
];

export const ZIGZAG_PATH = [2, 6, 4, 5, 1, 3] as const;
export const ZIGZAG_CHANNELS = ["G", "R", "B", "G", "R", "B"] as const;

export const FANO_RHYTHM_PATTERNS: number[][] = Array.from({ length: 7 }, (_, i) => [(0 + i) % 7, (1 + i) % 7, (3 + i) % 7]);

export type ToneMode = "pitch" | "bitSpectrum";

export const BIT_SPECTRUM_COMPONENTS = [
  { bit: 0, lv: 1, name: "P1/B", harmonic: 3, gain: 0.72 },
  { bit: 1, lv: 2, name: "P2/R", harmonic: 1, gain: 1.0 },
  { bit: 2, lv: 4, name: "P4/G", harmonic: 2, gain: 0.86 },
] as const;

export type BitSpectrumComponent = (typeof BIT_SPECTRUM_COMPONENTS)[number];

export function bitSpectrumComponents(lv: number): BitSpectrumComponent[] {
  return BIT_SPECTRUM_COMPONENTS.filter((component) => (lv & (1 << component.bit)) !== 0);
}

export function fanoLinesThrough(point: number): number[] {
  return FANO_LINES.reduce<number[]>((acc, line, i) => {
    if (line.includes(point)) acc.push(i);
    return acc;
  }, []);
}
