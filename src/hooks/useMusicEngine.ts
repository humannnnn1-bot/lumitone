import { useRef, useEffect, useCallback, useState } from "react";
import { FANO_LINES } from "../data/theory-data";
import { FANO_RHYTHM_PATTERNS, LUMA_VALUES } from "../data/music-data";
import { angleToFreq, type ScaleMode } from "../data/music-frequency";
import {
  applyParams,
  buildAudioGraph,
  buildFM,
  RAMP_TC,
  teardown,
  teardownFM,
  triggerBitSpectrumBurst,
  triggerErrorMarker,
  triggerLumaBurst,
  triggerPitchOrLumaBurst,
  type AudioNodes,
  type SonificationLevel,
} from "../music/music-audio-graph";
import { FULL_GRAY_CODE, GRAY_VOICE_FREQS, PARITY_GROUPS, gl32GenA, gl32GenB, gl32GenC, lumaToFreq } from "../music/music-engine-core";
import {
  andTriadEvents,
  complementCanonPairs,
  complementOfLine,
  distributiveEvents,
  extendedHammingTimeline,
  k8LayerStep,
  lineAndComplement,
  octahedronMixSequence,
  pointFanoContextLines,
  syndromeDemoEvents,
  tetraSingleEvents,
  tetraSplitEvents,
  timedCodewordEnd,
  weightSpectrumTimeline,
  zigzagStep,
} from "../music/music-playback-sequences";
import {
  clearIntervalSlot,
  clearIntervalSlots,
  clearTimeoutList,
  replaceInterval,
  scheduleTimeout,
  type IntervalHandle,
  type TimeoutHandle,
} from "../music/music-scheduler";

export type { ScaleMode } from "../data/music-frequency";

interface MusicEngineParams {
  enabled: boolean;
  levels: SonificationLevel[];
  hoveredLv: number | null;
  alpha0: number;
  alpha7: number;
  volume: number; // 0-1
  scaleMode: ScaleMode;
  fmEnabled: boolean;
  panEnabled: boolean;
  hoveredFanoLine: number | null; // 0-6 or null
  luminanceMode: "symmetric" | "luminance";
  originMode: 0 | 7;
}

export interface MusicEngineReturn {
  initAudio: () => void;
  stopAudio: () => void;
  triggerToneBurst: (lv: number, angle: number) => void;
  playGrayMelody: (tempo: number, onStep: (lv: number | null) => void) => void;
  stopGrayMelody: () => void;
  startFanoRhythm: (tempo: number, onBeat: (lines: number[], pos: number) => void) => void;
  stopFanoRhythm: () => void;
  analyserNode: AnalyserNode | null;
  playXorTriple: (lvA: number, lvB: number, onStep: (lv: number | null) => void) => void;
  playParityChord: (parityBit: 0 | 1 | 2) => void;
  playComplementChord: (lineIndex: number) => void;
  playLineAndComplement: (lineIndex: number, onStep: (phase: "line" | "complement" | null) => void) => void;
  playSyndromeDemo: (errorPos: number, onPhase: (phase: "original" | "corrupted" | "syndrome" | "corrected" | null) => void) => void;
  playGray3Voice: (onStep: (lv: number | null) => void) => void;
  playWeightSpectrum: (onStep: (positions: number[], weight: number, index: number) => void) => void;
  playCayleyRow: (row: number, onStep: (col: number, value: number) => void) => void;
  applyGL32Transform: (gen: "A" | "B" | "C", onPerm?: (perm: number[]) => void) => void;
  resetGL32Transform: (onPerm?: (perm: number[]) => void) => void;
  setLuminanceMode: (mode: "symmetric" | "luminance") => void;
  stopAlgebra: () => void;
  setDroneMuted: (muted: boolean) => void;
  playComplementCanon: (onStep: (pairIndex: number, phase: "playing" | null) => void, reverse?: boolean) => void;
  playZigzagMelody: (onStep: (stepIndex: number | null) => void) => void;
  stopZigzagMelody: () => void;
  playPointFanoContext: (point: number, onStep: (lineIdx: number | null) => void) => void;
  playExtendedHamming: (onStep: (positions: number[], weight: number, index: number) => void) => void;
  playDistributiveLaw: (
    a: number,
    b: number,
    c: number,
    onStep: (phase: "bxc" | "left" | "ab" | "ac" | "right" | "equal" | null, value: number) => void,
  ) => void;
  playAndTriads: (onStep: (step: { pairIndex: number; phase: "operands" | "result" } | null) => void) => void;
  playOctahedronMix: (lvA: number, lvB: number, onStep: (phase: "pair" | "result" | null) => void) => void;
  playTetraSplit: (onStep: (phase: "t0" | "t1" | null) => void) => void;
  playTetraT0: (onStep: (phase: "t0" | null) => void) => void;
  playTetraT1: (onStep: (phase: "t1" | null) => void) => void;
  playK8Layer: (layer: 1 | 2 | 3, onStep: (edgeIndex: number, pair: [number, number] | null) => void) => void;
}

