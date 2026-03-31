import { useRef, useEffect, useCallback } from "react";

/* ── Types ── */
export interface SonificationLevel {
  lv: number;
  angle: number; // hue angle in degrees (0-360)
  gray: number; // luminance 0-255
}

interface SonificationParams {
  enabled: boolean;
  levels: SonificationLevel[];
  hoveredLv: number | null;
  alpha0: number;
  alpha7: number;
}

/* ── Constants ── */
const BASE_FREQ = 220; // A3
const OCTAVES = 2; // 2 octaves range: 220-880 Hz
const GAIN_SCALE = 0.15; // per-oscillator max gain (louder than before)
const MASTER_GAIN = 0.6;
const NOISE_GAIN = 0.005;
const RAMP_TC = 0.02; // 20ms time constant for smooth transitions
const DUCK_TC = 0.05; // 50ms for hover ducking
const HOVER_BOOST = 1.5;
const HOVER_DUCK = 0.1;

/** Map hue angle (0-360) to frequency. 0°→220Hz, 180°→440Hz, 360°→880Hz */
function angleToFreq(angle: number): number {
  const norm = (((angle % 360) + 360) % 360) / 360;
  return BASE_FREQ * Math.pow(2, norm * OCTAVES);
}

/* ── Audio node refs ── */
interface AudioNodes {
  ctx: AudioContext;
  oscs: OscillatorNode[];
  gains: GainNode[];
  noiseSource: AudioBufferSourceNode;
  noiseGain: GainNode;
  master: GainNode;
  compressor: DynamicsCompressorNode;
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
  master.gain.value = MASTER_GAIN;

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -6;
  compressor.knee.value = 10;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.1;

  master.connect(compressor).connect(ctx.destination);

  // 6 oscillators for L1-L6
  const oscs: OscillatorNode[] = [];
  const gains: GainNode[] = [];
  for (let i = 0; i < 6; i++) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = BASE_FREQ;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain).connect(master);
    osc.start();
    oscs.push(osc);
    gains.push(gain);
  }

  // White noise for L7
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = NOISE_GAIN;
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = createNoiseBuffer(ctx);
  noiseSource.loop = true;
  noiseSource.connect(noiseGain).connect(master);
  noiseSource.start();

  return { ctx, oscs, gains, noiseSource, noiseGain, master, compressor };
}

function teardown(nodes: AudioNodes) {
  const { ctx, oscs, gains, noiseSource, noiseGain, master, compressor } = nodes;
  for (const osc of oscs) {
    try {
      osc.stop();
    } catch {
      /* already stopped */
    }
    osc.disconnect();
  }
  for (const g of gains) g.disconnect();
  try {
    noiseSource.stop();
  } catch {
    /* already stopped */
  }
  noiseSource.disconnect();
  noiseGain.disconnect();
  master.disconnect();
  compressor.disconnect();
  void ctx.close();
}

/** Apply current frequency and gain values to the audio graph */
function applyParams(nodes: AudioNodes, levels: SonificationLevel[], hoveredLv: number | null, alpha0: number, alpha7: number) {
  const now = nodes.ctx.currentTime;

  // Phase modulation factor: |cos(deltaAlpha/2)|
  const delta = (((alpha0 - alpha7) % 360) + 360) % 360;
  const deltaRad = (delta / 2) * (Math.PI / 180);
  const phaseFactor = Math.abs(Math.cos(deltaRad));

  for (let i = 0; i < 6; i++) {
    const lv = i + 1;
    const lvData = levels.find((l) => l.lv === lv);
    if (!lvData) continue;

    // Frequency
    nodes.oscs[i].frequency.setTargetAtTime(angleToFreq(lvData.angle), now, RAMP_TC);

    // Gain
    const baseGain = (lvData.gray / 255) * GAIN_SCALE;
    let targetGain: number;
    if (hoveredLv === null) {
      targetGain = baseGain * phaseFactor;
    } else if (hoveredLv === lv) {
      targetGain = baseGain * HOVER_BOOST;
    } else {
      targetGain = baseGain * HOVER_DUCK * phaseFactor;
    }
    const tc = hoveredLv !== null ? DUCK_TC : RAMP_TC;
    nodes.gains[i].gain.setTargetAtTime(targetGain, now, tc);
  }

  // L7 noise
  let noiseTarget = NOISE_GAIN * phaseFactor;
  if (hoveredLv === 7) noiseTarget = 0.03;
  else if (hoveredLv !== null) noiseTarget = 0.001;
  nodes.noiseGain.gain.setTargetAtTime(noiseTarget, now, DUCK_TC);
}

/* ── Hook ── */
export function useSonification({ enabled, levels, hoveredLv, alpha0, alpha7 }: SonificationParams) {
  const nodesRef = useRef<AudioNodes | null>(null);
  // Keep latest params in refs so initAudio can apply them immediately
  const paramsRef = useRef({ levels, hoveredLv, alpha0, alpha7 });
  useEffect(() => {
    paramsRef.current = { levels, hoveredLv, alpha0, alpha7 };
  }, [levels, hoveredLv, alpha0, alpha7]);

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
    // Apply params immediately so sound starts right away
    const p = paramsRef.current;
    applyParams(nodes, p.levels, p.hoveredLv, p.alpha0, p.alpha7);
  }, []);

  // Teardown on unmount only
  useEffect(() => {
    return () => {
      if (nodesRef.current) {
        teardown(nodesRef.current);
        nodesRef.current = null;
      }
    };
  }, []);

  // When disabled, teardown audio
  useEffect(() => {
    if (!enabled && nodesRef.current) {
      teardown(nodesRef.current);
      nodesRef.current = null;
    }
  }, [enabled]);

  // Update params when they change
  useEffect(() => {
    if (!enabled || !nodesRef.current) return;
    applyParams(nodesRef.current, levels, hoveredLv, alpha0, alpha7);
  }, [enabled, levels, hoveredLv, alpha0, alpha7]);

  return { initAudio };
}
