import React, { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "../../i18n";
import { S_BTN_SM, S_BTN_SM_ACTIVE } from "../../styles";
import { C, FS, R, SP } from "../../tokens";
import { K8LayerGraph } from "./K8LayerGraph";
import { TetraSplitView } from "./TetraSplitView";
import type { MusicEngineReturn } from "../../hooks/useMusicEngine";

interface K8ExplorerProps {
  engine: MusicEngineReturn;
  activeLevels: { lv: number; rgb: [number, number, number] }[];
  stopSignal: number;
  resetSignal: number;
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

export const K8Explorer = React.memo(function K8Explorer({ engine, activeLevels, stopSignal, resetSignal }: K8ExplorerProps) {
  const { t } = useTranslation();

  const [layer, setLayer] = useState<1 | 2 | 3>(1);
  const [edgeIndex, setEdgeIndex] = useState(-1);
  const [tetraPhase, setTetraPhase] = useState<"t0" | "t1" | null>(null);

  // Stop signal from parent (parent already calls engine stops)
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    setEdgeIndex(-1);
    setTetraPhase(null);
  }, [stopSignal]);

  const handleSelectLayer = useCallback(
    (newLayer: 1 | 2 | 3) => {
      if (edgeIndex >= 0) {
        engine.stopAlgebra?.();
        setEdgeIndex(-1);
      }
      setLayer(newLayer);
    },
    [engine, edgeIndex],
  );

  const handleToggleLayerPlayback = useCallback(() => {
    if (edgeIndex >= 0) {
      engine.stopAlgebra?.();
      setEdgeIndex(-1);
    } else {
      engine.initAudio();
      setEdgeIndex(-1);
      engine.playK8Layer?.(layer, (ei) => {
        setEdgeIndex(ei);
      });
    }
  }, [engine, edgeIndex, layer]);

  const handleToggleSplitPlayback = useCallback(() => {
    if (tetraPhase !== null) {
      engine.stopAlgebra?.();
      setTetraPhase(null);
    } else {
      engine.initAudio();
      setTetraPhase(null);
      engine.playTetraSplit?.((phase) => setTetraPhase(phase));
    }
  }, [engine, tetraPhase]);

  // Reset defaults signal from parent
  const resetRef = useRef(false);
  useEffect(() => {
    if (!resetRef.current) {
      resetRef.current = true;
      return;
    }
    setLayer(1);
  }, [resetSignal]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SP.md, width: "100%" }}>
      <div style={S_ROW}>
        <span style={S_LABEL}>{t("music_k8_explorer_title")}</span>
        <button type="button" style={layer === 1 ? S_BTN_SM_ACTIVE : S_BTN_SM} onClick={() => handleSelectLayer(1)}>
          {t("music_k8_d1")}
        </button>
        <button type="button" style={layer === 2 ? S_BTN_SM_ACTIVE : S_BTN_SM} onClick={() => handleSelectLayer(2)}>
          {t("music_k8_d2")}
        </button>
        <button type="button" style={layer === 3 ? S_BTN_SM_ACTIVE : S_BTN_SM} onClick={() => handleSelectLayer(3)}>
          {t("music_k8_d3")}
        </button>
        <button type="button" style={edgeIndex >= 0 ? S_BTN_SM_ACTIVE : S_BTN_SM} onClick={handleToggleLayerPlayback}>
          {t("music_k8_play")}
        </button>
        {layer === 2 && (
          <button type="button" style={tetraPhase !== null ? S_BTN_SM_ACTIVE : S_BTN_SM} onClick={handleToggleSplitPlayback}>
            {t("music_tetra_play")}
          </button>
        )}
      </div>
      <div style={S_GRID}>
        <div style={S_PANEL}>
          <div style={S_SUBTITLE}>{t("music_k8_title")}</div>
          <K8LayerGraph layer={layer} activeEdgeIndex={edgeIndex} activeLevels={activeLevels} />
        </div>
        {layer === 2 && (
          <div style={S_PANEL}>
            <div style={S_SUBTITLE}>{t("music_tetra_title")}</div>
            <TetraSplitView phase={tetraPhase} activeLevels={activeLevels} />
          </div>
        )}
      </div>
    </div>
  );
});
