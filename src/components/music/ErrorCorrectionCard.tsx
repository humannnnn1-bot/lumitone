import React, { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "../../i18n";
import { S_BTN_SM, S_BTN_SM_ACTIVE } from "../../styles";
import { C, FS, R, SP } from "../../tokens";
import { SyndromeTimeline } from "./SyndromeTimeline";
import type { MusicEngineReturn } from "../../hooks/useMusicEngine";
import type { DecoderPhase } from "./HammingDecoder";

interface ErrorCorrectionCardProps {
  engine: MusicEngineReturn;
  activeLevels: { lv: number; rgb: [number, number, number] }[];
  stopSignal: number;
  errorPos: number;
  errorPhase: DecoderPhase;
  onErrorPosChange: (pos: number) => void;
  onErrorPhaseChange: (phase: DecoderPhase) => void;
}

const S_ROW: React.CSSProperties = {
  display: "flex",
  gap: SP.sm,
  alignItems: "center",
  justifyContent: "center",
  flexWrap: "wrap",
};

const S_LABEL: React.CSSProperties = {
  fontSize: FS.lg,
  color: C.textDim,
  whiteSpace: "nowrap",
};

const S_SELECT: React.CSSProperties = {
  fontSize: FS.lg,
  padding: "2px 4px",
  background: C.bgPanel,
  color: C.textPrimary,
  border: `1px solid ${C.border}`,
  borderRadius: R.md,
};

export const ErrorCorrectionCard = React.memo(function ErrorCorrectionCard({
  engine,
  activeLevels,
  stopSignal,
  errorPos,
  errorPhase,
  onErrorPosChange,
  onErrorPhaseChange,
}: ErrorCorrectionCardProps) {
  const { t } = useTranslation();

  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    onErrorPhaseChange(null);
  }, [stopSignal, onErrorPhaseChange]);

  const handlePlayDecode = useCallback(() => {
    engine.initAudio();
    engine.playSyndromeDemo?.(errorPos, (phase) => onErrorPhaseChange(phase));
  }, [engine, errorPos, onErrorPhaseChange]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SP.md, width: "100%" }}>
      <div style={S_ROW}>
        <span style={S_LABEL}>{t("music_error_title")}</span>
        <select value={errorPos} onChange={(e) => onErrorPosChange(Number(e.target.value))} style={S_SELECT}>
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
        <button type="button" style={errorPhase ? S_BTN_SM_ACTIVE : S_BTN_SM} onClick={handlePlayDecode}>
          {t("music_error_play")}
        </button>
      </div>
      <SyndromeTimeline phase={errorPhase} errorPos={errorPos} activeLevels={activeLevels} />
    </div>
  );
});
