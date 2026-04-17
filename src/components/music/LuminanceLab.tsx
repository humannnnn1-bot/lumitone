import React, { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "../../i18n";
import { S_BTN_SM, S_BTN_SM_ACTIVE } from "../../styles";
import { C, FS, R, SP } from "../../tokens";
import { ComplementPairs } from "./ComplementPairs";
import { ZigzagGraph } from "./ZigzagGraph";
import type { MusicEngineReturn } from "../../hooks/useMusicEngine";

interface LuminanceLabProps {
  engine: MusicEngineReturn;
  stopSignal: number;
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

const S_GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: SP.md,
  width: "100%",
};

const S_PANEL: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: SP.sm,
  padding: "8px",
  borderRadius: R.md,
  border: `1px solid ${C.border}`,
  background: "rgba(255,255,255,0.02)",
};

const S_SUBTITLE: React.CSSProperties = {
  fontSize: FS.sm,
  color: C.textDimmer,
  textAlign: "center",
};

export const LuminanceLab = React.memo(function LuminanceLab({ engine, stopSignal }: LuminanceLabProps) {
  const { t } = useTranslation();

  const [activePair, setActivePair] = useState(-1);
  const [zigzagStep, setZigzagStep] = useState<number | null>(null);

  // Stop signal from parent (parent already calls engine stops)
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    setActivePair(-1);
    setZigzagStep(null);
  }, [stopSignal]);

  const handlePlayPairs = useCallback(() => {
    engine.initAudio();
    engine.playComplementCanon?.((idx, phase) => {
      setActivePair(idx);
      if (!phase) setActivePair(-1);
    });
  }, [engine]);

  const handleToggleZigzag = useCallback(() => {
    if (zigzagStep !== null) {
      engine.stopZigzagMelody?.();
      setZigzagStep(null);
    } else {
      engine.initAudio();
      engine.playZigzagMelody?.((step) => setZigzagStep(step));
    }
  }, [engine, zigzagStep]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SP.md, width: "100%" }}>
      <div style={S_ROW}>
        <span style={S_LABEL}>{t("music_luminance_lab_title")}</span>
        <button type="button" style={activePair >= 0 ? S_BTN_SM_ACTIVE : S_BTN_SM} onClick={handlePlayPairs}>
          {t("music_complement_play")}
        </button>
        <button type="button" style={zigzagStep !== null ? S_BTN_SM_ACTIVE : S_BTN_SM} onClick={handleToggleZigzag}>
          {zigzagStep !== null ? t("music_zigzag_stop") : t("music_zigzag_play")}
        </button>
      </div>
      <div style={S_GRID}>
        <div style={S_PANEL}>
          <div style={S_SUBTITLE}>{t("music_complement_title")}</div>
          <ComplementPairs activePair={activePair} />
        </div>
        <div style={S_PANEL}>
          <div style={S_SUBTITLE}>{t("music_zigzag_title")}</div>
          <ZigzagGraph currentStep={zigzagStep} />
        </div>
      </div>
    </div>
  );
});
