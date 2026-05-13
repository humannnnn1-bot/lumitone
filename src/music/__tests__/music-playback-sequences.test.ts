import { describe, expect, it } from "vitest";
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
  weightSpectrumTimeline,
  zigzagStep,
} from "../music-playback-sequences";

describe("music-playback-sequences", () => {
  it("builds Fano complement and line/complement pairings", () => {
    expect(complementOfLine(0)).toEqual([4, 5, 6, 7]);
    expect(lineAndComplement(0)).toEqual({ line: [1, 2, 3], complement: [4, 5, 6, 7] });
    expect(complementOfLine(-1)).toBeNull();
  });

  it("builds syndrome demo phases and parity levels", () => {
    const events = syndromeDemoEvents(5);

    expect(events[0]).toEqual({ at: 0, type: "phase", phase: "original" });
    expect(events.some((event) => event.type === "tone" && event.lv === 5 && event.errorMarker)).toBe(true);
    expect(events).toContainEqual({ at: 3400, type: "parity", levels: [1, 4] });
    expect(events[events.length - 1]).toEqual({ at: 5600, type: "phase", phase: null });
    expect(syndromeDemoEvents(0)).toEqual([]);
  });

  it("maps every error position to the matching syndrome parity tones", () => {
    const expected = [
      { errorPos: 1, levels: [1] },
      { errorPos: 2, levels: [2] },
      { errorPos: 3, levels: [1, 2] },
      { errorPos: 4, levels: [4] },
      { errorPos: 5, levels: [1, 4] },
      { errorPos: 6, levels: [2, 4] },
      { errorPos: 7, levels: [1, 2, 4] },
    ];

    for (const { errorPos, levels } of expected) {
      const events = syndromeDemoEvents(errorPos);

      expect(events).toContainEqual({ at: 1700 + (errorPos - 1) * 200, type: "tone", lv: errorPos, errorMarker: true });
      expect(events).toContainEqual({ at: 3400, type: "parity", levels });
    }
  });

  it("builds weight spectrum and extended Hamming timelines", () => {
    const weight = weightSpectrumTimeline();
    const extended = extendedHammingTimeline();

    expect(weight).toHaveLength(16);
    expect(weight[0]).toEqual({ at: 0, positions: [], weight: 0, index: 0 });
    expect(weight[weight.length - 1]).toEqual({ at: 6100, positions: [1, 2, 3, 4, 5, 6, 7], weight: 7, index: 15 });
    expect(extended).toHaveLength(16);
    expect(extended[extended.length - 1]).toEqual({ at: 5400, positions: [0, 1, 2, 3, 4, 5, 6, 7], weight: 8, index: 15 });
  });

  it("builds reusable algebraic playback sequences", () => {
    expect(complementCanonPairs(true).map((event) => event.pairIndex)).toEqual([2, 1, 0]);
    expect(zigzagStep(9)).toEqual({ index: 3, lv: 5 });
    expect(pointFanoContextLines(1)).toEqual([0, 1, 3]);

    expect(distributiveEvents(5, 3, 6)).toEqual([
      { at: 0, phase: "bxc", value: 5, play: [5] },
      { at: 400, phase: "left", value: 5, play: [5] },
      { at: 1000, phase: "ab", value: 1, play: [1] },
      { at: 1400, phase: "ac", value: 4, play: [4] },
      { at: 1800, phase: "right", value: 5, play: [5] },
      { at: 2400, phase: "equal", value: 5, play: [5, 5] },
      { at: 2900, phase: null, value: -1, play: [] },
    ]);

    const andEvents = andTriadEvents();
    expect(andEvents[andEvents.length - 1]).toEqual({ at: 2580, step: null, play: [] });
    expect(octahedronMixSequence(1, 2)?.events).toEqual([
      { at: 0, phase: "pair", play: [1, 2] },
      { at: 480, phase: "result", play: [3] },
      { at: 920, phase: null, play: [] },
    ]);
    expect(octahedronMixSequence(1, 1)).toBeNull();
  });

  it("builds K8 layer sequences", () => {
    expect(k8LayerStep(3, 0).intervalMs).toBe(520);
    expect(k8LayerStep(1, 0).intervalMs).toBe(280);
  });
});
