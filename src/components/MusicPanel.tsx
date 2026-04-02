import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { LEVEL_INFO, LEVEL_CANDIDATES, DEFAULT_CC, findClosestCandidate } from "../color-engine";
import { SP, C, R, FS, SHADOW, HUE_GRADIENT, FONT } from "../tokens";
import { S_BTN_SM, S_BTN_SM_ACTIVE } from "../styles";
import { useTranslation } from "../i18n";
import { LinkedViz, ACTIVE_LEVELS } from "./LinkedViz";
import { useMusicEngine, type ScaleMode } from "../hooks/useMusicEngine";
import { FANO_LINES } from "./theory/theory-data";
import { MiniFanoChord } from "./music/MiniFanoChord";
import { Oscilloscope } from "./music/Oscilloscope";
import { XorFanoLine } from "./music/XorFanoLine";
import { ParityGrid } from "./music/ParityGrid";
import { SyndromeTimeline } from "./music/SyndromeTimeline";
import { CayleyGrid } from "./music/CayleyGrid";
import { GrayCube } from "./music/GrayCube";
import { FanoRhythmGrid } from "./music/FanoRhythmGrid";
import { LineDualPartition } from "./music/LineDualPartition";
import { WeightHistogram } from "./music/WeightHistogram";
import { GL32Arrows } from "./music/GL32Arrows";
import { LuminanceBars } from "./music/LuminanceBars";
import { ComplementPairs } from "./music/ComplementPairs";
import { ZigzagGraph } from "./music/ZigzagGraph";
import { PointFanoContext } from "./music/PointFanoContext";
import { DistributiveFlow } from "./music/DistributiveFlow";

/* ── Style constants ── */

const S_ROW: React.CSSProperties = {
  display: "flex",
  gap: SP.sm,
  alignItems: "center",
  flexWrap: "wrap",
  justifyContent: "center",
};
const S_LABEL: React.CSSProperties = { fontSize: FS.lg, color: C.textDim, whiteSpace: "nowrap" };
const S_SELECT: React.CSSProperties = {
  fontSize: FS.lg,
  padding: "2px 4px",
  background: C.bgPanel,
  color: C.textPrimary,
  border: `1px solid ${C.border}`,
  borderRadius: R.md,
};

const S_HUE_WRAP: React.CSSProperties = { position: "relative", width: "100%", paddingTop: SP.xl };
const S_ALPHA_TRACK: React.CSSProperties = {
  width: "100%",
  height: 16,
  borderRadius: R.lg,
  background: `linear-gradient(90deg, ${C.accent}33, ${C.accent}, ${C.accent}33)`,
  cursor: "pointer",
  border: `1px solid ${C.border}`,
};
const S_HUE_TRACK: React.CSSProperties = {
  width: "100%",
  height: 16,
  borderRadius: R.lg,
  background: HUE_GRADIENT,
  cursor: "pointer",
  border: `1px solid ${C.border}`,
};
const S_HUE_INPUT: React.CSSProperties = {
  position: "absolute",
  top: 8,
  left: 0,
  width: "100%",
  height: 16,
  opacity: 0,
  cursor: "pointer",
};

const S_SECTION: React.CSSProperties = {
  background: "rgba(96, 128, 255, 0.06)",
  border: "none",
  borderLeft: `2px solid ${C.accent}`,
  padding: "6px 12px",
  fontSize: FS.lg,
  letterSpacing: "0.08em",
  color: C.textDim,
  fontFamily: FONT.mono,
  width: "100%",
};

const S_CARD: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 4,
  padding: "6px",
  borderRadius: R.lg,
  border: `1px solid ${C.border}`,
  background: "rgba(255,255,255,0.02)",
};
const S_CARD_FANO: React.CSSProperties = { ...S_CARD, borderTop: "2px solid #4060c0" };
const S_CARD_GROUP: React.CSSProperties = { ...S_CARD, borderTop: "2px solid #c0a040" };

const S_CARD_GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: SP.xl,
  width: "100%",
};

