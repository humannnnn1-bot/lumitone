/* ═══════════════════════════════════════════
   DESIGN TOKENS — centralized color, spacing,
   typography, radius, shadow, opacity, and z-index values
   ═══════════════════════════════════════════ */

/* ── Colors ── */
export const C = {
  // Backgrounds
  bgRoot: "#0a0a12",
  bgPanel: "#0f0f1a",
  bgPanelAlt: "#0f0f20",
  bgSurface: "#1a1a30",
  bgSurfaceAlt: "#1a1a3a",
  bgSurfaceHover: "#1a1a2a",
  bgInput: "#0a0a18",
  bgOverlay: "rgba(0,0,0,.6)",
  bgDrop: "rgba(64,128,255,.15)",
  bgModal: "#12122a",
  bgCode: "#0a0a1a",
  bgError: "#1a1a2e",

  // Borders
  border: "#2a2a40",
  borderAlt: "#2a2a4a",
  borderHover: "#3a3a5a",
  borderAccent: "#4060aa",

  // Primary / Accent
  accent: "#6080ff",
  accentBright: "#80a0ff",
  accentDim: "#3040aa",

  // Text
  textPrimary: "#c8c8d8",
  textSecondary: "#8a8aaa",
  textMuted: "#7a7aaa",
  textDim: "#6a6a8a",
  textDimmer: "#5a5a7a",
  textDimmest: "#7070a0",
  textSubtle: "#4a4a6a",
  textFaint: "#555580",
  textNavArrow: "#5a5a9a",
  textWhite: "#fff",

  // Semantic
  error: "#ff4060",
  success: "#40cc60",
  info: "#6080ff",
  warning: "#ffd700",

  // Feature-specific
  saveColor: "#70aa80",
  saveGlaze: "#aa90cc",
  saveSVG: "#aa80dd",
  copyBtn: "#80aacc",
  loadBtn: "#8090dd",
  errorBtnBg: "#4060c0",
  retryBtnBg: "#2a2a4a",

  // Active/Selected states (derived from accent)
  activeBg: "rgba(96,128,255,.08)",
  activeGlow: "rgba(96,128,255,.06)",

  // Title gradient
  titleGradient: "linear-gradient(90deg,#ff4060,#ff8040,#ffe040,#40ff60,#40e0ff,#8040ff)",

  // Canvas cursor colors (used in overlay drawing)
  cursorBrush: "rgba(255,255,255,.8)",
  cursorEraser: "rgba(255,100,100,.8)",
  cursorCross: "rgba(200,220,255,.7)",
  cursorShadow: "rgba(0,0,0,.5)",
  gridLine: "rgba(255,255,255,.08)",

  // SVG diagram accents
  svgFillFaint: "rgba(255,255,255,.04)",
  svgStrokeLight: "rgba(255,255,255,.3)",
  svgStrokeHover: "rgba(255,255,255,.4)",
} as const;

/* ── Hue rainbow gradient ── */
export const HUE_GRADIENT = "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)";

/* ── Spacing (2px base) ── */
export const SP = {
  xs: 2,
  sm: 3,
  md: 4,
  lg: 6,
  xl: 8,
  "2xl": 12,
  "3xl": 16,
  "4xl": 20,
  "5xl": 32,
} as const;

/* ── Typography ── */
export const FS = {
  xxs: 7,
  xs: 8,
  sm: 9,
  md: 10,
  lg: 11,
  xl: 12,
  "2xl": 14,
  title: 20,
} as const;

export const FW = {
  normal: 400,
  bold: 700,
} as const;

export const FONT = {
  mono: "monospace",
} as const;

/* ── Border Radius ── */
export const R = {
  sm: 2,
  md: 3,
  lg: 4,
  xl: 6,
  "2xl": 8,
} as const;

/* ── Duration / Easing ── */
export const DUR = {
  fast: ".1s",
  normal: ".15s",
  slow: ".25s",
} as const;

/* ── Shadows ── */
export const SHADOW = {
  toast: "0 4px 20px rgba(0,0,0,.5)",
  glow: (color: string) => `0 0 6px ${color}`,
} as const;

/* ── Opacity ── */
export const O = {
  disabled: 0.3,
  muted: 0.5,
  soft: 0.7,
  strong: 0.9,
} as const;

/* ── Z-Index ── */
export const Z = {
  cursorOverlay: 1,
  dropOverlay: 999,
  modal: 1000,
  toast: 2000,
} as const;
