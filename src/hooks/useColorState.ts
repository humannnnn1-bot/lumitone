import { useState, useReducer, useMemo, useCallback } from "react";
import { buildColorLUT, DEFAULT_CANDIDATE_INDEX_BY_LEVEL, LEVEL_CANDIDATES } from "../color-engine";
import { LEVEL_COUNT } from "../constants";
import { colorReducer } from "../state/color-reducer";

export function useColorState(levelHistogram: number[]) {
  const [candidateIndexByLevel, candidateIndexDispatch] = useReducer(colorReducer, [...DEFAULT_CANDIDATE_INDEX_BY_LEVEL]);
  const [lockedLevels, setLockedLevels] = useState<boolean[]>(new Array(LEVEL_COUNT).fill(false));

  const toggleLevelLock = useCallback((lv: number) => {
    setLockedLevels((prev) => {
      const n = [...prev];
      n[lv] = !n[lv];
      return n;
    });
  }, []);

  const handleRandomize = useCallback(() => {
    candidateIndexDispatch({ type: "randomize", lockedLevels, levelHistogram });
  }, [candidateIndexDispatch, lockedLevels, levelHistogram]);

  const handleUnlockAll = useCallback(() => {
    setLockedLevels(new Array(LEVEL_COUNT).fill(false));
  }, []);

  const canRandomize = useMemo(
    () => LEVEL_CANDIDATES.some((alts, lv) => levelHistogram[lv] > 0 && !lockedLevels[lv] && alts.length > 1),
    [levelHistogram, lockedLevels],
  );

  const colorLUT = useMemo(() => buildColorLUT(candidateIndexByLevel), [candidateIndexByLevel]);

  const patternInfo = useMemo(() => {
    const allC: number[] = [];
    for (let lv = 0; lv < LEVEL_CANDIDATES.length; lv++) {
      const c = LEVEL_CANDIDATES[lv].length;
      allC.push(levelHistogram[lv] > 0 && !lockedLevels[lv] ? c : 1);
    }
    const total = allC.reduce((a, b) => a * b, 1);
    const expanded = allC.join("\u00d7");
    return { total, expanded, perLevel: allC };
  }, [levelHistogram, lockedLevels]);

  return {
    candidateIndexByLevel,
    candidateIndexDispatch,
    lockedLevels,
    setLockedLevels,
    toggleLevelLock,
    handleRandomize,
    handleUnlockAll,
    canRandomize,
    colorLUT,
    patternInfo,
  };
}