/** Find Fano line index for a triple {a, b, a⊕b}, or -1 if not a Fano line */
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

  // Shared state (replaces GlazeContext for this tab)
  const [hueAngle, setHueAngle] = useState(0);
  const [directCandidates, setDirectCandidates] = useState<Map<number, number>>(() => {
    const m = new Map<number, number>();
    for (let lv = 1; lv <= 6; lv++) m.set(lv, DEFAULT_CC[lv]);
    return m;
  });
  const [hoveredCandidate, setHoveredCandidate] = useState<{ lv: number; ci: number } | null>(null);

  // Audio state — always enabled, initAudio called on first interaction
  const audioInitedRef = useRef(false);
  const ensureAudio = useCallback(() => {
    if (!audioInitedRef.current) {
      audioInitedRef.current = true;
    }
  }, []);
  const [volume, setVolume] = useState(0.7);
  const [muted, setMuted] = useState(false);
  const preMuteVolumeRef = useRef(0.7);
  const [scaleMode, setScaleMode] = useState<ScaleMode>("12tet");
  const [fmEnabled, setFmEnabled] = useState(false);
  const [panEnabled, setPanEnabled] = useState(false);
  const [alphaSpeed, setAlphaSpeed] = useState(36);
  const [hueSpeed, setHueSpeed] = useState(36);
  const [hoveredFanoLine, setHoveredFanoLine] = useState<number | null>(null);

  // LinkedViz alpha state (lifted here for audio engine access)
  const [alpha0, setAlpha0] = useState(0);
  const [alpha7, setAlpha7] = useState(0);
  const [originMode, setOriginMode] = useState<0 | 7>(0);
  const [droneMuted, setDroneMuted] = useState(false);

  // Auto-rotation state
  const [alphaDir, setAlphaDir] = useState<1 | -1 | 0>(0);
  const [hueDir, setHueDir] = useState<1 | -1 | 0>(0);
  const prevTimeRef = useRef<number>(0);
  const hueRef = useRef(hueAngle);
  const lastHueRoundedRef = useRef(Math.round(hueAngle));
  useEffect(() => {
    hueRef.current = hueAngle;
    lastHueRoundedRef.current = Math.round(hueAngle);
  }, [hueAngle]);

  useEffect(() => {
    if (alphaDir === 0 && hueDir === 0) return;
    let rafId: number;
    const tick = (time: number) => {
      if (prevTimeRef.current) {
        const dt = (time - prevTimeRef.current) / 1000;
        if (alphaDir !== 0) {
          const ad = alphaSpeed * dt * alphaDir;
          setAlpha0((a) => (((a + ad) % 360) + 360) % 360);
          setAlpha7((a) => (((a + ad) % 360) + 360) % 360);
        }
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
  }, [alphaDir, hueDir, alphaSpeed, hueSpeed]);

  // Sequencer state
  const [grayStep, setGrayStep] = useState<number | null>(null);
  const [rhythmPlaying, setRhythmPlaying] = useState(false);
  const [rhythmTempo, setRhythmTempo] = useState(120);

  // Algebra state
  const [xorA, setXorA] = useState<number | null>(null);
  const [xorB, setXorB] = useState<number | null>(null);
  const [errorPos, setErrorPos] = useState(1);
  const [errorPhase, setErrorPhase] = useState<string | null>(null);
  const [gray3Playing, setGray3Playing] = useState(false);
  const [weightPlaying, setWeightPlaying] = useState(false);
  const [weightStep, setWeightStep] = useState<{ positions: number[]; weight: number; index: number } | null>(null);
  const [hammingMode, setHammingMode] = useState<"743" | "844">("743");
  const [cayleyRow, setCayleyRow] = useState(1);
  const [luminanceMode, setLuminanceMode] = useState<"symmetric" | "luminance">("symmetric");

  // Visualization callback state
  const [xorStep, setXorStep] = useState<number | null>(null);
  const [activeParityGroup, setActiveParityGroup] = useState<0 | 1 | 2 | null>(null);
  const [dualPhase, setDualPhase] = useState<"line" | "dual" | null>(null);
  const [dualLineIndex, setDualLineIndex] = useState(0);
  const [gray3Code, setGray3Code] = useState<number | null>(null);
  const [cayleyCol, setCayleyCol] = useState(-1);
  const [rhythmBeat, setRhythmBeat] = useState(0);
  const [gl32Perm, setGl32Perm] = useState([0, 1, 2, 3, 4, 5, 6, 7]);
  const [gl32Flash, setGl32Flash] = useState(false);
  const [lumFlash, setLumFlash] = useState(false);

  // Extended algebra state
  const [canonPair, setCanonPair] = useState(-1);
  const [zigzagStep, setZigzagStep] = useState<number | null>(null);
  const [fanoContextPoint, setFanoContextPoint] = useState(1);
  const [fanoContextLine, setFanoContextLine] = useState(-1);
  const [distA, setDistA] = useState(5);
  const [distB, setDistB] = useState(3);
  const [distC, setDistC] = useState(6);
  const [distPhase, setDistPhase] = useState<"bxc" | "left" | "ab" | "ac" | "right" | "equal" | null>(null);

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
    panEnabled,
    hoveredFanoLine,
    luminanceMode,
    originMode,
  });

  // Resume drone when user interacts with LinkedViz controls
  const resumeDrone = useCallback(() => {
    if (droneMuted) {
      engine.setDroneMuted(false);
      setDroneMuted(false);
    }
  }, [droneMuted, engine]);

  const handleAlphaPlay = useCallback(() => {
    engine.initAudio();
    resumeDrone();
    setAlphaDir((d) => (d === 1 ? 0 : 1));
  }, [engine, resumeDrone]);
  const handleAlphaReverse = useCallback(() => {
    engine.initAudio();
    resumeDrone();
    setAlphaDir((d) => (d === -1 ? 0 : -1));
  }, [engine, resumeDrone]);
  const handleHuePlay = useCallback(() => {
    engine.initAudio();
    resumeDrone();
    setHueDir((d) => (d === 1 ? 0 : 1));
  }, [engine, resumeDrone]);
  const handleHueReverse = useCallback(() => {
    engine.initAudio();
    resumeDrone();
    setHueDir((d) => (d === -1 ? 0 : -1));
  }, [engine, resumeDrone]);

  // Stop All handler
  const handleStopAll = useCallback(() => {
    engine.stopGrayMelody?.();
    engine.stopFanoRhythm?.();
    engine.stopAlgebra?.();
    setAlphaDir(0);
    setHueDir(0);
    setGrayStep(null);
    setRhythmPlaying(false);
    setGray3Playing(false);
    setWeightPlaying(false);
    setWeightStep(null);
    setErrorPhase(null);
    setXorStep(null);
    setActiveParityGroup(null);
    setDualPhase(null);
    setGray3Code(null);
    setCayleyCol(-1);
    setCanonPair(-1);
    setZigzagStep(null);
    setFanoContextLine(-1);
    setDistPhase(null);
    engine.setDroneMuted(true);
    setDroneMuted(true);
  }, [engine]);

  // Reset Defaults handler
  const handleResetDefaults = useCallback(() => {
    handleStopAll();
    engine.setDroneMuted(false);
    setDroneMuted(false);
    setHueAngle(0);
    setDirectCandidates(new Map());
    setVolume(0.7);
    setScaleMode("12tet");
    setFmEnabled(false);
    setPanEnabled(false);
    setAlphaSpeed(36);
    setHueSpeed(36);
    setAlpha0(0);
    setAlpha7(0);
    setRhythmTempo(120);
    setLuminanceMode("symmetric");
    setGl32Perm([0, 1, 2, 3, 4, 5, 6, 7]);
    setFanoContextPoint(1);
    setDistA(5);
    setDistB(3);
    setDistC(6);
  }, [handleStopAll, engine]);

  // Handlers
  const handleHueChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      engine.initAudio();
      resumeDrone();
      setHueAngle(Number(e.target.value));
      setDirectCandidates(new Map());
    },
    [engine, resumeDrone],
  );

  const handleAlphaBarChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      engine.initAudio();
      resumeDrone();
      const v = Number(e.target.value);
      setAlpha0(v);
      setAlpha7(v);
    },
    [engine],
  );

  const handleBlockClick = useCallback(
    (lv: number, angle: number) => {
      ensureAudio();
      engine.initAudio();
      engine.triggerToneBurst(lv, angle);
    },
    [engine, ensureAudio],
  );

  const grayStepCbRef = useRef<(lv: number | null) => void>((lv: number | null) => setGrayStep(lv));
  const fanoBeatCbRef = useRef<(line: number, pos: number) => void>((_line, pos) => setRhythmBeat(pos % 7));

  const handleGrayMelody = useCallback(() => {
    if (grayStep !== null) {
      engine.stopGrayMelody();
      setGrayStep(null);
      return;
    }
    engine.initAudio();
    engine.playGrayMelody(rhythmTempo, grayStepCbRef.current);
  }, [engine, grayStep, rhythmTempo]);

  const handleFanoRhythm = useCallback(() => {
    if (rhythmPlaying) {
      engine.stopFanoRhythm();
      setRhythmPlaying(false);
      return;
    }
    engine.initAudio();
    engine.startFanoRhythm(rhythmTempo, fanoBeatCbRef.current);
    setRhythmPlaying(true);
  }, [engine, rhythmPlaying, rhythmTempo]);

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

  // Level preview (same as GlazePanel)
  const levelPreview = useMemo(() => {
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

  // Hue marker position
  const hueMarkerLeft = `${((hueAngle % 360) / 360) * 100}%`;
  const alphaMarkerLeft = `${((((alpha0 % 360) + 360) % 360) / 360) * 100}%`;

  // Candidate switch-point tick marks (memoized once)
  const hueTicks = useMemo(() => {
    const ticks: { deg: number; color: string }[] = [];
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

  const handleBgTap = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Reset hover state when tapping non-interactive background areas
    const el = e.target as HTMLElement;
    if (el.closest("button, [role='button'], input, select, a, canvas, svg")) return;
    setHoveredCandidate(null);
    setHoveredFanoLine(null);
  }, []);

  return (
    <div onClick={handleBgTap} style={{ display: "flex", flexDirection: "column", gap: SP.md, padding: `0 ${SP.md}px ${SP.md}px` }}>
      <div className="panel-layout music-layout">
        {/* ═══ Left Column: Visualizations ═══ */}
        <div className="panel-canvas" style={{ "--display-max": "420px" } as React.CSSProperties}>
          {/* Title — same style as other tabs */}
          <div style={{ fontSize: FS.md, color: C.textDim, textAlign: "center", lineHeight: "14px", marginBottom: SP.md }}>
            {t("music_title")}
          </div>

          {/* Hue angle slider with marker */}
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: SP.md }}>
            <div style={{ fontSize: FS.lg, color: C.textPrimary, textAlign: "center", fontFamily: FONT.mono }}>
              {t("glaze_hue_angle")}: {Math.round(hueAngle % 360)}&deg;
            </div>
            <div style={S_HUE_WRAP}>
              <div style={S_HUE_TRACK} />
              {/* Marker triangle */}
              <div
                style={{
                  position: "absolute",
                  top: 1,
                  left: hueMarkerLeft,
                  transform: "translateX(-5px)",
                  width: 0,
                  height: 0,
                  borderLeft: "5px solid transparent",
                  borderRight: "5px solid transparent",
                  borderTop: `6px solid ${C.textPrimary}`,
                  pointerEvents: "none",
                }}
              />
              {/* Candidate switch-point tick marks (above the bar) */}
              {hueTicks.map((tick, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    top: 3,
                    left: `${(tick.deg / 359) * 100}%`,
                    transform: "translateX(-0.5px)",
                    width: 1,
                    height: 5,
                    background: C.textDimmer,
                    pointerEvents: "none",
                  }}
                />
              ))}
              <input
                type="range"
                min={0}
                max={359}
                step={1}
                value={Math.round(hueAngle) % 360}
                onChange={handleHueChange}
                aria-label={t("aria_hue_slider")}
                style={S_HUE_INPUT}
              />
            </div>
            {/* Alpha angle bar */}
            <div style={{ fontSize: FS.lg, color: C.textPrimary, textAlign: "center", fontFamily: FONT.mono }}>
              {"\u03b1"}: {Math.round(((alpha0 % 360) + 360) % 360)}&deg;
            </div>
            <div style={S_HUE_WRAP}>
              <div style={S_ALPHA_TRACK} />
              {/* Marker triangle */}
              <div
                style={{
                  position: "absolute",
                  top: 1,
                  left: alphaMarkerLeft,
                  transform: "translateX(-5px)",
                  width: 0,
                  height: 0,
                  borderLeft: "5px solid transparent",
                  borderRight: "5px solid transparent",
                  borderTop: `6px solid ${C.textPrimary}`,
                  pointerEvents: "none",
                }}
              />
              {/* 60° interval tick marks */}
              {[0, 60, 120, 180, 240, 300].map((deg) => (
                <div
                  key={deg}
                  style={{
                    position: "absolute",
                    top: 3,
                    left: `${(deg / 360) * 100}%`,
                    transform: "translateX(-0.5px)",
                    width: 1,
                    height: 5,
                    background: C.textDimmer,
                    pointerEvents: "none",
                  }}
                />
              ))}
              <input
                type="range"
                min={0}
                max={359}
                step={1}
                value={Math.round(((alpha0 % 360) + 360) % 360)}
                onChange={handleAlphaBarChange}
                aria-label="Alpha angle"
                style={S_HUE_INPUT}
              />
            </div>
          </div>

          {/* Level preview — 2D candidate grid with tone burst */}
          <div style={{ display: "flex", gap: SP.sm, justifyContent: "center", alignItems: "center", marginTop: SP.lg }}>
            {levelPreview.map((lp) => {
              const cands = LEVEL_CANDIDATES[lp.lv];
              const hasCands = cands.length > 1;
              const isDirect = directCandidates.has(lp.lv);
              const directIdx = directCandidates.get(lp.lv);
              const autoIdx = hasCands ? findClosestCandidate(lp.lv, hueAngle) : 0;
              const currentIdx = isDirect ? directIdx! : autoIdx;
              const prevIdx = hasCands ? (currentIdx - 1 + cands.length) % cands.length : -1;
              const nextIdx = hasCands ? (currentIdx + 1) % cands.length : -1;

              const isTouchDevice = typeof window !== "undefined" && "ontouchstart" in window;

              const makeSwatch = (ci: number, size: number) => {
                const cand = cands[ci];
                const isSelected = directCandidates.get(lp.lv) === ci;
                const isSwatchHovered = hoveredCandidate !== null && hoveredCandidate.lv === lp.lv && hoveredCandidate.ci === ci;
                const isDimmed = hoveredCandidate !== null && !isSwatchHovered;
                const swatchClick = isTouchDevice
                  ? undefined
                  : () => {
                      const deselecting = directCandidates.get(lp.lv) === ci;
                      setDirectCandidates((prev) => {
                        const next = new Map(prev);
                        if (deselecting) next.delete(lp.lv);
                        else next.set(lp.lv, ci);
                        return next;
                      });
                      setHoveredCandidate({ lv: lp.lv, ci: deselecting ? autoIdx : ci });
                      handleBlockClick(lp.lv, cand.angle);
                    };
                return (
                  <div
                    key={ci}
                    role={isTouchDevice ? undefined : "button"}
                    tabIndex={isTouchDevice ? -1 : 0}
                    onClick={swatchClick}
                    onKeyDown={
                      isTouchDevice
                        ? undefined
                        : (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              swatchClick?.();
                            }
                          }
                    }
                    onPointerEnter={isTouchDevice ? undefined : () => setHoveredCandidate({ lv: lp.lv, ci })}
                    onPointerLeave={isTouchDevice ? undefined : () => setHoveredCandidate(null)}
                    title={`#${cand.rgb.map((c) => c.toString(16).padStart(2, "0")).join("")} ${Math.round(cand.angle)}\u00B0`}
                    style={{
                      width: size,
                      height: size,
                      borderRadius: R.md,
                      cursor: isTouchDevice ? "default" : "pointer",
                      background: `rgb(${cand.rgb.join(",")})`,
                      border: `2px solid ${isSwatchHovered || isSelected ? C.accent : C.border}`,
                      boxSizing: "border-box" as const,
                      boxShadow: isSwatchHovered || isSelected ? SHADOW.glow(C.accent) : "none",
                      opacity: isDimmed ? 0.35 : 1,
                      transition: "opacity 0.15s, box-shadow 0.15s, border-color 0.15s",
                    }}
                  />
                );
              };

              const cycleCand = (dir: number) => {
                const cur = directCandidates.has(lp.lv) ? directCandidates.get(lp.lv)! : autoIdx;
                const newIdx = (((cur + dir) % cands.length) + cands.length) % cands.length;
                setDirectCandidates((prev) => {
                  const next = new Map(prev);
                  next.set(lp.lv, newIdx);
                  return next;
                });
                setHoveredCandidate({ lv: lp.lv, ci: newIdx });
              };

              const handleWheel = hasCands
                ? (e: React.WheelEvent) => {
                    e.preventDefault();
                    cycleCand(e.deltaY > 0 ? 1 : -1);
                  }
                : undefined;

              const swipeStartRef = { current: 0, startX: 0 };
              const handleTouchStart = hasCands
                ? (e: React.TouchEvent) => {
                    swipeStartRef.current = e.touches[0].clientY;
                    swipeStartRef.startX = e.touches[0].clientX;
                  }
                : undefined;
              const handleTouchEnd = hasCands
                ? (e: React.TouchEvent) => {
                    const dy = e.changedTouches[0].clientY - swipeStartRef.current;
                    const dx = e.changedTouches[0].clientX - swipeStartRef.startX;
                    // Only cycle if intentional vertical swipe (not a tap)
                    if (Math.abs(dy) > 30 && Math.abs(dy) > Math.abs(dx)) cycleCand(dy > 0 ? 1 : -1);
                  }
                : undefined;

              return (
                <div
                  key={lp.lv}
                  onWheel={handleWheel}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                    cursor: hasCands ? "pointer" : "default",
                    touchAction: hasCands ? "none" : "auto",
                  }}
                >
                  {/* Upper candidate */}
                  {hasCands ? makeSwatch(prevIdx, 20) : <div style={{ height: 20 }} />}
                  {/* Current / main swatch */}
                  {(() => {
                    const mainCi = currentIdx;
                    const mainCand = cands[mainCi];
                    const isMainHovered = hoveredCandidate !== null && hoveredCandidate.lv === lp.lv && hoveredCandidate.ci === mainCi;
                    const isMainDimmed = hoveredCandidate !== null && !isMainHovered;
                    return (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (mainCand) handleBlockClick(lp.lv, mainCand.angle);
                        }}
                        onKeyDown={
                          isTouchDevice
                            ? undefined
                            : (e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  if (mainCand) handleBlockClick(lp.lv, mainCand.angle);
                                }
                              }
                        }
                        onPointerEnter={isTouchDevice ? undefined : () => setHoveredCandidate({ lv: lp.lv, ci: mainCi })}
                        onPointerLeave={isTouchDevice ? undefined : () => setHoveredCandidate(null)}
                        title={
                          mainCand
                            ? `#${mainCand.rgb.map((c) => c.toString(16).padStart(2, "0")).join("")} ${Math.round(mainCand.angle)}\u00B0`
                            : undefined
                        }
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: R.md,
                          background: isDirect ? `rgb(${cands[directIdx!]?.rgb.join(",")})` : lp.hex,
                          border: `2px solid ${isMainHovered || isDirect ? C.accent : C.border}`,
                          boxSizing: "border-box" as const,
                          cursor: "pointer",
                          boxShadow: isMainHovered ? SHADOW.glow(C.accent) : "none",
                          opacity: isMainDimmed ? 0.35 : 1,
                          transition: "opacity 0.15s, box-shadow 0.15s, border-color 0.15s",
                        }}
                      />
                    );
                  })()}
                  {/* Lower candidate */}
                  {hasCands ? makeSwatch(nextIdx, 20) : <div style={{ height: 20 }} />}
                </div>
              );
            })}
          </div>

          {/* LinkedViz */}
          <LinkedViz
            hueAngle={hueAngle}
            brushLevel={0}
            onHueAngleChange={(a) => {
              resumeDrone();
              setHueAngle(a);
            }}
            hoveredCandidate={hoveredCandidate}
            onHoverCandidate={setHoveredCandidate}
            directCandidates={directCandidates}
            hideLegend
            scaleMode={scaleMode}
            alpha0={alpha0}
            onAlpha0Change={(a) => {
              resumeDrone();
              setAlpha0(a);
            }}
            alpha7={alpha7}
            onAlpha7Change={(a) => {
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
          {/* ── Transport + Rotation ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: SP.sm, width: "100%" }}>
            {/* Control buttons — grouped with spacing */}
            <div style={{ display: "flex", justifyContent: "center", gap: SP.sm, width: "100%", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
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
                style={{
                  ...S_BTN_SM,
                  opacity: muted ? 0.5 : 1,
                }}
                aria-label={muted ? "Unmute" : "Mute"}
                title={muted ? "Unmute" : "Mute"}
              >
                {muted ? "\uD83D\uDD07" : "\uD83D\uDD0A"}
                {t("music_mute")}
              </button>
              <span style={{ width: SP.md }} />
              <button type="button" style={{ ...S_BTN_SM, borderColor: C.error, color: C.error }} onClick={handleStopAll}>
                {t("music_stop_all")}
              </button>
              <button type="button" style={S_BTN_SM} onClick={handleResetDefaults}>
                {t("music_reset")}
              </button>
              <span style={{ width: SP.xl }} />
              <button type="button" style={fmEnabled ? S_BTN_SM_ACTIVE : S_BTN_SM} onClick={() => setFmEnabled(!fmEnabled)}>
                {t("music_fm_on")}
              </button>
              <button type="button" style={panEnabled ? S_BTN_SM_ACTIVE : S_BTN_SM} onClick={() => setPanEnabled(!panEnabled)}>
                {t("music_panning")}
              </button>
              <span style={{ width: SP.xl }} />
              {(["12tet", "ji", "octatonic"] as ScaleMode[]).map((m) => (
                <button key={m} type="button" style={scaleMode === m ? S_BTN_SM_ACTIVE : S_BTN_SM} onClick={() => setScaleMode(m)}>
                  {t(`music_scale_${m}`)}
                </button>
              ))}
            </div>
            {/* Hue rotation (top — near hue slider) */}
            <div style={{ display: "flex", gap: SP.sm, alignItems: "center" }}>
              <button
                type="button"
                style={{ ...(hueDir === -1 ? S_BTN_SM_ACTIVE : S_BTN_SM), minWidth: 36 }}
                onClick={handleHueReverse}
                title={t("linkedviz_hue_reverse")}
              >
                {"H\u25C0"}
              </button>
              <button
                type="button"
                style={{ ...(hueDir === 1 ? S_BTN_SM_ACTIVE : S_BTN_SM), minWidth: 36 }}
                onClick={handleHuePlay}
                title={t("linkedviz_hue_play")}
              >
                {"H\u25B6"}
              </button>
              <input
                type="range"
                min={10}
                max={120}
                value={hueSpeed}
                onChange={(e) => setHueSpeed(Number(e.target.value))}
                aria-label="Hue speed"
                style={{ flex: 1, minWidth: 60 }}
              />
              <span style={{ fontSize: FS.lg, color: C.textDim, fontVariantNumeric: "tabular-nums", width: 42 }}>{hueSpeed}&deg;/s</span>
            </div>
            {/* Alpha rotation (bottom — near LinkedViz α display) */}
            <div style={{ display: "flex", gap: SP.sm, alignItems: "center" }}>
              <button
                type="button"
                style={{ ...(alphaDir === -1 ? S_BTN_SM_ACTIVE : S_BTN_SM), minWidth: 36 }}
                onClick={handleAlphaReverse}
                title={t("linkedviz_alpha_reverse")}
              >
                {"\u03b1\u25C0"}
              </button>
              <button
                type="button"
                style={{ ...(alphaDir === 1 ? S_BTN_SM_ACTIVE : S_BTN_SM), minWidth: 36 }}
                onClick={handleAlphaPlay}
                title={t("linkedviz_alpha_play")}
              >
                {"\u03b1\u25B6"}
              </button>
              <input
                type="range"
                min={10}
                max={120}
                value={alphaSpeed}
                onChange={(e) => setAlphaSpeed(Number(e.target.value))}
                aria-label="Alpha speed"
                style={{ flex: 1, minWidth: 60 }}
              />
              <span style={{ fontSize: FS.lg, color: C.textDim, fontVariantNumeric: "tabular-nums", width: 42 }}>{alphaSpeed}&deg;/s</span>
            </div>
            {/* Volume (bottom — global setting) */}
            <div style={{ display: "flex", gap: SP.sm, alignItems: "center", justifyContent: "center" }}>
              <span style={S_LABEL}>{t("music_volume")}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={muted ? 0 : Math.round(volume * 100)}
                onChange={(e) => {
                  engine.initAudio();
                  const v = Number(e.target.value) / 100;
                  setVolume(v);
                  if (muted && v > 0) setMuted(false);
                }}
                aria-label={t("music_volume")}
                style={{ flex: 1, minWidth: 60 }}
              />
            </div>
          </div>

          {/* Oscilloscope — between volume and Fano */}
          <Oscilloscope analyserNode={engine.analyserNode} />

          {/* ═══ Fano Sequences ═══ */}
          <div style={{ ...S_SECTION, marginTop: SP.xl }} role="heading" aria-level={3}>
            {t("music_section_sequences")}
          </div>
          <div
            id="music-sequences-panel"
            role="region"
            style={{ display: "flex", flexDirection: "column", gap: SP.md, alignItems: "center", width: "100%" }}
          >
            {/* Mini Fano Chord diagram — larger */}
            <div style={{ fontSize: FS.lg, color: C.textDim, textAlign: "center" }}>{t("music_fano_chord")}</div>
            <div style={{ width: "100%", maxWidth: 300 }}>
              <MiniFanoChord
                hoveredLine={hoveredFanoLine}
                onLineHover={setHoveredFanoLine}
                activeLevels={activeLevels}
                playingLevel={grayStep}
                playingLine={rhythmPlaying ? rhythmBeat : null}
              />
            </div>

            {/* Sequencer controls — below the diagram */}
            <div style={{ display: "flex", gap: SP.sm, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
              <button type="button" style={grayStep !== null ? S_BTN_SM_ACTIVE : S_BTN_SM} onClick={handleGrayMelody}>
                {grayStep !== null ? t("music_gray_stop") : t("music_gray_melody")}
              </button>
              <button type="button" style={rhythmPlaying ? S_BTN_SM_ACTIVE : S_BTN_SM} onClick={handleFanoRhythm}>
                {rhythmPlaying ? t("music_rhythm_stop") : t("music_rhythm_start")}
              </button>
              <span style={{ fontSize: FS.lg, color: C.textDim }}>{t("music_rhythm_tempo")}</span>
              <input
                type="range"
                min={60}
                max={200}
                value={rhythmTempo}
                onChange={(e) => setRhythmTempo(Number(e.target.value))}
                aria-label={t("music_rhythm_tempo")}
                style={{ width: 80, minWidth: 60 }}
              />
              <span style={{ fontSize: FS.lg, color: C.textDim }}>{rhythmTempo}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Algebraic Sonification — full-width below both columns ═══ */}
      <div style={{ ...S_SECTION, marginTop: SP.xl }} role="heading" aria-level={3}>
        {t("music_section_algebra")}
      </div>
      <div id="music-algebra-panel" role="region" className="music-algebra-scroll" style={S_CARD_GRID}>
        {/* ── A: Core Algebra (GF(2)³ operations) ── */}

        {/* 1. XOR Triple */}
        <div style={S_CARD_FANO}>
          <div style={S_ROW}>
            <span style={S_LABEL}>{t("music_xor_triple")}</span>
            <select value={xorA ?? ""} onChange={(e) => setXorA(e.target.value ? Number(e.target.value) : null)} style={S_SELECT}>
              <option value="">--</option>
              {[1, 2, 3, 4, 5, 6, 7].map((lv) => (
                <option key={lv} value={lv}>
                  {lv}
                </option>
              ))}
            </select>
            <select value={xorB ?? ""} onChange={(e) => setXorB(e.target.value ? Number(e.target.value) : null)} style={S_SELECT}>
              <option value="">--</option>
              {[1, 2, 3, 4, 5, 6, 7].map((lv) => (
                <option key={lv} value={lv}>
                  {lv}
                </option>
              ))}
            </select>
            {xorA != null && xorB != null && <span style={{ fontSize: FS.lg, color: C.accent }}>= {xorA ^ xorB}</span>}
            <button
              type="button"
              style={xorStep !== null ? S_BTN_SM_ACTIVE : S_BTN_SM}
              onClick={() => {
                if (xorA != null && xorB != null) {
                  engine.initAudio();
                  const fanoIdx = findFanoLine(xorA, xorB);
                  if (fanoIdx >= 0) setHoveredFanoLine(fanoIdx);
                  engine.playXorTriple?.(xorA, xorB, (lv) => {
                    setXorStep(lv);
                    if (lv === null && fanoIdx >= 0) setHoveredFanoLine(null);
                  });
                }
              }}
              disabled={xorA == null || xorB == null}
            >
              {t("music_xor_play")}
            </button>
          </div>
          <XorFanoLine stepLv={xorStep} lvA={xorA} lvB={xorB} activeLevels={activeLevels} />
        </div>

        {/* 2. Cayley Table */}
        <div style={S_CARD_GROUP}>
          <div style={S_ROW}>
            <span style={S_LABEL}>{t("music_cayley_title")}</span>
            <select value={cayleyRow} onChange={(e) => setCayleyRow(Number(e.target.value))} style={S_SELECT}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
            <button
              type="button"
              style={cayleyCol >= 0 ? S_BTN_SM_ACTIVE : S_BTN_SM}
              onClick={() => {
                if (cayleyCol >= 0) {
                  engine.stopAlgebra?.();
                  setCayleyCol(-1);
                } else {
                  engine.initAudio();
                  engine.playCayleyRow?.(cayleyRow, (col, _val) => setCayleyCol(col));
                }
              }}
            >
              {cayleyCol >= 0 ? t("music_cayley_stop") : t("music_cayley_play")}
            </button>
          </div>
          <CayleyGrid row={cayleyRow} activeCol={cayleyCol} activeLevels={activeLevels} />
        </div>

        {/* 3. Distributive Law */}
        <div style={S_CARD_GROUP}>
          <div style={S_ROW}>
            <span style={S_LABEL}>{t("music_distrib_title")}</span>
            <select value={distA} onChange={(e) => setDistA(Number(e.target.value))} style={S_SELECT}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
            <select value={distB} onChange={(e) => setDistB(Number(e.target.value))} style={S_SELECT}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
            <select value={distC} onChange={(e) => setDistC(Number(e.target.value))} style={S_SELECT}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
            <button
              type="button"
              style={distPhase !== null ? S_BTN_SM_ACTIVE : S_BTN_SM}
              onClick={() => {
                engine.initAudio();
                engine.playDistributiveLaw?.(distA, distB, distC, (phase) => {
                  setDistPhase(phase);
                });
              }}
            >
              {t("music_distrib_play")}
            </button>
          </div>
          <DistributiveFlow a={distA} b={distB} c={distC} phase={distPhase} activeLevels={activeLevels} />
        </div>

        {/* ── B: Fano Plane (PG(2,2)) ── */}

        {/* 4. Line + Dual */}
        <div style={S_CARD_FANO}>
          <div style={S_ROW}>
            <span style={S_LABEL}>{t("music_dual_title")}</span>
            <select value={hoveredFanoLine ?? 0} onChange={(e) => setHoveredFanoLine(Number(e.target.value))} style={S_SELECT}>
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <option key={i} value={i}>
                  L{i + 1}
                </option>
              ))}
            </select>
            <button
              type="button"
              style={dualPhase !== null ? S_BTN_SM_ACTIVE : S_BTN_SM}
              onClick={() => {
                setDualLineIndex(hoveredFanoLine ?? 0);
                engine.initAudio();
                engine.playLineAndDual?.(hoveredFanoLine ?? 0, (phase) => setDualPhase(phase));
              }}
            >
              {t("music_dual_play")}
            </button>
          </div>
          <LineDualPartition phase={dualPhase} lineIndex={dualLineIndex} activeLevels={activeLevels} />
        </div>

        {/* 5. Point Context */}
        <div style={S_CARD_FANO}>
          <div style={S_ROW}>
            <span style={S_LABEL}>{t("music_pointfano_title")}</span>
            <select value={fanoContextPoint} onChange={(e) => setFanoContextPoint(Number(e.target.value))} style={S_SELECT}>
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
            <button
              type="button"
              style={fanoContextLine >= 0 ? S_BTN_SM_ACTIVE : S_BTN_SM}
              onClick={() => {
                engine.initAudio();
                engine.playPointFanoContext?.(fanoContextPoint, (idx) => {
                  setFanoContextLine(idx ?? -1);
                  setHoveredFanoLine(idx ?? null);
                });
              }}
            >
              {t("music_pointfano_play")}
            </button>
          </div>
          <PointFanoContext selectedPoint={fanoContextPoint} activeLineIdx={fanoContextLine} activeLevels={activeLevels} />
        </div>

        {/* 6. Fano Rhythm */}
        <div style={S_CARD_FANO}>
          <FanoRhythmGrid playing={rhythmPlaying} currentBeat={rhythmBeat} activeLevels={activeLevels} />
        </div>

        {/* ── C: Hamming Code ── */}

        {/* 7. Parity Chords */}
        <div style={S_CARD_FANO}>
          <div style={S_ROW}>
            <span style={S_LABEL}>{t("music_parity_title")}</span>
            {([0, 1, 2] as const).map((p) => (
              <button
                key={p}
                type="button"
                style={activeParityGroup === p ? S_BTN_SM_ACTIVE : S_BTN_SM}
                onClick={() => {
                  setActiveParityGroup(p);
                  engine.initAudio();
                  engine.playParityChord?.(p);
                  setTimeout(() => setActiveParityGroup(null), 500);
                }}
              >
                {t(p === 0 ? "music_parity_p1" : p === 1 ? "music_parity_p2" : "music_parity_p4")}
              </button>
            ))}
          </div>
          <ParityGrid activeGroup={activeParityGroup} activeLevels={activeLevels} />
        </div>

        {/* 8. Error Correction */}
        <div style={S_CARD}>
          <div style={S_ROW}>
            <span style={S_LABEL}>{t("music_error_title")}</span>
            <select value={errorPos} onChange={(e) => setErrorPos(Number(e.target.value))} style={S_SELECT}>
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
            <button
              type="button"
              style={{ ...(errorPhase ? S_BTN_SM_ACTIVE : S_BTN_SM) }}
              onClick={() => {
                engine.initAudio();
                engine.playSyndromeDemo?.(errorPos, (p) => setErrorPhase(p));
              }}
            >
              {t("music_error_play")}
            </button>
            {errorPhase && <span style={{ fontSize: FS.md, color: C.accent }}>{errorPhase}</span>}
          </div>
          <SyndromeTimeline
            phase={errorPhase as "original" | "corrupted" | "syndrome" | "corrected" | null}
            errorPos={errorPos}
            activeLevels={activeLevels}
          />
        </div>

        {/* 9. Weight Spectrum ([7,4,3] / [8,4,4]) */}
        <div style={S_CARD_GROUP}>
          <div style={S_ROW}>
            <button
              type="button"
              style={hammingMode === "743" ? S_BTN_SM_ACTIVE : S_BTN_SM}
              onClick={() => {
                if (weightPlaying) {
                  engine.stopAlgebra?.();
                  setWeightPlaying(false);
                  setWeightStep(null);
                }
                setHammingMode("743");
              }}
            >
              [7,4,3]
            </button>
            <button
              type="button"
              style={hammingMode === "844" ? S_BTN_SM_ACTIVE : S_BTN_SM}
              onClick={() => {
                if (weightPlaying) {
                  engine.stopAlgebra?.();
                  setWeightPlaying(false);
                  setWeightStep(null);
                }
                setHammingMode("844");
              }}
            >
              [8,4,4]
            </button>
            <button
              type="button"
              style={weightPlaying ? S_BTN_SM_ACTIVE : S_BTN_SM}
              onClick={() => {
                if (weightPlaying) {
                  engine.stopAlgebra?.();
                  setWeightPlaying(false);
                  setWeightStep(null);
                  setHoveredFanoLine(null);
                } else {
                  engine.initAudio();
                  const playFn = hammingMode === "743" ? engine.playWeightSpectrum : engine.playExtendedHamming;
                  playFn?.((pos: number[], w: number, idx: number) => {
                    setWeightStep({ positions: pos, weight: w, index: idx });
                    // Link to Fano: w=3 codewords (743) or w=4 Fano+Black (844) at idx 1-7
                    const isFanoLine = (hammingMode === "743" && w === 3) || (hammingMode === "844" && idx >= 1 && idx <= 7);
                    setHoveredFanoLine(isFanoLine && idx >= 1 && idx <= 7 ? idx - 1 : null);
                    if (pos.length === 0 && w === -1) {
                      setWeightPlaying(false);
                      setWeightStep(null);
                      setHoveredFanoLine(null);
                    }
                  });
                  setWeightPlaying(true);
                }
              }}
            >
              {weightPlaying ? t("music_weight_stop") : t("music_weight_play")}
            </button>
            {weightStep && weightStep.weight >= 0 && <span style={{ fontSize: FS.md, color: C.accent }}>w={weightStep.weight}</span>}
          </div>
          <WeightHistogram
            mode={hammingMode}
            currentWeight={weightStep?.weight ?? -1}
            currentIndex={weightStep?.index ?? -1}
            activeLevels={activeLevels}
          />
        </div>

        {/* ── D: Cube / Gray Code ── */}

        {/* 10. Gray 3-Voice */}
        <div style={S_CARD_GROUP}>
          <div style={S_ROW}>
            <button
              type="button"
              style={{ ...(gray3Playing ? S_BTN_SM_ACTIVE : S_BTN_SM) }}
              onClick={() => {
                if (gray3Playing) {
                  engine.stopAlgebra?.();
                  setGray3Playing(false);
                  setGray3Code(null);
                } else {
                  engine.initAudio();
                  engine.playGray3Voice?.((lv: number | null) => {
                    setGray3Code(lv);
                  });
                  setGray3Playing(true);
                }
              }}
            >
              {gray3Playing ? t("music_gray3v_stop") : t("music_gray3v_play")}
            </button>
          </div>
          <GrayCube currentCode={gray3Code} activeLevels={activeLevels} />
        </div>

        {/* ── E: Symmetry / Automorphism ── */}

        {/* 11. GL(3,2) */}
        <div style={S_CARD_GROUP}>
          <div style={S_ROW}>
            <span style={S_LABEL}>{t("music_gl32_title")}</span>
            <button
              type="button"
              style={{ ...S_BTN_SM }}
              onClick={() => {
                engine.initAudio();
                engine.applyGL32Transform?.("A", (p) => {
                  setGl32Perm(p);
                  setGl32Flash(true);
                  setTimeout(() => setGl32Flash(false), 500);
                });
              }}
            >
              {t("music_gl32_a")}
            </button>
            <button
              type="button"
              style={{ ...S_BTN_SM }}
              onClick={() => {
                engine.initAudio();
                engine.applyGL32Transform?.("B", (p) => {
                  setGl32Perm(p);
                  setGl32Flash(true);
                  setTimeout(() => setGl32Flash(false), 500);
                });
              }}
            >
              {t("music_gl32_b")}
            </button>
          </div>
          <GL32Arrows perm={gl32Perm} activeLevels={activeLevels} flash={gl32Flash} />
        </div>

        {/* ── F: BT.601 Luminance ── */}

        {/* 12. Symmetry */}
        <div style={S_CARD}>
          <div style={S_ROW}>
            <span style={S_LABEL}>{t("music_luminance_title")}</span>
            <button
              type="button"
              style={luminanceMode === "symmetric" ? S_BTN_SM_ACTIVE : S_BTN_SM}
              onClick={() => {
                setLuminanceMode("symmetric");
                setLumFlash(true);
                setTimeout(() => setLumFlash(false), 600);
              }}
            >
              {t("music_luminance_sym")}
            </button>
            <button
              type="button"
              style={luminanceMode === "luminance" ? S_BTN_SM_ACTIVE : S_BTN_SM}
              onClick={() => {
                setLuminanceMode("luminance");
                setLumFlash(true);
                setTimeout(() => setLumFlash(false), 600);
              }}
            >
              {t("music_luminance_bt601")}
            </button>
          </div>
          <LuminanceBars mode={luminanceMode} activeLevels={activeLevels} flash={lumFlash} />
        </div>

        {/* 13. Complement Canon */}
        <div style={S_CARD}>
          <div style={S_ROW}>
            <span style={S_LABEL}>{t("music_complement_title")}</span>
            <button
              type="button"
              style={canonPair >= 0 ? S_BTN_SM_ACTIVE : S_BTN_SM}
              onClick={() => {
                engine.initAudio();
                engine.playComplementCanon?.((idx, phase) => {
                  setCanonPair(idx);
                  if (!phase) setCanonPair(-1);
                });
              }}
            >
              {t("music_complement_play")}
            </button>
          </div>
          <ComplementPairs activePair={canonPair} activeLevels={activeLevels} />
        </div>

        {/* 14. Zigzag Melody (looping) */}
        <div style={S_CARD}>
          <div style={S_ROW}>
            <span style={S_LABEL}>{t("music_zigzag_title")}</span>
            <button
              type="button"
              style={zigzagStep !== null ? S_BTN_SM_ACTIVE : S_BTN_SM}
              onClick={() => {
                if (zigzagStep !== null) {
                  engine.stopZigzagMelody?.();
                  setZigzagStep(null);
                } else {
                  engine.initAudio();
                  engine.playZigzagMelody?.((step) => setZigzagStep(step));
                }
              }}
            >
              {zigzagStep !== null ? t("music_zigzag_stop") : t("music_zigzag_play")}
            </button>
          </div>
          <ZigzagGraph currentStep={zigzagStep} activeLevels={activeLevels} />
        </div>
      </div>
    </div>
  );
});
