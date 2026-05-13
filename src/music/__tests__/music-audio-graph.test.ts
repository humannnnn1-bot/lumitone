import { describe, expect, it } from "vitest";
import { BASE_FREQ } from "../../data/music-frequency";
import {
  applyParams,
  buildAudioGraph,
  buildFM,
  teardown,
  teardownFM,
  triggerBitSpectrumBurst,
  triggerErrorMarker,
  triggerPitchOrLumaBurst,
  type SonificationLevel,
} from "../music-audio-graph";

class FakeAudioParam {
  private current = 0;
  readonly valueAssignments: number[] = [];
  readonly targetValues: number[] = [];

  get value() {
    return this.current;
  }

  set value(next: number) {
    this.current = next;
    this.valueAssignments.push(next);
  }

  setTargetAtTime(value: number, _startTime: number, _timeConstant: number) {
    this.current = value;
    this.targetValues.push(value);
    return this;
  }

  setValueAtTime(value: number, _startTime: number) {
    this.current = value;
    return this;
  }

  linearRampToValueAtTime(value: number, _endTime: number) {
    this.current = value;
    return this;
  }
}

class FakeAudioNode {
  disconnectCount = 0;

  connect<T>(destination: T): T {
    return destination;
  }

  disconnect() {
    this.disconnectCount++;
  }
}

class FakeGainNode extends FakeAudioNode {
  readonly gain = new FakeAudioParam();
}

class FakeOscillatorNode extends FakeAudioNode {
  type: OscillatorType = "sine";
  readonly frequency = new FakeAudioParam();
  startCount = 0;
  stopCount = 0;

  start(_when?: number) {
    this.startCount++;
  }

  stop(_when?: number) {
    this.stopCount++;
  }
}

class FakeStereoPannerNode extends FakeAudioNode {
  readonly pan = new FakeAudioParam();
}

class FakeAnalyserNode extends FakeAudioNode {
  fftSize = 0;
}

class FakeDynamicsCompressorNode extends FakeAudioNode {
  readonly threshold = new FakeAudioParam();
  readonly knee = new FakeAudioParam();
  readonly ratio = new FakeAudioParam();
  readonly attack = new FakeAudioParam();
  readonly release = new FakeAudioParam();
}

class FakeAudioBuffer {
  private readonly data: Float32Array;

  constructor(length: number) {
    this.data = new Float32Array(length);
  }

  getChannelData(_channel: number) {
    return this.data;
  }
}

class FakeAudioBufferSourceNode extends FakeAudioNode {
  buffer: FakeAudioBuffer | null = null;
  loop = false;
  startCount = 0;
  stopCount = 0;

  start(_when?: number) {
    this.startCount++;
  }

  stop(_when?: number) {
    this.stopCount++;
  }
}

class FakeBiquadFilterNode extends FakeAudioNode {
  type: BiquadFilterType = "lowpass";
  readonly frequency = new FakeAudioParam();
  readonly Q = new FakeAudioParam();
}

class FakeAudioContext {
  readonly currentTime = 1;
  readonly destination = new FakeAudioNode();
  readonly gains: FakeGainNode[] = [];
  readonly oscs: FakeOscillatorNode[] = [];
  readonly panners: FakeStereoPannerNode[] = [];
  readonly sources: FakeAudioBufferSourceNode[] = [];
  readonly filters: FakeBiquadFilterNode[] = [];
  readonly sampleRate = 1000;
  closed = false;

  createGain() {
    const gain = new FakeGainNode();
    this.gains.push(gain);
    return gain;
  }

  createAnalyser() {
    return new FakeAnalyserNode();
  }

  createDynamicsCompressor() {
    return new FakeDynamicsCompressorNode();
  }

  createOscillator() {
    const osc = new FakeOscillatorNode();
    this.oscs.push(osc);
    return osc;
  }

  createStereoPanner() {
    const panner = new FakeStereoPannerNode();
    this.panners.push(panner);
    return panner;
  }

  createBufferSource() {
    const source = new FakeAudioBufferSourceNode();
    this.sources.push(source);
    return source;
  }

  createBiquadFilter() {
    const filter = new FakeBiquadFilterNode();
    this.filters.push(filter);
    return filter;
  }

  createBuffer(_numberOfChannels: number, length: number, _sampleRate: number) {
    return new FakeAudioBuffer(length);
  }

  close() {
    this.closed = true;
    return Promise.resolve();
  }
}

function makeContext() {
  return new FakeAudioContext() as unknown as AudioContext;
}

function last(values: number[]) {
  return values[values.length - 1] ?? 0;
}

const levels: SonificationLevel[] = [
  { levelIndex: 1, hueAngleDeg: 240, luma255: 29 },
  { levelIndex: 2, hueAngleDeg: 0, luma255: 76 },
  { levelIndex: 3, hueAngleDeg: 300, luma255: 105 },
  { levelIndex: 4, hueAngleDeg: 120, luma255: 150 },
  { levelIndex: 5, hueAngleDeg: 180, luma255: 179 },
  { levelIndex: 6, hueAngleDeg: 60, luma255: 226 },
];

