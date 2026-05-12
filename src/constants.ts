/* ═══════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════ */
export const DEFAULT_CANVAS_WIDTH = 320,
  DEFAULT_CANVAS_HEIGHT = 320;
export const MAX_UNDO = 40;
export const DISPLAY_MIN = 280;
export const DISPLAY_MAX_LIMIT = 1600;
export const ZOOM_MIN = 0.25,
  ZOOM_MAX = 16,
  ZOOM_STEP = 1.15;
export const BRUSH_MIN = 1,
  BRUSH_MAX = 100,
  BRUSH_STEP = 1;
const DEFAULT_BRUSH_SIZE = 12;
export const MAX_IMAGE_SIZE = 2048;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 50_000_000;
export const GRID_ZOOM_THRESHOLD = 4;
export const MIN_TAP_SIZE = 44;
export const TOAST_DURATION = 2500;
/* ═══════════════════════════════════════════
   MODULE-LEVEL CONSTANTS (early, used by HEX data)
   ═══════════════════════════════════════════ */
export const LEVEL_COUNT = 8; /* number of luminance levels */
export const LEVEL_MASK = 7; /* 3-bit mask for 8 levels (0-7) */
export const NUM_VERTICES = 6; /* hexagon vertex count */

/* ═══════════════════════════════════════════
   TOOLS DEFINITION
   ═══════════════════════════════════════════ */
export type ToolId = "brush" | "eraser" | "fill" | "line" | "rect" | "ellipse";

interface ToolDef {
  readonly id: ToolId;
  readonly key: string;
  readonly shape: boolean;
}

export const TOOLS = [
  { id: "brush", key: "B", shape: false },
  { id: "eraser", key: "E", shape: false },
  { id: "fill", key: "F", shape: false },
  { id: "line", key: "L", shape: true },
  { id: "rect", key: "R", shape: true },
  { id: "ellipse", key: "O", shape: true },
] as const satisfies readonly ToolDef[];

const SHAPE_TOOL_SET: ReadonlySet<ToolId> = new Set(TOOLS.filter((t) => t.shape).map((t) => t.id));
export const isShapeTool = (t: ToolId): boolean => SHAPE_TOOL_SET.has(t);

export type GlazeToolId = "glaze_brush" | "glaze_eraser" | "glaze_fill";

export function isAllowedCanvasSize(w: number, h: number): boolean {
  if (!Number.isInteger(w) || !Number.isInteger(h) || w <= 0 || h <= 0) return false;
  return w <= MAX_IMAGE_SIZE && h <= MAX_IMAGE_SIZE;
}

export function defaultBrushSizeForCanvas(w: number, h: number): number {
  const shortEdge = Math.max(1, Math.min(w, h));
  const size = Math.round((shortEdge * DEFAULT_BRUSH_SIZE) / DEFAULT_CANVAS_WIDTH);
  return Math.max(BRUSH_MIN, Math.min(BRUSH_MAX, size));
}
