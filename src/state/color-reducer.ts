import { LEVEL_CANDIDATES } from "../color-engine";

export type ColorAction =
  | { type: "set_color"; levelIndex: number; candidateIndex: number }
  | { type: "cycle_color"; levelIndex: number; direction: number }
  | { type: "randomize"; lockedLevels?: boolean[]; levelHistogram?: number[] }
  | { type: "load_all"; values: number[] };

export function colorReducer(state: number[], action: ColorAction): number[] {
  switch (action.type) {
    case "set_color": {
      if (action.levelIndex < 0 || action.levelIndex >= LEVEL_CANDIDATES.length) return state;
      const alts = LEVEL_CANDIDATES[action.levelIndex];
      if (action.candidateIndex < 0 || action.candidateIndex >= alts.length) return state;
      const n = [...state];
      n[action.levelIndex] = action.candidateIndex;
      return n;
    }
    case "cycle_color": {
      if (action.levelIndex < 0 || action.levelIndex >= LEVEL_CANDIDATES.length) return state;
      const a = LEVEL_CANDIDATES[action.levelIndex];
      if (a.length <= 1) return state;
      const n = [...state];
      n[action.levelIndex] = (((n[action.levelIndex] + action.direction) % a.length) + a.length) % a.length;
      return n;
    }
    case "randomize": {
      const lockedLevels = action.lockedLevels;
      const levelHistogram = action.levelHistogram;
      return LEVEL_CANDIDATES.map((alts, lv) => {
        if (lockedLevels?.[lv]) return state[lv];
        if (levelHistogram && levelHistogram[lv] === 0) return state[lv];
        return alts.length <= 1 ? 0 : ((Math.random() * alts.length) | 0) % alts.length;
      });
    }
    case "load_all": {
      if (!Array.isArray(action.values) || action.values.length !== LEVEL_CANDIDATES.length) return state;
      return LEVEL_CANDIDATES.map((alts, lv) => {
        const idx = action.values[lv];
        return typeof idx === "number" && idx >= 0 && idx < alts.length ? idx : 0;
      });
    }
    default:
      return state;
  }
}
