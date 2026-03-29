import type React from "react";
import { MIN_TAP_SIZE } from "./constants";
import { C, SP, FS, FW, R, DUR } from "./tokens";

/* ═══════════════════════════════════════════
   SHARED STYLES
   ═══════════════════════════════════════════ */
export const S_CHECKERBOARD: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg, #1a1a2a 25%, transparent 25%), linear-gradient(-45deg, #1a1a2a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1a1a2a 75%), linear-gradient(-45deg, transparent 75%, #1a1a2a 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
  backgroundColor: "#12122a",
};
export const S_BTN: React.CSSProperties = {
  padding: `${SP.xs}px ${SP.lg}px`,
  fontSize: FS.lg,
  border: `1px solid ${C.border}`,
  background: C.bgPanel,
  color: C.textMuted,
  borderRadius: R.lg,
  cursor: "pointer",
  transition: `background ${DUR.fast}, border-color ${DUR.fast}, color ${DUR.fast}`,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};
export const S_BTN_ACTIVE: React.CSSProperties = {
  ...S_BTN,
  border: `1px solid ${C.accent}`,
  background: C.bgSurfaceAlt,
  color: C.accentBright,
  fontWeight: FW.bold,
};
export const S_BTN_SM: React.CSSProperties = { ...S_BTN, padding: `${SP.xs}px ${SP.md}px`, fontSize: FS.md };
export const S_BTN_SM_ACTIVE: React.CSSProperties = { ...S_BTN_ACTIVE, padding: `${SP.xs}px ${SP.md}px`, fontSize: FS.md };
export const S_NAV_ARROW: React.CSSProperties = {
  background: "none",
  border: "none",
  color: C.textNavArrow,
  cursor: "pointer",
  fontSize: 16,
  minWidth: MIN_TAP_SIZE,
  minHeight: MIN_TAP_SIZE,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
export const S_TAB_ACTIVE: React.CSSProperties = {
  padding: `${SP.md}px ${SP.xl}px`,
  fontSize: FS.xl,
  fontWeight: FW.bold,
  border: `1px solid ${C.accent}`,
  background: C.bgSurfaceAlt,
  color: C.accentBright,
  borderRadius: `${R.lg}px ${R.lg}px 0 0`,
  cursor: "pointer",
  borderBottom: `1px solid ${C.bgSurfaceAlt}`,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};
export const S_TAB_INACTIVE: React.CSSProperties = {
  padding: `${SP.md}px ${SP.xl}px`,
  fontSize: FS.xl,
  fontWeight: FW.normal,
  border: `1px solid ${C.border}`,
  background: C.bgPanel,
  color: C.textDimmer,
  borderRadius: `${R.lg}px ${R.lg}px 0 0`,
  cursor: "pointer",
  borderBottom: `1px solid ${C.border}`,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};
export const S_SWATCH: React.CSSProperties = { borderRadius: R.md, cursor: "pointer", padding: 0, background: "none" };
