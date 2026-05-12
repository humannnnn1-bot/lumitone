import { LEVEL_CANDIDATES, LEVEL_INFO, findClosestCandidate } from "../color-engine";
import type { GlazeToolId } from "../constants";
import { HEX_CANDIDATE_ANGLES } from "../data/hex-data";
import { hexStr } from "./index";
import type { StatusText } from "./status-display";

const CANONICAL_ANGLES: Array<number | null> = [null, 240, 0, 300, 120, 180, 60, null];

interface PixelStatusBase {
  x: number;
  y: number;
  lv: number;
}

interface CandidateResolution {
  ci: number;
  count: number;
  rgb: readonly [number, number, number];
  angle: number;
}

function normalizeCandidateIndex(lv: number, idx: number): number {
  const count = LEVEL_CANDIDATES[lv]?.length ?? 1;
  return count > 0 ? ((idx % count) + count) % count : 0;
}

function resolveCandidate(lv: number, idx: number): CandidateResolution {
  const alts = LEVEL_CANDIDATES[lv] ?? LEVEL_CANDIDATES[0];
  const ci = normalizeCandidateIndex(lv, idx);
  const candidate = alts[ci] ?? alts[0];
  return {
    ci,
    count: alts.length,
    rgb: candidate.rgb,
    angle: candidate.angle,
  };
}

function resolveGlobalCandidate(candidateIndexByLevel: readonly number[], lv: number): CandidateResolution {
  return resolveCandidate(lv, candidateIndexByLevel[lv] ?? 0);
}

function candidateLabel(candidate: CandidateResolution): string {
  return `c${candidate.ci + 1}/${candidate.count}`;
}

function angleLabel(angle: number | null | undefined): string {
  if (angle == null || !Number.isFinite(angle) || angle < 0) return "\u2014";
  return `${Math.round(angle)}\u00B0`;
}

function signedHueDelta(lv: number, angle: number): string {
  const canonical = CANONICAL_ANGLES[lv];
  if (canonical == null || angle < 0 || !Number.isFinite(angle)) return "\u2014";
  let delta = Math.round(angle - canonical);
  delta = ((delta + 540) % 360) - 180;
  if (delta === 0) return `0\u00B0`;
  return `${delta > 0 ? "+" : "\u2212"}${Math.abs(delta)}\u00B0`;
}

function levelBits(lv: number): string {
  return (lv & 7).toString(2).padStart(3, "0");
}

function formatCount(n: number): string {
  return Math.max(0, n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatShortCount(n: number): string {
  const count = Math.max(0, n);
  if (count >= 1_000_000) return `${Math.round(count / 100_000) / 10}M`;
  if (count >= 10_000) return `${Math.round(count / 1000)}k`;
  if (count >= 1000) return `${Math.round(count / 100) / 10}k`;
  return String(count);
}

function glazeActionLabel(glazeTool: GlazeToolId): string {
  if (glazeTool === "glaze_eraser") return "eraser";
  if (glazeTool === "glaze_fill") return "fill";
  return "brush";
}

function glazeTargetLabel({
  lv,
  hueAngle,
  candidateOverridesByLevel,
  glazeTool,
}: {
  lv: number;
  hueAngle: number;
  candidateOverridesByLevel: Map<number, number>;
  glazeTool: GlazeToolId;
}): string {
  if (glazeTool === "glaze_eraser") return "default";
  if (candidateOverridesByLevel.size > 0 && !candidateOverridesByLevel.has(lv)) return "skip";
  const targetIdx = candidateOverridesByLevel.size > 0 ? candidateOverridesByLevel.get(lv)! : findClosestCandidate(lv, hueAngle);
  const target = resolveCandidate(lv, targetIdx);
  return `${candidateLabel(target)} ${hexStr(target.rgb)}`;
}

export function formatSourcePixelStatus({ x, y, lv }: PixelStatusBase): StatusText {
  const info = LEVEL_INFO[lv];
  return {
    full: `(${x},${y}) Source L${lv} ${info.name} gray=${info.gray} bits=${levelBits(lv)}`,
    compact: `(${x},${y}) Src L${lv} gray=${info.gray} bits=${levelBits(lv)}`,
  };
}

export function formatColorPixelStatus({
  x,
  y,
  lv,
  candidateIndexByLevel,
}: PixelStatusBase & { candidateIndexByLevel: readonly number[] }): StatusText {
  const candidate = resolveGlobalCandidate(candidateIndexByLevel, lv);
  const rgb = candidate.rgb;
  return {
    full: `(${x},${y}) Color L${lv} ${candidateLabel(candidate)} ${hexStr(rgb)} rgb(${rgb[0]},${rgb[1]},${rgb[2]}) hue=${angleLabel(
      candidate.angle,
    )} \u0394${signedHueDelta(lv, candidate.angle)}`,
    compact: `(${x},${y}) Color L${lv} ${candidateLabel(candidate)} ${hexStr(rgb)} h=${angleLabel(candidate.angle)}`,
  };
}

export function formatHexPixelStatus({
  x,
  y,
  lv,
  candidateIndexByLevel,
  levelHistogram,
  patternFactor,
  isLocked,
}: PixelStatusBase & {
  candidateIndexByLevel: readonly number[];
  levelHistogram: readonly number[];
  patternFactor: number;
  isLocked: boolean;
}): StatusText {
  const candidate = resolveGlobalCandidate(candidateIndexByLevel, lv);
  const hexAngle = HEX_CANDIDATE_ANGLES[lv]?.[candidate.ci] ?? candidate.angle;
  return {
    full: `(${x},${y}) Hex L${lv} ${candidateLabel(candidate)} @${angleLabel(hexAngle)} used=${formatCount(
      levelHistogram[lv] ?? 0,
    )}px factor\u00D7${patternFactor} ${isLocked ? "locked" : "unlocked"}`,
    compact: `(${x},${y}) Hex L${lv} ${candidateLabel(candidate)} used=${formatShortCount(levelHistogram[lv] ?? 0)}px f\u00D7${patternFactor} ${
      isLocked ? "lock" : "open"
    }`,
  };
}

export function formatGlazePixelStatus({
  x,
  y,
  lv,
  candidateIndexByLevel,
  pixelCandidateOverrideValue,
  hueAngle,
  candidateOverridesByLevel,
  glazeTool,
}: PixelStatusBase & {
  candidateIndexByLevel: readonly number[];
  pixelCandidateOverrideValue: number;
  hueAngle: number;
  candidateOverridesByLevel: Map<number, number>;
  glazeTool: GlazeToolId;
}): StatusText {
  const base = resolveGlobalCandidate(candidateIndexByLevel, lv);
  const actual = pixelCandidateOverrideValue > 0 ? resolveCandidate(lv, pixelCandidateOverrideValue - 1) : base;
  const override = pixelCandidateOverrideValue > 0 ? "override" : "no override";
  const compactOverride = pixelCandidateOverrideValue > 0 ? "ovr" : "no-ovr";
  const action = glazeActionLabel(glazeTool);
  const target = glazeTargetLabel({ lv, hueAngle, candidateOverridesByLevel, glazeTool });
  return {
    full: `(${x},${y}) Glaze L${lv} base ${candidateLabel(base)} ${hexStr(base.rgb)} \u2192 actual ${candidateLabel(actual)} ${hexStr(
      actual.rgb,
    )} ${override} / ${action}\u2192${target}`,
    compact: `(${x},${y}) Glaze L${lv} ${candidateLabel(base)}\u2192${candidateLabel(actual)} ${compactOverride} ${action}\u2192${target.split(" ")[0]}`,
  };
}
