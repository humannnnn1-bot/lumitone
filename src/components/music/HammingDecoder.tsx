import React, { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "../../i18n";
import { S_BTN_SM, S_BTN_SM_ACTIVE } from "../../styles";
import { C, FS, R, SP } from "../../tokens";
import { ParityGrid } from "./ParityGrid";
import { SyndromeTimeline } from "./SyndromeTimeline";
import type { MusicEngineReturn } from "../../hooks/useMusicEngine";

export type DecoderPhase = "original" | "corrupted" | "syndrome" | "corrected" | null;

interface HammingDecoderProps {
  engine: MusicEngineReturn;
  activeLevels: { lv: number; rgb: [number, number, number] }[];
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

const S_SELECT: React.CSSProperties = {
  fontSize: FS.lg,
  padding: "2px 4px",
  background: C.bgPanel,
  color: C.textPrimary,
  border: `1px solid ${C.border}`,
  borderRadius: R.md,
};

const S_GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
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
  alignItems: "center",
};

const S_SUBTITLE: React.CSSProperties = {
  fontSize: FS.sm,
  color: C.textDimmer,
  textAlign: "center",
};

function parityGroupsFor(errorPos: number, errorPhase: DecoderPhase, activeParityGroup: 0 | 1 | 2 | null): (0 | 1 | 2)[] {
  if (errorPhase === "syndrome") {
    return ([0, 1, 2] as const).filter((bit) => (errorPos & (1 << bit)) !== 0);
  }
  return activeParityGroup !== null ? [activeParityGroup] : [];
}

export const HammingDecoder = React.memo(function HammingDecoder({ engine, activeLevels, stopSignal }: HammingDecoderProps) {
  const { t } = useTranslation();

  const [activeParityGroup, setActiveParityGroup] = useState<0 | 1 | 2 | null>(null);
  const [errorPos, setErrorPos] = useState(1);
  const [errorPhase, setErrorPhase] = useState<DecoderPhase>(null);

  const activeGroups = parityGroupsFor(errorPos, errorPhase, activeParityGroup);

  // Stop signal from parent (parent already calls engine stops)
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    setActiveParityGroup(null);
    setErrorPhase(null);
  }, [stopSignal]);

  const handlePlayParityGroup = useCallback(
    (group: 0 | 1 | 2) => {
      setActiveParityGroup(group);
      engine.initAudio();
      engine.playParityChord?.(group);
      setTimeout(() => setActiveParityGroup(null), 500);
    },
    [engine],
  );

  const handlePlayDecode = useCallback(() => {
    engine.initAudio();
    engine.playSyndromeDemo?.(errorPos, (phase) => setErrorPhase(phase));
  }, [engine, errorPos]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SP.md, width: "100%" }}>
      <div style={S_ROW}>
        <span style={S_LABEL}>{t("music_hamming_decoder_title")}</span>
        {([0, 1, 2] as const).map((group) => (
          <button
            key={group}
            type="button"
            style={activeGroups.includes(group) ? S_BTN_SM_ACTIVE : S_BTN_SM}
            onClick={() => handlePlayParityGroup(group)}
          >
            {t(group === 0 ? "music_parity_p1" : group === 1 ? "music_parity_p2" : "music_parity_p4")}
          </button>
        ))}
        <select value={errorPos} onChange={(e) => setErrorPos(Number(e.target.value))} style={S_SELECT}>
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
      <div style={S_GRID}>
        <div style={S_PANEL}>
          <div style={S_SUBTITLE}>{t("music_parity_title")}</div>
          <ParityGrid activeGroups={activeGroups} activeLevels={activeLevels} />
        </div>
        <div style={S_PANEL}>
          <div style={S_SUBTITLE}>{t("music_error_title")}</div>
          <SyndromeTimeline phase={errorPhase} errorPos={errorPos} activeLevels={activeLevels} />
        </div>
      </div>
    </div>
  );
});
