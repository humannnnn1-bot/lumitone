import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ChangeEvent, Dispatch, MouseEvent, MutableRefObject, SetStateAction } from "react";

import { LEVEL_CANDIDATES, findClosestCandidate } from "../color-engine";
import {
  buildActiveMusicLevels,
  buildMusicHueTicks,
  buildMusicLevelPreview,
  buildMusicSonificationLevels,
  findMusicFanoLine,
} from "../music/music-panel-derived";
import { MUSIC_ACTIVE_LEVELS } from "../music/types";
import { useMusicEngine, type MusicEngineReturn } from "./useMusicEngine";
import {
  createDefaultMusicDirectCandidates,
  useMusicAlgebraState,
  useMusicBurstHighlightState,
  useMusicFanoState,
  useMusicPaletteState,
  useMusicSignalsState,
  useMusicTransportState,
} from "./useMusicPanelState";
import { useMusicStopAllHandler } from "./useMusicStopAllHandler";
import { useMusicTransportHandlers } from "./useMusicTransportHandlers";

function useInitialAudio(initAudio: () => void): void {
  const initAudioRef = useRef(initAudio);
  initAudioRef.current = initAudio;

  useEffect(() => {
    initAudioRef.current();
  }, []);
}

interface MusicTransportAnimationOptions {
  alphaDir: number;
  hueDir: number;
  alphaSpeed: number;
  phaseSpeed: number;
  hueSpeed: number;
  originMode: 0 | 7;
  hueRef: MutableRefObject<number>;
  lastHueRoundedRef: MutableRefObject<number>;
  prevTimeRef: MutableRefObject<number>;
  setAlpha0: Dispatch<SetStateAction<number>>;
  setAlpha7: Dispatch<SetStateAction<number>>;
  setHueAngle: Dispatch<SetStateAction<number>>;
}

function useMusicTransportAnimation({
  alphaDir,
  hueDir,
  alphaSpeed,
  phaseSpeed,
  hueSpeed,
  originMode,
  hueRef,
  lastHueRoundedRef,
  prevTimeRef,
  setAlpha0,
  setAlpha7,
  setHueAngle,
}: MusicTransportAnimationOptions): void {
  useEffect(() => {
    if (alphaDir === 0 && hueDir === 0 && phaseSpeed === 0) return;
    let rafId: number;
    const tick = (time: number) => {
      if (prevTimeRef.current) {
        const dt = (time - prevTimeRef.current) / 1000;
        const base = alphaDir !== 0 ? alphaSpeed * dt * alphaDir : 0;
        const drift = phaseSpeed * dt;
        const a0d = base + (originMode === 0 ? drift : 0);
        const a7d = base + (originMode === 7 ? drift : 0);
        if (a0d !== 0) setAlpha0((a) => (((a + a0d) % 360) + 360) % 360);
        if (a7d !== 0) setAlpha7((a) => (((a + a7d) % 360) + 360) % 360);
        if (hueDir !== 0) {
          const hd = hueSpeed * dt * hueDir;
          const next = (((hueRef.current + hd) % 360) + 360) % 360;
          hueRef.current = next;
          const rounded = Math.round(next) % 360;
          if (rounded !== lastHueRoundedRef.current) {
            lastHueRoundedRef.current = rounded;
            setHueAngle(next);
          }
        }
      }
      prevTimeRef.current = time;
      rafId = requestAnimationFrame(tick);
    };
    prevTimeRef.current = 0;
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [
    alphaDir,
    alphaSpeed,
    hueDir,
    hueRef,
    hueSpeed,
    lastHueRoundedRef,
    originMode,
    phaseSpeed,
    prevTimeRef,
    setAlpha0,
    setAlpha7,
    setHueAngle,
  ]);
}

function useMusicLifecycleStop(onBackgroundStop: () => void, backgroundStoppedRef: MutableRefObject<boolean>): void {
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        onBackgroundStop();
      } else if (document.visibilityState === "visible") {
        backgroundStoppedRef.current = false;
      }
    };
    const onPageHide = () => onBackgroundStop();
    const onPageShow = () => {
      backgroundStoppedRef.current = false;
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [backgroundStoppedRef, onBackgroundStop]);
}

function useMusicKeyboardShortcuts(
  sonificationLevels: Array<{ lv: number; angle: number }>,
  onLevelTrigger: (lv: number, angle: number) => void,
): void {
  const sonificationLevelsRef = useRef(sonificationLevels);
  useEffect(() => {
    sonificationLevelsRef.current = sonificationLevels;
  }, [sonificationLevels]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
      if (k >= "1" && k <= "6") {
        const lv = +k;
        const entry = sonificationLevelsRef.current.find((s) => s.lv === lv);
        if (entry) onLevelTrigger(lv, entry.angle);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onLevelTrigger]);
}

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

