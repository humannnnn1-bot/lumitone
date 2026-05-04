import React, { useMemo, useCallback, useRef, useEffect } from "react";
import { LEVEL_INFO, LEVEL_CANDIDATES, findClosestCandidate } from "../color-engine";
import { SP, C, FS } from "../styles/tokens";
import { useTranslation } from "../i18n";
import { ACTIVE_LEVELS } from "./LinkedVisualization";
import { MusicLinkedVisualization } from "./music/MusicLinkedVisualization";
import { useMusicEngine } from "../hooks/useMusicEngine";
import { Oscilloscope } from "./music/Oscilloscope";
import type { MusicHueTick, MusicLevelPreview } from "./music/types";
import { MusicAlgebraPanel } from "./music/MusicAlgebraPanel";
import { MusicFanoControls } from "./music/MusicFanoControls";
import { MusicHueAlphaControls } from "./music/MusicHueAlphaControls";
import { MusicLevelCandidateGrid } from "./music/MusicLevelCandidateGrid";
import { MusicTransportControls } from "./music/MusicTransportControls";
import { FANO_LINES } from "../data/theory-data";
import {
  createDefaultMusicDirectCandidates,
  useMusicAlgebraState,
  useMusicBurstHighlightState,
  useMusicFanoState,
  useMusicPaletteState,
  useMusicSignalsState,
  useMusicTransportState,
} from "../hooks/useMusicPanelState";

/** Find Fano line index for a triple {a, b, a XOR b}, or -1 if not a Fano line */
function findFanoLine(a: number, b: number): number {
  const c = a ^ b;
  const triple = [a, b, c].sort((x, y) => x - y);
  return FANO_LINES.findIndex((line) => {
    const sorted = [...line].sort((x, y) => x - y);
    return sorted[0] === triple[0] && sorted[1] === triple[1] && sorted[2] === triple[2];
  });
}