describe("music-audio-graph", () => {
  it("builds the persistent oscillator, analyser, compressor, and muted noise graph", () => {
    const ctx = makeContext();
    const fake = ctx as unknown as FakeAudioContext;
    const nodes = buildAudioGraph(ctx);

    expect(nodes.oscs).toHaveLength(6);
    expect(nodes.gains).toHaveLength(6);
    expect(nodes.panners).toHaveLength(6);
    expect(nodes.analyser.fftSize).toBe(2048);
    expect(nodes.master.gain.value).toBe(0.8);
    expect(nodes.noiseGain.gain.value).toBe(0);
    expect(nodes.noiseSource.loop).toBe(true);
    expect(fake.oscs.slice(0, 6).every((osc) => osc.startCount === 1)).toBe(true);
    expect(fake.sources[0].startCount).toBe(1);
  });

  it("applies drone params to oscillator frequency, gain, pan, and noise gain", () => {
    const nodes = buildAudioGraph(makeContext());

    applyParams(nodes, levels, 3, 0, 0, 0.5, "diatonic7", false, true, null, "symmetric", 0, false);

    const master = nodes.master as unknown as FakeGainNode;
    const gain0 = nodes.gains[0] as unknown as FakeGainNode;
    const gain2 = nodes.gains[2] as unknown as FakeGainNode;
    const osc0 = nodes.oscs[0] as unknown as FakeOscillatorNode;
    const panner0 = nodes.panners[0] as unknown as FakeStereoPannerNode;
    const noiseGain = nodes.noiseGain as unknown as FakeGainNode;

    expect(master.gain.targetValues).toContain(0.4);
    expect(last(gain2.gain.targetValues)).toBeGreaterThan(last(gain0.gain.targetValues));
    expect(osc0.frequency.targetValues.length).toBeGreaterThan(0);
    expect(panner0.pan.targetValues.length).toBeGreaterThan(0);
    expect(noiseGain.gain.targetValues.length).toBeGreaterThan(0);
  });

  it("rebuilds and tears down FM modulator nodes", () => {
    const nodes = buildAudioGraph(makeContext());

    buildFM(nodes, levels, "diatonic7");
    expect(nodes.fmOscs).toHaveLength(3);
    expect(nodes.fmGains).toHaveLength(3);
    const firstFmOscs = nodes.fmOscs as unknown as FakeOscillatorNode[];

    buildFM(nodes, levels, "diatonic7");
    expect(firstFmOscs.every((osc) => osc.stopCount === 1 && osc.disconnectCount === 1)).toBe(true);
    expect(nodes.fmOscs).toHaveLength(3);

    teardownFM(nodes);
    expect(nodes.fmOscs).toEqual([]);
    expect(nodes.fmGains).toEqual([]);
  });

  it("creates transient tone, bit-spectrum, and error-marker nodes", () => {
    const ctx = makeContext();
    const fake = ctx as unknown as FakeAudioContext;
    const nodes = buildAudioGraph(ctx);
    const initialOscCount = fake.oscs.length;

    triggerPitchOrLumaBurst(nodes, 0, -1, "diatonic7");
    triggerPitchOrLumaBurst(nodes, 2, 120, "diatonic7");
    triggerBitSpectrumBurst(nodes, 3, -1, false);
    triggerErrorMarker(nodes);

    expect(fake.oscs.length).toBeGreaterThan(initialOscCount + 2);
    expect(fake.sources.length).toBeGreaterThan(1);
    expect(fake.filters).toHaveLength(1);
  });

  it("maps levels 1 through 7 to the matching bit-spectrum components", () => {
    const expected = [
      { lv: 1, freqs: [BASE_FREQ * 3] },
      { lv: 2, freqs: [BASE_FREQ] },
      { lv: 3, freqs: [BASE_FREQ * 3, BASE_FREQ] },
      { lv: 4, freqs: [BASE_FREQ * 2] },
      { lv: 5, freqs: [BASE_FREQ * 3, BASE_FREQ * 2] },
      { lv: 6, freqs: [BASE_FREQ, BASE_FREQ * 2] },
      { lv: 7, freqs: [BASE_FREQ * 3, BASE_FREQ, BASE_FREQ * 2] },
    ];

    for (const { lv, freqs } of expected) {
      const ctx = makeContext();
      const fake = ctx as unknown as FakeAudioContext;
      const nodes = buildAudioGraph(ctx);
      const initialOscCount = fake.oscs.length;

      triggerBitSpectrumBurst(nodes, lv, -1, false);

      expect(fake.oscs.slice(initialOscCount).map((osc) => osc.frequency.value)).toEqual(freqs);
    }
  });

  it("tears down persistent graph nodes and closes the context", () => {
    const ctx = makeContext();
    const fake = ctx as unknown as FakeAudioContext;
    const nodes = buildAudioGraph(ctx);

    teardown(nodes);

    expect(fake.oscs.slice(0, 6).every((osc) => osc.stopCount === 1 && osc.disconnectCount === 1)).toBe(true);
    expect(fake.sources[0].stopCount).toBe(1);
    expect(fake.closed).toBe(true);
  });
});
