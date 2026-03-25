import type React from "react";
import { MIN_TAP_SIZE } from "./constants";
import { C, SP, FS, FW, R, DUR } from "./tokens";

/* ═══════════════════════════════════════════
   SHARED STYLES
   ═══════════════════════════════════════════ */
export const S_BTN: React.CSSProperties = { padding: `${SP.md}px ${SP.xl}px`, fontSize: FS.lg, border: `1px solid ${C.border}`, background: C.bgPanel, color: C.textMuted, borderRadius: R.lg, cursor: "pointer", transition: `background ${DUR.fast}, border-color ${DUR.fast}, color ${DUR.fast}`, minHeight: MIN_TAP_SIZE };
export const S_BTN_ACTIVE: React.CSSProperties = { ...S_BTN, border: `1px solid ${C.accent}`, background: C.bgSurfaceAlt, color: C.accentBright, fontWeight: FW.bold };
export const S_BTN_SM: React.CSSProperties = { ...S_BTN, padding: `${SP.xs}px ${SP.xl}px`, fontSize: FS.md };
export const S_BTN_SM_ACTIVE: React.CSSProperties = { ...S_BTN_ACTIVE, padding: `${SP.xs}px ${SP.xl}px`, fontSize: FS.md };
export const S_NAV_ARROW: React.CSSProperties = { background: "none", border: "none", color: C.textNavArrow, cursor: "pointer", fontSize: 16, minWidth: MIN_TAP_SIZE, minHeight: MIN_TAP_SIZE, display: "flex", alignItems: "center", justifyContent: "center" };
export const S_TAB_ACTIVE: React.CSSProperties = {
  padding: `5px ${SP["2xl"]}px`, fontSize: FS.lg, fontWeight: FW.bold,
  border: `1px solid ${C.accent}`, background: C.bgSurfaceAlt, color: C.accentBright,
  borderRadius: `${R.lg}px ${R.lg}px 0 0`, cursor: "pointer", borderBottom: `1px solid ${C.bgSurfaceAlt}`,
};
export const S_TAB_INACTIVE: React.CSSProperties = {
  padding: `5px ${SP["2xl"]}px`, fontSize: FS.lg, fontWeight: FW.normal,
  border: `1px solid ${C.border}`, background: C.bgPanel, color: C.textDimmer,
  borderRadius: `${R.lg}px ${R.lg}px 0 0`, cursor: "pointer", borderBottom: `1px solid ${C.border}`,
};
export const S_SWATCH: React.CSSProperties = { borderRadius: R.md, cursor: "pointer", padding: 0, background: "none" };
