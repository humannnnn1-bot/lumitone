import { useState, useReducer, useMemo, useCallback } from "react";
import { buildColorLUT, DEFAULT_COLOR_CHOICE_INDICES, LEVEL_CANDIDATES } from "../color-engine";
import { LEVEL_COUNT } from "../constants";
import { colorReducer } from "../state/color-reducer";

export function useColorState(hist: number[]) {
  const [colorChoiceIndices, colorChoiceDispatch] = useReducer(colorReducer, [...DEFAULT_COLOR_CHOICE_INDICES]);
  const [locked, setLocked] = useState<boolean[]>(new Array(LEVEL_COUNT).fill(false));

  const toggleLock = useCallback((lv: number) => {
    setLocked((prev) => {
      const n = [...prev];
      n[lv] = !n[lv];
      return n;
    });
  }, []);

  const handleRandomize = useCallback(() => {
    colorChoiceDispatch({ type: "randomize", locked, hist });
  }, [colorChoiceDispatch, locked, hist]);

  const handleUnlockAll = useCallback(() => {
    setLocked(new Array(LEVEL_COUNT).fill(false));
  }, []);

  const canRandomize = useMemo(() => LEVEL_CANDIDATES.some((alts, lv) => hist[lv] > 0 && !locked[lv] && alts.length > 1), [hist, locked]);

  const colorLUT = useMemo(() => buildColorLUT(colorChoiceIndices), [colorChoiceIndices]);

  const patternInfo = useMemo(() => {
    const allC: number[] = [];
    for (let lv = 0; lv < LEVEL_CANDIDATES.length; lv++) {
      const c = LEVEL_CANDIDATES[lv].length;
      allC.push(hist[lv] > 0 && !locked[lv] ? c : 1);
    }
    const total = allC.reduce((a, b) => a * b, 1);
    const expanded = allC.join("\u00d7");
    return { total, expanded, perLevel: allC };
  }, [hist, locked]);

  return {
    colorChoiceIndices,
    colorChoiceDispatch,
    locked,
    setLocked,
    toggleLock,
    handleRandomize,
    handleUnlockAll,
    canRandomize,
    colorLUT,
    patternInfo,
  };
}
