import React, { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "../../i18n";
import { C, SP } from "../../styles/tokens";
import { ZigzagGraph } from "./ZigzagGraph";
import type { MusicEngineReturn } from "../../hooks/useMusicEngine";
import { S_CARD_CONTROL_BTN, S_CARD_CONTROL_BTN_ACTIVE } from "./music-panel-styles";

interface Props {
  engine: MusicEngineReturn;
  stopSignal: number;
}

const S_COL: React.CSSProperties = { display: "flex", flexDirection: "column", gap: SP.sm, alignItems: "center" };
const S_LABEL: React.CSSProperties = { fontSize: "var(--music-card-label-fs, 11px)", color: C.textDim, whiteSpace: "nowrap" };
const S_HEADER: React.CSSProperties = {
  ...S_COL,
  gap: "var(--music-card-control-gap, 3px)",
  flex: "0 0 var(--music-card-header-size, 38px)",
  justifyContent: "flex-start",
};
const S_TOGGLE_BTN: React.CSSProperties = {
  ...S_CARD_CONTROL_BTN,
  width: "var(--music-card-toggle-width, 70px)",
};
const S_TOGGLE_BTN_ACTIVE: React.CSSProperties = {
  ...S_CARD_CONTROL_BTN_ACTIVE,
  width: "var(--music-card-toggle-width, 70px)",
};

export const ZigzagCard = React.memo(function ZigzagCard({ engine, stopSignal }: Props) {
  const { t } = useTranslation();
  const [zigzagStep, setZigzagStep] = useState<number | null>(null);

  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    setZigzagStep(null);
  }, [stopSignal]);

  const handleToggle = useCallback(() => {
    if (zigzagStep !== null) {
      engine.stopZigzagMelody?.();
      setZigzagStep(null);
    } else {
      engine.initAudio();
      engine.playZigzagMelody?.((step) => setZigzagStep(step));
    }
  }, [engine, zigzagStep]);

  return (
    <div
      data-testid="luma-zigzag-card"
      style={{ display: "flex", flexDirection: "column", gap: "var(--music-card-gap, 4px)", width: "100%", flex: 1 }}
    >
      <div style={S_HEADER}>
        <span style={S_LABEL}>{t("music_zigzag_title")}</span>
        <button type="button" style={zigzagStep !== null ? S_TOGGLE_BTN_ACTIVE : S_TOGGLE_BTN} onClick={handleToggle}>
          {zigzagStep !== null ? t("music_zigzag_stop") : t("music_zigzag_play")}
        </button>
      </div>
      <ZigzagGraph currentStep={zigzagStep} />
    </div>
  );
});
