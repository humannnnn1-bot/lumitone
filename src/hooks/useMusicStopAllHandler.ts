import { useCallback } from "react";
import type { useMusicAlgebraState, useMusicFanoState, useMusicSignalsState, useMusicTransportState } from "./useMusicPanelState";
import type { MusicEngineReturn } from "./useMusicEngine";

type MusicTransportState = ReturnType<typeof useMusicTransportState>;
type MusicFanoState = ReturnType<typeof useMusicFanoState>;
type MusicAlgebraState = ReturnType<typeof useMusicAlgebraState>;
type MusicSignalsState = ReturnType<typeof useMusicSignalsState>;

interface UseMusicStopAllHandlerOptions {
  engine: MusicEngineReturn;
  transport: Pick<MusicTransportState, "setAlphaDir" | "setHueDir" | "setDroneMuted">;
  fano: Pick<
    MusicFanoState,
    "setGrayStep" | "setRhythmPlaying" | "setRhythmFiringLines" | "setXorStep" | "setFanoContextLine" | "setPartitionPhase"
  >;
  algebra: Pick<
    MusicAlgebraState,
    | "setGray3Playing"
    | "setWeightPlaying"
    | "setWeightStep"
    | "setAndStep"
    | "setGray3Code"
    | "setCayleyCol"
    | "setDistPhase"
    | "setOctaPhase"
    | "setGl32Flash"
    | "setK8Layer"
    | "setTetraPhase"
    | "setErrorPhase"
  >;
  signals: Pick<MusicSignalsState, "setStopSignal">;
}

export function useMusicStopAllHandler({ engine, transport, fano, algebra, signals }: UseMusicStopAllHandlerOptions) {
  const { setAlphaDir, setHueDir, setDroneMuted } = transport;
  const { setGrayStep, setRhythmPlaying, setRhythmFiringLines, setXorStep, setFanoContextLine, setPartitionPhase } = fano;
  const {
    setGray3Playing,
    setWeightPlaying,
    setWeightStep,
    setAndStep,
    setGray3Code,
    setCayleyCol,
    setDistPhase,
    setOctaPhase,
    setGl32Flash,
    setK8Layer,
    setTetraPhase,
    setErrorPhase,
  } = algebra;
  const { setStopSignal } = signals;

  return useCallback(() => {
    engine.stopGrayMelody?.();
    engine.stopFanoRhythm?.();
    engine.stopAlgebra?.();
    engine.stopZigzagMelody?.();
    setAlphaDir(0);
    setHueDir(0);
    setGrayStep(null);
    setRhythmPlaying(false);
    setRhythmFiringLines([]);
    setXorStep(null);
    setFanoContextLine(-1);
    setPartitionPhase(null);
    setGray3Playing(false);
    setWeightPlaying(false);
    setWeightStep(null);
    setAndStep(null);
    setGray3Code(null);
    setCayleyCol(-1);
    setDistPhase(null);
    setOctaPhase(null);
    setGl32Flash(false);
    setK8Layer(null);
    setTetraPhase(null);
    setErrorPhase(null);
    setStopSignal((s) => s + 1);
    engine.setDroneMuted(true);
    setDroneMuted(true);
  }, [
    engine,
    setAlphaDir,
    setAndStep,
    setCayleyCol,
    setDistPhase,
    setDroneMuted,
    setErrorPhase,
    setFanoContextLine,
    setGl32Flash,
    setGray3Code,
    setGray3Playing,
    setGrayStep,
    setHueDir,
    setK8Layer,
    setOctaPhase,
    setPartitionPhase,
    setRhythmFiringLines,
    setRhythmPlaying,
    setStopSignal,
    setTetraPhase,
    setWeightPlaying,
    setWeightStep,
    setXorStep,
  ]);
}
