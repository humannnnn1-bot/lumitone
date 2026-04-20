import React, { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "../../i18n";
import { S_BTN_SM, S_BTN_SM_ACTIVE } from "../../styles";
import { C, FS, SP } from "../../tokens";
import { ComplementPairs } from "./ComplementPairs";
import type { MusicEngineReturn } from "../../hooks/useMusicEngine";

interface Props {
  engine: MusicEngineReturn;
  stopSignal: number;
}

const S_COL: React.CSSProperties = { display: "flex", flexDirection: "column", gap: SP.sm, alignItems: "center" };
const S_LABEL: React.CSSProperties = { fontSize: FS.lg, color: C.textDim, whiteSpace: "nowrap" };

const LOOP_PERIOD_MS = 1800;
type Direction = "forward" | "reverse" | null;

export const ComplementPairsCard = React.memo(function ComplementPairsCard({ engine, stopSignal }: Props) {
  const { t } = useTranslation();
  const [activePair, setActivePair] = useState(-1);
  const [playing, setPlaying] = useState<Direction>(null);
  const loopTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearLoop = useCallback(() => {
    if (loopTimerRef.current !== null) {
      clearInterval(loopTimerRef.current);
      loopTimerRef.current = null;
    }
  }, []);

  const stopLoop = useCallback(() => {
    clearLoop();
    engine.stopAlgebra?.();
    setActivePair(-1);
    setPlaying(null);
  }, [clearLoop, engine]);

  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    clearLoop();
    setActivePair(-1);
    setPlaying(null);
  }, [clearLoop, stopSignal]);

  useEffect(() => clearLoop, [clearLoop]);

  const handleClick = useCallback(
    (reverse: boolean) => {
      const dir: Direction = reverse ? "reverse" : "forward";
      if (playing === dir) {
        stopLoop();
        return;
      }
      clearLoop();
      engine.initAudio();
      const play = () => {
        engine.playComplementCanon?.((idx, phase) => {
          setActivePair(idx);
          if (!phase) setActivePair(-1);
        }, reverse);
      };
      play();
      loopTimerRef.current = setInterval(play, LOOP_PERIOD_MS);
      setPlaying(dir);
    },
    [clearLoop, engine, playing, stopLoop],
  );

  const fwdLabel = playing === "forward" ? t("music_complement_stop") : t("music_complement_play");
  const revLabel = playing === "reverse" ? t("music_complement_stop") : t("music_complement_play_reverse");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SP.md, width: "100%", flex: 1 }}>
      <div style={S_COL}>
        <span style={S_LABEL}>{t("music_complement_title")}</span>
        <button type="button" style={playing === "forward" ? S_BTN_SM_ACTIVE : S_BTN_SM} onClick={() => handleClick(false)}>
          {fwdLabel}
        </button>
        <button type="button" style={playing === "reverse" ? S_BTN_SM_ACTIVE : S_BTN_SM} onClick={() => handleClick(true)}>
          {revLabel}
        </button>
      </div>
      <ComplementPairs activePair={activePair} />
    </div>
  );
});