export const MusicPanel = React.memo(function MusicPanel() {
  const { t } = useTranslation();

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

  // Audio state — always enabled, initAudio called on first interaction
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
          // Only trigger React re-render when rounded degree changes (candidate may change)
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
  ]);

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

  // Compute sonification levels
  const sonificationLevels = useMemo(() => {
    return ACTIVE_LEVELS.map((lv) => {
      const ci = directCandidates.has(lv) ? directCandidates.get(lv)! : findClosestCandidate(lv, hueAngle);
      const cand = LEVEL_CANDIDATES[lv][ci];
      return cand ? { lv, angle: cand.angle, gray: LEVEL_INFO[lv].gray } : { lv, angle: 0, gray: 0 };
    });
  }, [hueAngle, directCandidates]);

  // Audio engine
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

  // Init audio on mount (tab click provides user gesture for AudioContext)
  useEffect(() => {
    engine.initAudio();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Resume drone when user interacts with LinkedVisualization controls
  const resumeDrone = useCallback(() => {
    if (droneMuted) {
      engine.setDroneMuted(false);
      setDroneMuted(false);
    }
  }, [droneMuted, engine, setDroneMuted]);

  const handleAlphaPlay = useCallback(() => {
    engine.initAudio();
    resumeDrone();
    setAlphaDir((d) => (d === 1 ? 0 : 1));
  }, [engine, resumeDrone, setAlphaDir]);
  const handleAlphaReverse = useCallback(() => {
    engine.initAudio();
    resumeDrone();
    setAlphaDir((d) => (d === -1 ? 0 : -1));
  }, [engine, resumeDrone, setAlphaDir]);
  const handleHuePlay = useCallback(() => {
    engine.initAudio();
    resumeDrone();
    setHueDir((d) => (d === 1 ? 0 : 1));
  }, [engine, resumeDrone, setHueDir]);
  const handleHueReverse = useCallback(() => {
    engine.initAudio();
    resumeDrone();
    setHueDir((d) => (d === -1 ? 0 : -1));
  }, [engine, resumeDrone, setHueDir]);

  // Stop All handler
  const handleStopAll = useCallback(() => {
    engine.stopGrayMelody?.();
    engine.stopFanoRhythm?.();
    engine.stopAlgebra?.();
    engine.stopZigzagMelody?.();
    setAlphaDir(0);
    setHueDir(0);
    // Fano plane sidebar state
    setGrayStep(null);
    setRhythmPlaying(false);
    setRhythmFiringLines([]);
    setXorStep(null);
    setFanoContextLine(-1);
    setPartitionPhase(null);
    // Non-explorer transient state
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
    // Signal explorer components to reset transient state
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

  const handleBackgroundStop = useCallback(() => {
    if (backgroundStoppedRef.current) return;
    backgroundStoppedRef.current = true;
    handleStopAll();
    engine.stopAudio();
  }, [backgroundStoppedRef, engine, handleStopAll]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        handleBackgroundStop();
      } else if (document.visibilityState === "visible") {
        backgroundStoppedRef.current = false;
      }
    };
    const onPageHide = () => handleBackgroundStop();
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
  }, [backgroundStoppedRef, handleBackgroundStop]);

  // Reset Defaults handler
  const handleResetDefaults = useCallback(() => {
    handleStopAll();
    engine.setDroneMuted(false);
    setDroneMuted(false);
    setHueAngle(0);
    // Force the canonical 6-color palette (RGB light primaries + CMY pigment primaries):
    // L1=Blue, L2=Red, L3=Magenta, L4=Green, L5=Cyan, L6=Yellow.
    setDirectCandidates(createDefaultMusicDirectCandidates());
    setSelectedLevels(new Set());
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
    // null (not 0): 0 would trigger engine's fano-line-0 gain boost → audible "chord".
    setHoveredFanoLine(null);
    setDistA(5);
    setDistB(3);
    setDistC(6);
    setOctaA(1);
    setOctaB(2);
    // Signal explorer components to reset defaults
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
    setSelectedLevels,
    setVolume,
  ]);

  // Handlers
  const handleHueChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      engine.initAudio();
      resumeDrone();
      setHueAngle(Number(e.target.value));
      setDirectCandidates(new Map());
      setSelectedLevels(new Set());
    },
    [engine, resumeDrone, setDirectCandidates, setHueAngle, setSelectedLevels],
  );

  const handleAlphaBarChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
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
      // Clear existing timer for this level (handles rapid re-trigger)
      const prev = burstTimersRef.current.get(lv);
      if (prev) clearTimeout(prev);
      // Remove then re-add to force transition restart
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

  // Keyboard 1-6: trigger tone burst for corresponding level
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
        if (entry) handleBlockClick(lv, entry.angle);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleBlockClick]);

  // Sequence handlers
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

  // Restart playback when BPM changes while playing
  const tempoMountedRef = useRef(false);
  useEffect(() => {
    if (!tempoMountedRef.current) {
      tempoMountedRef.current = true;
      return;
    }
    if (grayStep !== null) {
      engine.stopGrayMelody();
      engine.playGrayMelody(rhythmTempo, grayStepCbRef.current);
    }
    if (rhythmPlaying) {
      engine.stopFanoRhythm();
      engine.startFanoRhythm(rhythmTempo, fanoBeatCbRef.current);
    }
  }, [rhythmTempo]); // eslint-disable-line react-hooks/exhaustive-deps

  // XOR triple handler
  const handlePlayXor = useCallback(() => {
    if (xorA != null && xorB != null) {
      engine.initAudio();
      const fanoIdx = findFanoLine(xorA, xorB);
      if (fanoIdx >= 0) setHoveredFanoLine(fanoIdx);
      engine.playXorTriple?.(xorA, xorB, (lv) => {
        setXorStep(lv);
        if (lv === null && fanoIdx >= 0) setHoveredFanoLine(null);
      });
    }
  }, [engine, setHoveredFanoLine, setXorStep, xorA, xorB]);

  // Point context handler
  const handlePlayPointContext = useCallback(() => {
    engine.initAudio();
    engine.playPointFanoContext?.(fanoContextPoint, (idx) => {
      setFanoContextLine(idx ?? -1);
      setHoveredFanoLine(idx ?? null);
    });
  }, [engine, fanoContextPoint, setFanoContextLine, setHoveredFanoLine]);

  // Line + Complement handler
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

  // Fano node click → XOR selection
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

  // Fano line click → Line+Complement selection
  const handleFanoLineClick = useCallback(
    (lineIndex: number) => {
      setHoveredFanoLine(lineIndex);
    },
    [setHoveredFanoLine],
  );

  // Level preview (same as GlazePanel)
  const levelPreview = useMemo<MusicLevelPreview[]>(() => {
    return LEVEL_INFO.map((info, lv) => {
      const candidates = LEVEL_CANDIDATES[lv];
      const ci = directCandidates.has(lv) ? directCandidates.get(lv)! : findClosestCandidate(lv, hueAngle);
      const rgb = candidates[ci]?.rgb ?? [128, 128, 128];
      return { lv, name: info.name, rgb, hex: `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` };
    });
  }, [hueAngle, directCandidates]);

  const activeLevels = useMemo(
    () => levelPreview.filter((lp) => lp.lv >= 1 && lp.lv <= 6).map((lp) => ({ lv: lp.lv, rgb: lp.rgb as [number, number, number] })),
    [levelPreview],
  );

  // Candidate switch-point tick marks (memoized once)
  const hueTicks = useMemo<MusicHueTick[]>(() => {
    const ticks: MusicHueTick[] = [];
    for (let lv = 2; lv <= 5; lv++) {
      const cands = LEVEL_CANDIDATES[lv];
      if (cands.length <= 1 || cands[0].angle < 0) continue;
      const angles = cands.map((c) => c.angle).sort((a, b) => a - b);
      for (let i = 0; i < angles.length; i++) {
        const a1 = angles[i];
        const a2 = angles[(i + 1) % angles.length];
        const diff = (a2 - a1 + 360) % 360;
        const mid = (a1 + diff / 2) % 360;
        ticks.push({ deg: mid, color: `rgb(${cands[0].rgb.join(",")})` });
      }
    }
    return ticks;
  }, []);

  // Disabled style for play buttons when audio is off
  // All buttons auto-init audio on click; no disabled state needed

  const handleBgTap = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Reset hover state when tapping non-interactive background areas
      const el = e.target as HTMLElement;
      if (el.closest("button, [role='button'], input, select, a, canvas, svg")) return;
      setHoveredCandidate(null);
      setHoveredFanoLine(null);
    },
    [setHoveredCandidate, setHoveredFanoLine],
  );

  return (
    <div onClick={handleBgTap} style={{ display: "flex", flexDirection: "column", gap: SP.md, padding: `0 ${SP.md}px ${SP.md}px` }}>
      <div className="panel-layout music-layout">
        {/* ═══ Left Column: Visualizations ═══ */}
        <div className="panel-canvas" style={{ "--display-max": "420px" } as React.CSSProperties}>
          {/* Title — same style as other tabs */}
          <div style={{ fontSize: FS.md, color: C.textDim, textAlign: "center", lineHeight: "14px", marginBottom: SP.md }}>
            {t("music_title")}
          </div>

          <MusicHueAlphaControls
            hueAngle={hueAngle}
            alpha0={alpha0}
            hueTicks={hueTicks}
            onHueChange={handleHueChange}
            onAlphaChange={handleAlphaBarChange}
          />

          <MusicLevelCandidateGrid
            levelPreview={levelPreview}
            hueAngle={hueAngle}
            directCandidates={directCandidates}
            selectedLevels={selectedLevels}
            burstHighlight={burstHighlight}
            hoveredCandidate={hoveredCandidate}
            onDirectCandidatesChange={setDirectCandidates}
            onSelectedLevelsChange={setSelectedLevels}
            onHoveredCandidateChange={setHoveredCandidate}
            onBlockClick={handleBlockClick}
          />

          {/* LinkedVisualization */}
          <MusicLinkedVisualization
            hueAngle={hueAngle}
            brushLevel={0}
            onHueAngleChange={(a) => {
              engine.initAudio();
              resumeDrone();
              // Tone burst when candidate changes; pitch follows the active alpha rotation.
              for (const lv of ACTIVE_LEVELS) {
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
            }}
            hoveredCandidate={hoveredCandidate}
            onHoverCandidate={setHoveredCandidate}
            directCandidates={directCandidates}
            scaleMode={scaleMode}
            alpha0={alpha0}
            onAlpha0Change={(a) => {
              engine.initAudio();
              resumeDrone();
              setAlpha0(a);
            }}
            alpha7={alpha7}
            onAlpha7Change={(a) => {
              engine.initAudio();
              resumeDrone();
              setAlpha7(a);
            }}
            onOriginModeChange={(m) => {
              resumeDrone();
              setOriginMode(m);
            }}
          />
        </div>

        {/* ═══ Right Column: Controls ═══ */}
        <div className="panel-sidebar">
          <MusicTransportControls
            scaleMode={scaleMode}
            onScaleModeChange={setScaleMode}
            onStopAll={handleStopAll}
            onResetDefaults={handleResetDefaults}
            luminanceMode={luminanceMode}
            onLuminanceModeChange={setLuminanceMode}
            fmEnabled={fmEnabled}
            onFmEnabledChange={setFmEnabled}
            hueDir={hueDir}
            onHueReverse={handleHueReverse}
            onHuePlay={handleHuePlay}
            hueSpeed={hueSpeed}
            onHueSpeedChange={setHueSpeed}
            alphaDir={alphaDir}
            onAlphaReverse={handleAlphaReverse}
            onAlphaPlay={handleAlphaPlay}
            alphaSpeed={alphaSpeed}
            onAlphaSpeedChange={setAlphaSpeed}
            phaseSpeed={phaseSpeed}
            onPhaseSpeedChange={setPhaseSpeed}
            muted={muted}
            volume={volume}
            onMuteToggle={() => {
              if (muted) {
                setMuted(false);
                setVolume(preMuteVolumeRef.current);
              } else {
                preMuteVolumeRef.current = volume;
                setMuted(true);
              }
              if (droneMuted) {
                engine.setDroneMuted(false);
                setDroneMuted(false);
              }
            }}
            onVolumeChange={(v) => {
              engine.initAudio();
              setVolume(v);
              if (muted && v > 0) setMuted(false);
            }}
          />

          {/* Oscilloscope */}
          <Oscilloscope analyserNode={engine.analyserNode} />

          <MusicFanoControls
            hoveredFanoLine={hoveredFanoLine}
            onHoveredFanoLineChange={setHoveredFanoLine}
            onFanoNodeClick={handleFanoNodeClick}
            onFanoLineClick={handleFanoLineClick}
            activeLevels={activeLevels}
            grayStep={grayStep}
            xorStep={xorStep}
            rhythmPlaying={rhythmPlaying}
            rhythmFiringLines={rhythmFiringLines}
            partitionPhase={partitionPhase}
            partitionLineIndex={partitionLineIndex}
            xorA={xorA}
            xorB={xorB}
            onXorAChange={setXorA}
            onXorBChange={setXorB}
            onPlayXor={handlePlayXor}
            fanoContextPoint={fanoContextPoint}
            onFanoContextPointChange={setFanoContextPoint}
            fanoContextLine={fanoContextLine}
            onPlayPointContext={handlePlayPointContext}
            selectedFanoLine={selectedFanoLine}
            onSelectedFanoLineChange={setHoveredFanoLine}
            onPlayPartition={handlePlayPartition}
            onGrayMelody={handleGrayMelody}
            onFanoRhythm={handleFanoRhythm}
            rhythmTempo={rhythmTempo}
            onRhythmTempoChange={setRhythmTempo}
          />
        </div>
      </div>

      <MusicAlgebraPanel
        engine={engine}
        activeLevels={activeLevels}
        stopSignal={stopSignal}
        resetSignal={resetSignal}
        cayley={{
          row: cayleyRow,
          onRowChange: setCayleyRow,
          col: cayleyCol,
          onColChange: setCayleyCol,
        }}
        distributive={{
          a: distA,
          onAChange: setDistA,
          b: distB,
          onBChange: setDistB,
          c: distC,
          onCChange: setDistC,
          phase: distPhase,
          onPhaseChange: setDistPhase,
        }}
        andTriads={{
          step: andStep,
          onStepChange: setAndStep,
        }}
        errorCorrection={{
          pos: errorPos,
          phase: errorPhase,
          onPosChange: setErrorPos,
          onPhaseChange: setErrorPhase,
        }}
        hamming={{
          mode: hammingMode,
          onModeChange: setHammingMode,
          weightPlaying,
          onWeightPlayingChange: setWeightPlaying,
          weightStep,
          onWeightStepChange: setWeightStep,
          onHoveredFanoLineChange: setHoveredFanoLine,
        }}
        octahedron={{
          a: octaA,
          onAChange: setOctaA,
          b: octaB,
          onBChange: setOctaB,
          phase: octaPhase,
          onPhaseChange: setOctaPhase,
        }}
        gray3={{
          playing: gray3Playing,
          onPlayingChange: setGray3Playing,
          code: gray3Code,
          onCodeChange: setGray3Code,
        }}
        polyhedra={{
          k8Layer,
          onK8LayerChange: setK8Layer,
          tetraPhase,
          onTetraPhaseChange: setTetraPhase,
        }}
        gl32={{
          perm: gl32Perm,
          onPermChange: setGl32Perm,
          flash: gl32Flash,
          onFlashChange: setGl32Flash,
        }}
      />
    </div>
  );
});
