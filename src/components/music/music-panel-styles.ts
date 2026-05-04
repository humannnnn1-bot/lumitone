import type { CSSProperties } from "react";
import { C, FS, R, SP, HUE_GRADIENT, FONT } from "../../styles/tokens";
import { S_BTN_SM, S_BTN_SM_ACTIVE } from "../../styles/shared";

const MUSIC_CARD_LABEL_FONT_SIZE = `var(--music-card-label-fs, ${FS.lg}px)`;
const MUSIC_CARD_SELECT_FONT_SIZE = `var(--music-card-select-fs, ${FS.lg}px)`;
const MUSIC_CARD_SELECT_PADDING = "var(--music-card-select-padding, 2px 4px)";
const MUSIC_CARD_PADDING = "var(--music-card-padding, 6px)";
const MUSIC_CARD_GAP = "var(--music-card-gap, 4px)";
const MUSIC_CARD_CONTROL_GAP = `var(--music-card-control-gap, ${SP.sm}px)`;

export const S_ROW: CSSProperties = {
  display: "flex",
  gap: MUSIC_CARD_CONTROL_GAP,
  alignItems: "center",
  flexWrap: "wrap",
  justifyContent: "center",
};

export const S_LABEL: CSSProperties = {
  fontSize: MUSIC_CARD_LABEL_FONT_SIZE,
  color: C.textDim,
  whiteSpace: "nowrap",
};

export const S_SELECT: CSSProperties = {
  fontSize: MUSIC_CARD_SELECT_FONT_SIZE,
  padding: MUSIC_CARD_SELECT_PADDING,
  background: C.bgPanel,
  color: C.textPrimary,
  border: `1px solid ${C.border}`,
  borderRadius: R.md,
};

export const S_MUSIC_MODE_BTN: CSSProperties = {
  ...S_BTN_SM,
  boxSizing: "border-box",
  height: 22,
  padding: `${SP.sm}px ${SP.md}px`,
  whiteSpace: "nowrap",
};

export const S_MUSIC_MODE_BTN_ACTIVE: CSSProperties = {
  ...S_BTN_SM_ACTIVE,
  boxSizing: "border-box",
  height: 22,
  padding: `${SP.sm}px ${SP.md}px`,
  whiteSpace: "nowrap",
};

export const S_HUE_WRAP: CSSProperties = { position: "relative", width: "100%", paddingTop: SP.xl };

export const S_ALPHA_TRACK: CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  height: 16,
  borderRadius: R.lg,
  background: `linear-gradient(90deg, ${C.accent}33, ${C.accent}, ${C.accent}33)`,
  cursor: "pointer",
  border: `1px solid ${C.border}`,
};

export const S_HUE_TRACK: CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  height: 16,
  borderRadius: R.lg,
  background: HUE_GRADIENT,
  cursor: "pointer",
  border: `1px solid ${C.border}`,
};

export const S_HUE_INPUT: CSSProperties = {
  position: "absolute",
  boxSizing: "border-box",
  top: 8,
  left: 0,
  width: "100%",
  height: 16,
  margin: 0,
  opacity: 0,
  cursor: "pointer",
};

export const S_SECTION: CSSProperties = {
  background: "rgba(96, 128, 255, 0.06)",
  border: "none",
  borderLeft: `2px solid ${C.accent}`,
  padding: "6px 12px",
  fontSize: FS.lg,
  letterSpacing: "0.08em",
  color: C.textDim,
  fontFamily: FONT.mono,
  width: "100%",
  boxSizing: "border-box",
};

const S_CARD: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: MUSIC_CARD_GAP,
  padding: MUSIC_CARD_PADDING,
  boxSizing: "border-box",
  borderRadius: R.lg,
  border: `1px solid ${C.border}`,
  background: "rgba(255,255,255,0.02)",
  aspectRatio: "3 / 4",
};

export const S_CARD_ALGEBRA: CSSProperties = { ...S_CARD, borderTop: "2px solid #c0a040" };
export const S_CARD_CODE: CSSProperties = { ...S_CARD, borderTop: "2px solid #4060c0" };
export const S_CARD_CUBE: CSSProperties = { ...S_CARD, borderTop: "2px solid #40a0a0" };
export const S_CARD_POLY: CSSProperties = { ...S_CARD, borderTop: "2px solid #40a060" };
export const S_CARD_SYM: CSSProperties = { ...S_CARD, borderTop: "2px solid #8040c0" };
export const S_CARD_LUMA: CSSProperties = { ...S_CARD, borderTop: "2px solid #c04060" };
