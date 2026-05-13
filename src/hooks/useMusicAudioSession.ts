import { useCallback, useEffect, useRef, useState } from "react";

import { type ScaleMode } from "../data/music-frequency";
import {
  applyParams,
  buildAudioGraph,
  buildFM,
  teardown,
  teardownFM,
  triggerBitSpectrumBurst,
  triggerErrorMarker,
  triggerLumaBurst,
  triggerPitchOrLumaBurst,
  type AudioNodes,
  type SonificationLevel,
} from "../music/music-audio-graph";

type MusicLumaMode = "symmetric" | "bt601Luma";

interface MusicAudioSessionParams {
  enabled: boolean;
  levels: SonificationLevel[];
  hoveredLevelIndex: number | null;
  alpha0: number;
  alpha7: number;
  volume: number;
  scaleMode: ScaleMode;
  fmEnabled: boolean;
  panEnabled: boolean;
  hoveredFanoLine: number | null;
  lumaMode: MusicLumaMode;
  originMode: 0 | 7;
  onStopPlayback: () => void;
}

interface MusicAudioSessionSnapshot {
  levels: SonificationLevel[];
  hoveredLevelIndex: number | null;
  alpha0: number;
  alpha7: number;
  volume: number;
  scaleMode: ScaleMode;
  fmEnabled: boolean;
  panEnabled: boolean;
  hoveredFanoLine: number | null;
  lumaMode: MusicLumaMode;
  originMode: 0 | 7;
}

interface MusicAudioSessionReturn {
  nodesRef: React.MutableRefObject<AudioNodes | null>;
  paramsRef: React.MutableRefObject<MusicAudioSessionSnapshot>;
  analyserNode: AnalyserNode | null;
  initAudio: () => void;
  stopAudio: () => void;
  triggerToneBurst: (levelIndex: number, hueAngleDeg: number) => void;
  playPitchLevel: (levelIndex: number) => void;
  playBitVectorLevel: (levelIndex: number) => void;
  triggerLumaBurst: (luma255: number) => void;
  triggerErrorMarker: () => void;
  setLumaMode: (mode: MusicLumaMode) => void;
  setDroneMuted: (muted: boolean) => void;
}

