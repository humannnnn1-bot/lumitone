import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ChangeEvent, Dispatch, MouseEvent, MutableRefObject, SetStateAction } from "react";

import { LEVEL_CANDIDATES, findClosestCandidate } from "../color-engine";
import {
  buildActiveMusicLevels,
  buildMusicHueTicks,
  buildMusicLevelPreview,
  buildMusicSonificationLevels,
} from "../music/music-panel-derived";
import { MUSIC_ACTIVE_LEVELS } from "../music/types";
import { useMusicEngine } from "./useMusicEngine";
import { useMusicFanoHandlers } from "./useMusicFanoHandlers";
import {
  useMusicAlgebraState,
  useMusicBurstHighlightState,
  useMusicFanoState,
  useMusicPaletteState,
  useMusicSignalsState,
  useMusicTransportState,
} from "./useMusicPanelState";
import { useMusicResetDefaultsHandler } from "./useMusicResetDefaultsHandler";
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

  const handleResetDefaults = useMusicResetDefaultsHandler({
    engine,
    stopAll: handleStopAll,
    palette: { setHueAngle, setDirectCandidates, setSelectedLevels },
    transport: {
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
      setLuminanceMode,
      setHoveredFanoLine,
    },
    fano: { setRhythmTempo, setFanoContextPoint, setPartitionLineIndex },
    algebra: { setGl32Perm, setDistA, setDistB, setDistC, setOctaA, setOctaB },
    signals: { setResetSignal },
  });

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

  const {
    selectedFanoLine,
    handleGrayMelody,
    handleFanoRhythm,
    handlePlayXor,
    handlePlayPointContext,
    handlePlayPartition,
    handleFanoNodeClick,
    handleFanoLineClick,
  } = useMusicFanoHandlers({
    engine,
    hoveredFanoLine,
    setHoveredFanoLine,
    fano: {
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
    },
  });

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
