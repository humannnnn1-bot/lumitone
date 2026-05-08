import { useCallback, useEffect, useRef } from "react";
import type { MutableRefObject } from "react";

import { findMusicFanoLine } from "../music/music-panel-derived";
import type { MusicEngineReturn } from "./useMusicEngine";
import type { useMusicFanoState, useMusicTransportState } from "./useMusicPanelState";

type MusicFanoState = ReturnType<typeof useMusicFanoState>;
type MusicTransportState = ReturnType<typeof useMusicTransportState>;

interface MusicTempoRestartOptions {
  rhythmTempo: number;
  grayStep: number | null;
  rhythmPlaying: boolean;
  engine: MusicEngineReturn;
  grayStepCbRef: MutableRefObject<(lv: number | null) => void>;
  fanoBeatCbRef: MutableRefObject<(lines: number[], pos: number) => void>;
}

function useMusicTempoRestart({
  rhythmTempo,
  grayStep,
  rhythmPlaying,
  engine,
  grayStepCbRef,
  fanoBeatCbRef,
}: MusicTempoRestartOptions): void {
  const tempoMountedRef = useRef(false);
  const latestRef = useRef({ grayStep, rhythmPlaying, engine, grayStepCbRef, fanoBeatCbRef });
  latestRef.current = { grayStep, rhythmPlaying, engine, grayStepCbRef, fanoBeatCbRef };

  useEffect(() => {
    if (!tempoMountedRef.current) {
      tempoMountedRef.current = true;
      return;
    }

    const latest = latestRef.current;
    if (latest.grayStep !== null) {
      latest.engine.stopGrayMelody();
      latest.engine.playGrayMelody(rhythmTempo, latest.grayStepCbRef.current);
    }
    if (latest.rhythmPlaying) {
      latest.engine.stopFanoRhythm();
      latest.engine.startFanoRhythm(rhythmTempo, latest.fanoBeatCbRef.current);
    }
  }, [rhythmTempo]);
}

interface UseMusicFanoHandlersOptions {
  engine: MusicEngineReturn;
  hoveredFanoLine: number | null;
  setHoveredFanoLine: MusicTransportState["setHoveredFanoLine"];
  fano: Pick<
    MusicFanoState,
    | "grayStep"
    | "setGrayStep"
    | "rhythmPlaying"
    | "setRhythmPlaying"
    | "setRhythmFiringLines"
    | "rhythmTempo"
    | "xorA"
    | "setXorA"
    | "xorB"
    | "setXorB"
    | "setXorStep"
    | "fanoContextPoint"
    | "setFanoContextLine"
    | "partitionPhase"
    | "setPartitionPhase"
    | "setPartitionLineIndex"
  >;
}

export function useMusicFanoHandlers({ engine, hoveredFanoLine, setHoveredFanoLine, fano }: UseMusicFanoHandlersOptions) {
  const {
    grayStep,
    setGrayStep,
    rhythmPlaying,
    setRhythmPlaying,
    setRhythmFiringLines,
    rhythmTempo,
    xorA,
    setXorA,
    xorB,
    setXorB,
    setXorStep,
    fanoContextPoint,
    setFanoContextLine,
    partitionPhase,
    setPartitionPhase,
    setPartitionLineIndex,
  } = fano;

  const grayStepCbRef = useRef<(lv: number | null) => void>((lv) => setGrayStep(lv));
  const fanoBeatCbRef = useRef<(lines: number[], pos: number) => void>((lines) => setRhythmFiringLines(lines));

  const handleGrayMelody = useCallback(() => {
    if (grayStep !== null) {
      engine.stopGrayMelody();
      setGrayStep(null);
      return;
    }
    engine.initAudio();
    engine.playGrayMelody(rhythmTempo, grayStepCbRef.current);
  }, [engine, grayStep, rhythmTempo, setGrayStep]);

  const handleFanoRhythm = useCallback(() => {
    if (rhythmPlaying) {
      engine.stopFanoRhythm();
      setRhythmPlaying(false);
      return;
    }
    engine.initAudio();
    engine.startFanoRhythm(rhythmTempo, fanoBeatCbRef.current);
    setRhythmPlaying(true);
  }, [engine, rhythmPlaying, rhythmTempo, setRhythmPlaying]);

  useMusicTempoRestart({ rhythmTempo, grayStep, rhythmPlaying, engine, grayStepCbRef, fanoBeatCbRef });

  const handlePlayXor = useCallback(() => {
    if (xorA != null && xorB != null) {
      engine.initAudio();
      const fanoIdx = findMusicFanoLine(xorA, xorB);
      if (fanoIdx >= 0) setHoveredFanoLine(fanoIdx);
      engine.playXorTriple?.(xorA, xorB, (lv) => {
        setXorStep(lv);
        if (lv === null && fanoIdx >= 0) setHoveredFanoLine(null);
      });
    }
  }, [engine, setHoveredFanoLine, setXorStep, xorA, xorB]);

  const handlePlayPointContext = useCallback(() => {
    engine.initAudio();
    engine.playPointFanoContext?.(fanoContextPoint, (idx) => {
      setFanoContextLine(idx ?? -1);
      setHoveredFanoLine(idx ?? null);
    });
  }, [engine, fanoContextPoint, setFanoContextLine, setHoveredFanoLine]);

  const selectedFanoLine = hoveredFanoLine ?? 0;
  const handlePlayPartition = useCallback(() => {
    if (partitionPhase !== null) {
      engine.stopAlgebra?.();
      setPartitionPhase(null);
    } else {
      setPartitionLineIndex(selectedFanoLine);
      engine.initAudio();
      setPartitionPhase(null);
      engine.playLineAndComplement?.(selectedFanoLine, (phase) => setPartitionPhase(phase));
    }
  }, [engine, partitionPhase, selectedFanoLine, setPartitionLineIndex, setPartitionPhase]);

  const handleFanoNodeClick = useCallback(
    (lv: number) => {
      if (xorA == null) {
        setXorA(lv);
      } else if (xorB == null) {
        setXorB(lv);
      } else {
        setXorA(lv);
        setXorB(null);
      }
    },
    [setXorA, setXorB, xorA, xorB],
  );

  const handleFanoLineClick = useCallback(
    (lineIndex: number) => {
      setHoveredFanoLine(lineIndex);
    },
    [setHoveredFanoLine],
  );

  return {
    selectedFanoLine,
    handleGrayMelody,
    handleFanoRhythm,
    handlePlayXor,
    handlePlayPointContext,
    handlePlayPartition,
    handleFanoNodeClick,
    handleFanoLineClick,
  };
}
