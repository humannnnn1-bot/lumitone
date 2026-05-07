import type { Point } from "../types";

const STROKE_SMOOTHING_ALPHA = 0.72;
const STROKE_SMOOTHING_MAX_LAG = 0.8;
const STROKE_SMOOTHING_MAX_LAG_SQ = STROKE_SMOOTHING_MAX_LAG * STROKE_SMOOTHING_MAX_LAG;

export interface StrokeSmoother {
  x: number;
  y: number;
}

export function createStrokeSmoother(start: Point): StrokeSmoother {
  return { x: start.x, y: start.y };
}

export function smoothStrokePoint(smoother: StrokeSmoother, raw: Point): Point {
  if (!Number.isFinite(smoother.x) || !Number.isFinite(smoother.y) || !Number.isFinite(raw.x) || !Number.isFinite(raw.y)) {
    smoother.x = raw.x;
    smoother.y = raw.y;
    return raw;
  }

  let x = smoother.x + (raw.x - smoother.x) * STROKE_SMOOTHING_ALPHA;
  let y = smoother.y + (raw.y - smoother.y) * STROKE_SMOOTHING_ALPHA;
  const lagX = raw.x - x;
  const lagY = raw.y - y;
  const lagSq = lagX * lagX + lagY * lagY;

  if (lagSq > STROKE_SMOOTHING_MAX_LAG_SQ) {
    const lag = Math.sqrt(lagSq);
    x = raw.x - (lagX / lag) * STROKE_SMOOTHING_MAX_LAG;
    y = raw.y - (lagY / lag) * STROKE_SMOOTHING_MAX_LAG;
  }

  smoother.x = x;
  smoother.y = y;
  return { x: Math.round(x), y: Math.round(y) };
}
