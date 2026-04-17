import { FANO_LINES } from "../theory/theory-data";

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

export function fanoLinesThrough(point: number): number[] {
  return FANO_LINES.reduce<number[]>((acc, line, i) => {
    if (line.includes(point)) acc.push(i);
    return acc;
  }, []);
}

const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"] as const;

/** Frequency → "A4" or "A4 −12¢" style label (cents shown only when non-zero). */
export function freqToNote(hz: number): string {
  if (!isFinite(hz) || hz <= 0) return "—";
  const midi = 69 + 12 * Math.log2(hz / 440);
  const midiRound = Math.round(midi);
  const cents = Math.round((midi - midiRound) * 100);
  const name = NOTE_NAMES[((midiRound % 12) + 12) % 12];
  const octave = Math.floor(midiRound / 12) - 1;
  if (cents === 0) return `${name}${octave}`;
  return `${name}${octave}${cents > 0 ? "+" : "−"}${Math.abs(cents)}¢`;
}
