import { useRef, useState } from "react";

import { DEFAULT_CANDIDATE_INDEX_BY_LEVEL } from "../color-engine";
import type { DecoderPhase, MusicCandidateHover } from "../music/types";
import type { ScaleMode } from "./useMusicEngine";

type MusicWeightStep = { positions: number[]; weight: number; index: number } | null;
type MusicAndStep = { pairIndex: number; phase: "operands" | "result" } | null;
type MusicDistPhase = "bxc" | "left" | "ab" | "ac" | "right" | "equal" | null;
type MusicOctaPhase = "pair" | "result" | null;
type MusicHammingMode = "743" | "844";
type MusicLumaMode = "symmetric" | "bt601Luma";
type MusicPartitionPhase = "line" | "complement" | null;
type MusicRotationDir = 1 | -1 | 0;
type MusicOriginMode = 0 | 7;

export function createDefaultMusicDirectCandidates() {
  const candidates = new Map<number, number>();
  for (let levelIndex = 1; levelIndex <= 6; levelIndex++) candidates.set(levelIndex, DEFAULT_CANDIDATE_INDEX_BY_LEVEL[levelIndex]);
  return candidates;
}

export function useMusicPaletteState() {
  const [hueAngleDeg, setHueAngleDeg] = useState(0);
  const [candidateOverridesByLevel, setCandidateOverridesByLevel] = useState<Map<number, number>>(createDefaultMusicDirectCandidates);
  const [hoveredCandidate, setHoveredCandidate] = useState<MusicCandidateHover>(null);
  const [selectedLevels, setSelectedLevels] = useState<Set<number>>(new Set());
  const prevCandidatesRef = useRef<Map<number, number>>(new Map());

  return {
    hueAngleDeg,
    setHueAngleDeg,
    candidateOverridesByLevel,
    setCandidateOverridesByLevel,
    hoveredCandidate,
    setHoveredCandidate,
    selectedLevels,
    setSelectedLevels,
    prevCandidatesRef,
  };
}

export function useMusicTransportState(hueAngleDeg: number) {
  const [volume, setVolume] = useState(0.7);
  const [muted, setMuted] = useState(false);
  const preMuteVolumeRef = useRef(0.7);
  const [scaleMode, setScaleMode] = useState<ScaleMode>("diatonic7");
  const [fmEnabled, setFmEnabled] = useState(false);
  const [alphaSpeed, setAlphaSpeed] = useState(36);
  const [phaseSpeed, setPhaseSpeed] = useState(0);
  const [hueSpeed, setHueSpeed] = useState(36);
  const [hoveredFanoLine, setHoveredFanoLine] = useState<number | null>(null);
  const [lumaMode, setLumaMode] = useState<MusicLumaMode>("symmetric");

  const [alpha0, setAlpha0] = useState(0);
  const [alpha7, setAlpha7] = useState(0);
  const [originMode, setOriginMode] = useState<MusicOriginMode>(0);
  const [droneMuted, setDroneMuted] = useState(true);

  const [alphaDir, setAlphaDir] = useState<MusicRotationDir>(0);
  const [hueDir, setHueDir] = useState<MusicRotationDir>(0);
  const prevTimeRef = useRef<number>(0);
  const hueRef = useRef(hueAngleDeg);
  const lastHueRoundedRef = useRef(Math.round(hueAngleDeg));

  return {
    volume,
    setVolume,
    muted,
    setMuted,
    preMuteVolumeRef,
    scaleMode,
    setScaleMode,
    fmEnabled,
    setFmEnabled,
    alphaSpeed,
    setAlphaSpeed,
    phaseSpeed,
    setPhaseSpeed,
    hueSpeed,
    setHueSpeed,
    hoveredFanoLine,
    setHoveredFanoLine,
    lumaMode,
    setLumaMode,
    alpha0,
    setAlpha0,
    alpha7,
    setAlpha7,
    originMode,
    setOriginMode,
    droneMuted,
    setDroneMuted,
    alphaDir,
    setAlphaDir,
    hueDir,
    setHueDir,
    prevTimeRef,
    hueRef,
    lastHueRoundedRef,
  };
}

