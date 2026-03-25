import { LEVEL_CANDIDATES } from "./color-engine";

export type ColorAction =
  | { type: "set_color"; lv: number; idx: number }
  | { type: "cycle_color"; lv: number; dir: number }
  | { type: "randomize"; locked?: boolean[] }
  | { type: "load_all"; values: number[] };

export function colorReducer(state: number[], action: ColorAction): number[] {
  switch (action.type) {
    case "set_color": {
      if (action.lv < 0 || action.lv >= LEVEL_CANDIDATES.length) return state;
      const alts = LEVEL_CANDIDATES[action.lv];
      if (action.idx < 0 || action.idx >= alts.length) return state;
      const n = [...state]; n[action.lv] = action.idx; return n;
    }
    case "cycle_color": {
      if (action.lv < 0 || action.lv >= LEVEL_CANDIDATES.length) return state;
      const a = LEVEL_CANDIDATES[action.lv]; if (a.length <= 1) return state;
      const n = [...state];
      n[action.lv] = ((n[action.lv] + action.dir) % a.length + a.length) % a.length;
      return n;
    }
    case "randomize": {
      const locked = action.locked;
      return LEVEL_CANDIDATES.map((alts, lv) => {
        if (locked?.[lv]) return state[lv];
        return alts.length <= 1 ? 0 : (Math.random() * alts.length | 0) % alts.length;
      });
    }
    case "load_all": {
      if (!Array.isArray(action.values) || action.values.length !== LEVEL_CANDIDATES.length) return state;
      return LEVEL_CANDIDATES.map((alts, lv) => {
        const idx = action.values[lv];
        return (typeof idx === "number" && idx >= 0 && idx < alts.length) ? idx : 0;
      });
    }
    default: return state;
  }
}
