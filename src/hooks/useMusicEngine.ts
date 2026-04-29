import { useRef, useEffect, useCallback, useState } from "react";
import { COMPLEMENT_EDGES, CUBE_EDGES, FANO_LINES, STELLA_EDGES, TETRA_T0, TETRA_T1 } from "../data/theory-data";
import {
  COMPLEMENT_PAIRS,
  FANO_RHYTHM_PATTERNS,
  LUMA_VALUES,
  ZIGZAG_PATH,
  bitSpectrumComponents,
  fanoLinesThrough,
} from "../data/music-data";
import { BASE_FREQ, angleToFreq, type ScaleMode } from "../data/music-frequency";

export type { ScaleMode } from "../data/music-frequency";

/* ── Types ── */
interface SonificationLevel {
  lv: number;
  angle: number; // hue angle in degrees (0-360)
  gray: number; // luminance 0-255
}

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

/* ── Constants ── */
const GAIN_SCALE = 0.15;
const NOISE_GAIN = 0.005;
const RAMP_TC = 0.02;
const DUCK_TC = 0.05;
const HOVER_BOOST = 1.5;
const HOVER_DUCK = 0.1;
const BIT_TIMBRE_GAIN_SCALE = 0.42;
const C2_PAIRS: [number, number][] = [
  [6, 1],
  [5, 2],
  [4, 3],
]; // carrier, modulator

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
// Gen C: [G,R,B] -> [G,R,R⊕B] (true linear mix, not a channel permutation)
function gl32GenC(lv: number): number {
  const g = (lv >> 2) & 1,
    r = (lv >> 1) & 1,
    b = lv & 1;
  return (g << 2) | (r << 1) | (r ^ b);
}

/**
 * 3-voice frequencies for Gray code decomposition. bit0=B, bit1=R, bit2=G.
 * Ratio 330:440:550 = 3:4:5 = just-intonation minor triad (E4, A4, C#5).
 * Assignment is NOT luma-ordered — chosen so the 8 possible bit-sum chords
 * form consonant subsets of the same triad, independent of per-bit luma.
 */
const GRAY_VOICE_FREQS = [550, 440, 330];

/* ── Extended algebra constants ── */
const AND_TRIADS: [number, number, number][] = [
  [3, 5, 1],
  [5, 6, 4],
  [6, 3, 2],
];
const K8_LAYER_EDGES = {
  1: CUBE_EDGES,
  2: STELLA_EDGES,
  3: COMPLEMENT_EDGES,
} as const;
/** Luma value → frequency (distinct from angleToFreq: sonifies BT.601 luma theorem) */
function lumaToFreq(gray: number): number {
  return 220 + (gray / 255) * 660; // 220–880 Hz linear
}

/** Lines through a Fano point */
function linesThrough(p: number): number[] {
  return fanoLinesThrough(p);
}

/** [8,4,4] extended Hamming codewords (sorted by weight) */
function extendedHammingCodewords(): { positions: number[]; weight: number }[] {
  const codewords: { positions: number[]; weight: number }[] = [];
  codewords.push({ positions: [], weight: 0 });
  // w=4: Fano lines + Black
  for (const line of FANO_LINES) {
    codewords.push({ positions: [0, ...line], weight: 4 });
  }
  // w=4: complements of Fano lines (no Black)
  for (const line of FANO_LINES) {
    const lineSet = new Set(line);
    codewords.push({ positions: ALL_POINTS.filter((lv) => !lineSet.has(lv)), weight: 4 });
  }
  codewords.push({ positions: [0, ...ALL_POINTS], weight: 8 });
  return codewords;
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
  master.gain.value = 0.8;

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

/** Trigger a short tone burst at a luma-derived frequency */
function triggerLumaBurst(nodes: AudioNodes, gray: number) {
  const ctx = nodes.ctx;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = lumaToFreq(gray);
  const gain = ctx.createGain();
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.3, now + 0.01);
  gain.gain.linearRampToValueAtTime(0.0, now + 0.31);
  osc.connect(gain).connect(nodes.master);
  osc.start(now);
  osc.stop(now + 0.35);
}

