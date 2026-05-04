import { describe, expect, it, vi } from "vitest";
import {
  scheduleAndTriads,
  scheduleComplementCanon,
  scheduleDistributiveLaw,
  scheduleExtendedHamming,
  scheduleLineAndComplement,
  scheduleOctahedronMix,
  schedulePointFanoContext,
  scheduleSyndromeDemo,
  scheduleTetraSplit,
  scheduleTetraT0,
  scheduleTetraT1,
  scheduleWeightSpectrum,
  scheduleXorTriple,
  type MusicPlaybackRuntime,
} from "../music-playback-runner";

function createRuntime() {
  const scheduled: Array<{ fn: () => void; ms: number }> = [];
  const clear = vi.fn();
  const schedule = vi.fn((fn: () => void, ms: number) => {
    scheduled.push({ fn, ms });
  });
  const playBitVectorLevel = vi.fn();
  const triggerLumaBurst = vi.fn();
  const triggerErrorMarker = vi.fn();
  const runtime: MusicPlaybackRuntime = {
    clear,
    schedule,
    playBitVectorLevel,
    triggerLumaBurst,
    triggerErrorMarker,
  };

  return { runtime, scheduled, clear, schedule, playBitVectorLevel, triggerLumaBurst, triggerErrorMarker };
}

describe("music-playback-runner", () => {
  it("schedules line/complement phases and played levels", () => {
    const { runtime, scheduled, clear, playBitVectorLevel } = createRuntime();
    const onStep = vi.fn();

    expect(scheduleLineAndComplement(0, onStep, runtime)).toBe(true);
    expect(clear).toHaveBeenCalledOnce();
    expect(scheduled.map((event) => event.ms)).toEqual([0, 500, 1000]);

    scheduled.forEach((event) => event.fn());

    expect(onStep.mock.calls).toEqual([["line"], ["complement"], [null]]);
    expect(playBitVectorLevel.mock.calls.map(([lv]) => lv)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("leaves existing timers alone for invalid line/complement input", () => {
    const { runtime, clear, schedule } = createRuntime();

    expect(scheduleLineAndComplement(-1, vi.fn(), runtime)).toBe(false);

    expect(clear).not.toHaveBeenCalled();
    expect(schedule).not.toHaveBeenCalled();
  });

  it("plays syndrome events including the error marker and parity tones", () => {
    const { runtime, scheduled, triggerErrorMarker, playBitVectorLevel } = createRuntime();
    const onPhase = vi.fn();

    expect(scheduleSyndromeDemo(5, onPhase, runtime)).toBe(true);
    scheduled.forEach((event) => event.fn());

    expect(triggerErrorMarker).toHaveBeenCalledOnce();
    expect(onPhase).toHaveBeenCalledWith("syndrome");
    expect(playBitVectorLevel).toHaveBeenCalledWith(1);
    expect(playBitVectorLevel).toHaveBeenCalledWith(4);
  });

  it("schedules luma canon and extended Hamming luma coordinates", () => {
    const canon = createRuntime();
    const onCanonStep = vi.fn();

    scheduleComplementCanon(onCanonStep, true, canon.runtime);
    canon.scheduled[0].fn();
    canon.scheduled[canon.scheduled.length - 1].fn();

    expect(onCanonStep).toHaveBeenCalledWith(2, "playing");
    expect(onCanonStep).toHaveBeenCalledWith(-1, null);
    expect(canon.triggerLumaBurst).toHaveBeenCalledTimes(2);

    const extended = createRuntime();
    const onSpectrumStep = vi.fn();

    scheduleExtendedHamming(onSpectrumStep, extended.runtime);
    extended.scheduled.forEach((event) => event.fn());

    expect(extended.triggerLumaBurst).toHaveBeenCalledWith(0);
    expect(onSpectrumStep).toHaveBeenLastCalledWith([], -1, 16);
  });

  it("schedules remaining one-shot algebra and polyhedra helpers", () => {
    const xor = createRuntime();
    const onXorStep = vi.fn();
    scheduleXorTriple(2, 5, onXorStep, xor.runtime);
    xor.scheduled.forEach((event) => event.fn());
    expect(onXorStep.mock.calls).toEqual([[2], [5], [7], [null]]);

    const spectrum = createRuntime();
    const onSpectrumStep = vi.fn();
    scheduleWeightSpectrum(onSpectrumStep, spectrum.runtime);
    spectrum.scheduled[1].fn();
    spectrum.scheduled[spectrum.scheduled.length - 1].fn();
    expect(onSpectrumStep).toHaveBeenCalledWith([1, 2, 3], 3, 1);
    expect(onSpectrumStep).toHaveBeenLastCalledWith([], -1, 16);

    const point = createRuntime();
    const onLineStep = vi.fn();
    expect(schedulePointFanoContext(1, onLineStep, point.runtime)).toBe(true);
    point.scheduled.forEach((event) => event.fn());
    expect(onLineStep.mock.calls).toEqual([[0], [1], [3], [null]]);

    const invalidPoint = createRuntime();
    expect(schedulePointFanoContext(0, vi.fn(), invalidPoint.runtime)).toBe(false);
    expect(invalidPoint.clear).not.toHaveBeenCalled();

    const distributive = createRuntime();
    const onDistributiveStep = vi.fn();
    scheduleDistributiveLaw(5, 3, 6, onDistributiveStep, distributive.runtime);
    distributive.scheduled.forEach((event) => event.fn());
    expect(onDistributiveStep).toHaveBeenCalledWith("equal", 5);

    const andTriads = createRuntime();
    const onAndStep = vi.fn();
    scheduleAndTriads(onAndStep, andTriads.runtime);
    andTriads.scheduled[0].fn();
    andTriads.scheduled[1].fn();
    andTriads.scheduled[andTriads.scheduled.length - 1].fn();
    expect(onAndStep).toHaveBeenNthCalledWith(1, { pairIndex: 0, phase: "operands" });
    expect(onAndStep).toHaveBeenNthCalledWith(2, { pairIndex: 0, phase: "result" });
    expect(onAndStep).toHaveBeenLastCalledWith(null);

    const octahedron = createRuntime();
    const onOctahedronStep = vi.fn();
    expect(scheduleOctahedronMix(1, 2, onOctahedronStep, octahedron.runtime)).toBe(true);
    octahedron.scheduled.forEach((event) => event.fn());
    expect(onOctahedronStep.mock.calls).toEqual([["pair"], ["result"], [null]]);

    const invalidOctahedron = createRuntime();
    expect(scheduleOctahedronMix(1, 1, vi.fn(), invalidOctahedron.runtime)).toBe(false);
    expect(invalidOctahedron.clear).not.toHaveBeenCalled();

    const tetraSplit = createRuntime();
    const onTetraSplit = vi.fn();
    scheduleTetraSplit(onTetraSplit, tetraSplit.runtime);
    tetraSplit.scheduled.forEach((event) => event.fn());
    expect(onTetraSplit.mock.calls).toEqual([["t0"], ["t1"], [null]]);

    const tetraT0 = createRuntime();
    const onTetraT0 = vi.fn();
    scheduleTetraT0(onTetraT0, tetraT0.runtime);
    tetraT0.scheduled.forEach((event) => event.fn());
    expect(onTetraT0.mock.calls).toEqual([["t0"], [null]]);

    const tetraT1 = createRuntime();
    const onTetraT1 = vi.fn();
    scheduleTetraT1(onTetraT1, tetraT1.runtime);
    tetraT1.scheduled.forEach((event) => event.fn());
    expect(onTetraT1.mock.calls).toEqual([["t1"], [null]]);
  });
});
