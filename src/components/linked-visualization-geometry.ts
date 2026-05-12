import { LEVEL_CANDIDATES, LEVEL_INFO, findClosestCandidate } from "../color-engine";

export interface LinkedVisualizationDot {
  levelIndex: number;
  candidateIndex: number;
  angleDeg: number;
  rgb: readonly [number, number, number];
  isActive: boolean;
}

export interface LinkedVisualizationHover {
  levelIndex: number;
  candidateIndex: number;
}

interface LinkedVisualizationPoint {
  x: number;
  y: number;
}

const LINKED_VIZ_LAYOUT = {
  WR: 58,
  WO: 18,
  WCX: 68,
  WCY: 68,
  RING_R: 70,
  GRAPH_GAP: 8,
  RW: 170,
  BH: 170,
} as const;

export const WR = LINKED_VIZ_LAYOUT.WR;
export const WO = LINKED_VIZ_LAYOUT.WO;
export const RW = LINKED_VIZ_LAYOUT.RW;
export const BH = LINKED_VIZ_LAYOUT.BH;
export const CX = WO + LINKED_VIZ_LAYOUT.WCX;
export const CY = WO + LINKED_VIZ_LAYOUT.WCY;
export const RX = CX + LINKED_VIZ_LAYOUT.RING_R + LINKED_VIZ_LAYOUT.GRAPH_GAP;
export const RYtop = CY - WR - 4;
export const RYbot = CY + WR + 4;
export const RH = RYbot - RYtop;
export const BY = CY + LINKED_VIZ_LAYOUT.RING_R + LINKED_VIZ_LAYOUT.GRAPH_GAP;
export const BXleft = CX - WR - 4;
export const BXright = CX + WR + 4;
export const BW = BXright - BXleft;
export const TW = RX + RW + 4;
export const TH = BY + BH + 16;

export const ACTIVE_LEVELS = [1, 2, 3, 4, 5, 6] as const;
export const HUE_LABELS = [0, 60, 120, 180, 240, 300, 360] as const;
export const LV_COLORS = ["", "#0000ff", "#ff0000", "#ff00ff", "#00ff00", "#00ffff", "#ffff00", ""] as const;
export const C2_PAIR: Readonly<Record<number, number>> = { 1: 6, 2: 5, 3: 4, 4: 3, 5: 2, 6: 1 };

export const lumR0 = (levelIndex: number) => (LEVEL_INFO[levelIndex].gray / 255) * WR;
export const lumR7 = (levelIndex: number) => (1 - LEVEL_INFO[levelIndex].gray / 255) * WR;

export function wheelPoint(
  angle: number,
  level: number,
  alpha: number,
  radiusFn: (levelIndex: number) => number,
  cx = CX,
  cy = CY,
): LinkedVisualizationPoint {
  const rad = ((angle - alpha - 90) * Math.PI) / 180;
  const r = radiusFn(level);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function rightProjectionX(angle: number): number {
  return RX + 10 + (angle / 360) * (RW - 14);
}

export function bottomProjectionY(angle: number): number {
  return BY + 8 + (angle / 360) * (BH - 16);
}

export function clampHueFromRightGraphX(x: number): number {
  return Math.max(0, Math.min(360, ((x - RX - 10) / (RW - 14)) * 360));
}

export function clampHueFromBottomGraphY(y: number): number {
  return Math.max(0, Math.min(360, ((y - BY - 8) / (BH - 16)) * 360));
}

export function buildLinkedVisualizationDots(hueAngle: number, candidateOverridesByLevel?: Map<number, number>): LinkedVisualizationDot[] {
  const result: LinkedVisualizationDot[] = [];
  for (let levelIndex = 0; levelIndex < LEVEL_CANDIDATES.length; levelIndex++) {
    for (let candidateIndex = 0; candidateIndex < LEVEL_CANDIDATES[levelIndex].length; candidateIndex++) {
      const candidate = LEVEL_CANDIDATES[levelIndex][candidateIndex];
      if (candidate.angle < 0) continue;
      const activeCandidateIndex = candidateOverridesByLevel?.has(levelIndex)
        ? candidateOverridesByLevel.get(levelIndex)!
        : findClosestCandidate(levelIndex, hueAngle);
      result.push({
        levelIndex,
        candidateIndex,
        angleDeg: candidate.angle,
        rgb: candidate.rgb,
        isActive: activeCandidateIndex === candidateIndex,
      });
    }
  }
  return result;
}

export function sinePath(level: number, radiusFn: (levelIndex: number) => number, alpha: number): string {
  const r = radiusFn(level);
  if (r < 1) return "";
  const pts: string[] = [];
  for (let h = 0; h <= 360; h += 2) {
    const rad = ((h - alpha - 90) * Math.PI) / 180;
    const y = CY + r * Math.sin(rad);
    pts.push(`${h === 0 ? "M" : "L"}${rightProjectionX(h).toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(" ");
}

export function cosinePath(level: number, radiusFn: (levelIndex: number) => number, alpha: number): string {
  const r = radiusFn(level);
  if (r < 1) return "";
  const pts: string[] = [];
  for (let h = 0; h <= 360; h += 2) {
    const rad = ((h - alpha - 90) * Math.PI) / 180;
    const x = CX + r * Math.cos(rad);
    pts.push(`${h === 0 ? "M" : "L"}${x.toFixed(1)},${bottomProjectionY(h).toFixed(1)}`);
  }
  return pts.join(" ");
}

export function compositeSinePath(radius: number, alpha0: number, alpha7: number): string {
  if (radius < 1) return "";
  const avgAlpha = (alpha0 + alpha7) / 2;
  const deltaAlpha = alpha7 - alpha0;
  const amp = 2 * radius * Math.cos(((deltaAlpha / 2) * Math.PI) / 180);
  const pts: string[] = [];
  for (let h = 0; h <= 360; h += 2) {
    const y = CY + amp * Math.sin(((h - avgAlpha - 90) * Math.PI) / 180);
    pts.push(`${h === 0 ? "M" : "L"}${rightProjectionX(h).toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(" ");
}

export function compositeCosinePath(radius: number, alpha0: number, alpha7: number): string {
  if (radius < 1) return "";
  const avgAlpha = (alpha0 + alpha7) / 2;
  const deltaAlpha = alpha7 - alpha0;
  const amp = 2 * radius * Math.cos(((deltaAlpha / 2) * Math.PI) / 180);
  const pts: string[] = [];
  for (let h = 0; h <= 360; h += 2) {
    const x = CX + amp * Math.cos(((h - avgAlpha - 90) * Math.PI) / 180);
    pts.push(`${h === 0 ? "M" : "L"}${x.toFixed(1)},${bottomProjectionY(h).toFixed(1)}`);
  }
  return pts.join(" ");
}
