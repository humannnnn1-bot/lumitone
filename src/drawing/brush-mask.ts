import type { DirtyRect } from "../types";

export interface BrushMaskOffset {
  dx: number;
  dy: number;
}

export interface BrushMask {
  size: number;
  offsets: readonly BrushMaskOffset[];
  keys: ReadonlySet<string>;
  minDx: number;
  maxDx: number;
  minDy: number;
  maxDy: number;
}

const maskCache = new Map<number, BrushMask>();

function offsetKey(dx: number, dy: number): string {
  return `${dx},${dy}`;
}

export function getBrushMask(size: number): BrushMask {
  const normalized = Math.max(1, Math.round(Number.isFinite(size) ? size : 1));
  const cached = maskCache.get(normalized);
  if (cached) return cached;

  const min = Math.floor((1 - normalized) / 2) + (normalized % 2 === 0 ? 1 : 0);
  const max = min + normalized - 1;
  const center = (min + max) / 2;
  const radius = normalized === 1 ? 0 : normalized / 2 - 0.25;
  const radiusSq = radius * radius;
  const offsets: BrushMaskOffset[] = [];
  const keys = new Set<string>();

  for (let dy = min; dy <= max; dy++) {
    for (let dx = min; dx <= max; dx++) {
      const cx = dx - center;
      const cy = dy - center;
      if (cx * cx + cy * cy > radiusSq) continue;
      offsets.push({ dx, dy });
      keys.add(offsetKey(dx, dy));
    }
  }

  const mask: BrushMask = {
    size: normalized,
    offsets,
    keys,
    minDx: min,
    maxDx: max,
    minDy: min,
    maxDy: max,
  };
  maskCache.set(normalized, mask);
  return mask;
}

export function brushMaskHas(mask: BrushMask, dx: number, dy: number): boolean {
  return mask.keys.has(offsetKey(dx, dy));
}

export function forEachBrushPixel(
  mask: BrushMask,
  cx: number,
  cy: number,
  w: number,
  h: number,
  write: (x: number, y: number) => void,
): void {
  for (const { dx, dy } of mask.offsets) {
    const x = cx + dx;
    const y = cy + dy;
    if (x >= 0 && x < w && y >= 0 && y < h) write(x, y);
  }
}

export function brushMaskBBox(pts: [number, number][], mask: BrushMask, w: number, h: number): DirtyRect | null {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [px, py] of pts) {
    minX = Math.min(minX, px + mask.minDx);
    maxX = Math.max(maxX, px + mask.maxDx);
    minY = Math.min(minY, py + mask.minDy);
    maxY = Math.max(maxY, py + mask.maxDy);
  }
  minX = Math.max(0, minX);
  minY = Math.max(0, minY);
  maxX = Math.min(w - 1, maxX);
  maxY = Math.min(h - 1, maxY);
  if (maxX < minX || maxY < minY) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

export function shapeMaskBBox(x0: number, y0: number, x1: number, y1: number, mask: BrushMask, w: number, h: number): DirtyRect | null {
  let minX = Math.min(x0, x1) + mask.minDx;
  let maxX = Math.max(x0, x1) + mask.maxDx;
  let minY = Math.min(y0, y1) + mask.minDy;
  let maxY = Math.max(y0, y1) + mask.maxDy;
  minX = Math.max(0, minX);
  minY = Math.max(0, minY);
  maxX = Math.min(w - 1, maxX);
  maxY = Math.min(h - 1, maxY);
  if (maxX < minX || maxY < minY) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}
