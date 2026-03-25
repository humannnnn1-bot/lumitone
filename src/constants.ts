/* ═══════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════ */
export const W0 = 320, H0 = 320;
export const MAX_UNDO = 40;
export const DISPLAY_MAX = 320;  // legacy default, used as fallback
export const DISPLAY_MIN = 280;
export const DISPLAY_MAX_LIMIT = 960;
export const ZOOM_MIN = 0.25, ZOOM_MAX = 16, ZOOM_STEP = 1.15;
export const BRUSH_MIN = 1, BRUSH_MAX = 60, BRUSH_STEP = 2;
export const MAX_IMAGE_SIZE = 1024;
export const GRID_ZOOM_THRESHOLD = 4;
export const MIN_TAP_SIZE = 28;
export const TOAST_DURATION = 2500;

/* ═══════════════════════════════════════════
   MODULE-LEVEL CONSTANTS (early, used by HEX data)
   ═══════════════════════════════════════════ */
export const LEVEL_COUNT = 8;      /* number of luminance levels */
export const LEVEL_MASK = 7;       /* 3-bit mask for 8 levels (0-7) */
export const NUM_VERTICES = 6;    /* hexagon vertex count */

/* ═══════════════════════════════════════════
   TOOLS DEFINITION
   ═══════════════════════════════════════════ */
export type ToolId = "brush" | "eraser" | "fill" | "line" | "rect" | "ellipse";

export interface ToolDef {
  id: ToolId;
  key: string;
  shape: boolean;
}

export const TOOLS: ToolDef[] = [
  { id: "brush",   key: "B", shape: false },
  { id: "eraser",  key: "E", shape: false },
  { id: "fill",    key: "F", shape: false },
  { id: "line",    key: "L", shape: true  },
  { id: "rect",    key: "R", shape: true  },
  { id: "ellipse", key: "O", shape: true  },
];

export const SHAPE_TOOL_SET = new Set(TOOLS.filter(t => t.shape).map(t => t.id));
export const isShapeTool = (t: ToolId): boolean => SHAPE_TOOL_SET.has(t);

export type GlazeToolId = "glaze_brush" | "glaze_eraser" | "glaze_fill";