/** Trigger a short tone burst at a hue-derived pitch. */
function triggerPitchBurst(nodes: AudioNodes, angle: number, scaleMode: ScaleMode) {
  const ctx = nodes.ctx;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = angleToFreq(angle, scaleMode);

  const gain = ctx.createGain();
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.3, now + 0.01);
  gain.gain.linearRampToValueAtTime(0.0, now + 0.31);

  osc.connect(gain).connect(nodes.master);
  osc.start(now);
  osc.stop(now + 0.35);
}

function triggerPitchOrLumaBurst(nodes: AudioNodes, lv: number, angle: number, scaleMode: ScaleMode) {
  if (angle < 0) {
    triggerLumaBurst(nodes, LUMA_VALUES[lv] ?? 0);
    return;
  }

  triggerPitchBurst(nodes, angle, scaleMode);
}

/** Trigger a bit-basis timbre burst: GF(2)^3 bits select spectral basis components. */
function triggerBitSpectrumBurst(nodes: AudioNodes, lv: number, angle: number, panEnabled: boolean) {
  const components = bitSpectrumComponents(lv);
  if (components.length === 0) return;

  const grayNorm = Math.max(0, Math.min(1, (LUMA_VALUES[lv] ?? 0) / 255));
  if (grayNorm <= 0) return;

  const ctx = nodes.ctx;
  const now = ctx.currentTime;
  const group = ctx.createGain();
  const panner = ctx.createStereoPanner();

  group.gain.setValueAtTime(0, now);
  group.gain.linearRampToValueAtTime(grayNorm * BIT_TIMBRE_GAIN_SCALE, now + 0.01);
  group.gain.linearRampToValueAtTime(0, now + 0.31);

  if (panEnabled && angle >= 0) {
    panner.pan.value = Math.cos((angle * Math.PI) / 180);
  }

  const componentNorm = 1 / Math.sqrt(components.length);
  for (const component of components) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = BASE_FREQ * component.harmonic;

    const gain = ctx.createGain();
    gain.gain.value = component.gain * componentNorm;

    osc.connect(gain).connect(group);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  group.connect(panner).connect(nodes.master);
}

