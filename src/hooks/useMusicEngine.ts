import { useRef, useEffect, useCallback, useState } from "react";
import { FANO_LINES } from "../components/theory/theory-data";

/* ── Types ── */
export interface SonificationLevel {
  lv: number;
  angle: number; // hue angle in degrees (0-360)
  gray: number; // luminance 0-255
}

export type ScaleMode = "12tet" | "ji" | "octatonic";

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
}

interface MusicEngineReturn {
  initAudio: () => void;
  triggerToneBurst: (lv: number, angle: number) => void;
  playGrayMelody: (tempo: number, onStep: (lv: number | null) => void) => void;
  stopGrayMelody: () => void;
  startFanoRhythm: (tempo: number, onBeat: (line: number, pos: number) => void) => void;
  stopFanoRhythm: () => void;
  analyserNode: AnalyserNode | null;
  playXorTriple: (lvA: number, lvB: number, onStep: (lv: number | null) => void) => void;
  playParityChord: (parityBit: 0 | 1 | 2) => void;
  playDualChord: (lineIndex: number) => void;
  playLineAndDual: (lineIndex: number, onStep: (phase: "line" | "dual" | null) => void) => void;
  playSyndromeDemo: (errorPos: number, onPhase: (phase: "original" | "corrupted" | "syndrome" | "corrected" | null) => void) => void;
  playGray3Voice: (onStep: (lv: number | null) => void) => void;
  playWeightSpectrum: (onStep: (positions: number[], weight: number, index: number) => void) => void;
  playCayleyRow: (row: number, onStep: (col: number, value: number) => void) => void;
  applyGL32Transform: (gen: "A" | "B", onPerm?: (perm: number[]) => void) => void;
  setLuminanceMode: (mode: "symmetric" | "luminance") => void;
  stopAlgebra: () => void;
}

/* ── Constants ── */
const BASE_FREQ = 220;
const GAIN_SCALE = 0.15;
const NOISE_GAIN = 0.005;
const RAMP_TC = 0.02;
const DUCK_TC = 0.05;
const HOVER_BOOST = 1.5;
const HOVER_DUCK = 0.1;
const C2_PAIRS: [number, number][] = [
  [6, 1],
  [5, 2],
  [4, 3],
]; // carrier, modulator

const GRAY_PATH = [2, 6, 4, 5, 1, 3]; // R -> Y -> G -> C -> B -> M

const FANO_RHYTHM_PATTERNS = FANO_LINES.map((_, i) => [0, 1, 3].map((p) => (p + i) % 7));

/* ── Algebra constants ── */
const PARITY_GROUPS: number[][] = [
  [1, 3, 5, 7],
  [2, 3, 6, 7],
  [4, 5, 6, 7],
];
const ALL_POINTS = [1, 2, 3, 4, 5, 6, 7];
const FULL_GRAY_CODE = [0, 1, 3, 2, 6, 7, 5, 4];

/** BT.601 luminance coefficients per level (L1-L6) */
const BT601_LUMINANCE: Record<number, number> = {
  1: 0.114, // B
  2: 0.299, // R
  3: 0.413, // M = B+R
  4: 0.587, // G
  5: 0.701, // C = G+B
  6: 0.886, // Y = R+G
};
const BT601_MAX = Math.max(...Object.values(BT601_LUMINANCE));

/** GL(3,2) generators operating on {1..7} via bit manipulation */
// Gen A: [G,R,B] -> [B,G,R] (bit rotation left)
function gl32GenA(lv: number): number {
  const g = (lv >> 2) & 1,
    r = (lv >> 1) & 1,
    b = lv & 1;
  return (b << 2) | (g << 1) | r;
}
// Gen B: [G,R,B] -> [G,B,R] (swap R and B)
function gl32GenB(lv: number): number {
  const g = (lv >> 2) & 1,
    r = (lv >> 1) & 1,
    b = lv & 1;
  return (g << 2) | (b << 1) | r;
}

/** 3-voice frequencies for Gray code decomposition */
const GRAY_VOICE_FREQS = [550, 440, 330]; // bit0=B, bit1=R, bit2=G

