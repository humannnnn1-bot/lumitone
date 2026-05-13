import { LUMA_VALUES } from "../data/music-data";
import { FANO_LINES } from "../data/theory-data";
import {
  andTriadEvents,
  complementCanonPairs,
  distributiveEvents,
  extendedHammingTimeline,
  lineAndComplement,
  octahedronMixSequence,
  pointFanoContextLines,
  syndromeDemoEvents,
  timedCodewordEnd,
  weightSpectrumTimeline,
  type DistributivePhase,
  type SyndromePhase,
} from "./music-playback-sequences";

export interface MusicPlaybackRuntime {
  clear: () => void;
  schedule: (fn: () => void, ms: number) => void;
  playBitVectorLevel: (lv: number) => void;
  triggerLumaBurst: (luma255: number) => void;
  triggerErrorMarker: () => void;
}

type LineComplementPhase = "line" | "complement" | null;
type SpectrumStepHandler = (positions: number[], weight: number, index: number) => void;
type ComplementCanonStepHandler = (pairIndex: number, phase: "playing" | null) => void;
type DistributiveStepHandler = (phase: DistributivePhase | null, value: number) => void;
type AndTriadStep = { pairIndex: number; phase: "operands" | "result" } | null;
type OctahedronMixPhase = "pair" | "result" | null;

export function scheduleXorTriple(lvA: number, lvB: number, onStep: (lv: number | null) => void, runtime: MusicPlaybackRuntime) {
  runtime.clear();
  const steps = [lvA, lvB, lvA ^ lvB];
  for (let i = 0; i < steps.length; i++) {
    runtime.schedule(() => {
      const lv = steps[i];
      runtime.playBitVectorLevel(lv);
      onStep(lv);
    }, i * 300);
  }
  runtime.schedule(() => onStep(null), 900);
}

export function scheduleLineAndComplement(lineIndex: number, onStep: (phase: LineComplementPhase) => void, runtime: MusicPlaybackRuntime) {
  const sequence = lineAndComplement(lineIndex);
  if (!sequence) return false;

  runtime.clear();
  runtime.schedule(() => {
    onStep("line");
    sequence.line.forEach((lv) => runtime.playBitVectorLevel(lv));
  }, 0);
  runtime.schedule(() => {
    onStep("complement");
    sequence.complement.forEach((lv) => runtime.playBitVectorLevel(lv));
  }, 500);
  runtime.schedule(() => onStep(null), 1000);
  return true;
}

export function scheduleSyndromeDemo(errorPos: number, onPhase: (phase: SyndromePhase | null) => void, runtime: MusicPlaybackRuntime) {
  const events = syndromeDemoEvents(errorPos);
  if (events.length === 0) return false;

  runtime.clear();
  for (const event of events) {
    runtime.schedule(() => {
      if (event.type === "phase") {
        onPhase(event.phase);
      } else if (event.type === "tone") {
        runtime.playBitVectorLevel(event.lv);
        if (event.errorMarker) {
          runtime.triggerErrorMarker();
        }
      } else {
        onPhase("syndrome");
        event.levels.forEach((lv) => runtime.playBitVectorLevel(lv));
      }
    }, event.at);
  }
  return true;
}

export function scheduleWeightSpectrum(onStep: SpectrumStepHandler, runtime: MusicPlaybackRuntime) {
  runtime.clear();
  const events = weightSpectrumTimeline();
  for (const event of events) {
    runtime.schedule(() => {
      onStep(event.positions, event.weight, event.index);
      event.positions.forEach((lv) => runtime.playBitVectorLevel(lv));
    }, event.at);
  }
  runtime.schedule(() => onStep([], -1, events.length), timedCodewordEnd(events, 7));
}

export function scheduleComplementCanon(onStep: ComplementCanonStepHandler, reverse: boolean, runtime: MusicPlaybackRuntime) {
  runtime.clear();
  for (const event of complementCanonPairs(reverse)) {
    runtime.schedule(() => {
      const [a, b] = event.pair;
      runtime.triggerLumaBurst(LUMA_VALUES[a]);
      runtime.triggerLumaBurst(LUMA_VALUES[b]);
      onStep(event.pairIndex, "playing");
    }, event.at);
  }
  runtime.schedule(() => onStep(-1, null), 1800);
}

export function schedulePointFanoContext(point: number, onStep: (lineIdx: number | null) => void, runtime: MusicPlaybackRuntime) {
  const lines = pointFanoContextLines(point);
  if (lines.length === 0) return false;

  runtime.clear();
  for (let i = 0; i < lines.length; i++) {
    runtime.schedule(() => {
      onStep(lines[i]);
      FANO_LINES[lines[i]].forEach((lv) => runtime.playBitVectorLevel(lv));
    }, i * 600);
  }
  runtime.schedule(() => onStep(null), lines.length * 600);
  return true;
}

export function scheduleExtendedHamming(onStep: SpectrumStepHandler, runtime: MusicPlaybackRuntime) {
  runtime.clear();
  const events = extendedHammingTimeline();
  for (const event of events) {
    runtime.schedule(() => {
      onStep(event.positions, event.weight, event.index);
      for (const lv of event.positions) {
        if (lv === 0) {
          runtime.triggerLumaBurst(0);
        } else {
          runtime.playBitVectorLevel(lv);
        }
      }
    }, event.at);
  }
  runtime.schedule(() => onStep([], -1, events.length), timedCodewordEnd(events, 8));
}

export function scheduleDistributiveLaw(a: number, b: number, c: number, onStep: DistributiveStepHandler, runtime: MusicPlaybackRuntime) {
  runtime.clear();
  for (const event of distributiveEvents(a, b, c)) {
    runtime.schedule(() => {
      onStep(event.phase, event.value);
      event.play.forEach((lv) => runtime.playBitVectorLevel(lv));
    }, event.at);
  }
}

export function scheduleAndTriads(onStep: (step: AndTriadStep) => void, runtime: MusicPlaybackRuntime) {
  runtime.clear();
  for (const event of andTriadEvents()) {
    runtime.schedule(() => {
      onStep(event.step);
      event.play.forEach((lv) => runtime.playBitVectorLevel(lv));
    }, event.at);
  }
}

export function scheduleOctahedronMix(
  lvA: number,
  lvB: number,
  onStep: (phase: OctahedronMixPhase) => void,
  runtime: MusicPlaybackRuntime,
) {
  const sequence = octahedronMixSequence(lvA, lvB);
  if (!sequence) return false;

  runtime.clear();
  for (const event of sequence.events) {
    runtime.schedule(() => {
      onStep(event.phase);
      event.play.forEach((lv) => runtime.playBitVectorLevel(lv));
    }, event.at);
  }
  return true;
}
