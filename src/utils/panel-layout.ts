import type React from "react";

const LANDSCAPE_CANVAS_OFFSET_RATIO = 0.12;
export const LANDSCAPE_CANVAS_BASE_OFFSET_MAX = 12;
const ULTRA_WIDE_CANVAS_ASPECT_THRESHOLD = 3;
const ULTRA_WIDE_CANVAS_OFFSET_STEP = 12;
const ULTRA_WIDE_CANVAS_OFFSET_MAX = 48;

function getDisplayAspect(displayWidth: number, displayHeight: number): number {
  return Math.max(1, displayWidth) / Math.max(1, displayHeight);
}

export function getPanelLayoutClassName(displayWidth: number, displayHeight: number): string {
  const aspect = getDisplayAspect(displayWidth, displayHeight);
  if (aspect <= 0.7) return "panel-layout panel-layout--tall-portrait";
  if (aspect < 1) return "panel-layout panel-layout--portrait";
  return "panel-layout";
}

export function getCanvasPanelClassName(displayWidth: number, displayHeight: number): string {
  return displayWidth > displayHeight ? "panel-canvas panel-canvas--landscape" : "panel-canvas";
}

export function getCanvasPanelStyle(displayWidth: number, displayHeight: number): React.CSSProperties {
  const style = { "--display-max": `${displayWidth}px` } as React.CSSProperties;
  if (displayWidth <= displayHeight) return style;

  const aspect = getDisplayAspect(displayWidth, displayHeight);
  const baseOffset = Math.min(LANDSCAPE_CANVAS_BASE_OFFSET_MAX, Math.round((displayWidth - displayHeight) * LANDSCAPE_CANVAS_OFFSET_RATIO));
  const ultraWideOffset =
    aspect > ULTRA_WIDE_CANVAS_ASPECT_THRESHOLD
      ? Math.min(ULTRA_WIDE_CANVAS_OFFSET_MAX, Math.round((aspect - ULTRA_WIDE_CANVAS_ASPECT_THRESHOLD) * ULTRA_WIDE_CANVAS_OFFSET_STEP))
      : 0;

  return {
    ...style,
    "--canvas-landscape-offset": `${baseOffset + ultraWideOffset}px`,
  } as React.CSSProperties;
}