/** Non-pitched transient used only to mark a Hamming error position. */
function triggerErrorMarker(nodes: AudioNodes) {
  const ctx = nodes.ctx;
  const now = ctx.currentTime;
  const bufLen = Math.floor(ctx.sampleRate * 0.06);
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

  const source = ctx.createBufferSource();
  source.buffer = buf;

  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 1800;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.08, now);
  gain.gain.linearRampToValueAtTime(0, now + 0.06);

  source.connect(filter).connect(gain).connect(nodes.master);
  source.start(now);
  source.stop(now + 0.07);
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
  originMode: 0 | 7 = 0,
  droneMuted = false,
) {
  const now = nodes.ctx.currentTime;

  // Active alpha: use alpha0 in L0 mode, alpha7 in L7 mode
  const activeAlpha = originMode === 0 ? alpha0 : alpha7;

  // Phase modulation factor: |cos(deltaAlpha/2)|
  const delta = (((alpha0 - alpha7) % 360) + 360) % 360;
  const deltaRad = (delta / 2) * (Math.PI / 180);
  const phaseFactor = Math.abs(Math.cos(deltaRad));

  // Master volume
  nodes.master.gain.setTargetAtTime(volume * 0.8, now, RAMP_TC);

  // Determine which levels are boosted by Fano line hover
  let fanoBoostSet: Set<number> | null = null;
  if (hoveredFanoLine !== null && hoveredFanoLine >= 0 && hoveredFanoLine < 7) {
    fanoBoostSet = new Set(FANO_LINES[hoveredFanoLine]);
  }

  for (let i = 0; i < 6; i++) {
    const lv = i + 1;
    const lvData = levels.find((l) => l.lv === lv);
    if (!lvData) continue;

    // Frequency — active alpha rotates pitch mapping around the hue wheel
    const rotatedAngle = lvData.angle + activeAlpha;
    nodes.oscs[i].frequency.setTargetAtTime(angleToFreq(rotatedAngle, scaleMode), now, RAMP_TC);

    // Gain — hover logic with Fano line boost
    // L0 mode: brighter levels are louder (gray/255)
    // L7 mode: darker levels are louder (1 - gray/255), matching the inverted radius
    const gainScale =
      luminanceMode === "luminance" && BT601_LUMINANCE[lv] !== undefined ? (BT601_LUMINANCE[lv] / BT601_MAX) * GAIN_SCALE : GAIN_SCALE;
    const grayNorm = originMode === 0 ? lvData.gray / 255 : 1 - lvData.gray / 255;
    const baseGain = grayNorm * gainScale;
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
    // When drone is muted, only play hovered level or Fano line members
    let finalGain: number;
    if (droneMuted) {
      const isHoveredLevel = hoveredLv !== null && hoveredLv === lv;
      const isFanoMember = fanoBoostSet !== null && fanoBoostSet.has(lv);
      finalGain = isHoveredLevel || isFanoMember ? baseGain * HOVER_BOOST : 0;
    } else {
      finalGain = targetGain;
    }
    nodes.gains[i].gain.setTargetAtTime(finalGain, now, tc);

    // Stereo pan
    const panValue = panEnabled ? Math.cos((lvData.angle * Math.PI) / 180) : 0;
    nodes.panners[i].pan.setTargetAtTime(panValue, now, RAMP_TC);
  }

  // L7 noise — gain follows wave graph radius: L0-origin → gray/255 = 1.0, L7-origin → 1-gray/255 = 0
  const l7Gray = 255; // White
  const l7Radius = originMode === 0 ? l7Gray / 255 : 1 - l7Gray / 255;
  const noiseBase = NOISE_GAIN * l7Radius;
  let noiseTarget = noiseBase * phaseFactor;
  if (hoveredLv === 7) noiseTarget = noiseBase * HOVER_BOOST;
  else if (hoveredLv !== null) noiseTarget = noiseBase * HOVER_DUCK;
  else if (fanoBoostSet !== null) noiseTarget = noiseBase * HOVER_DUCK;
  const finalNoise = droneMuted ? (hoveredLv === 7 ? noiseBase * HOVER_BOOST : 0) : noiseTarget;
  nodes.noiseGain.gain.setTargetAtTime(finalNoise, now, DUCK_TC);

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
      nodes.fmOscs[pairIdx].frequency.setTargetAtTime(angleToFreq(modData.angle + activeAlpha, scaleMode), now, RAMP_TC);
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
  originMode,
}: MusicEngineParams): MusicEngineReturn {
  const nodesRef = useRef<AudioNodes | null>(null);
  const grayIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fanoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const algebraTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const gray3IntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const zigzagIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cayleyIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const k8IntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
      if (zigzagIntervalRef.current !== null) {
        clearInterval(zigzagIntervalRef.current);
        zigzagIntervalRef.current = null;
      }
      if (gray3IntervalRef.current !== null) {
        clearInterval(gray3IntervalRef.current);
        gray3IntervalRef.current = null;
      }
      if (cayleyIntervalRef.current !== null) {
        clearInterval(cayleyIntervalRef.current);
        cayleyIntervalRef.current = null;
      }
      if (k8IntervalRef.current !== null) {
        clearInterval(k8IntervalRef.current);
        k8IntervalRef.current = null;
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
      if (zigzagIntervalRef.current !== null) {
        clearInterval(zigzagIntervalRef.current);
        zigzagIntervalRef.current = null;
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
      // Stop any existing melody
      if (grayIntervalRef.current !== null) {
        clearInterval(grayIntervalRef.current);
      }

      const intervalMs = 60000 / tempo;
      let step = 0;
      const id = setInterval(() => {
        const lv = FULL_GRAY_CODE[step % FULL_GRAY_CODE.length];
        playPitchLevel(lv);
        onStep(lv);
        step++;
      }, intervalMs);
      grayIntervalRef.current = id;
    },
    [playPitchLevel],
  );

  const stopGrayMelody = useCallback(() => {
    if (grayIntervalRef.current !== null) {
      clearInterval(grayIntervalRef.current);
      grayIntervalRef.current = null;
    }
  }, []);

  /* ── Fano Rhythm Canon ── */
  const startFanoRhythm = useCallback((tempo: number, onBeat: (lines: number[], pos: number) => void) => {
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
    if (zigzagIntervalRef.current !== null) {
      clearInterval(zigzagIntervalRef.current);
      zigzagIntervalRef.current = null;
    }
    if (k8IntervalRef.current !== null) {
      clearInterval(k8IntervalRef.current);
      k8IntervalRef.current = null;
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
      if (lineIndex < 0 || lineIndex >= FANO_LINES.length) return;
      const lineSet = new Set(FANO_LINES[lineIndex]);
      const complement = ALL_POINTS.filter((lv) => !lineSet.has(lv));
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
      if (lineIndex < 0 || lineIndex >= FANO_LINES.length) return;
      clearAlgebraTimers();

      const line = FANO_LINES[lineIndex];
      const lineSet = new Set(line);
      const complement = ALL_POINTS.filter((lv) => !lineSet.has(lv));

      scheduleAlgebra(() => {
        onStep("line");
        for (const lv of line) {
          playBitVectorLevel(lv);
        }
      }, 0);

      scheduleAlgebra(() => {
        onStep("complement");
        for (const lv of complement) {
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
      if (errorPos < 1 || errorPos > 7) return;
      clearAlgebraTimers();

      let t = 0;

      // Phase "original": 7 tones, 200ms each
      scheduleAlgebra(() => onPhase("original"), t);
      for (let i = 1; i <= 7; i++) {
        const lv = i;
        scheduleAlgebra(() => {
          playBitVectorLevel(lv);
        }, t);
        t += 200;
      }

      t += 300; // gap

      // Phase "corrupted": the position label stays the same; a transient marks the flipped code bit.
      scheduleAlgebra(() => onPhase("corrupted"), t);
      for (let i = 1; i <= 7; i++) {
        const lv = i;
        scheduleAlgebra(() => {
          playBitVectorLevel(lv);
          if (lv === errorPos) {
            const nodes = nodesRef.current;
            if (nodes) triggerErrorMarker(nodes);
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
            playBitVectorLevel(parityLv);
          }
        }
      }, t);

      t += 500; // gap

      // Phase "corrected": play original 7 tones again
      scheduleAlgebra(() => onPhase("corrected"), t);
      for (let i = 1; i <= 7; i++) {
        const lv = i;
        scheduleAlgebra(() => {
          playBitVectorLevel(lv);
        }, t);
        t += 200;
      }

      scheduleAlgebra(() => onPhase(null), t + 300);
    },
    [playBitVectorLevel, clearAlgebraTimers, scheduleAlgebra],
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
            playBitVectorLevel(lv);
          }
        }, t);
        t += duration;
      }

      scheduleAlgebra(() => onStep([], -1, codewords.length), t);
    },
    [playBitVectorLevel, clearAlgebraTimers, scheduleAlgebra],
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
        if (!nodesRef.current) return;
        const col = step % 8;
        const value = row ^ col;
        onStep(col, value);
        playBitVectorLevel(value);
        step++;
      }, 300);
      cayleyIntervalRef.current = id;
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
      for (let step = 0; step < 3; step++) {
        const i = reverse ? 2 - step : step;
        scheduleAlgebra(() => {
          const [a, b] = COMPLEMENT_PAIRS[i];
          triggerLumaBurst(nodes, LUMA_VALUES[a]);
          triggerLumaBurst(nodes, LUMA_VALUES[b]);
          onStep(i, "playing");
        }, step * 600);
      }
      scheduleAlgebra(() => onStep(-1, null), 1800);
    },
    [clearAlgebraTimers, scheduleAlgebra],
  );

  /* ── 13. playZigzagMelody (looping) ── */
  const playZigzagMelody = useCallback((onStep: (stepIndex: number | null) => void) => {
    const nodes = nodesRef.current;
    if (!nodes) return;
    if (zigzagIntervalRef.current !== null) {
      clearInterval(zigzagIntervalRef.current);
    }
    let step = 0;
    const id = setInterval(() => {
      const currentNodes = nodesRef.current;
      if (!currentNodes) return;
      const i = step % ZIGZAG_PATH.length;
      const lv = ZIGZAG_PATH[i];
      triggerLumaBurst(currentNodes, LUMA_VALUES[lv]);
      onStep(i);
      step++;
    }, 400);
    zigzagIntervalRef.current = id;
  }, []);

  const stopZigzagMelody = useCallback(() => {
    if (zigzagIntervalRef.current !== null) {
      clearInterval(zigzagIntervalRef.current);
      zigzagIntervalRef.current = null;
    }
  }, []);

  /* ── 14. playPointFanoContext ── */
  const playPointFanoContext = useCallback(
    (point: number, onStep: (lineIdx: number | null) => void) => {
      if (!nodesRef.current) return;
      if (point < 1 || point > 7) return;
      clearAlgebraTimers();
      const lines = linesThrough(point);
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
      const codewords = extendedHammingCodewords();
      let t = 0;
      for (let idx = 0; idx < codewords.length; idx++) {
        const cw = codewords[idx];
        const duration = cw.weight === 0 || cw.weight === 8 ? 500 : 350;
        scheduleAlgebra(() => {
          onStep(cw.positions, cw.weight, idx);
          for (const lv of cw.positions) {
            if (lv === 0) {
              // 0 is the added overall-parity coordinate, not a nonzero Fano point.
              triggerLumaBurst(nodes, 0);
            } else {
              playBitVectorLevel(lv);
            }
          }
        }, t);
        t += duration;
      }
      scheduleAlgebra(() => onStep([], -1, codewords.length), t);
    },
    [playBitVectorLevel, clearAlgebraTimers, scheduleAlgebra],
  );

  /* ── 16. playDistributiveLaw ── */
  const playDistributiveLaw = useCallback(
    (a: number, b: number, c: number, onStep: (phase: "bxc" | "left" | "ab" | "ac" | "right" | "equal" | null, value: number) => void) => {
      const nodes = nodesRef.current;
      if (!nodes) return;
      clearAlgebraTimers();
      const bxc = b ^ c;
      const left = a & bxc;
      const ab = a & b;
      const ac = a & c;
      const right = ab ^ ac;
      const playLv = (lv: number) => playBitVectorLevel(lv);
      // Left path
      scheduleAlgebra(() => {
        onStep("bxc", bxc);
        playLv(bxc);
      }, 0);
      scheduleAlgebra(() => {
        onStep("left", left);
        playLv(left);
      }, 400);
      // Right path
      scheduleAlgebra(() => {
        onStep("ab", ab);
        playLv(ab);
      }, 1000);
      scheduleAlgebra(() => {
        onStep("ac", ac);
        playLv(ac);
      }, 1400);
      scheduleAlgebra(() => {
        onStep("right", right);
        playLv(right);
      }, 1800);
      // Convergence
      scheduleAlgebra(() => {
        onStep("equal", left);
        playLv(left);
        playLv(right);
      }, 2400);
      scheduleAlgebra(() => onStep(null, -1), 2900);
    },
    [playBitVectorLevel, clearAlgebraTimers, scheduleAlgebra],
  );

  const playAndTriads = useCallback(
    (onStep: (step: { pairIndex: number; phase: "operands" | "result" } | null) => void) => {
      if (!nodesRef.current) return;
      clearAlgebraTimers();
      let t = 0;
      AND_TRIADS.forEach(([a, b, result], pairIndex) => {
        scheduleAlgebra(() => {
          onStep({ pairIndex, phase: "operands" });
          playBitVectorLevel(a);
          playBitVectorLevel(b);
        }, t);
        scheduleAlgebra(() => {
          onStep({ pairIndex, phase: "result" });
          playBitVectorLevel(result);
        }, t + 360);
        t += 860;
      });
      scheduleAlgebra(() => onStep(null), t);
    },
    [clearAlgebraTimers, scheduleAlgebra, playBitVectorLevel],
  );

  const playOctahedronMix = useCallback(
    (lvA: number, lvB: number, onStep: (phase: "pair" | "result" | null) => void) => {
      if (!nodesRef.current) return;
      if (lvA < 1 || lvA > 6 || lvB < 1 || lvB > 6 || lvA === lvB) return;
      const result = lvA ^ lvB;
      if (result < 1 || result > 6) return;
      clearAlgebraTimers();
      scheduleAlgebra(() => {
        onStep("pair");
        playBitVectorLevel(lvA);
        playBitVectorLevel(lvB);
      }, 0);
      scheduleAlgebra(() => {
        onStep("result");
        playBitVectorLevel(result);
      }, 480);
      scheduleAlgebra(() => onStep(null), 920);
    },
    [clearAlgebraTimers, scheduleAlgebra, playBitVectorLevel],
  );

  const playTetraSplit = useCallback(
    (onStep: (phase: "t0" | "t1" | null) => void) => {
      if (!nodesRef.current) return;
      clearAlgebraTimers();
      scheduleAlgebra(() => {
        onStep("t0");
        TETRA_T0.forEach((lv) => playBitVectorLevel(lv));
      }, 0);
      scheduleAlgebra(() => {
        onStep("t1");
        TETRA_T1.forEach((lv) => playBitVectorLevel(lv));
      }, 650);
      scheduleAlgebra(() => onStep(null), 1300);
    },
    [clearAlgebraTimers, scheduleAlgebra, playBitVectorLevel],
  );

  const playTetraT0 = useCallback(
    (onStep: (phase: "t0" | null) => void) => {
      if (!nodesRef.current) return;
      clearAlgebraTimers();
      scheduleAlgebra(() => {
        onStep("t0");
        TETRA_T0.forEach((lv) => playBitVectorLevel(lv));
      }, 0);
      scheduleAlgebra(() => onStep(null), 650);
    },
    [clearAlgebraTimers, scheduleAlgebra, playBitVectorLevel],
  );

  const playTetraT1 = useCallback(
    (onStep: (phase: "t1" | null) => void) => {
      if (!nodesRef.current) return;
      clearAlgebraTimers();
      scheduleAlgebra(() => {
        onStep("t1");
        TETRA_T1.forEach((lv) => playBitVectorLevel(lv));
      }, 0);
      scheduleAlgebra(() => onStep(null), 650);
    },
    [clearAlgebraTimers, scheduleAlgebra, playBitVectorLevel],
  );

  const playK8Layer = useCallback(
    (layer: 1 | 2 | 3, onStep: (edgeIndex: number, pair: [number, number] | null) => void) => {
      if (!nodesRef.current) return;
      if (k8IntervalRef.current !== null) {
        clearInterval(k8IntervalRef.current);
      }
      const edges = K8_LAYER_EDGES[layer];
      const intervalMs = layer === 3 ? 520 : 280;
      let step = 0;
      const id = setInterval(() => {
        if (!nodesRef.current) return;
        const ei = step % edges.length;
        const [a, b] = edges[ei];
        onStep(ei, [a, b]);
        playBitVectorLevel(a);
        playBitVectorLevel(b);
        step++;
      }, intervalMs);
      k8IntervalRef.current = id;
    },
    [playBitVectorLevel],
  );

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