export function useMusicPanelController() {
  const {
    hueAngle,
    setHueAngle,
    directCandidates,
    setDirectCandidates,
    hoveredCandidate,
    setHoveredCandidate,
    selectedLevels,
    setSelectedLevels,
    prevCandidatesRef,
  } = useMusicPaletteState();

  const audioInitedRef = useRef(false);
  const ensureAudio = useCallback(() => {
    if (!audioInitedRef.current) {
      audioInitedRef.current = true;
    }
  }, []);

  const {
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
    luminanceMode,
    setLuminanceMode,
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
  } = useMusicTransportState(hueAngle);

  useEffect(() => {
    hueRef.current = hueAngle;
    lastHueRoundedRef.current = Math.round(hueAngle);
  }, [hueAngle, hueRef, lastHueRoundedRef]);

  useMusicTransportAnimation({
    alphaDir,
    hueDir,
    alphaSpeed,
    phaseSpeed,
    hueSpeed,
    originMode,
    hueRef,
    lastHueRoundedRef,
    prevTimeRef,
    setAlpha0,
    setAlpha7,
    setHueAngle,
  });

  const {
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
    k8Layer,
    setK8Layer,
    tetraPhase,
    setTetraPhase,
    errorPos,
    setErrorPos,
    errorPhase,
    setErrorPhase,
  } = useMusicAlgebraState();

  const {
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
  } = useMusicFanoState();

  const { stopSignal, setStopSignal, resetSignal, setResetSignal, backgroundStoppedRef } = useMusicSignalsState();
  const { burstHighlight, setBurstHighlight, burstTimersRef } = useMusicBurstHighlightState();

  const sonificationLevels = useMemo(() => buildMusicSonificationLevels(directCandidates, hueAngle), [hueAngle, directCandidates]);

  const engine = useMusicEngine({
    enabled: true,
    levels: sonificationLevels,
    hoveredLv: hoveredCandidate?.lv ?? null,
    alpha0,
    alpha7,
    volume: muted ? 0 : volume,
    scaleMode,
    fmEnabled,
    panEnabled: true,
    hoveredFanoLine,
    luminanceMode,
    originMode,
  });

  const activeAlpha = originMode === 0 ? alpha0 : alpha7;
  const triggerToneBurstAtActiveAlpha = useCallback(
    (lv: number, angle: number) => {
      engine.triggerToneBurst(lv, angle >= 0 ? angle + activeAlpha : angle);
    },
    [activeAlpha, engine],
  );

  useInitialAudio(engine.initAudio);

  const { resumeDrone, handleAlphaPlay, handleAlphaReverse, handleHuePlay, handleHueReverse, handleMuteToggle, handleVolumeChange } =
    useMusicTransportHandlers({
      engine,
      droneMuted,
      setDroneMuted,
      muted,
      setMuted,
      volume,
      setVolume,
      preMuteVolumeRef,
      setAlphaDir,
      setHueDir,
    });

  const handleStopAll = useMusicStopAllHandler({
    engine,
    transport: { setAlphaDir, setHueDir, setDroneMuted },
    fano: { setGrayStep, setRhythmPlaying, setRhythmFiringLines, setXorStep, setFanoContextLine, setPartitionPhase },
    algebra: {
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
    },
    signals: { setStopSignal },
  });

  const handleBackgroundStop = useCallback(() => {
    if (backgroundStoppedRef.current) return;
    backgroundStoppedRef.current = true;
    handleStopAll();
    engine.stopAudio();
  }, [backgroundStoppedRef, engine, handleStopAll]);

  useMusicLifecycleStop(handleBackgroundStop, backgroundStoppedRef);

  const handleResetDefaults = useCallback(() => {
    handleStopAll();
    engine.setDroneMuted(false);
    setDroneMuted(false);
    setHueAngle(0);
    setDirectCandidates(createDefaultMusicDirectCandidates());
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
    setLuminanceMode("symmetric");
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
    handleStopAll,
    engine,
    setAlpha0,
    setAlpha7,
    setAlphaSpeed,
    setDirectCandidates,
    setDistA,
    setDistB,
    setDistC,
    setDroneMuted,
    setFanoContextPoint,
    setFmEnabled,
    setGl32Perm,
    setHoveredFanoLine,
    setHueAngle,
    setHueSpeed,
    setLuminanceMode,
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
  ]);

  const handleHueChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      engine.initAudio();
      resumeDrone();
      setHueAngle(Number(e.target.value));
      setDirectCandidates(new Map());
      setSelectedLevels(new Set());
    },
    [engine, resumeDrone, setDirectCandidates, setHueAngle, setSelectedLevels],
  );

  const handleAlphaBarChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      engine.initAudio();
      resumeDrone();
      const v = Number(e.target.value);
      setAlpha0(v);
      setAlpha7(v);
    },
    [engine, resumeDrone, setAlpha0, setAlpha7],
  );

  const handleBlockClick = useCallback(
    (lv: number, angle: number) => {
      ensureAudio();
      engine.initAudio();
      triggerToneBurstAtActiveAlpha(lv, angle);
      const prev = burstTimersRef.current.get(lv);
      if (prev) clearTimeout(prev);
      setBurstHighlight((s) => {
        const n = new Set(s);
        n.delete(lv);
        return n;
      });
      requestAnimationFrame(() => {
        setBurstHighlight((s) => new Set(s).add(lv));
        burstTimersRef.current.set(
          lv,
          setTimeout(() => {
            setBurstHighlight((s) => {
              const n = new Set(s);
              n.delete(lv);
              return n;
            });
            burstTimersRef.current.delete(lv);
          }, 20),
        );
      });
    },
    [burstTimersRef, engine, ensureAudio, setBurstHighlight, triggerToneBurstAtActiveAlpha],
  );

  useMusicKeyboardShortcuts(sonificationLevels, handleBlockClick);

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

  const levelPreview = useMemo(() => buildMusicLevelPreview(directCandidates, hueAngle), [hueAngle, directCandidates]);
  const activeLevels = useMemo(() => buildActiveMusicLevels(levelPreview), [levelPreview]);
  const hueTicks = useMemo(() => buildMusicHueTicks(), []);

  const handleLinkedHueAngleChange = useCallback(
    (a: number) => {
      engine.initAudio();
      resumeDrone();
      for (const lv of MUSIC_ACTIVE_LEVELS) {
        const ci = findClosestCandidate(lv, a);
        const prev = prevCandidatesRef.current.get(lv);
        if (prev !== undefined && prev !== ci) {
          const cand = LEVEL_CANDIDATES[lv][ci];
          if (cand && cand.angle >= 0) triggerToneBurstAtActiveAlpha(lv, cand.angle);
        }
        prevCandidatesRef.current.set(lv, ci);
      }
      setHueAngle(a);
      setDirectCandidates(new Map());
      setSelectedLevels(new Set());
    },
    [engine, prevCandidatesRef, resumeDrone, setDirectCandidates, setHueAngle, setSelectedLevels, triggerToneBurstAtActiveAlpha],
  );

  const handleAlpha0Change = useCallback(
    (a: number) => {
      engine.initAudio();
      resumeDrone();
      setAlpha0(a);
    },
    [engine, resumeDrone, setAlpha0],
  );

  const handleAlpha7Change = useCallback(
    (a: number) => {
      engine.initAudio();
      resumeDrone();
      setAlpha7(a);
    },
    [engine, resumeDrone, setAlpha7],
  );

  const handleOriginModeChange = useCallback(
    (mode: 0 | 7) => {
      resumeDrone();
      setOriginMode(mode);
    },
    [resumeDrone, setOriginMode],
  );

  const handleBgTap = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const el = e.target as HTMLElement;
      if (el.closest("button, [role='button'], input, select, a, canvas, svg")) return;
      setHoveredCandidate(null);
      setHoveredFanoLine(null);
    },
    [setHoveredCandidate, setHoveredFanoLine],
  );

  return {
    engine,
    hueAngle,
    directCandidates,
    hoveredCandidate,
    setHoveredCandidate,
    selectedLevels,
    setSelectedLevels,
    setDirectCandidates,
    volume,
    muted,
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
    luminanceMode,
    setLuminanceMode,
    alpha0,
    alpha7,
    alphaDir,
    hueDir,
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
    k8Layer,
    setK8Layer,
    tetraPhase,
    setTetraPhase,
    errorPos,
    setErrorPos,
    errorPhase,
    setErrorPhase,
    grayStep,
    setGrayStep,
    rhythmPlaying,
    setRhythmPlaying,
    rhythmFiringLines,
    rhythmTempo,
    setRhythmTempo,
    xorA,
    setXorA,
    xorB,
    setXorB,
    xorStep,
    fanoContextPoint,
    setFanoContextPoint,
    fanoContextLine,
    partitionPhase,
    partitionLineIndex,
    stopSignal,
    resetSignal,
    burstHighlight,
    selectedFanoLine,
    levelPreview,
    activeLevels,
    hueTicks,
    handleAlphaPlay,
    handleAlphaReverse,
    handleHuePlay,
    handleHueReverse,
    handleStopAll,
    handleResetDefaults,
    handleHueChange,
    handleAlphaBarChange,
    handleBlockClick,
    handleGrayMelody,
    handleFanoRhythm,
    handlePlayXor,
    handlePlayPointContext,
    handlePlayPartition,
    handleFanoNodeClick,
    handleFanoLineClick,
    handleLinkedHueAngleChange,
    handleAlpha0Change,
    handleAlpha7Change,
    handleOriginModeChange,
    handleMuteToggle,
    handleVolumeChange,
    handleBgTap,
  };
}
