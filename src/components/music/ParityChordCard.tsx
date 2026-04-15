import React, { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "../../i18n";
import { S_BTN_SM, S_BTN_SM_ACTIVE } from "../../styles";
import { C, FS, SP } from "../../tokens";
import { ParityGrid } from "./ParityGrid";
import type { MusicEngineReturn } from "../../hooks/useMusicEngine";
import type { DecoderPhase } from "./HammingDecoder";

interface ParityChordCardProps {
  engine: MusicEngineReturn;
  activeLevels: { lv: number; rgb: [number, number, number] }[];
  stopSignal: number;
  /** Syndrome-phase parity groups from ErrorCorrectionCard */
  errorPos: number;
  errorPhase: DecoderPhase;
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

function parityGroupsFor(errorPos: number, errorPhase: DecoderPhase, activeParityGroup: 0 | 1 | 2 | null): (0 | 1 | 2)[] {
  if (errorPhase === "syndrome") {
    return ([0, 1, 2] as const).filter((bit) => (errorPos & (1 << bit)) !== 0);
  }
  return activeParityGroup !== null ? [activeParityGroup] : [];
}

export const ParityChordCard = React.memo(function ParityChordCard({
  engine,
  activeLevels,
  stopSignal,
  errorPos,
  errorPhase,
}: ParityChordCardProps) {
  const { t } = useTranslation();
  const [activeParityGroup, setActiveParityGroup] = useState<0 | 1 | 2 | null>(null);

  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    setActiveParityGroup(null);
  }, [stopSignal]);

  const activeGroups = parityGroupsFor(errorPos, errorPhase, activeParityGroup);

  const handlePlay = useCallback(
    (group: 0 | 1 | 2) => {
      setActiveParityGroup(group);
      engine.initAudio();
      engine.playParityChord?.(group);
      setTimeout(() => setActiveParityGroup(null), 500);
    },
    [engine],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SP.md, width: "100%" }}>
      <div style={S_ROW}>
        <span style={S_LABEL}>{t("music_parity_title")}</span>
        {([0, 1, 2] as const).map((group) => (
          <button
            key={group}
            type="button"
            style={activeGroups.includes(group) ? S_BTN_SM_ACTIVE : S_BTN_SM}
            onClick={() => handlePlay(group)}
          >
            {t(group === 0 ? "music_parity_p1" : group === 1 ? "music_parity_p2" : "music_parity_p4")}
          </button>
        ))}
      </div>
      <ParityGrid activeGroups={activeGroups} activeLevels={activeLevels} />
    </div>
  );
});
