import React, { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "../../i18n";
import { S_BTN_SM, S_BTN_SM_ACTIVE } from "../../styles/shared";
import { C, FS, SP } from "../../styles/tokens";
import { ZigzagGraph } from "./ZigzagGraph";
import type { MusicEngineReturn } from "../../hooks/useMusicEngine";

interface Props {
  engine: MusicEngineReturn;
  stopSignal: number;
}

const S_COL: React.CSSProperties = { display: "flex", flexDirection: "column", gap: SP.sm, alignItems: "center" };
const S_LABEL: React.CSSProperties = { fontSize: FS.lg, color: C.textDim, whiteSpace: "nowrap" };
const S_HEADER: React.CSSProperties = { ...S_COL, flex: "0 0 38px", justifyContent: "flex-start" };
const S_TOGGLE_BTN: React.CSSProperties = { ...S_BTN_SM, width: 70, height: 20, lineHeight: 1, boxSizing: "border-box" };
const S_TOGGLE_BTN_ACTIVE: React.CSSProperties = { ...S_BTN_SM_ACTIVE, width: 70, height: 20, lineHeight: 1, boxSizing: "border-box" };

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
    <div data-testid="luma-zigzag-card" style={{ display: "flex", flexDirection: "column", gap: SP.md, width: "100%", flex: 1 }}>
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
