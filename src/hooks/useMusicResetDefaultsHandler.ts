import { useCallback } from "react";

import type { MusicEngineReturn } from "./useMusicEngine";
import {
  createDefaultMusicDirectCandidates,
  type useMusicAlgebraState,
  type useMusicFanoState,
  type useMusicPaletteState,
  type useMusicSignalsState,
  type useMusicTransportState,
} from "./useMusicPanelState";

type MusicPaletteState = ReturnType<typeof useMusicPaletteState>;
type MusicTransportState = ReturnType<typeof useMusicTransportState>;
type MusicFanoState = ReturnType<typeof useMusicFanoState>;
type MusicAlgebraState = ReturnType<typeof useMusicAlgebraState>;
type MusicSignalsState = ReturnType<typeof useMusicSignalsState>;

interface UseMusicResetDefaultsHandlerOptions {
  engine: MusicEngineReturn;
  stopAll: () => void;
  palette: Pick<MusicPaletteState, "setHueAngleDeg" | "setCandidateOverridesByLevel" | "setSelectedLevels">;
  transport: Pick<
    MusicTransportState,
    | "setDroneMuted"
    | "setMuted"
    | "setVolume"
    | "setScaleMode"
    | "setFmEnabled"
    | "setAlphaSpeed"
    | "setPhaseSpeed"
    | "setHueSpeed"
    | "setAlpha0"
    | "setAlpha7"
    | "setLumaMode"
    | "setHoveredFanoLine"
  >;
  fano: Pick<MusicFanoState, "setRhythmTempo" | "setFanoContextPoint" | "setPartitionLineIndex">;
  algebra: Pick<MusicAlgebraState, "setGl32Perm" | "setDistA" | "setDistB" | "setDistC" | "setOctaA" | "setOctaB">;
  signals: Pick<MusicSignalsState, "setResetSignal">;
}

export function useMusicResetDefaultsHandler({
  engine,
  stopAll,
  palette,
  transport,
  fano,
  algebra,
  signals,
}: UseMusicResetDefaultsHandlerOptions) {
  const { setHueAngleDeg, setCandidateOverridesByLevel, setSelectedLevels } = palette;
  const {
    setDroneMuted,
    setMuted,
    setVolume,
    setScaleMode,
    setFmEnabled,
    setAlphaSpeed,
    setPhaseSpeed,
    setHueSpeed,
    setAlpha0,
    setAlpha7,
    setLumaMode,
    setHoveredFanoLine,
  } = transport;
  const { setRhythmTempo, setFanoContextPoint, setPartitionLineIndex } = fano;
  const { setGl32Perm, setDistA, setDistB, setDistC, setOctaA, setOctaB } = algebra;
  const { setResetSignal } = signals;

  return useCallback(() => {
    stopAll();
    engine.setDroneMuted(false);
    setDroneMuted(false);
    setHueAngleDeg(0);
    setCandidateOverridesByLevel(createDefaultMusicDirectCandidates());
    setSelectedLevels(new Set());
    setMuted(false);
    setVolume(0.7);
    setScaleMode("diatonic7");
    setFmEnabled(false);
    setAlphaSpeed(36);
    setPhaseSpeed(0);
    setHueSpeed(36);
    setAlpha0(0);
    setAlpha7(0);
    setLumaMode("symmetric");
    setRhythmTempo(120);
    setFanoContextPoint(1);
    setPartitionLineIndex(0);
    engine.resetGL32Transform?.((perm) => setGl32Perm(perm));
    setHoveredFanoLine(null);
    setDistA(5);
    setDistB(3);
    setDistC(6);
    setOctaA(1);
    setOctaB(2);
    setResetSignal((s) => s + 1);
  }, [
    engine,
    setAlpha0,
    setAlpha7,
    setAlphaSpeed,
    setCandidateOverridesByLevel,
    setDistA,
    setDistB,
    setDistC,
    setDroneMuted,
    setFanoContextPoint,
    setFmEnabled,
    setGl32Perm,
    setHoveredFanoLine,
    setHueAngleDeg,
    setHueSpeed,
    setLumaMode,
    setOctaA,
    setOctaB,
    setPartitionLineIndex,
    setPhaseSpeed,
    setResetSignal,
    setRhythmTempo,
    setScaleMode,
    setMuted,
    setSelectedLevels,
    setVolume,
    stopAll,
  ]);
}