export function useMusicAudioSession({
  enabled,
  levels,
  hoveredLevelIndex,
  alpha0,
  alpha7,
  volume,
  scaleMode,
  fmEnabled,
  panEnabled,
  hoveredFanoLine,
  lumaMode,
  originMode,
  onStopPlayback,
}: MusicAudioSessionParams): MusicAudioSessionReturn {
  const nodesRef = useRef<AudioNodes | null>(null);
  const droneMutedRef = useRef(true);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  const paramsRef = useRef<MusicAudioSessionSnapshot>({
    levels,
    hoveredLevelIndex,
    alpha0,
    alpha7,
    volume,
    scaleMode,
    fmEnabled,
    panEnabled,
    hoveredFanoLine,
    lumaMode,
    originMode,
  });
  paramsRef.current = {
    levels,
    hoveredLevelIndex,
    alpha0,
    alpha7,
    volume,
    scaleMode,
    fmEnabled,
    panEnabled,
    hoveredFanoLine,
    lumaMode,
    originMode,
  };

  const applyCurrentParams = useCallback((nodes: AudioNodes, lumaModeOverride?: MusicLumaMode, droneMutedOverride?: boolean) => {
    const p = paramsRef.current;
    applyParams(
      nodes,
      p.levels,
      p.hoveredLevelIndex,
      p.alpha0,
      p.alpha7,
      p.volume,
      p.scaleMode,
      p.fmEnabled,
      p.panEnabled,
      p.hoveredFanoLine,
      lumaModeOverride ?? p.lumaMode,
      p.originMode,
      droneMutedOverride ?? droneMutedRef.current,
    );
  }, []);

  const initAudio = useCallback(() => {
    if (nodesRef.current) {
      if (nodesRef.current.ctx.state === "suspended") {
        void nodesRef.current.ctx.resume();
      }
      return;
    }

    const ctx = new AudioContext({ sampleRate: 44100 });
    const nodes = buildAudioGraph(ctx);
    nodesRef.current = nodes;
    setAnalyserNode(nodes.analyser);

    const p = paramsRef.current;
    if (p.fmEnabled) {
      buildFM(nodes, p.levels, p.scaleMode);
    }

    applyCurrentParams(nodes);
  }, [applyCurrentParams]);

  const stopAudio = useCallback(() => {
    onStopPlayback();
    if (nodesRef.current) {
      teardown(nodesRef.current);
      nodesRef.current = null;
    }
    setAnalyserNode(null);
  }, [onStopPlayback]);

  useEffect(() => stopAudio, [stopAudio]);

  useEffect(() => {
    if (!enabled && nodesRef.current) {
      stopAudio();
    }
  }, [enabled, stopAudio]);

  useEffect(() => {
    if (!enabled || !nodesRef.current) return;
    if (fmEnabled) {
      buildFM(nodesRef.current, levels, scaleMode);
    } else {
      teardownFM(nodesRef.current);
    }
  }, [enabled, fmEnabled, scaleMode, levels]);

  useEffect(() => {
    if (!enabled || !nodesRef.current) return;
    applyCurrentParams(nodesRef.current);
  }, [
    enabled,
    levels,
    hoveredLevelIndex,
    alpha0,
    alpha7,
    volume,
    scaleMode,
    fmEnabled,
    panEnabled,
    hoveredFanoLine,
    lumaMode,
    originMode,
    applyCurrentParams,
  ]);

  const hueAngleForLevel = useCallback((levelIndex: number): number => {
    const p = paramsRef.current;
    const d = p.levels.find((level) => level.levelIndex === levelIndex);
    const activeAlpha = p.originMode === 0 ? p.alpha0 : p.alpha7;
    return (d?.hueAngleDeg ?? 0) + activeAlpha;
  }, []);

  const triggerToneBurst = useCallback((levelIndex: number, hueAngleDeg: number) => {
    const nodes = nodesRef.current;
    if (!nodes) return;
    triggerPitchOrLumaBurst(nodes, levelIndex, hueAngleDeg, paramsRef.current.scaleMode);
  }, []);

  const playPitchLevel = useCallback(
    (levelIndex: number) => {
      const nodes = nodesRef.current;
      if (!nodes) return;
      if (levelIndex === 0 || levelIndex === 7) {
        triggerPitchOrLumaBurst(nodes, levelIndex, -1, paramsRef.current.scaleMode);
        return;
      }
      triggerPitchOrLumaBurst(nodes, levelIndex, hueAngleForLevel(levelIndex), paramsRef.current.scaleMode);
    },
    [hueAngleForLevel],
  );

  const playBitVectorLevel = useCallback((levelIndex: number) => {
    const nodes = nodesRef.current;
    if (!nodes) return;
    triggerBitSpectrumBurst(nodes, levelIndex, -1, false);
  }, []);

  const triggerLumaBurstForSession = useCallback((luma255: number) => {
    const nodes = nodesRef.current;
    if (nodes) {
      triggerLumaBurst(nodes, luma255);
    }
  }, []);

  const triggerErrorMarkerForSession = useCallback(() => {
    const nodes = nodesRef.current;
    if (nodes) {
      triggerErrorMarker(nodes);
    }
  }, []);

  const setLumaMode = useCallback(
    (mode: MusicLumaMode) => {
      if (!nodesRef.current) return;
      paramsRef.current.lumaMode = mode;
      applyCurrentParams(nodesRef.current, mode);
    },
    [applyCurrentParams],
  );

  const setDroneMuted = useCallback(
    (muted: boolean) => {
      droneMutedRef.current = muted;
      if (!nodesRef.current) return;
      applyCurrentParams(nodesRef.current, undefined, muted);
    },
    [applyCurrentParams],
  );

  return {
    nodesRef,
    paramsRef,
    analyserNode,
    initAudio,
    stopAudio,
    triggerToneBurst,
    playPitchLevel,
    playBitVectorLevel,
    triggerLumaBurst: triggerLumaBurstForSession,
    triggerErrorMarker: triggerErrorMarkerForSession,
    setLumaMode,
    setDroneMuted,
  };
}
