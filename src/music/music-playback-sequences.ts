import { FANO_LINES } from "../data/theory-data";
import { COMPLEMENT_PAIRS, ZIGZAG_PATH } from "../data/music-data";
import { ALL_POINTS, AND_TRIADS, K8_LAYER_EDGES, extendedHammingCodewords, linesThrough } from "./music-engine-core";

interface Codeword {
  positions: number[];
  weight: number;
}

interface TimedCodeword {
  at: number;
  positions: number[];
  weight: number;
  index: number;
}

export type SyndromePhase = "original" | "corrupted" | "syndrome" | "corrected";
type SyndromeEvent =
  | { at: number; type: "phase"; phase: SyndromePhase | null }
  | { at: number; type: "tone"; lv: number; errorMarker?: boolean }
  | { at: number; type: "parity"; levels: number[] };

interface DistributiveValues {
  bxc: number;
  left: number;
  ab: number;
  ac: number;
  right: number;
}

export type DistributivePhase = "bxc" | "left" | "ab" | "ac" | "right" | "equal";
interface DistributiveEvent {
  at: number;
  phase: DistributivePhase | null;
  value: number;
  play: number[];
}

export function complementOfLine(lineIndex: number): number[] | null {
  if (lineIndex < 0 || lineIndex >= FANO_LINES.length) return null;
  const lineSet = new Set(FANO_LINES[lineIndex]);
  return ALL_POINTS.filter((lv) => !lineSet.has(lv));
}

export function lineAndComplement(lineIndex: number): { line: number[]; complement: number[] } | null {
  const complement = complementOfLine(lineIndex);
  if (!complement) return null;
  return { line: [...FANO_LINES[lineIndex]], complement };
}

export function syndromeDemoEvents(errorPos: number): SyndromeEvent[] {
  if (errorPos < 1 || errorPos > 7) return [];
  const events: SyndromeEvent[] = [];
  let t = 0;

  events.push({ at: t, type: "phase", phase: "original" });
  for (let lv = 1; lv <= 7; lv++) {
    events.push({ at: t, type: "tone", lv });
    t += 200;
  }

  t += 300;
  events.push({ at: t, type: "phase", phase: "corrupted" });
  for (let lv = 1; lv <= 7; lv++) {
    events.push({ at: t, type: "tone", lv, errorMarker: lv === errorPos });
    t += 200;
  }

  t += 300;
  events.push({
    at: t,
    type: "phase",
    phase: "syndrome",
  });
  events.push({
    at: t,
    type: "parity",
    levels: [0, 1, 2].filter((bit) => errorPos & (1 << bit)).map((bit) => 1 << bit),
  });

  t += 500;
  events.push({ at: t, type: "phase", phase: "corrected" });
  for (let lv = 1; lv <= 7; lv++) {
    events.push({ at: t, type: "tone", lv });
    t += 200;
  }

  events.push({ at: t + 300, type: "phase", phase: null });
  return events;
}

function weightSpectrumCodewords(): Codeword[] {
  const codewords: Codeword[] = [];
  codewords.push({ positions: [], weight: 0 });
  for (const line of FANO_LINES) {
    codewords.push({ positions: [...line], weight: 3 });
  }
  for (const line of FANO_LINES) {
    const lineSet = new Set(line);
    codewords.push({ positions: ALL_POINTS.filter((lv) => !lineSet.has(lv)), weight: 4 });
  }
  codewords.push({ positions: [...ALL_POINTS], weight: 7 });
  return codewords;
}

function timedCodewords(codewords: Codeword[], terminalWeight: number): TimedCodeword[] {
  let at = 0;
  return codewords.map((cw, index) => {
    const event = { at, positions: cw.positions, weight: cw.weight, index };
    at += cw.weight === 0 || cw.weight === terminalWeight ? 500 : terminalWeight === 8 ? 350 : 400;
    return event;
  });
}

export function timedCodewordEnd(events: TimedCodeword[], terminalWeight: number): number {
  if (events.length === 0) return 0;
  const last = events[events.length - 1];
  return last.at + (last.weight === 0 || last.weight === terminalWeight ? 500 : terminalWeight === 8 ? 350 : 400);
}

export function extendedHammingTimeline(): TimedCodeword[] {
  return timedCodewords(extendedHammingCodewords(), 8);
}

export function weightSpectrumTimeline(): TimedCodeword[] {
  return timedCodewords(weightSpectrumCodewords(), 7);
}

export function complementCanonPairs(reverse = false): Array<{ at: number; pairIndex: number; pair: [number, number] }> {
  return [0, 1, 2].map((step) => {
    const pairIndex = reverse ? 2 - step : step;
    return { at: step * 600, pairIndex, pair: [...COMPLEMENT_PAIRS[pairIndex]] };
  });
}

export function zigzagStep(step: number): { index: number; lv: number } {
  const index = step % ZIGZAG_PATH.length;
  return { index, lv: ZIGZAG_PATH[index] };
}

export function pointFanoContextLines(point: number): number[] {
  return point >= 1 && point <= 7 ? linesThrough(point) : [];
}

function distributiveValues(a: number, b: number, c: number): DistributiveValues {
  const bxc = b ^ c;
  const left = a & bxc;
  const ab = a & b;
  const ac = a & c;
  const right = ab ^ ac;
  return { bxc, left, ab, ac, right };
}

export function distributiveEvents(a: number, b: number, c: number): DistributiveEvent[] {
  const values = distributiveValues(a, b, c);
  return [
    { at: 0, phase: "bxc", value: values.bxc, play: [values.bxc] },
    { at: 400, phase: "left", value: values.left, play: [values.left] },
    { at: 1000, phase: "ab", value: values.ab, play: [values.ab] },
    { at: 1400, phase: "ac", value: values.ac, play: [values.ac] },
    { at: 1800, phase: "right", value: values.right, play: [values.right] },
    { at: 2400, phase: "equal", value: values.left, play: [values.left, values.right] },
    { at: 2900, phase: null, value: -1, play: [] },
  ];
}

export function andTriadEvents(): Array<{ at: number; step: { pairIndex: number; phase: "operands" | "result" } | null; play: number[] }> {
  const events: Array<{ at: number; step: { pairIndex: number; phase: "operands" | "result" } | null; play: number[] }> = [];
  let at = 0;
  AND_TRIADS.forEach(([a, b, result], pairIndex) => {
    events.push({ at, step: { pairIndex, phase: "operands" }, play: [a, b] });
    events.push({ at: at + 360, step: { pairIndex, phase: "result" }, play: [result] });
    at += 860;
  });
  events.push({ at, step: null, play: [] });
  return events;
}

export function octahedronMixSequence(
  lvA: number,
  lvB: number,
): { result: number; events: Array<{ at: number; phase: "pair" | "result" | null; play: number[] }> } | null {
  if (lvA < 1 || lvA > 6 || lvB < 1 || lvB > 6 || lvA === lvB) return null;
  const result = lvA ^ lvB;
  if (result < 1 || result > 6) return null;
  return {
    result,
    events: [
      { at: 0, phase: "pair", play: [lvA, lvB] },
      { at: 480, phase: "result", play: [result] },
      { at: 920, phase: null, play: [] },
    ],
  };
}

export function k8LayerStep(layer: 1 | 2 | 3, step: number): { intervalMs: number; edgeIndex: number; pair: [number, number] } {
  const edges = K8_LAYER_EDGES[layer];
  const edgeIndex = step % edges.length;
  return {
    intervalMs: layer === 3 ? 520 : 280,
    edgeIndex,
    pair: [...edges[edgeIndex]],
  };
}