/* ── Hook ── */
export function useMusicEngine({
  enabled,
  levels,
  hoveredLv,
  alpha0,
  alpha7,
  volume,
  scaleMode,
  fmEnabled,
  panEnabled,
  hoveredFanoLine,
  luminanceMode,
  originMode,
}: MusicEngineParams): MusicEngineReturn {
  const nodesRef = useRef<AudioNodes | null>(null);
  const grayIntervalRef = useRef<IntervalHandle | null>(null);
  const fanoIntervalRef = useRef<IntervalHandle | null>(null);
  const algebraTimersRef = useRef<TimeoutHandle[]>([]);
  const gray3IntervalRef = useRef<IntervalHandle | null>(null);
  const zigzagIntervalRef = useRef<IntervalHandle | null>(null);
  const cayleyIntervalRef = useRef<IntervalHandle | null>(null);
  const k8IntervalRef = useRef<IntervalHandle | null>(null);
  const gl32PermRef = useRef<number[]>([1, 2, 3, 4, 5, 6, 7]); // identity permutation
  const droneMutedRef = useRef(true);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  // Keep latest params in refs so callbacks can access them
  const paramsRef = useRef({
    levels,
    hoveredLv,
    alpha0,
    alpha7,
    volume,
    scaleMode,
    fmEnabled,
    panEnabled,
    hoveredFanoLine,
    luminanceMode,
    originMode,
  });
  paramsRef.current = {
    levels,
    hoveredLv,
    alpha0,
    alpha7,
    volume,
    scaleMode,
    fmEnabled,
    panEnabled,
    hoveredFanoLine,
    luminanceMode,
    originMode,
  };

  /* ── Init ── */
  const initAudio = useCallback(() => {
    if (nodesRef.current) {
      if (nodesRef.current.ctx.state === "suspended") {
        void nodesRef.current.ctx.resume();
      }
      return;
    }
    const ctx = new AudioContext({ sampleRate: 44100 });
    const nodes = buildAudioGraph(ctx);
    nodesRef.current = nodes;
    setAnalyserNode(nodes.analyser);

    // Build FM if enabled
    const p = paramsRef.current;
    if (p.fmEnabled) {
      buildFM(nodes, p.levels, p.scaleMode);
    }

    // Apply params immediately
    applyParams(
      nodes,
      p.levels,
      p.hoveredLv,
      p.alpha0,
      p.alpha7,
      p.volume,
      p.scaleMode,
      p.fmEnabled,
      p.panEnabled,
      p.hoveredFanoLine,
      p.luminanceMode,
      p.originMode,
      droneMutedRef.current,
    );
  }, []);

  const stopAudio = useCallback(() => {
    clearIntervalSlots(grayIntervalRef, fanoIntervalRef, zigzagIntervalRef, gray3IntervalRef, cayleyIntervalRef, k8IntervalRef);
    clearTimeoutList(algebraTimersRef);
    if (nodesRef.current) {
      teardown(nodesRef.current);
      nodesRef.current = null;
    }
    setAnalyserNode(null);
  }, []);

  /* ── Teardown on unmount ── */
  useEffect(() => {
    return stopAudio;
  }, [stopAudio]);

  /* ── When disabled, teardown audio ── */
  useEffect(() => {
    if (!enabled && nodesRef.current) {
      stopAudio();
    }
  }, [enabled, stopAudio]);

  /* ── FM toggle ── */
  useEffect(() => {
    if (!enabled || !nodesRef.current) return;
    if (fmEnabled) {
      buildFM(nodesRef.current, levels, scaleMode);
    } else {
      teardownFM(nodesRef.current);
    }
  }, [enabled, fmEnabled, scaleMode, levels]);

  /* ── Update drone params when they change ── */
  useEffect(() => {
    if (!enabled || !nodesRef.current) return;
    applyParams(
      nodesRef.current,
      levels,
      hoveredLv,
      alpha0,
      alpha7,
      volume,
      scaleMode,
      fmEnabled,
      panEnabled,
      hoveredFanoLine,
      luminanceMode,
      originMode,
      droneMutedRef.current,
    );
  }, [enabled, levels, hoveredLv, alpha0, alpha7, volume, scaleMode, fmEnabled, panEnabled, hoveredFanoLine, luminanceMode, originMode]);

  const angleForLv = useCallback((lv: number): number => {
    const p = paramsRef.current;
    const d = p.levels.find((l) => l.lv === lv);
    const activeAlpha = p.originMode === 0 ? p.alpha0 : p.alpha7;
    return (d?.angle ?? 0) + activeAlpha;
  }, []);

  /* ── Tone Burst ── */
  const triggerToneBurst = useCallback((lv: number, angle: number) => {
    const nodes = nodesRef.current;
    if (!nodes) return;

    triggerPitchOrLumaBurst(nodes, lv, angle, paramsRef.current.scaleMode);
  }, []);

  /** Hue/luma traversal: used when the sequence is meant to be heard as a melody. */
  const playPitchLevel = useCallback(
    (lv: number) => {
      const nodes = nodesRef.current;
      if (!nodes) return;
      if (lv === 0 || lv === 7) {
        triggerPitchOrLumaBurst(nodes, lv, -1, paramsRef.current.scaleMode);
        return;
      }
      triggerPitchOrLumaBurst(nodes, lv, angleForLv(lv), paramsRef.current.scaleMode);
    },
    [angleForLv],
  );

  /** GF(2)^3 point label: used by algebraic/Fano/Hamming structures. */
  const playBitVectorLevel = useCallback((lv: number) => {
    const nodes = nodesRef.current;
    if (!nodes) return;
    triggerBitSpectrumBurst(nodes, lv, -1, false);
  }, []);

  /* ── Gray Code Melody ── */
  const playGrayMelody = useCallback(
    (tempo: number, onStep: (lv: number | null) => void) => {
      if (!nodesRef.current) return;
      const intervalMs = 60000 / tempo;
      let step = 0;
      replaceInterval(
        grayIntervalRef,
        () => {
          const lv = FULL_GRAY_CODE[step % FULL_GRAY_CODE.length];
          playPitchLevel(lv);
          onStep(lv);
          step++;
        },
        intervalMs,
      );
    },
    [playPitchLevel],
  );

  const stopGrayMelody = useCallback(() => {
    clearIntervalSlot(grayIntervalRef);
  }, []);

  /* ── Fano Rhythm Canon ── */
  const startFanoRhythm = useCallback((tempo: number, onBeat: (lines: number[], pos: number) => void) => {
    const nodes = nodesRef.current;
    if (!nodes) return;

    const subdivisionMs = 60000 / (tempo * 7);
    let pos = 0;

    replaceInterval(
      fanoIntervalRef,
      () => {
        const currentNodes = nodesRef.current;
        if (!currentNodes) return;
        const ctx = currentNodes.ctx;
        const now = ctx.currentTime;

        // Each beat may trigger up to 3 Fano lines simultaneously (difference set {0,1,3}
        // guarantees exactly 3 firings per beat). Collect them all so the UI can highlight
        // the full set of audible lines in sync with the noise bursts.
        const firingLines: number[] = [];
        for (let line = 0; line < 7; line++) {
          if (FANO_RHYTHM_PATTERNS[line].includes(pos % 7)) {
            firingLines.push(line);
            // Short noise burst filtered at different frequency per line
            const bufLen = Math.floor(ctx.sampleRate * 0.05); // 50ms
            const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let j = 0; j < bufLen; j++) data[j] = Math.random() * 2 - 1;

            const source = ctx.createBufferSource();
            source.buffer = buf;

            const filter = ctx.createBiquadFilter();
            filter.type = "bandpass";
            filter.frequency.value = 300 + line * 200; // 300-1700 Hz per line
            filter.Q.value = 5;

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.05);

            source.connect(filter).connect(gain).connect(currentNodes.master);
            source.start(now);
            source.stop(now + 0.06);
          }
        }
        onBeat(firingLines, pos % 7);
        pos++;
      },
      subdivisionMs,
    );
  }, []);

  const stopFanoRhythm = useCallback(() => {
    clearIntervalSlot(fanoIntervalRef);
  }, []);

  /* ── Helper: clear all algebra timers ── */
  const clearAlgebraTimers = useCallback(() => {
    clearTimeoutList(algebraTimersRef);
  }, []);

  /* ── Helper: schedule a timeout and track it ── */
  const scheduleAlgebra = useCallback((fn: () => void, ms: number) => {
    return scheduleTimeout(algebraTimersRef, fn, ms);
  }, []);

  /* ── stopAlgebra ── */
  const stopAlgebra = useCallback(() => {
    clearAlgebraTimers();
    clearIntervalSlots(gray3IntervalRef, cayleyIntervalRef, zigzagIntervalRef, k8IntervalRef);
  }, [clearAlgebraTimers]);

  /* ── 1. playXorTriple ── */
  const playXorTriple = useCallback(
    (lvA: number, lvB: number, onStep: (lv: number | null) => void) => {
      if (!nodesRef.current) return;
      clearAlgebraTimers();
      const lvC = lvA ^ lvB;
      const steps = [lvA, lvB, lvC];
      for (let i = 0; i < 3; i++) {
        scheduleAlgebra(() => {
          const lv = steps[i];
          playBitVectorLevel(lv);
          onStep(lv);
        }, i * 300);
      }
      scheduleAlgebra(() => onStep(null), 900);
    },
    [playBitVectorLevel, clearAlgebraTimers, scheduleAlgebra],
  );

  /* ── 2. playParityChord ── */
  const playParityChord = useCallback(
    (parityBit: 0 | 1 | 2) => {
      if (!nodesRef.current) return;
      const group = PARITY_GROUPS[parityBit];
      for (const lv of group) {
        playBitVectorLevel(lv);
      }
    },
    [playBitVectorLevel],
  );

  /* ── 3. playComplementChord ── */
  const playComplementChord = useCallback(
    (lineIndex: number) => {
      if (!nodesRef.current) return;
      const complement = complementOfLine(lineIndex);
      if (!complement) return;
      for (const lv of complement) {
        playBitVectorLevel(lv);
      }
    },
    [playBitVectorLevel],
  );

  /* ── 4. playLineAndComplement ── */
  const playLineAndComplement = useCallback(
    (lineIndex: number, onStep: (phase: "line" | "complement" | null) => void) => {
      if (!nodesRef.current) return;
      const sequence = lineAndComplement(lineIndex);
      if (!sequence) return;
      clearAlgebraTimers();

      scheduleAlgebra(() => {
        onStep("line");
        for (const lv of sequence.line) {
          playBitVectorLevel(lv);
        }
      }, 0);

      scheduleAlgebra(() => {
        onStep("complement");
        for (const lv of sequence.complement) {
          playBitVectorLevel(lv);
        }
      }, 500);

      scheduleAlgebra(() => onStep(null), 1000);
    },
    [playBitVectorLevel, clearAlgebraTimers, scheduleAlgebra],
  );

  /* ── 5. playSyndromeDemo ── */
  const playSyndromeDemo = useCallback(
    (errorPos: number, onPhase: (phase: "original" | "corrupted" | "syndrome" | "corrected" | null) => void) => {
      if (!nodesRef.current) return;
      const events = syndromeDemoEvents(errorPos);
      if (events.length === 0) return;
      clearAlgebraTimers();

      for (const event of events) {
        scheduleAlgebra(() => {
          if (event.type === "phase") {
            onPhase(event.phase);
          } else if (event.type === "tone") {
            playBitVectorLevel(event.lv);
            if (event.errorMarker) {
              const nodes = nodesRef.current;
              if (nodes) triggerErrorMarker(nodes);
            }
          } else {
            onPhase("syndrome");
            for (const lv of event.levels) {
              playBitVectorLevel(lv);
            }
          }
        }, event.at);
      }
    },
    [playBitVectorLevel, clearAlgebraTimers, scheduleAlgebra],
  );

  /* ── 6. playGray3Voice (looping) ── */
  const playGray3Voice = useCallback((onStep: (lv: number | null) => void) => {
    if (!nodesRef.current) return;

    let step = 0;
    replaceInterval(
      gray3IntervalRef,
      () => {
        const nodes = nodesRef.current;
        if (!nodes) return;
        const ctx = nodes.ctx;
        const lv = FULL_GRAY_CODE[step % FULL_GRAY_CODE.length];
        onStep(lv);

        // Create oscillators for each bit that is 1
        for (let bit = 0; bit < 3; bit++) {
          if (lv & (1 << bit)) {
            const osc = ctx.createOscillator();
            osc.type = "sine";
            osc.frequency.value = GRAY_VOICE_FREQS[bit];

            const gain = ctx.createGain();
            const now = ctx.currentTime;
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.2, now + 0.01);
            gain.gain.linearRampToValueAtTime(0.0, now + 0.35);

            osc.connect(gain).connect(nodes.master);
            osc.start(now);
            osc.stop(now + 0.38);
          }
        }
        step++;
      },
      400,
    );
  }, []);

  /* ── 7. playWeightSpectrum ── */
  const playWeightSpectrum = useCallback(
    (onStep: (positions: number[], weight: number, index: number) => void) => {
      if (!nodesRef.current) return;
      clearAlgebraTimers();

      const events = weightSpectrumTimeline();
      for (const event of events) {
        scheduleAlgebra(() => {
          onStep(event.positions, event.weight, event.index);
          for (const lv of event.positions) {
            playBitVectorLevel(lv);
          }
        }, event.at);
      }

      scheduleAlgebra(() => onStep([], -1, events.length), timedCodewordEnd(events, 7));
    },
    [playBitVectorLevel, clearAlgebraTimers, scheduleAlgebra],
  );

  /* ── 8. playCayleyRow (looping) ── */
  const playCayleyRow = useCallback(
    (row: number, onStep: (col: number, value: number) => void) => {
      if (!nodesRef.current) return;
      let step = 0;
      replaceInterval(
        cayleyIntervalRef,
        () => {
          if (!nodesRef.current) return;
          const col = step % 8;
          const value = row ^ col;
          onStep(col, value);
          playBitVectorLevel(value);
          step++;
        },
        300,
      );
    },
    [playBitVectorLevel],
  );

  /* ── 9. applyGL32Transform ── */
  const applyGL32Transform = useCallback((gen: "A" | "B" | "C", onPerm?: (perm: number[]) => void) => {
    if (!nodesRef.current) return;
    const genFn = gen === "A" ? gl32GenA : gen === "B" ? gl32GenB : gl32GenC;
    const perm = gl32PermRef.current;
    gl32PermRef.current = perm.map((lv) => genFn(lv));

    const nodes = nodesRef.current;
    const p = paramsRef.current;
    const now = nodes.ctx.currentTime;
    const newPerm = gl32PermRef.current;
    const activeAlpha = p.originMode === 0 ? p.alpha0 : p.alpha7;
    const freqForLv = (lv: number): number => {
      if (lv === 0 || lv === 7) return lumaToFreq(LUMA_VALUES[lv]);
      const lvData = p.levels.find((l) => l.lv === lv);
      return angleToFreq((lvData?.angle ?? 0) + activeAlpha, p.scaleMode);
    };

    for (let i = 0; i < 6; i++) {
      const targetLv = newPerm[i];
      nodes.oscs[i].frequency.setTargetAtTime(freqForLv(targetLv), now, RAMP_TC);
    }

    onPerm?.([0, ...newPerm]);
  }, []);

  const resetGL32Transform = useCallback((onPerm?: (perm: number[]) => void) => {
    if (!nodesRef.current) {
      gl32PermRef.current = [1, 2, 3, 4, 5, 6, 7];
      onPerm?.([0, 1, 2, 3, 4, 5, 6, 7]);
      return;
    }
    gl32PermRef.current = [1, 2, 3, 4, 5, 6, 7];
    const nodes = nodesRef.current;
    const p = paramsRef.current;
    const now = nodes.ctx.currentTime;
    const activeAlpha = p.originMode === 0 ? p.alpha0 : p.alpha7;
    for (let i = 0; i < 6; i++) {
      const lvData = p.levels.find((l) => l.lv === i + 1);
      if (!lvData) continue;
      nodes.oscs[i].frequency.setTargetAtTime(angleToFreq(lvData.angle + activeAlpha, p.scaleMode), now, RAMP_TC);
    }
    onPerm?.([0, 1, 2, 3, 4, 5, 6, 7]);
  }, []);

  /* ── 10. setLuminanceMode ── */
  const setLuminanceMode = useCallback((mode: "symmetric" | "luminance") => {
    if (!nodesRef.current) return;
    paramsRef.current.luminanceMode = mode;
    const p = paramsRef.current;
    applyParams(
      nodesRef.current,
      p.levels,
      p.hoveredLv,
      p.alpha0,
      p.alpha7,
      p.volume,
      p.scaleMode,
      p.fmEnabled,
      p.panEnabled,
      p.hoveredFanoLine,
      mode,
      p.originMode,
      droneMutedRef.current,
    );
  }, []);

  /* ── 11. setDroneMuted ── */
  const setDroneMuted = useCallback((muted: boolean) => {
    droneMutedRef.current = muted;
    if (!nodesRef.current) return;
    const p = paramsRef.current;
    applyParams(
      nodesRef.current,
      p.levels,
      p.hoveredLv,
      p.alpha0,
      p.alpha7,
      p.volume,
      p.scaleMode,
      p.fmEnabled,
      p.panEnabled,
      p.hoveredFanoLine,
      p.luminanceMode,
      p.originMode,
      muted,
    );
  }, []);

  /* ── 12. playComplementCanon ── */
  const playComplementCanon = useCallback(
    (onStep: (pairIndex: number, phase: "playing" | null) => void, reverse = false) => {
      const nodes = nodesRef.current;
      if (!nodes) return;
      clearAlgebraTimers();
      for (const event of complementCanonPairs(reverse)) {
        scheduleAlgebra(() => {
          const [a, b] = event.pair;
          triggerLumaBurst(nodes, LUMA_VALUES[a]);
          triggerLumaBurst(nodes, LUMA_VALUES[b]);
          onStep(event.pairIndex, "playing");
        }, event.at);
      }
      scheduleAlgebra(() => onStep(-1, null), 1800);
    },
    [clearAlgebraTimers, scheduleAlgebra],
  );

  /* ── 13. playZigzagMelody (looping) ── */
  const playZigzagMelody = useCallback((onStep: (stepIndex: number | null) => void) => {
    const nodes = nodesRef.current;
    if (!nodes) return;
    let step = 0;
    replaceInterval(
      zigzagIntervalRef,
      () => {
        const currentNodes = nodesRef.current;
        if (!currentNodes) return;
        const { index, lv } = zigzagStep(step);
        triggerLumaBurst(currentNodes, LUMA_VALUES[lv]);
        onStep(index);
        step++;
      },
      400,
    );
  }, []);

  const stopZigzagMelody = useCallback(() => {
    clearIntervalSlot(zigzagIntervalRef);
  }, []);

  /* ── 14. playPointFanoContext ── */
  const playPointFanoContext = useCallback(
    (point: number, onStep: (lineIdx: number | null) => void) => {
      if (!nodesRef.current) return;
      const lines = pointFanoContextLines(point);
      if (lines.length === 0) return;
      clearAlgebraTimers();
      for (let i = 0; i < lines.length; i++) {
        scheduleAlgebra(() => {
          onStep(lines[i]);
          for (const lv of FANO_LINES[lines[i]]) {
            playBitVectorLevel(lv);
          }
        }, i * 600);
      }
      scheduleAlgebra(() => onStep(null), lines.length * 600);
    },
    [playBitVectorLevel, clearAlgebraTimers, scheduleAlgebra],
  );

  /* ── 15. playExtendedHamming ── */
  const playExtendedHamming = useCallback(
    (onStep: (positions: number[], weight: number, index: number) => void) => {
      const nodes = nodesRef.current;
      if (!nodes) return;
      clearAlgebraTimers();
      const events = extendedHammingTimeline();
      for (const event of events) {
        scheduleAlgebra(() => {
          onStep(event.positions, event.weight, event.index);
          for (const lv of event.positions) {
            if (lv === 0) {
              // 0 is the added overall-parity coordinate, not a nonzero Fano point.
              triggerLumaBurst(nodes, 0);
            } else {
              playBitVectorLevel(lv);
            }
          }
        }, event.at);
      }
      scheduleAlgebra(() => onStep([], -1, events.length), timedCodewordEnd(events, 8));
    },
    [playBitVectorLevel, clearAlgebraTimers, scheduleAlgebra],
  );

  /* ── 16. playDistributiveLaw ── */
  const playDistributiveLaw = useCallback(
    (a: number, b: number, c: number, onStep: (phase: "bxc" | "left" | "ab" | "ac" | "right" | "equal" | null, value: number) => void) => {
      const nodes = nodesRef.current;
      if (!nodes) return;
      clearAlgebraTimers();
      for (const event of distributiveEvents(a, b, c)) {
        scheduleAlgebra(() => {
          onStep(event.phase, event.value);
          event.play.forEach((lv) => playBitVectorLevel(lv));
        }, event.at);
      }
    },
    [playBitVectorLevel, clearAlgebraTimers, scheduleAlgebra],
  );

  const playAndTriads = useCallback(
    (onStep: (step: { pairIndex: number; phase: "operands" | "result" } | null) => void) => {
      if (!nodesRef.current) return;
      clearAlgebraTimers();
      for (const event of andTriadEvents()) {
        scheduleAlgebra(() => {
          onStep(event.step);
          event.play.forEach((lv) => playBitVectorLevel(lv));
        }, event.at);
      }
    },
    [clearAlgebraTimers, scheduleAlgebra, playBitVectorLevel],
  );

  const playOctahedronMix = useCallback(
    (lvA: number, lvB: number, onStep: (phase: "pair" | "result" | null) => void) => {
      if (!nodesRef.current) return;
      const sequence = octahedronMixSequence(lvA, lvB);
      if (!sequence) return;
      clearAlgebraTimers();
      for (const event of sequence.events) {
        scheduleAlgebra(() => {
          onStep(event.phase);
          event.play.forEach((lv) => playBitVectorLevel(lv));
        }, event.at);
      }
    },
    [clearAlgebraTimers, scheduleAlgebra, playBitVectorLevel],
  );

  const playTetraSplit = useCallback(
    (onStep: (phase: "t0" | "t1" | null) => void) => {
      if (!nodesRef.current) return;
      clearAlgebraTimers();
      for (const event of tetraSplitEvents()) {
        scheduleAlgebra(() => {
          onStep(event.phase);
          event.play.forEach((lv) => playBitVectorLevel(lv));
        }, event.at);
      }
    },
    [clearAlgebraTimers, scheduleAlgebra, playBitVectorLevel],
  );

  const playTetraT0 = useCallback(
    (onStep: (phase: "t0" | null) => void) => {
      if (!nodesRef.current) return;
      clearAlgebraTimers();
      for (const event of tetraSingleEvents("t0")) {
        scheduleAlgebra(() => {
          onStep(event.phase === "t1" ? null : event.phase);
          event.play.forEach((lv) => playBitVectorLevel(lv));
        }, event.at);
      }
    },
    [clearAlgebraTimers, scheduleAlgebra, playBitVectorLevel],
  );

  const playTetraT1 = useCallback(
    (onStep: (phase: "t1" | null) => void) => {
      if (!nodesRef.current) return;
      clearAlgebraTimers();
      for (const event of tetraSingleEvents("t1")) {
        scheduleAlgebra(() => {
          onStep(event.phase === "t0" ? null : event.phase);
          event.play.forEach((lv) => playBitVectorLevel(lv));
        }, event.at);
      }
    },
    [clearAlgebraTimers, scheduleAlgebra, playBitVectorLevel],
  );

  const playK8Layer = useCallback(
    (layer: 1 | 2 | 3, onStep: (edgeIndex: number, pair: [number, number] | null) => void) => {
      if (!nodesRef.current) return;
      let step = 0;
      const { intervalMs } = k8LayerStep(layer, step);
      replaceInterval(
        k8IntervalRef,
        () => {
          if (!nodesRef.current) return;
          const { edgeIndex, pair } = k8LayerStep(layer, step);
          const [a, b] = pair;
          onStep(edgeIndex, pair);
          playBitVectorLevel(a);
          playBitVectorLevel(b);
          step++;
        },
        intervalMs,
      );
    },
    [playBitVectorLevel],
  );

  return {
    initAudio,
    stopAudio,
    triggerToneBurst,
    playGrayMelody,
    stopGrayMelody,
    startFanoRhythm,
    stopFanoRhythm,
    analyserNode,
    playXorTriple,
    playParityChord,
    playComplementChord,
    playLineAndComplement,
    playSyndromeDemo,
    playGray3Voice,
    playWeightSpectrum,
    playCayleyRow,
    applyGL32Transform,
    resetGL32Transform,
    setLuminanceMode,
    stopAlgebra,
    setDroneMuted,
    playComplementCanon,
    playZigzagMelody,
    stopZigzagMelody,
    playPointFanoContext,
    playExtendedHamming,
    playDistributiveLaw,
    playAndTriads,
    playOctahedronMix,
    playTetraSplit,
    playTetraT0,
    playTetraT1,
    playK8Layer,
  };
}
