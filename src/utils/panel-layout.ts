import type React from "react";

const LANDSCAPE_CANVAS_OFFSET_RATIO = 0.12;
const LANDSCAPE_CANVAS_OFFSET_MAX = 72;

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

  const offset = Math.min(LANDSCAPE_CANVAS_OFFSET_MAX, Math.round((displayWidth - displayHeight) * LANDSCAPE_CANVAS_OFFSET_RATIO));
  return {
    ...style,
    "--canvas-landscape-offset": `${offset}px`,
  } as React.CSSProperties;
}
