import React, { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "../../i18n";
import { S_BTN_SM, S_BTN_SM_ACTIVE } from "../../styles";
import { C, FS, SP } from "../../tokens";
import { TetraSplitView } from "./TetraSplitView";
import type { MusicEngineReturn } from "../../hooks/useMusicEngine";

interface TetraSplitCardProps {
  engine: MusicEngineReturn;
  activeLevels: { lv: number; rgb: [number, number, number] }[];
  stopSignal: number;
  highlighted: boolean;
  onPhaseChange?: (phase: "t0" | "t1" | null) => void;
}

const S_COL: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: SP.sm,
  alignItems: "center",
};

const S_TITLE: React.CSSProperties = {
  fontSize: FS.lg,
  color: C.textDim,
  whiteSpace: "nowrap",
};

export const TetraSplitCard = React.memo(function TetraSplitCard({
  engine,
  activeLevels,
  stopSignal,
  highlighted,
  onPhaseChange,
}: TetraSplitCardProps) {
  const { t } = useTranslation();
  const [tetraPhase, setTetraPhase] = useState<"t0" | "t1" | null>(null);

  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    setTetraPhase(null);
    onPhaseChange?.(null);
  }, [stopSignal, onPhaseChange]);

  const handlePlayT0 = useCallback(() => {
    engine.initAudio();
    engine.playTetraT0?.((phase) => {
      setTetraPhase(phase);
      onPhaseChange?.(phase);
    });
  }, [engine, onPhaseChange]);

  const handlePlayT1 = useCallback(() => {
    engine.initAudio();
    engine.playTetraT1?.((phase) => {
      setTetraPhase(phase);
      onPhaseChange?.(phase);
    });
  }, [engine, onPhaseChange]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: SP.md,
        width: "100%",
        flex: 1,
        transition: "box-shadow .25s",
        boxShadow: highlighted ? "inset 0 0 0 1px #ffd36e40, 0 0 8px #ffd36e20" : "none",
      }}
    >
      <div style={S_COL}>
        <span style={S_TITLE}>{t("music_tetra_title")}</span>
        <div style={{ display: "flex", gap: SP.sm }}>
          <button type="button" style={tetraPhase === "t0" ? S_BTN_SM_ACTIVE : S_BTN_SM} onClick={handlePlayT0}>
            {"\u25b6 T0"}
          </button>
          <button type="button" style={tetraPhase === "t1" ? S_BTN_SM_ACTIVE : S_BTN_SM} onClick={handlePlayT1}>
            {"\u25b6 T1"}
          </button>
        </div>
      </div>
      <TetraSplitView phase={tetraPhase} activeLevels={activeLevels} />
    </div>
  );
});
