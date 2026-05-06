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

type MusicLuminanceMode = "symmetric" | "luminance";

interface MusicAudioSessionParams {
  enabled: boolean;
  levels: SonificationLevel[];
  hoveredLv: number | null;
  alpha0: number;
  alpha7: number;
  volume: number;
  scaleMode: ScaleMode;
  fmEnabled: boolean;
  panEnabled: boolean;
  hoveredFanoLine: number | null;
  luminanceMode: MusicLuminanceMode;
  originMode: 0 | 7;
  onStopPlayback: () => void;
}

interface MusicAudioSessionSnapshot {
  levels: SonificationLevel[];
  hoveredLv: number | null;
  alpha0: number;
  alpha7: number;
  volume: number;
  scaleMode: ScaleMode;
  fmEnabled: boolean;
  panEnabled: boolean;
  hoveredFanoLine: number | null;
  luminanceMode: MusicLuminanceMode;
  originMode: 0 | 7;
}

interface MusicAudioSessionReturn {
  nodesRef: React.MutableRefObject<AudioNodes | null>;
  paramsRef: React.MutableRefObject<MusicAudioSessionSnapshot>;
  analyserNode: AnalyserNode | null;
  initAudio: () => void;
  stopAudio: () => void;
  triggerToneBurst: (lv: number, angle: number) => void;
  playPitchLevel: (lv: number) => void;
  playBitVectorLevel: (lv: number) => void;
  triggerLumaBurst: (gray: number) => void;
  triggerErrorMarker: () => void;
  setLuminanceMode: (mode: MusicLuminanceMode) => void;
  setDroneMuted: (muted: boolean) => void;
}

export function useMusicAudioSession({
  enabled,
  levels,
  hoveredLv,
  alpha0,
  alpha7,
  volume,
  scaleMode,
  fmEnabled,
  panEnabled,
  hoveredFanoLine,
  luminanceMode,
  originMode,
  onStopPlayback,
}: MusicAudioSessionParams): MusicAudioSessionReturn {
  const nodesRef = useRef<AudioNodes | null>(null);
  const droneMutedRef = useRef(true);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  const paramsRef = useRef<MusicAudioSessionSnapshot>({
    levels,
    hoveredLv,
    alpha0,
    alpha7,
    volume,
    scaleMode,
    fmEnabled,
    panEnabled,
    hoveredFanoLine,
    luminanceMode,
    originMode,
  });
  paramsRef.current = {
    levels,
    hoveredLv,
    alpha0,
    alpha7,
    volume,
    scaleMode,
    fmEnabled,
    panEnabled,
    hoveredFanoLine,
    luminanceMode,
    originMode,
  };

  const applyCurrentParams = useCallback((nodes: AudioNodes, luminanceOverride?: MusicLuminanceMode, droneMutedOverride?: boolean) => {
    const p = paramsRef.current;
    applyParams(
      nodes,
      p.levels,
      p.hoveredLv,
      p.alpha0,
      p.alpha7,
      p.volume,
      p.scaleMode,
      p.fmEnabled,
      p.panEnabled,
      p.hoveredFanoLine,
      luminanceOverride ?? p.luminanceMode,
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
    hoveredLv,
    alpha0,
    alpha7,
    volume,
    scaleMode,
    fmEnabled,
    panEnabled,
    hoveredFanoLine,
    luminanceMode,
    originMode,
    applyCurrentParams,
  ]);

  const angleForLv = useCallback((lv: number): number => {
    const p = paramsRef.current;
    const d = p.levels.find((l) => l.lv === lv);
    const activeAlpha = p.originMode === 0 ? p.alpha0 : p.alpha7;
    return (d?.angle ?? 0) + activeAlpha;
  }, []);

  const triggerToneBurst = useCallback((lv: number, angle: number) => {
    const nodes = nodesRef.current;
    if (!nodes) return;
    triggerPitchOrLumaBurst(nodes, lv, angle, paramsRef.current.scaleMode);
  }, []);

  const playPitchLevel = useCallback(
    (lv: number) => {
      const nodes = nodesRef.current;
      if (!nodes) return;
      if (lv === 0 || lv === 7) {
        triggerPitchOrLumaBurst(nodes, lv, -1, paramsRef.current.scaleMode);
        return;
      }
      triggerPitchOrLumaBurst(nodes, lv, angleForLv(lv), paramsRef.current.scaleMode);
    },
    [angleForLv],
  );

  const playBitVectorLevel = useCallback((lv: number) => {
    const nodes = nodesRef.current;
    if (!nodes) return;
    triggerBitSpectrumBurst(nodes, lv, -1, false);
  }, []);

  const triggerLumaBurstForSession = useCallback((gray: number) => {
    const nodes = nodesRef.current;
    if (nodes) {
      triggerLumaBurst(nodes, gray);
    }
  }, []);

  const triggerErrorMarkerForSession = useCallback(() => {
    const nodes = nodesRef.current;
    if (nodes) {
      triggerErrorMarker(nodes);
    }
  }, []);

  const setLuminanceMode = useCallback(
    (mode: MusicLuminanceMode) => {
      if (!nodesRef.current) return;
      paramsRef.current.luminanceMode = mode;
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
    setLuminanceMode,
    setDroneMuted,
  };
}
