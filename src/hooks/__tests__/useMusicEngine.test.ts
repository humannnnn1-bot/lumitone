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
    return Promise.resolve();
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeAudioContext.instances = [];
});

describe("useMusicEngine", () => {
  it("starts the persistent L7 noise source muted", () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);

    const { result, unmount } = renderHook(() =>
      useMusicEngine({
        enabled: true,
        levels: [
          { lv: 1, angle: 240, gray: 29 },
          { lv: 2, angle: 0, gray: 76 },
          { lv: 3, angle: 300, gray: 105 },
          { lv: 4, angle: 120, gray: 150 },
          { lv: 5, angle: 180, gray: 179 },
          { lv: 6, angle: 60, gray: 226 },
        ],
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
      }),
    );

    act(() => {
      result.current.initAudio();
    });

    const ctx = FakeAudioContext.instances[0];
    const noiseGain = ctx.gains[7];
    expect(noiseGain.gain.valueAssignments[0]).toBe(0);
    expect(noiseGain.gain.targetValues).toContain(0);

    unmount();
  });
});
