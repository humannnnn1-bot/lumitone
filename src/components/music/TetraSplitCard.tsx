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

const S_ROW: React.CSSProperties = {
  display: "flex",
  gap: SP.sm,
  alignItems: "center",
  justifyContent: "center",
  flexWrap: "wrap",
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

  const handleToggle = useCallback(() => {
    if (tetraPhase !== null) {
      engine.stopAlgebra?.();
      setTetraPhase(null);
      onPhaseChange?.(null);
    } else {
      engine.initAudio();
      setTetraPhase(null);
      engine.playTetraSplit?.((phase) => {
        setTetraPhase(phase);
        onPhaseChange?.(phase);
      });
    }
  }, [engine, tetraPhase, onPhaseChange]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: SP.md,
        width: "100%",
        transition: "box-shadow .25s",
        boxShadow: highlighted ? "inset 0 0 0 1px #ffd36e40, 0 0 8px #ffd36e20" : "none",
      }}
    >
      <div style={S_ROW}>
        <span style={S_TITLE}>{t("music_tetra_title")}</span>
        <button type="button" style={tetraPhase !== null ? S_BTN_SM_ACTIVE : S_BTN_SM} onClick={handleToggle}>
          {t("music_tetra_play")}
        </button>
      </div>
      <TetraSplitView phase={tetraPhase} activeLevels={activeLevels} />
    </div>
  );
});
