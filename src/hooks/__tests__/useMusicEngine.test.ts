// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useMusicEngine } from "../useMusicEngine";

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
  connect<T>(destination: T): T {
    return destination;
  }

  disconnect() {}
}

class FakeGainNode extends FakeAudioNode {
  readonly gain = new FakeAudioParam();
}

class FakeOscillatorNode extends FakeAudioNode {
  type: OscillatorType = "sine";
  readonly frequency = new FakeAudioParam();

  start(_when?: number) {}
  stop(_when?: number) {}
}

class FakeStereoPannerNode extends FakeAudioNode {
  readonly pan = new FakeAudioParam();
}

class FakeBiquadFilterNode extends FakeAudioNode {
  type: BiquadFilterType = "lowpass";
  readonly frequency = new FakeAudioParam();
  readonly Q = new FakeAudioParam();
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

  start(_when?: number) {}
  stop(_when?: number) {}
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];

  readonly currentTime = 0;
  readonly destination = new FakeAudioNode();
  readonly gains: FakeGainNode[] = [];
  readonly sampleRate: number;
  state: AudioContextState = "running";

  constructor(options?: AudioContextOptions) {
    this.sampleRate = options?.sampleRate ?? 44100;
    FakeAudioContext.instances.push(this);
  }

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
    return new FakeOscillatorNode();
  }

  createStereoPanner() {
    return new FakeStereoPannerNode();
  }

  createBiquadFilter() {
    return new FakeBiquadFilterNode();
  }

  createBufferSource() {
    return new FakeAudioBufferSourceNode();
  }

  createBuffer(_numberOfChannels: number, length: number, _sampleRate: number) {
    return new FakeAudioBuffer(length);
  }

  resume() {
    this.state = "running";
    return Promise.resolve();
  }

  close() {
    this.state = "closed";
    return Promise.resolve();
  }
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  FakeAudioContext.instances = [];
});

type MusicEngineParams = Parameters<typeof useMusicEngine>[0];

const DEFAULT_LEVELS: MusicEngineParams["levels"] = [
  { lv: 1, angle: 240, gray: 29 },
  { lv: 2, angle: 0, gray: 76 },
  { lv: 3, angle: 300, gray: 105 },
  { lv: 4, angle: 120, gray: 150 },
  { lv: 5, angle: 180, gray: 179 },
  { lv: 6, angle: 60, gray: 226 },
];

function renderMusicEngine(overrides: Partial<MusicEngineParams> = {}) {
  return renderHook(() =>
    useMusicEngine({
      enabled: true,
      levels: DEFAULT_LEVELS,
      hoveredLv: null,
      alpha0: 0,
      alpha7: 0,
      volume: 0.7,
      scaleMode: "diatonic7",
      fmEnabled: false,
      panEnabled: true,
      hoveredFanoLine: null,
      luminanceMode: "symmetric",
      originMode: 0,
      ...overrides,
    }),
  );
}

describe("useMusicEngine", () => {
  it("starts the persistent L7 noise source muted", () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);

    const { result, unmount } = renderMusicEngine();

    act(() => {
      result.current.initAudio();
    });

    const ctx = FakeAudioContext.instances[0];
    const noiseGain = ctx.gains[7];
    expect(noiseGain.gain.valueAssignments[0]).toBe(0);
    expect(noiseGain.gain.targetValues).toContain(0);

    unmount();
  });

  it("releases the audio context and creates a fresh one on the next init", () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);

    const { result, unmount } = renderMusicEngine();

    act(() => {
      result.current.initAudio();
    });
    const firstCtx = FakeAudioContext.instances[0];

    act(() => {
      result.current.stopAudio();
    });
    expect(firstCtx.state).toBe("closed");

    act(() => {
      result.current.initAudio();
    });
    expect(FakeAudioContext.instances).toHaveLength(2);

    unmount();
  });

  it("starts, restarts, and stops the Gray melody interval", () => {
    vi.useFakeTimers();
    vi.stubGlobal("AudioContext", FakeAudioContext);

    const { result, unmount } = renderMusicEngine();
    act(() => {
      result.current.initAudio();
    });

    const onStep = vi.fn();
    act(() => {
      result.current.playGrayMelody(60, onStep);
      vi.advanceTimersByTime(1000);
    });
    expect(onStep).toHaveBeenCalledTimes(1);

    const restartedStep = vi.fn();
    act(() => {
      result.current.playGrayMelody(120, restartedStep);
      vi.advanceTimersByTime(1000);
    });
    expect(onStep).toHaveBeenCalledTimes(1);
    expect(restartedStep).toHaveBeenCalledTimes(2);

    restartedStep.mockClear();
    act(() => {
      result.current.stopGrayMelody();
      vi.advanceTimersByTime(1000);
    });
    expect(restartedStep).not.toHaveBeenCalled();

    unmount();
  });

  it("starts, restarts, and stops the Fano rhythm interval", () => {
    vi.useFakeTimers();
    vi.stubGlobal("AudioContext", FakeAudioContext);

    const { result, unmount } = renderMusicEngine();
    act(() => {
      result.current.initAudio();
    });

    const onBeat = vi.fn();
    act(() => {
      result.current.startFanoRhythm(60, onBeat);
      vi.advanceTimersByTime(143);
    });
    expect(onBeat).toHaveBeenCalledTimes(1);

    onBeat.mockClear();
    act(() => {
      result.current.startFanoRhythm(60, onBeat);
      vi.advanceTimersByTime(143);
    });
    expect(onBeat).toHaveBeenCalledTimes(1);

    onBeat.mockClear();
    act(() => {
      result.current.stopFanoRhythm();
      vi.advanceTimersByTime(1000);
    });
    expect(onBeat).not.toHaveBeenCalled();

    unmount();
  });

  it("clears queued algebra timeouts before they run", () => {
    vi.useFakeTimers();
    vi.stubGlobal("AudioContext", FakeAudioContext);

    const { result, unmount } = renderMusicEngine();
    act(() => {
      result.current.initAudio();
    });

    const onPhase = vi.fn();
    act(() => {
      result.current.playLineAndComplement(0, onPhase);
      result.current.stopAlgebra();
      vi.advanceTimersByTime(1000);
    });

    expect(onPhase).not.toHaveBeenCalled();

    unmount();
  });

  it("stops algebra interval playback for Gray voices, Cayley rows, and K8 layers", () => {
    vi.useFakeTimers();
    vi.stubGlobal("AudioContext", FakeAudioContext);

    const { result, unmount } = renderMusicEngine();
    act(() => {
      result.current.initAudio();
    });

    const onGray3 = vi.fn();
    const onCayley = vi.fn();
    const onK8 = vi.fn();

    act(() => {
      result.current.playGray3Voice(onGray3);
      result.current.playCayleyRow(1, onCayley);
      result.current.playK8Layer(1, onK8);
      vi.advanceTimersByTime(400);
    });

    expect(onGray3).toHaveBeenCalled();
    expect(onCayley).toHaveBeenCalled();
    expect(onK8).toHaveBeenCalled();

    onGray3.mockClear();
    onCayley.mockClear();
    onK8.mockClear();

    act(() => {
      result.current.stopAlgebra();
      vi.advanceTimersByTime(1000);
    });

    expect(onGray3).not.toHaveBeenCalled();
    expect(onCayley).not.toHaveBeenCalled();
    expect(onK8).not.toHaveBeenCalled();

    unmount();
  });
});
