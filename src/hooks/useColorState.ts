import { useState, useReducer, useMemo, useCallback } from "react";
import { buildColorLUT, DEFAULT_CC, LEVEL_CANDIDATES } from "../color-engine";
import { LEVEL_COUNT } from "../constants";
import { colorReducer } from "../color-reducer";

export function useColorState(hist: number[]) {
  const [cc, ccDispatch] = useReducer(colorReducer, [...DEFAULT_CC]);
  const [locked, setLocked] = useState<boolean[]>(new Array(LEVEL_COUNT).fill(false));

  const toggleLock = useCallback((lv: number) => {
    setLocked(prev => { const n = [...prev]; n[lv] = !n[lv]; return n; });
  }, []);

  const handleRandomize = useCallback(() => {
    ccDispatch({ type: "randomize", locked });
  }, [ccDispatch, locked]);

  const handleUnlockAll = useCallback(() => {
    setLocked(new Array(LEVEL_COUNT).fill(false));
  }, []);

  const colorLUT = useMemo(() => buildColorLUT(cc), [cc]);

  const patternInfo = useMemo(() => {
    const allC: number[] = [];
    for (let lv = 0; lv < LEVEL_CANDIDATES.length; lv++) {
      const c = LEVEL_CANDIDATES[lv].length;
      allC.push((hist[lv] > 0 && !locked[lv]) ? c : 1);
    }
    const total = allC.reduce((a, b) => a * b, 1);
    const expanded = allC.join("\u00d7");
    return { total, expanded };
  }, [hist, locked]);

  return {
    cc, ccDispatch,
    locked, setLocked,
    toggleLock, handleRandomize, handleUnlockAll,
    colorLUT, patternInfo,
  };
}