/* ── Frequency mapping ── */
function angleToFreq(angle: number, mode: ScaleMode): number {
  if (mode === "12tet") {
    return BASE_FREQ * Math.pow(2, ((((angle % 360) + 360) % 360) / 360) * 2);
  }
  if (mode === "ji") {
    const ratios = [1, 8 / 7, 7 / 5, 8 / 5, 2];
    const angles = [0, 72, 144, 216, 288];
    const norm = ((angle % 360) + 360) % 360;
    let closest = 0;
    let minDist = 360;
    for (let i = 0; i < angles.length; i++) {
      const d = Math.min(Math.abs(norm - angles[i]), 360 - Math.abs(norm - angles[i]));
      if (d < minDist) {
        minDist = d;
        closest = i;
      }
    }
    return BASE_FREQ * ratios[closest];
  }
  // octatonic
  const semitones = [0, 1, 3, 4, 6, 7, 9, 10];
  const norm = ((angle % 360) + 360) % 360;
  const idx = Math.round((norm / 360) * 8) % 8;
  return 261.63 * Math.pow(2, semitones[idx] / 12);
}

/* ── Audio node refs ── */
interface AudioNodes {
  ctx: AudioContext;
  oscs: OscillatorNode[];
  gains: GainNode[];
  panners: StereoPannerNode[];
  noiseSource: AudioBufferSourceNode;
  noiseGain: GainNode;
  master: GainNode;
  analyser: AnalyserNode;
  compressor: DynamicsCompressorNode;
  // FM synthesis nodes (created/destroyed dynamically)
  fmOscs: OscillatorNode[];
  fmGains: GainNode[];
}

function createNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function buildAudioGraph(ctx: AudioContext): AudioNodes {
  const master = ctx.createGain();
  master.gain.value = 0.6;

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -6;
  compressor.knee.value = 10;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.1;

  master.connect(analyser).connect(compressor).connect(ctx.destination);

  // 6 oscillators for L1-L6
  const oscs: OscillatorNode[] = [];
  const gains: GainNode[] = [];
  const panners: StereoPannerNode[] = [];
  for (let i = 0; i < 6; i++) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = BASE_FREQ;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const panner = ctx.createStereoPanner();
    panner.pan.value = 0;
    osc.connect(gain).connect(panner).connect(master);
    osc.start();
    oscs.push(osc);
    gains.push(gain);
    panners.push(panner);
  }

  // White noise for L7
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = NOISE_GAIN;
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = createNoiseBuffer(ctx);
  noiseSource.loop = true;
  noiseSource.connect(noiseGain).connect(master);
  noiseSource.start();

  return {
    ctx,
    oscs,
    gains,
    panners,
    noiseSource,
    noiseGain,
    master,
    analyser,
    compressor,
    fmOscs: [],
    fmGains: [],
  };
}

function teardownFM(nodes: AudioNodes) {
  for (const osc of nodes.fmOscs) {
    try {
      osc.stop();
    } catch {
      /* already stopped */
    }
    osc.disconnect();
  }
  for (const g of nodes.fmGains) g.disconnect();
  nodes.fmOscs = [];
  nodes.fmGains = [];
}

function teardown(nodes: AudioNodes) {
  teardownFM(nodes);
  for (const osc of nodes.oscs) {
    try {
      osc.stop();
    } catch {
      /* already stopped */
    }
    osc.disconnect();
  }
  for (const g of nodes.gains) g.disconnect();
  for (const p of nodes.panners) p.disconnect();
  try {
    nodes.noiseSource.stop();
  } catch {
    /* already stopped */
  }
  nodes.noiseSource.disconnect();
  nodes.noiseGain.disconnect();
  nodes.master.disconnect();
  nodes.analyser.disconnect();
  nodes.compressor.disconnect();
  void nodes.ctx.close();
}

