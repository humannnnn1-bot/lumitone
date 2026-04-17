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

  const bin = errorPos.toString(2).padStart(3, "0");
  // Syndrome bits (s0=P1, s1=P2, s2=P4); shown during syndrome/corrected phases.
  const showSyndrome = errorPhase === "syndrome" || errorPhase === "corrected";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SP.md, width: "100%", flex: 1 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: SP.sm, alignItems: "center" }}>
        <span style={S_LABEL}>{t("music_error_title")}</span>
        <div style={{ display: "flex", gap: SP.sm, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
          <select value={errorPos} onChange={(e) => onErrorPosChange(Number(e.target.value))} style={S_SELECT}>
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
          <span style={{ fontSize: FS.sm, fontFamily: "monospace", color: C.textDim, whiteSpace: "nowrap" }}>{`= ${bin}\u2082`}</span>
          <button type="button" style={errorPhase ? S_BTN_SM_ACTIVE : S_BTN_SM} onClick={handlePlayDecode}>
            {t("music_error_play")}
          </button>
        </div>
      </div>
      <SyndromeTimeline phase={errorPhase} errorPos={errorPos} activeLevels={activeLevels} />
      {/* Reserve space even when hidden to avoid layout shift as phase advances. */}
      <div
        style={{
          fontSize: FS.xs,
          fontFamily: "monospace",
          color: C.accent,
          textAlign: "center",
          lineHeight: 1.4,
          minHeight: "1.4em",
          visibility: showSyndrome ? "visible" : "hidden",
        }}
      >
        {`s\u2082s\u2081s\u2080 = ${bin} \u2192 pos ${errorPos}`}
      </div>
    </div>
  );
});
