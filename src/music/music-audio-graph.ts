import { FANO_LINES } from "../data/theory-data";
import { LUMA_VALUES, bitSpectrumComponents } from "../data/music-data";
import { BASE_FREQ, angleToFreq, type ScaleMode } from "../data/music-frequency";
import { BT601_LUMA_COEFFICIENT_BY_LEVEL, MAX_BT601_LUMA_COEFFICIENT, lumaToFreq } from "./music-engine-core";

export interface SonificationLevel {
  levelIndex: number;
  hueAngleDeg: number;
  luma255: number;
}

export interface AudioNodes {
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

const GAIN_SCALE = 0.15;
const NOISE_GAIN = 0.005;
export const RAMP_TC = 0.02;
const DUCK_TC = 0.05;
const HOVER_BOOST = 1.5;
const HOVER_DUCK = 0.1;
const BIT_TIMBRE_GAIN_SCALE = 0.42;
const C2_PAIRS: [number, number][] = [
  [6, 1],
  [5, 2],
  [4, 3],
]; // carrier, modulator

function createNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export function buildAudioGraph(ctx: AudioContext): AudioNodes {
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
  noiseGain.gain.value = 0;
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

export function teardownFM(nodes: AudioNodes) {
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

export function teardown(nodes: AudioNodes) {
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
export function buildFM(nodes: AudioNodes, levels: SonificationLevel[], scaleMode: ScaleMode) {
  teardownFM(nodes);
  const fmOscs: OscillatorNode[] = [];
  const fmGains: GainNode[] = [];

  for (const [carrierLevelIndex, modulatorLevelIndex] of C2_PAIRS) {
    const carrierLevel = levels.find((level) => level.levelIndex === carrierLevelIndex);
    const modulatorLevel = levels.find((level) => level.levelIndex === modulatorLevelIndex);
    if (!carrierLevel || !modulatorLevel) continue;

    const modOsc = nodes.ctx.createOscillator();
    modOsc.type = "sine";
    modOsc.frequency.value = angleToFreq(modulatorLevel.hueAngleDeg, scaleMode);

    const modGain = nodes.ctx.createGain();
    const modIndex = (Math.abs(carrierLevel.luma255 - modulatorLevel.luma255) / 255) * 400;
    modGain.gain.value = modIndex;

    // The carrier oscillator array is indexed by levelIndex - 1.
    const carrierOsc = nodes.oscs[carrierLevelIndex - 1];
    modOsc.connect(modGain).connect(carrierOsc.frequency);
    modOsc.start();

    fmOscs.push(modOsc);
    fmGains.push(modGain);
  }

  nodes.fmOscs = fmOscs;
  nodes.fmGains = fmGains;
}

/** Trigger a short tone burst at a luma-derived frequency */
export function triggerLumaBurst(nodes: AudioNodes, luma255: number) {
  const ctx = nodes.ctx;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = lumaToFreq(luma255);
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
function triggerPitchBurst(nodes: AudioNodes, hueAngleDeg: number, scaleMode: ScaleMode) {
  const ctx = nodes.ctx;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = angleToFreq(hueAngleDeg, scaleMode);

  const gain = ctx.createGain();
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.3, now + 0.01);
  gain.gain.linearRampToValueAtTime(0.0, now + 0.31);

  osc.connect(gain).connect(nodes.master);
  osc.start(now);
  osc.stop(now + 0.35);
}

export function triggerPitchOrLumaBurst(nodes: AudioNodes, levelIndex: number, hueAngleDeg: number, scaleMode: ScaleMode) {
  if (hueAngleDeg < 0) {
    triggerLumaBurst(nodes, LUMA_VALUES[levelIndex] ?? 0);
    return;
  }

  triggerPitchBurst(nodes, hueAngleDeg, scaleMode);
}

/** Trigger a bit-basis timbre burst: GF(2)^3 bits select spectral basis components. */
export function triggerBitSpectrumBurst(nodes: AudioNodes, levelIndex: number, hueAngleDeg: number, panEnabled: boolean) {
  const components = bitSpectrumComponents(levelIndex);
  if (components.length === 0) return;

  const lumaNorm = Math.max(0, Math.min(1, (LUMA_VALUES[levelIndex] ?? 0) / 255));
  if (lumaNorm <= 0) return;

  const ctx = nodes.ctx;
  const now = ctx.currentTime;
  const group = ctx.createGain();
  const panner = ctx.createStereoPanner();

  group.gain.setValueAtTime(0, now);
  group.gain.linearRampToValueAtTime(lumaNorm * BIT_TIMBRE_GAIN_SCALE, now + 0.01);
  group.gain.linearRampToValueAtTime(0, now + 0.31);

  if (panEnabled && hueAngleDeg >= 0) {
    panner.pan.value = Math.cos((hueAngleDeg * Math.PI) / 180);
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
export function triggerErrorMarker(nodes: AudioNodes) {
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
export function applyParams(
  nodes: AudioNodes,
  levels: SonificationLevel[],
  hoveredLevelIndex: number | null,
  alpha0: number,
  alpha7: number,
  volume: number,
  scaleMode: ScaleMode,
  fmEnabled: boolean,
  panEnabled: boolean,
  hoveredFanoLine: number | null,
  lumaMode: "symmetric" | "bt601Luma" = "symmetric",
  originMode: 0 | 7 = 0,
  droneMuted = false,
) {
  const now = nodes.ctx.currentTime;

  // Active alpha: use alpha0 in L0 mode, alpha7 in L7 mode
  const activeAlpha = originMode === 0 ? alpha0 : alpha7;

  // Phase modulation factor: abs(cos(deltaAlpha/2))
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
    const levelIndex = i + 1;
    const levelData = levels.find((level) => level.levelIndex === levelIndex);
    if (!levelData) continue;

    // Frequency: active alpha rotates pitch mapping around the hue wheel
    const rotatedAngle = levelData.hueAngleDeg + activeAlpha;
    nodes.oscs[i].frequency.setTargetAtTime(angleToFreq(rotatedAngle, scaleMode), now, RAMP_TC);

    // Gain: hover logic with Fano line boost
    // L0 mode: brighter levels are louder (luma/255)
    // L7 mode: darker levels are louder (1 - luma/255), matching the inverted radius
    const gainScale =
      lumaMode === "bt601Luma" && BT601_LUMA_COEFFICIENT_BY_LEVEL[levelIndex] !== undefined
        ? (BT601_LUMA_COEFFICIENT_BY_LEVEL[levelIndex] / MAX_BT601_LUMA_COEFFICIENT) * GAIN_SCALE
        : GAIN_SCALE;
    const lumaNorm = originMode === 0 ? levelData.luma255 / 255 : 1 - levelData.luma255 / 255;
    const baseGain = lumaNorm * gainScale;
    let targetGain: number;

    if (hoveredLevelIndex !== null) {
      // Individual level hover takes priority
      if (hoveredLevelIndex === levelIndex) {
        targetGain = baseGain * HOVER_BOOST;
      } else {
        targetGain = baseGain * HOVER_DUCK * phaseFactor;
      }
    } else if (fanoBoostSet !== null) {
      // Fano line hover: boost members, duck others
      if (fanoBoostSet.has(levelIndex)) {
        targetGain = baseGain * HOVER_BOOST;
      } else {
        targetGain = baseGain * HOVER_DUCK * phaseFactor;
      }
    } else {
      targetGain = baseGain * phaseFactor;
    }

    const tc = hoveredLevelIndex !== null || fanoBoostSet !== null ? DUCK_TC : RAMP_TC;
    // When drone is muted, only play hovered level or Fano line members
    let finalGain: number;
    if (droneMuted) {
      const isHoveredLevel = hoveredLevelIndex !== null && hoveredLevelIndex === levelIndex;
      const isFanoMember = fanoBoostSet !== null && fanoBoostSet.has(levelIndex);
      finalGain = isHoveredLevel || isFanoMember ? baseGain * HOVER_BOOST : 0;
    } else {
      finalGain = targetGain;
    }
    nodes.gains[i].gain.setTargetAtTime(finalGain, now, tc);

    // Stereo pan
    const panValue = panEnabled ? Math.cos((levelData.hueAngleDeg * Math.PI) / 180) : 0;
    nodes.panners[i].pan.setTargetAtTime(panValue, now, RAMP_TC);
  }

  // L7 noise: gain follows wave graph radius: L0-origin -> luma/255 = 1.0, L7-origin -> 1-luma/255 = 0
  const l7Luma255 = 255; // White
  const l7Radius = originMode === 0 ? l7Luma255 / 255 : 1 - l7Luma255 / 255;
  const noiseBase = NOISE_GAIN * l7Radius;
  let noiseTarget = noiseBase * phaseFactor;
  if (hoveredLevelIndex === 7) noiseTarget = noiseBase * HOVER_BOOST;
  else if (hoveredLevelIndex !== null) noiseTarget = noiseBase * HOVER_DUCK;
  else if (fanoBoostSet !== null) noiseTarget = noiseBase * HOVER_DUCK;
  const finalNoise = droneMuted ? (hoveredLevelIndex === 7 ? noiseBase * HOVER_BOOST : 0) : noiseTarget;
  nodes.noiseGain.gain.setTargetAtTime(finalNoise, now, DUCK_TC);

  // FM synthesis: update modulator parameters if enabled
  if (fmEnabled && nodes.fmOscs.length > 0) {
    let pairIdx = 0;
    for (const [carrierLevelIndex, modulatorLevelIndex] of C2_PAIRS) {
      if (pairIdx >= nodes.fmOscs.length) break;
      const carrierLevel = levels.find((level) => level.levelIndex === carrierLevelIndex);
      const modulatorLevel = levels.find((level) => level.levelIndex === modulatorLevelIndex);
      if (!carrierLevel || !modulatorLevel) {
        pairIdx++;
        continue;
      }
      nodes.fmOscs[pairIdx].frequency.setTargetAtTime(angleToFreq(modulatorLevel.hueAngleDeg + activeAlpha, scaleMode), now, RAMP_TC);
      const modIndex = (Math.abs(carrierLevel.luma255 - modulatorLevel.luma255) / 255) * 400;
      nodes.fmGains[pairIdx].gain.setTargetAtTime(modIndex, now, RAMP_TC);
      pairIdx++;
    }
  }
}
