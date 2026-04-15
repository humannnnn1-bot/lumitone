import React, { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "../../i18n";
import { S_BTN_SM, S_BTN_SM_ACTIVE } from "../../styles";
import { C, FS, SP } from "../../tokens";
import { ZigzagGraph } from "./ZigzagGraph";
import type { MusicEngineReturn } from "../../hooks/useMusicEngine";

interface Props {
  engine: MusicEngineReturn;
  activeLevels: { lv: number; rgb: [number, number, number] }[];
  stopSignal: number;
}

const S_ROW: React.CSSProperties = { display: "flex", gap: SP.sm, alignItems: "center", justifyContent: "center", flexWrap: "wrap" };
const S_LABEL: React.CSSProperties = { fontSize: FS.lg, color: C.textDim, whiteSpace: "nowrap" };

export const ZigzagCard = React.memo(function ZigzagCard({ engine, activeLevels, stopSignal }: Props) {
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
    <div style={{ display: "flex", flexDirection: "column", gap: SP.md, width: "100%" }}>
      <div style={S_ROW}>
        <span style={S_LABEL}>{t("music_zigzag_title")}</span>
        <button type="button" style={zigzagStep !== null ? S_BTN_SM_ACTIVE : S_BTN_SM} onClick={handleToggle}>
          {zigzagStep !== null ? t("music_zigzag_stop") : t("music_zigzag_play")}
        </button>
      </div>
      <ZigzagGraph currentStep={zigzagStep} activeLevels={activeLevels} />
    </div>
  );
});
