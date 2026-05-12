// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useColorState } from "../useColorState";
import { DEFAULT_COLOR_CHOICE_INDICES, LEVEL_CANDIDATES } from "../../color-engine";
import { LEVEL_COUNT } from "../../constants";

// Provide a simple histogram (all zeros)
const emptyHist = new Array(LEVEL_COUNT).fill(0);
// Histogram with all levels used
const activeHist = new Array(LEVEL_COUNT).fill(100);

describe("useColorState", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initial colorChoiceIndices matches DEFAULT_COLOR_CHOICE_INDICES", () => {
    const { result } = renderHook(() => useColorState(emptyHist));
    expect(result.current.colorChoiceIndices).toEqual([...DEFAULT_COLOR_CHOICE_INDICES]);
  });

  it("initial locked array is all false with LEVEL_COUNT entries", () => {
    const { result } = renderHook(() => useColorState(emptyHist));
    expect(result.current.locked.length).toBe(LEVEL_COUNT);
    expect(result.current.locked.every((v) => v === false)).toBe(true);
  });

  it("toggleLock toggles a single locked state", () => {
    const { result } = renderHook(() => useColorState(emptyHist));

    act(() => {
      result.current.toggleLock(3);
    });
    expect(result.current.locked[3]).toBe(true);
    expect(result.current.locked[0]).toBe(false);

    // Toggle back
    act(() => {
      result.current.toggleLock(3);
    });
    expect(result.current.locked[3]).toBe(false);
  });

  it("handleRandomize changes colorChoiceIndices values (with Math.random mock)", () => {
    const { result } = renderHook(() => useColorState(activeHist));
    const originalColorChoiceIndices = [...result.current.colorChoiceIndices];

    // Mock Math.random to return a predictable value
    vi.spyOn(Math, "random").mockReturnValue(0.99);

    act(() => {
      result.current.handleRandomize();
    });
    const newColorChoiceIndices = result.current.colorChoiceIndices;

    // At least some levels with multiple candidates should change
    const hasMultiple = LEVEL_CANDIDATES.some((alts) => alts.length > 1);
    if (hasMultiple) {
      expect(newColorChoiceIndices).not.toEqual(originalColorChoiceIndices);
    }
  });

  it("handleRandomize respects locked levels", () => {
    const { result } = renderHook(() => useColorState(emptyHist));

    // Lock level 0
    act(() => {
      result.current.toggleLock(0);
    });
    const level0Before = result.current.colorChoiceIndices[0];

    vi.spyOn(Math, "random").mockReturnValue(0.99);
    act(() => {
      result.current.handleRandomize();
    });

    expect(result.current.colorChoiceIndices[0]).toBe(level0Before);
  });

  it("colorLUT is built from colorChoiceIndices and has LEVEL_COUNT RGB tuples", () => {
    const { result } = renderHook(() => useColorState(emptyHist));
    expect(result.current.colorLUT.length).toBe(LEVEL_COUNT);
    for (const rgb of result.current.colorLUT) {
      expect(rgb.length).toBe(3);
      expect(typeof rgb[0]).toBe("number");
      expect(typeof rgb[1]).toBe("number");
      expect(typeof rgb[2]).toBe("number");
    }
  });

  it("colorChoiceDispatch with set_color changes a specific level", () => {
    const { result } = renderHook(() => useColorState(emptyHist));

    const lv = 0;
    const maxIdx = LEVEL_CANDIDATES[lv].length - 1;
    if (maxIdx > 0) {
      act(() => {
        result.current.colorChoiceDispatch({ type: "set_color", levelIndex: lv, candidateIndex: maxIdx });
      });
      expect(result.current.colorChoiceIndices[lv]).toBe(maxIdx);
    }
  });

  it("handleUnlockAll resets all locks to false", () => {
    const { result } = renderHook(() => useColorState(emptyHist));

    act(() => {
      result.current.toggleLock(1);
    });
    act(() => {
      result.current.toggleLock(3);
    });
    expect(result.current.locked[1]).toBe(true);
    expect(result.current.locked[3]).toBe(true);

    act(() => {
      result.current.handleUnlockAll();
    });
    expect(result.current.locked.every((v) => v === false)).toBe(true);
  });
});
