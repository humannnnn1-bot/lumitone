import React, { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "../../i18n";
import { S_BTN_SM, S_BTN_SM_ACTIVE } from "../../styles";
import { C, FS, SP } from "../../tokens";
import { ComplementPairs } from "./ComplementPairs";
import type { MusicEngineReturn } from "../../hooks/useMusicEngine";

interface Props {
  engine: MusicEngineReturn;
  activeLevels: { lv: number; rgb: [number, number, number] }[];
  stopSignal: number;
}

const S_COL: React.CSSProperties = { display: "flex", flexDirection: "column", gap: SP.sm, alignItems: "center" };
const S_LABEL: React.CSSProperties = { fontSize: FS.lg, color: C.textDim, whiteSpace: "nowrap" };

export const ComplementPairsCard = React.memo(function ComplementPairsCard({ engine, activeLevels, stopSignal }: Props) {
  const { t } = useTranslation();
  const [activePair, setActivePair] = useState(-1);

  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    setActivePair(-1);
  }, [stopSignal]);

  const handlePlay = useCallback(() => {
    engine.initAudio();
    engine.playComplementCanon?.((idx, phase) => {
      setActivePair(idx);
      if (!phase) setActivePair(-1);
    });
  }, [engine]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SP.md, width: "100%", flex: 1 }}>
      <div style={S_COL}>
        <span style={S_LABEL}>{t("music_complement_title")}</span>
        <button type="button" style={activePair >= 0 ? S_BTN_SM_ACTIVE : S_BTN_SM} onClick={handlePlay}>
          {t("music_complement_play")}
        </button>
      </div>
      <ComplementPairs activePair={activePair} activeLevels={activeLevels} />
    </div>
  );
});
