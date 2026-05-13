import { LEVEL_CANDIDATES, LEVEL_INFO, findClosestCandidate } from "../color-engine";
import { FANO_LINES } from "../data/theory-data";
import type { SonificationLevel } from "./music-audio-graph";
import { MUSIC_ACTIVE_LEVELS, type ActiveMusicLevel, type MusicHueTick, type MusicLevelPreview } from "./types";

function getCandidateIndex(candidateOverridesByLevel: ReadonlyMap<number, number>, levelIndex: number, hueAngleDeg: number): number {
  return candidateOverridesByLevel.has(levelIndex)
    ? candidateOverridesByLevel.get(levelIndex)!
    : findClosestCandidate(levelIndex, hueAngleDeg);
}

export function findMusicFanoLine(a: number, b: number): number {
  const c = a ^ b;
  const triple = [a, b, c].sort((x, y) => x - y);
  return FANO_LINES.findIndex((line) => {
    const sorted = [...line].sort((x, y) => x - y);
    return sorted[0] === triple[0] && sorted[1] === triple[1] && sorted[2] === triple[2];
  });
}

export function buildMusicSonificationLevels(
  candidateOverridesByLevel: ReadonlyMap<number, number>,
  hueAngleDeg: number,
): SonificationLevel[] {
  return MUSIC_ACTIVE_LEVELS.map((levelIndex) => {
    const candidateIndex = getCandidateIndex(candidateOverridesByLevel, levelIndex, hueAngleDeg);
    const cand = LEVEL_CANDIDATES[levelIndex][candidateIndex];
    return cand
      ? { levelIndex, hueAngleDeg: cand.hueAngleDeg, luma255: LEVEL_INFO[levelIndex].gray }
      : { levelIndex, hueAngleDeg: 0, luma255: 0 };
  });
}

export function buildMusicLevelPreview(candidateOverridesByLevel: ReadonlyMap<number, number>, hueAngleDeg: number): MusicLevelPreview[] {
  return LEVEL_INFO.map((info, levelIndex) => {
    const candidates = LEVEL_CANDIDATES[levelIndex];
    const candidateIndex = getCandidateIndex(candidateOverridesByLevel, levelIndex, hueAngleDeg);
    const rgb = candidates[candidateIndex]?.rgb ?? [128, 128, 128];
    return { levelIndex, name: info.name, rgb, hex: `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` };
  });
}

export function buildActiveMusicLevels(levelPreview: readonly MusicLevelPreview[]): ActiveMusicLevel[] {
  return levelPreview
    .filter((lp) => lp.levelIndex >= 1 && lp.levelIndex <= 6)
    .map((lp) => ({ levelIndex: lp.levelIndex, rgb: lp.rgb as readonly [number, number, number] }));
}

export function buildMusicHueTicks(): MusicHueTick[] {
  const ticks: MusicHueTick[] = [];
  for (let levelIndex = 2; levelIndex <= 5; levelIndex++) {
    const cands = LEVEL_CANDIDATES[levelIndex];
    if (cands.length <= 1 || cands[0].hueAngleDeg < 0) continue;
    const angles = cands.map((c) => c.hueAngleDeg).sort((a, b) => a - b);
    for (let i = 0; i < angles.length; i++) {
      const a1 = angles[i];
      const a2 = angles[(i + 1) % angles.length];
      const diff = (a2 - a1 + 360) % 360;
      const mid = (a1 + diff / 2) % 360;
      ticks.push({ hueAngleDeg: mid, color: `rgb(${cands[0].rgb.join(",")})` });
    }
  }
  return ticks;
}