export function useMusicAlgebraState() {
  const [gray3Playing, setGray3Playing] = useState(false);
  const [weightPlaying, setWeightPlaying] = useState(false);
  const [weightStep, setWeightStep] = useState<MusicWeightStep>(null);
  const [hammingMode, setHammingMode] = useState<MusicHammingMode>("743");
  const [cayleyRow, setCayleyRow] = useState(1);
  const [andStep, setAndStep] = useState<MusicAndStep>(null);
  const [gray3Code, setGray3Code] = useState<number | null>(null);
  const [cayleyCol, setCayleyCol] = useState(-1);
  const [gl32Perm, setGl32Perm] = useState([0, 1, 2, 3, 4, 5, 6, 7]);
  const [gl32Flash, setGl32Flash] = useState(false);
  const [distA, setDistA] = useState(5);
  const [distB, setDistB] = useState(3);
  const [distC, setDistC] = useState(6);
  const [distPhase, setDistPhase] = useState<MusicDistPhase>(null);
  const [octaA, setOctaA] = useState(1);
  const [octaB, setOctaB] = useState(2);
  const [octaPhase, setOctaPhase] = useState<MusicOctaPhase>(null);
  const [errorPos, setErrorPos] = useState(1);
  const [errorPhase, setErrorPhase] = useState<DecoderPhase>(null);

  return {
    gray3Playing,
    setGray3Playing,
    weightPlaying,
    setWeightPlaying,
    weightStep,
    setWeightStep,
    hammingMode,
    setHammingMode,
    cayleyRow,
    setCayleyRow,
    andStep,
    setAndStep,
    gray3Code,
    setGray3Code,
    cayleyCol,
    setCayleyCol,
    gl32Perm,
    setGl32Perm,
    gl32Flash,
    setGl32Flash,
    distA,
    setDistA,
    distB,
    setDistB,
    distC,
    setDistC,
    distPhase,
    setDistPhase,
    octaA,
    setOctaA,
    octaB,
    setOctaB,
    octaPhase,
    setOctaPhase,
    errorPos,
    setErrorPos,
    errorPhase,
    setErrorPhase,
  };
}

export function useMusicFanoState() {
  const [grayStep, setGrayStep] = useState<number | null>(null);
  const [rhythmPlaying, setRhythmPlaying] = useState(false);
  const [rhythmFiringLines, setRhythmFiringLines] = useState<number[]>([]);
  const [rhythmTempo, setRhythmTempo] = useState(120);
  const [xorA, setXorA] = useState<number | null>(null);
  const [xorB, setXorB] = useState<number | null>(null);
  const [xorStep, setXorStep] = useState<number | null>(null);
  const [fanoContextPoint, setFanoContextPoint] = useState(1);
  const [fanoContextLine, setFanoContextLine] = useState(-1);
  const [partitionPhase, setPartitionPhase] = useState<MusicPartitionPhase>(null);
  const [partitionLineIndex, setPartitionLineIndex] = useState(0);

  return {
    grayStep,
    setGrayStep,
    rhythmPlaying,
    setRhythmPlaying,
    rhythmFiringLines,
    setRhythmFiringLines,
    rhythmTempo,
    setRhythmTempo,
    xorA,
    setXorA,
    xorB,
    setXorB,
    xorStep,
    setXorStep,
    fanoContextPoint,
    setFanoContextPoint,
    fanoContextLine,
    setFanoContextLine,
    partitionPhase,
    setPartitionPhase,
    partitionLineIndex,
    setPartitionLineIndex,
  };
}

export function useMusicSignalsState() {
  const [stopSignal, setStopSignal] = useState(0);
  const [resetSignal, setResetSignal] = useState(0);
  const backgroundStoppedRef = useRef(false);

  return {
    stopSignal,
    setStopSignal,
    resetSignal,
    setResetSignal,
    backgroundStoppedRef,
  };
}

export function useMusicBurstHighlightState() {
  const [burstHighlight, setBurstHighlight] = useState<Set<number>>(() => new Set());
  const burstTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  return {
    burstHighlight,
    setBurstHighlight,
    burstTimersRef,
  };
}
