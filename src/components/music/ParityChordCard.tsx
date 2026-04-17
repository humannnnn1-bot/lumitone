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

  const PARITY_ROWS: { name: string; bit: number; set: string; color: string; group: 0 | 1 | 2 }[] = [
    { name: "P1", bit: 0, set: "{1,3,5,7}", color: "#0000ff", group: 0 },
    { name: "P2", bit: 1, set: "{2,3,6,7}", color: "#ff0000", group: 1 },
    { name: "P4", bit: 2, set: "{4,5,6,7}", color: "#00ff00", group: 2 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SP.md, width: "100%", flex: 1 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: SP.sm, alignItems: "center" }}>
        <span style={S_LABEL}>{t("music_parity_title")}</span>
        <div style={{ display: "flex", gap: SP.sm, alignItems: "center" }}>
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
      </div>
      <ParityGrid activeGroups={activeGroups} activeLevels={activeLevels} />
      <div style={{ fontSize: FS.xs, fontFamily: "monospace", color: C.textDim, lineHeight: 1.5, textAlign: "center" }}>
        {PARITY_ROWS.map((r) => {
          const active = activeGroups.includes(r.group);
          return (
            <div key={r.name} style={{ opacity: activeGroups.length === 0 || active ? 1 : 0.4 }}>
              <span style={{ color: r.color, fontWeight: active ? 700 : 400 }}>{r.name}</span>
              {`: bit ${r.bit} = ${r.set}`}
            </div>
          );
        })}
      </div>
    </div>
  );
});
