import { useCallback, useEffect, useRef } from "react";
import type { ChangeEvent } from "react";

import { LEVEL_CANDIDATES, findClosestCandidate } from "../color-engine";
import { MUSIC_ACTIVE_LEVELS } from "../music/types";
import type { MusicEngineReturn } from "./useMusicEngine";
import type { useMusicBurstHighlightState, useMusicPaletteState, useMusicTransportState } from "./useMusicPanelState";

type MusicPaletteState = ReturnType<typeof useMusicPaletteState>;
type MusicTransportState = ReturnType<typeof useMusicTransportState>;
type MusicBurstHighlightState = ReturnType<typeof useMusicBurstHighlightState>;
type MusicSonificationLevel = { levelIndex: number; hueAngleDeg: number };

function useMusicKeyboardShortcuts(
  sonificationLevels: MusicSonificationLevel[],
  onLevelTrigger: (levelIndex: number, hueAngleDeg: number) => void,
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
        const levelIndex = +k;
        const entry = sonificationLevelsRef.current.find((level) => level.levelIndex === levelIndex);
        if (entry) onLevelTrigger(levelIndex, entry.hueAngleDeg);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onLevelTrigger]);
}

interface UseMusicHuePaletteHandlersOptions {
  engine: MusicEngineReturn;
  activeAlpha: number;
  resumeDrone: () => void;
  ensureAudio: () => void;
  sonificationLevels: MusicSonificationLevel[];
  palette: Pick<MusicPaletteState, "setHueAngle" | "setCandidateOverridesByLevel" | "setSelectedLevels" | "prevCandidatesRef">;
  transport: Pick<MusicTransportState, "setAlpha0" | "setAlpha7" | "setOriginMode">;
  burst: Pick<MusicBurstHighlightState, "setBurstHighlight" | "burstTimersRef">;
}

export function useMusicHuePaletteHandlers({
  engine,
  activeAlpha,
  resumeDrone,
  ensureAudio,
  sonificationLevels,
  palette,
  transport,
  burst,
}: UseMusicHuePaletteHandlersOptions) {
  const { setHueAngle, setCandidateOverridesByLevel, setSelectedLevels, prevCandidatesRef } = palette;
  const { setAlpha0, setAlpha7, setOriginMode } = transport;
  const { setBurstHighlight, burstTimersRef } = burst;

  const triggerToneBurstAtActiveAlpha = useCallback(
    (levelIndex: number, hueAngleDeg: number) => {
      engine.triggerToneBurst(levelIndex, hueAngleDeg >= 0 ? hueAngleDeg + activeAlpha : hueAngleDeg);
    },
    [activeAlpha, engine],
  );

  const handleHueChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      engine.initAudio();
      resumeDrone();
      setHueAngle(Number(e.target.value));
      setCandidateOverridesByLevel(new Map());
      setSelectedLevels(new Set());
    },
    [engine, resumeDrone, setCandidateOverridesByLevel, setHueAngle, setSelectedLevels],
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
    (levelIndex: number, hueAngleDeg: number) => {
      ensureAudio();
      engine.initAudio();
      triggerToneBurstAtActiveAlpha(levelIndex, hueAngleDeg);
      const prev = burstTimersRef.current.get(levelIndex);
      if (prev) clearTimeout(prev);
      setBurstHighlight((s) => {
        const n = new Set(s);
        n.delete(levelIndex);
        return n;
      });
      requestAnimationFrame(() => {
        setBurstHighlight((s) => new Set(s).add(levelIndex));
        burstTimersRef.current.set(
          levelIndex,
          setTimeout(() => {
            setBurstHighlight((s) => {
              const n = new Set(s);
              n.delete(levelIndex);
              return n;
            });
            burstTimersRef.current.delete(levelIndex);
          }, 20),
        );
      });
    },
    [burstTimersRef, engine, ensureAudio, setBurstHighlight, triggerToneBurstAtActiveAlpha],
  );

  useMusicKeyboardShortcuts(sonificationLevels, handleBlockClick);

  const handleLinkedHueAngleChange = useCallback(
    (angleDeg: number) => {
      engine.initAudio();
      resumeDrone();
      for (const levelIndex of MUSIC_ACTIVE_LEVELS) {
        const candidateIndex = findClosestCandidate(levelIndex, angleDeg);
        const prev = prevCandidatesRef.current.get(levelIndex);
        if (prev !== undefined && prev !== candidateIndex) {
          const cand = LEVEL_CANDIDATES[levelIndex][candidateIndex];
          if (cand && cand.angle >= 0) triggerToneBurstAtActiveAlpha(levelIndex, cand.angle);
        }
        prevCandidatesRef.current.set(levelIndex, candidateIndex);
      }
      setHueAngle(angleDeg);
      setCandidateOverridesByLevel(new Map());
      setSelectedLevels(new Set());
    },
    [engine, prevCandidatesRef, resumeDrone, setCandidateOverridesByLevel, setHueAngle, setSelectedLevels, triggerToneBurstAtActiveAlpha],
  );

  const handleAlpha0Change = useCallback(
    (angleDeg: number) => {
      engine.initAudio();
      resumeDrone();
      setAlpha0(angleDeg);
    },
    [engine, resumeDrone, setAlpha0],
  );

  const handleAlpha7Change = useCallback(
    (angleDeg: number) => {
      engine.initAudio();
      resumeDrone();
      setAlpha7(angleDeg);
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

  return {
    handleHueChange,
    handleAlphaBarChange,
    handleBlockClick,
    handleLinkedHueAngleChange,
    handleAlpha0Change,
    handleAlpha7Change,
    handleOriginModeChange,
  };
}