/** Build or rebuild FM modulator nodes */
function buildFM(nodes: AudioNodes, levels: SonificationLevel[], scaleMode: ScaleMode) {
  teardownFM(nodes);
  const fmOscs: OscillatorNode[] = [];
  const fmGains: GainNode[] = [];

  for (const [carrierLv, modLv] of C2_PAIRS) {
    const carrierData = levels.find((l) => l.lv === carrierLv);
    const modData = levels.find((l) => l.lv === modLv);
    if (!carrierData || !modData) continue;

    const modOsc = nodes.ctx.createOscillator();
    modOsc.type = "sine";
    modOsc.frequency.value = angleToFreq(modData.angle, scaleMode);

    const modGain = nodes.ctx.createGain();
    const modIndex = (Math.abs(carrierData.gray - modData.gray) / 255) * 400;
    modGain.gain.value = modIndex;

    // carrier index in oscs array is (carrierLv - 1)
    const carrierOsc = nodes.oscs[carrierLv - 1];
    modOsc.connect(modGain).connect(carrierOsc.frequency);
    modOsc.start();

    fmOscs.push(modOsc);
    fmGains.push(modGain);
  }

  nodes.fmOscs = fmOscs;
  nodes.fmGains = fmGains;
}

/** Apply current frequency, gain, pan, and FM values to the audio graph */
function applyParams(
  nodes: AudioNodes,
  levels: SonificationLevel[],
  hoveredLv: number | null,
  alpha0: number,
  alpha7: number,
  volume: number,
  scaleMode: ScaleMode,
  fmEnabled: boolean,
  panEnabled: boolean,
  hoveredFanoLine: number | null,
  luminanceMode: "symmetric" | "luminance" = "symmetric",
) {
  const now = nodes.ctx.currentTime;

  // Phase modulation factor: |cos(deltaAlpha/2)|
  const delta = (((alpha0 - alpha7) % 360) + 360) % 360;
  const deltaRad = (delta / 2) * (Math.PI / 180);
  const phaseFactor = Math.abs(Math.cos(deltaRad));

  // Master volume
  nodes.master.gain.setTargetAtTime(volume * 0.6, now, RAMP_TC);

  // Determine which levels are boosted by Fano line hover
  let fanoBoostSet: Set<number> | null = null;
  if (hoveredFanoLine !== null && hoveredFanoLine >= 0 && hoveredFanoLine < 7) {
    fanoBoostSet = new Set(FANO_LINES[hoveredFanoLine]);
  }

  for (let i = 0; i < 6; i++) {
    const lv = i + 1;
    const lvData = levels.find((l) => l.lv === lv);
    if (!lvData) continue;

    // Frequency
    nodes.oscs[i].frequency.setTargetAtTime(angleToFreq(lvData.angle, scaleMode), now, RAMP_TC);

    // Gain — hover logic with Fano line boost
    const gainScale =
      luminanceMode === "luminance" && BT601_LUMINANCE[lv] !== undefined ? (BT601_LUMINANCE[lv] / BT601_MAX) * GAIN_SCALE : GAIN_SCALE;
    const baseGain = (lvData.gray / 255) * gainScale;
    let targetGain: number;

    if (hoveredLv !== null) {
      // Individual level hover takes priority
      if (hoveredLv === lv) {
        targetGain = baseGain * HOVER_BOOST;
      } else {
        targetGain = baseGain * HOVER_DUCK * phaseFactor;
      }
    } else if (fanoBoostSet !== null) {
      // Fano line hover: boost members, duck others
      if (fanoBoostSet.has(lv)) {
        targetGain = baseGain * HOVER_BOOST;
      } else {
        targetGain = baseGain * HOVER_DUCK * phaseFactor;
      }
    } else {
      targetGain = baseGain * phaseFactor;
    }

    const tc = hoveredLv !== null || fanoBoostSet !== null ? DUCK_TC : RAMP_TC;
    nodes.gains[i].gain.setTargetAtTime(targetGain, now, tc);

    // Stereo pan
    const panValue = panEnabled ? Math.cos((lvData.angle * Math.PI) / 180) : 0;
    nodes.panners[i].pan.setTargetAtTime(panValue, now, RAMP_TC);
  }

  // L7 noise
  let noiseTarget = NOISE_GAIN * phaseFactor;
  if (hoveredLv === 7) noiseTarget = 0.03;
  else if (hoveredLv !== null) noiseTarget = 0.001;
  else if (fanoBoostSet !== null) noiseTarget = 0.001;
  nodes.noiseGain.gain.setTargetAtTime(noiseTarget, now, DUCK_TC);

  // FM synthesis: update modulator parameters if enabled
  if (fmEnabled && nodes.fmOscs.length > 0) {
    let pairIdx = 0;
    for (const [carrierLv, modLv] of C2_PAIRS) {
      if (pairIdx >= nodes.fmOscs.length) break;
      const carrierData = levels.find((l) => l.lv === carrierLv);
      const modData = levels.find((l) => l.lv === modLv);
      if (!carrierData || !modData) {
        pairIdx++;
        continue;
      }
      nodes.fmOscs[pairIdx].frequency.setTargetAtTime(angleToFreq(modData.angle, scaleMode), now, RAMP_TC);
      const modIndex = (Math.abs(carrierData.gray - modData.gray) / 255) * 400;
      nodes.fmGains[pairIdx].gain.setTargetAtTime(modIndex, now, RAMP_TC);
      pairIdx++;
    }
  }
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
}: MusicEngineParams): MusicEngineReturn {
  const nodesRef = useRef<AudioNodes | null>(null);
  const grayIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fanoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const algebraTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const gray3IntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cayleyIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gl32PermRef = useRef<number[]>([1, 2, 3, 4, 5, 6, 7]); // identity permutation
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
    );
  }, []);

  /* ── Teardown on unmount ── */
  useEffect(() => {
    return () => {
      if (grayIntervalRef.current !== null) {
        clearInterval(grayIntervalRef.current);
        grayIntervalRef.current = null;
      }
      if (fanoIntervalRef.current !== null) {
        clearInterval(fanoIntervalRef.current);
        fanoIntervalRef.current = null;
      }
      for (const t of algebraTimersRef.current) clearTimeout(t);
      algebraTimersRef.current = [];
      if (nodesRef.current) {
        teardown(nodesRef.current);
        nodesRef.current = null;
      }
      setAnalyserNode(null);
    };
  }, []);

  /* ── When disabled, teardown audio ── */
  useEffect(() => {
    if (!enabled && nodesRef.current) {
      if (grayIntervalRef.current !== null) {
        clearInterval(grayIntervalRef.current);
        grayIntervalRef.current = null;
      }
      if (fanoIntervalRef.current !== null) {
        clearInterval(fanoIntervalRef.current);
        fanoIntervalRef.current = null;
      }
      for (const t of algebraTimersRef.current) clearTimeout(t);
      algebraTimersRef.current = [];
      teardown(nodesRef.current);
      nodesRef.current = null;
      setAnalyserNode(null);
    }
  }, [enabled]);

  /* ── FM toggle ── */
  useEffect(() => {
    if (!enabled || !nodesRef.current) return;
    if (fmEnabled) {
      buildFM(nodesRef.current, levels, scaleMode);
    } else {
      teardownFM(nodesRef.current);
    }
  }, [enabled, fmEnabled, scaleMode, levels]);

  /* ── Update params when they change ── */
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
    );
  }, [enabled, levels, hoveredLv, alpha0, alpha7, volume, scaleMode, fmEnabled, panEnabled, hoveredFanoLine, luminanceMode]);

  /* ── Tone Burst ── */
  const triggerToneBurst = useCallback((_lv: number, angle: number) => {
    const nodes = nodesRef.current;
    if (!nodes) return;
    const ctx = nodes.ctx;
    const mode = paramsRef.current.scaleMode;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = angleToFreq(angle, mode);

    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.01); // 10ms attack
    gain.gain.linearRampToValueAtTime(0.0, now + 0.31); // 200ms decay + 100ms release

    osc.connect(gain).connect(nodes.master);
    osc.start(now);
    osc.stop(now + 0.35);
  }, []);

  /* ── Gray Code Melody ── */
  const playGrayMelody = useCallback(
    (tempo: number, onStep: (lv: number | null) => void) => {
      if (!nodesRef.current) return;
      // Stop any existing melody
      if (grayIntervalRef.current !== null) {
        clearInterval(grayIntervalRef.current);
      }

      const intervalMs = 60000 / tempo;
      let step = 0;
      const id = setInterval(() => {
        const lv = GRAY_PATH[step % GRAY_PATH.length];
        const p = paramsRef.current;
        const lvData = p.levels.find((l) => l.lv === lv);
        triggerToneBurst(lv, lvData?.angle ?? 0);
        onStep(lv);
        step++;
      }, intervalMs);
      grayIntervalRef.current = id;
    },
    [triggerToneBurst],
  );

  const stopGrayMelody = useCallback(() => {
    if (grayIntervalRef.current !== null) {
      clearInterval(grayIntervalRef.current);
      grayIntervalRef.current = null;
    }
  }, []);

  /* ── Fano Rhythm Canon ── */
  const startFanoRhythm = useCallback((tempo: number, onBeat: (line: number, pos: number) => void) => {
    const nodes = nodesRef.current;
    if (!nodes) return;

    // Stop any existing rhythm
    if (fanoIntervalRef.current !== null) {
      clearInterval(fanoIntervalRef.current);
    }

    const subdivisionMs = 60000 / (tempo * 7);
    let pos = 0;

    const id = setInterval(() => {
      const currentNodes = nodesRef.current;
      if (!currentNodes) return;
      const ctx = currentNodes.ctx;
      const now = ctx.currentTime;

      // Check each line for onset at this position
      for (let line = 0; line < 7; line++) {
        if (FANO_RHYTHM_PATTERNS[line].includes(pos % 7)) {
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

          onBeat(line, pos % 7);
        }
      }
      pos++;
    }, subdivisionMs);

    fanoIntervalRef.current = id;
  }, []);

  const stopFanoRhythm = useCallback(() => {
    if (fanoIntervalRef.current !== null) {
      clearInterval(fanoIntervalRef.current);
      fanoIntervalRef.current = null;
    }
  }, []);

  /* ── Helper: clear all algebra timers ── */
  const clearAlgebraTimers = useCallback(() => {
    for (const t of algebraTimersRef.current) clearTimeout(t);
    algebraTimersRef.current = [];
  }, []);

  /* ── Helper: get angle for a level ── */
  const angleForLv = useCallback((lv: number): number => {
    const p = paramsRef.current;
    const d = p.levels.find((l) => l.lv === lv);
    return d?.angle ?? 0;
  }, []);

  /* ── Helper: schedule a timeout and track it ── */
  const scheduleAlgebra = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    algebraTimersRef.current.push(id);
    return id;
  }, []);

  /* ── stopAlgebra ── */
  const stopAlgebra = useCallback(() => {
    clearAlgebraTimers();
    if (gray3IntervalRef.current !== null) {
      clearInterval(gray3IntervalRef.current);
      gray3IntervalRef.current = null;
    }
    if (cayleyIntervalRef.current !== null) {
      clearInterval(cayleyIntervalRef.current);
      cayleyIntervalRef.current = null;
    }
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
          triggerToneBurst(lv, angleForLv(lv));
          onStep(lv);
        }, i * 300);
      }
      scheduleAlgebra(() => onStep(null), 900);
    },
    [triggerToneBurst, clearAlgebraTimers, scheduleAlgebra, angleForLv],
  );

  /* ── 2. playParityChord ── */
  const playParityChord = useCallback(
    (parityBit: 0 | 1 | 2) => {
      if (!nodesRef.current) return;
      const group = PARITY_GROUPS[parityBit];
      for (const lv of group) {
        triggerToneBurst(lv, angleForLv(lv));
      }
    },
    [triggerToneBurst, angleForLv],
  );

  /* ── 3. playDualChord ── */
  const playDualChord = useCallback(
    (lineIndex: number) => {
      if (!nodesRef.current) return;
      if (lineIndex < 0 || lineIndex >= FANO_LINES.length) return;
      const lineSet = new Set(FANO_LINES[lineIndex]);
      const dual = ALL_POINTS.filter((lv) => !lineSet.has(lv));
      for (const lv of dual) {
        triggerToneBurst(lv, angleForLv(lv));
      }
    },
    [triggerToneBurst, angleForLv],
  );

  /* ── 4. playLineAndDual ── */
  const playLineAndDual = useCallback(
    (lineIndex: number, onStep: (phase: "line" | "dual" | null) => void) => {
      if (!nodesRef.current) return;
      if (lineIndex < 0 || lineIndex >= FANO_LINES.length) return;
      clearAlgebraTimers();

      const line = FANO_LINES[lineIndex];
      const lineSet = new Set(line);
      const dual = ALL_POINTS.filter((lv) => !lineSet.has(lv));

      // Play line chord
      scheduleAlgebra(() => {
        onStep("line");
        for (const lv of line) {
          triggerToneBurst(lv, angleForLv(lv));
        }
      }, 0);

      // Play dual chord after 500ms
      scheduleAlgebra(() => {
        onStep("dual");
        for (const lv of dual) {
          triggerToneBurst(lv, angleForLv(lv));
        }
      }, 500);

      scheduleAlgebra(() => onStep(null), 1000);
    },
    [triggerToneBurst, clearAlgebraTimers, scheduleAlgebra, angleForLv],
  );

  /* ── 5. playSyndromeDemo ── */
  const playSyndromeDemo = useCallback(
    (errorPos: number, onPhase: (phase: "original" | "corrupted" | "syndrome" | "corrected" | null) => void) => {
      if (!nodesRef.current) return;
      if (errorPos < 1 || errorPos > 7) return;
      clearAlgebraTimers();

      const p = paramsRef.current;
      let t = 0;

      // Phase "original": 7 tones, 200ms each
      scheduleAlgebra(() => onPhase("original"), t);
      for (let i = 1; i <= 7; i++) {
        const lv = i;
        scheduleAlgebra(() => {
          triggerToneBurst(lv, angleForLv(lv));
        }, t);
        t += 200;
      }

      t += 300; // gap

      // Phase "corrupted": same but errorPos has tritone-shifted pitch
      scheduleAlgebra(() => onPhase("corrupted"), t);
      for (let i = 1; i <= 7; i++) {
        const lv = i;
        scheduleAlgebra(() => {
          if (lv === errorPos) {
            // Tritone shift: add 180 degrees to angle (half circle)
            const shiftedAngle = angleForLv(lv) + 180;
            triggerToneBurst(lv, shiftedAngle);
          } else {
            triggerToneBurst(lv, angleForLv(lv));
          }
        }, t);
        t += 200;
      }

      t += 300; // gap

      // Phase "syndrome": syndrome = errorPos in binary, play parity bits that fail
      scheduleAlgebra(() => {
        onPhase("syndrome");
        for (let bit = 0; bit < 3; bit++) {
          if (errorPos & (1 << bit)) {
            // Play the parity group chord for this bit
            const parityLv = 1 << bit; // 1, 2, or 4
            triggerToneBurst(parityLv, angleForLv(parityLv));
          }
        }
      }, t);

      t += 500; // gap

      // Phase "corrected": play original 7 tones again
      scheduleAlgebra(() => onPhase("corrected"), t);
      for (let i = 1; i <= 7; i++) {
        const lv = i;
        const lvData = p.levels.find((l) => l.lv === lv);
        scheduleAlgebra(() => {
          triggerToneBurst(lv, lvData?.angle ?? 0);
        }, t);
        t += 200;
      }

      scheduleAlgebra(() => onPhase(null), t + 300);
    },
    [triggerToneBurst, clearAlgebraTimers, scheduleAlgebra, angleForLv],
  );

  /* ── 6. playGray3Voice (looping) ── */
  const playGray3Voice = useCallback((onStep: (lv: number | null) => void) => {
    if (!nodesRef.current) return;
    // Stop any existing
    if (gray3IntervalRef.current !== null) {
      clearInterval(gray3IntervalRef.current);
    }

    let step = 0;
    const id = setInterval(() => {
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
    }, 400);
    gray3IntervalRef.current = id;
  }, []);

  /* ── 7. playWeightSpectrum ── */
  const playWeightSpectrum = useCallback(
    (onStep: (positions: number[], weight: number, index: number) => void) => {
      if (!nodesRef.current) return;
      clearAlgebraTimers();

      // Build all 16 codewords sorted by weight
      const codewords: { positions: number[]; weight: number }[] = [];

      // Weight 0: empty (silence)
      codewords.push({ positions: [], weight: 0 });

      // Weight 3: Fano lines
      for (const line of FANO_LINES) {
        codewords.push({ positions: [...line], weight: 3 });
      }

      // Weight 4: complements of Fano lines
      for (const line of FANO_LINES) {
        const lineSet = new Set(line);
        const dual = ALL_POINTS.filter((lv) => !lineSet.has(lv));
        codewords.push({ positions: dual, weight: 4 });
      }

      // Weight 7: all points
      codewords.push({ positions: [...ALL_POINTS], weight: 7 });

      let t = 0;
      for (let idx = 0; idx < codewords.length; idx++) {
        const cw = codewords[idx];
        const duration = cw.weight === 0 || cw.weight === 7 ? 500 : 400;
        scheduleAlgebra(() => {
          onStep(cw.positions, cw.weight, idx);
          for (const lv of cw.positions) {
            triggerToneBurst(lv, angleForLv(lv));
          }
        }, t);
        t += duration;
      }

      scheduleAlgebra(() => onStep([], -1, codewords.length), t);
    },
    [triggerToneBurst, clearAlgebraTimers, scheduleAlgebra, angleForLv],
  );

  /* ── 8. playCayleyRow (looping) ── */
  const playCayleyRow = useCallback(
    (row: number, onStep: (col: number, value: number) => void) => {
      if (!nodesRef.current) return;
      // Stop any existing
      if (cayleyIntervalRef.current !== null) {
        clearInterval(cayleyIntervalRef.current);
      }

      let step = 0;
      const id = setInterval(() => {
        const nodes = nodesRef.current;
        if (!nodes) return;
        const ctx = nodes.ctx;
        const col = step % 8;
        const value = row ^ col;
        onStep(col, value);

        if (value === 0) {
          // Level 0 (Black) = silence — do nothing
        } else if (value === 7) {
          // Level 7 (White) = noise burst
          const bufLen = Math.floor(ctx.sampleRate * 0.25);
          const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
          const data = buf.getChannelData(0);
          for (let j = 0; j < bufLen; j++) data[j] = Math.random() * 2 - 1;
          const source = ctx.createBufferSource();
          source.buffer = buf;
          const gain = ctx.createGain();
          const now = ctx.currentTime;
          gain.gain.setValueAtTime(0.05, now);
          gain.gain.linearRampToValueAtTime(0, now + 0.25);
          source.connect(gain).connect(nodes.master);
          source.start(now);
          source.stop(now + 0.28);
        } else {
          triggerToneBurst(value, angleForLv(value));
        }
        step++;
      }, 300);
      cayleyIntervalRef.current = id;
    },
    [triggerToneBurst, angleForLv],
  );

  /* ── 9. applyGL32Transform ── */
  const applyGL32Transform = useCallback((gen: "A" | "B", onPerm?: (perm: number[]) => void) => {
    if (!nodesRef.current) return;
    const genFn = gen === "A" ? gl32GenA : gl32GenB;
    const perm = gl32PermRef.current;
    // Apply generator: new_perm[i] = genFn(perm[i])
    gl32PermRef.current = perm.map((lv) => genFn(lv));

    // Re-apply params: remap oscillator frequencies according to permutation
    const nodes = nodesRef.current;
    const p = paramsRef.current;
    const now = nodes.ctx.currentTime;
    const newPerm = gl32PermRef.current;

    for (let i = 0; i < 6; i++) {
      const targetLv = newPerm[i]; // osc[i] now gets the frequency of level targetLv
      const lvData = p.levels.find((l) => l.lv === targetLv);
      if (lvData) {
        nodes.oscs[i].frequency.setTargetAtTime(angleToFreq(lvData.angle, p.scaleMode), now, RAMP_TC);
      }
    }

    // Notify caller with the full permutation array [0, perm[1], ..., perm[7]]
    onPerm?.([0, ...newPerm]);
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
    );
  }, []);

  return {
    initAudio,
    triggerToneBurst,
    playGrayMelody,
    stopGrayMelody,
    startFanoRhythm,
    stopFanoRhythm,
    analyserNode,
    playXorTriple,
    playParityChord,
    playDualChord,
    playLineAndDual,
    playSyndromeDemo,
    playGray3Voice,
    playWeightSpectrum,
    playCayleyRow,
    applyGL32Transform,
    setLuminanceMode,
    stopAlgebra,
  };
}
