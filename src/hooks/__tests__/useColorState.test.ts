// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useColorState } from "../useColorState";
import { DEFAULT_CANDIDATE_INDEX_BY_LEVEL, LEVEL_CANDIDATES } from "../../color-engine";
import { LEVEL_COUNT } from "../../constants";

// Provide a simple histogram (all zeros)
const emptyHist = new Array(LEVEL_COUNT).fill(0);
// Histogram with all levels used
const activeHist = new Array(LEVEL_COUNT).fill(100);

describe("useColorState", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initial candidateIndexByLevel matches DEFAULT_CANDIDATE_INDEX_BY_LEVEL", () => {
    const { result } = renderHook(() => useColorState(emptyHist));
    expect(result.current.candidateIndexByLevel).toEqual([...DEFAULT_CANDIDATE_INDEX_BY_LEVEL]);
  });

  it("initial locked array is all false with LEVEL_COUNT entries", () => {
    const { result } = renderHook(() => useColorState(emptyHist));
    expect(result.current.lockedLevels.length).toBe(LEVEL_COUNT);
    expect(result.current.lockedLevels.every((v) => v === false)).toBe(true);
  });

  it("toggleLevelLock toggles a single locked state", () => {
    const { result } = renderHook(() => useColorState(emptyHist));

    act(() => {
      result.current.toggleLevelLock(3);
    });
    expect(result.current.lockedLevels[3]).toBe(true);
    expect(result.current.lockedLevels[0]).toBe(false);

    // Toggle back
    act(() => {
      result.current.toggleLevelLock(3);
    });
    expect(result.current.lockedLevels[3]).toBe(false);
  });

  it("handleRandomize changes candidateIndexByLevel values (with Math.random mock)", () => {
    const { result } = renderHook(() => useColorState(activeHist));
    const originalColorChoiceIndices = [...result.current.candidateIndexByLevel];

    // Mock Math.random to return a predictable value
    vi.spyOn(Math, "random").mockReturnValue(0.99);

    act(() => {
      result.current.handleRandomize();
    });
    const newColorChoiceIndices = result.current.candidateIndexByLevel;

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
      result.current.toggleLevelLock(0);
    });
    const level0Before = result.current.candidateIndexByLevel[0];

    vi.spyOn(Math, "random").mockReturnValue(0.99);
    act(() => {
      result.current.handleRandomize();
    });

    expect(result.current.candidateIndexByLevel[0]).toBe(level0Before);
  });

  it("colorLUT is built from candidateIndexByLevel and has LEVEL_COUNT RGB tuples", () => {
    const { result } = renderHook(() => useColorState(emptyHist));
    expect(result.current.colorLUT.length).toBe(LEVEL_COUNT);
    for (const rgb of result.current.colorLUT) {
      expect(rgb.length).toBe(3);
      expect(typeof rgb[0]).toBe("number");
      expect(typeof rgb[1]).toBe("number");
      expect(typeof rgb[2]).toBe("number");
    }
  });

  it("candidateIndexDispatch with set_color changes a specific level", () => {
    const { result } = renderHook(() => useColorState(emptyHist));

    const lv = 0;
    const maxIdx = LEVEL_CANDIDATES[lv].length - 1;
    if (maxIdx > 0) {
      act(() => {
        result.current.candidateIndexDispatch({ type: "set_color", levelIndex: lv, candidateIndex: maxIdx });
      });
      expect(result.current.candidateIndexByLevel[lv]).toBe(maxIdx);
    }
  });

  it("handleUnlockAll resets all locks to false", () => {
    const { result } = renderHook(() => useColorState(emptyHist));

    act(() => {
      result.current.toggleLevelLock(1);
    });
    act(() => {
      result.current.toggleLevelLock(3);
    });
    expect(result.current.lockedLevels[1]).toBe(true);
    expect(result.current.lockedLevels[3]).toBe(true);

    act(() => {
      result.current.handleUnlockAll();
    });
    expect(result.current.lockedLevels.every((v) => v === false)).toBe(true);
  });
});
