import React, { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "../../i18n";
import { S_BTN_SM, S_BTN_SM_ACTIVE } from "../../styles";
import { C, FS, SP } from "../../tokens";
import { K8LayerGraph } from "./K8LayerGraph";
import type { MusicEngineReturn } from "../../hooks/useMusicEngine";

interface K8ExplorerProps {
  engine: MusicEngineReturn;
  activeLevels: { lv: number; rgb: [number, number, number] }[];
  stopSignal: number;
  resetSignal: number;
  tetraPhase: "t0" | "t1" | null;
  /** `null` when no layer is playing (graph shows only nodes). */
  onLayerChange?: (layer: 1 | 2 | 3 | null) => void;
}

const S_LABEL: React.CSSProperties = {
  fontSize: FS.lg,
  color: C.textDim,
  whiteSpace: "nowrap",
};

export const K8Explorer = React.memo(function K8Explorer({
  engine,
  activeLevels,
  stopSignal,
  resetSignal,
  tetraPhase,
  onLayerChange,
}: K8ExplorerProps) {
  const { t } = useTranslation();

  // null = no layer playing → graph shows only nodes (no edges).
  const [activeLayer, setActiveLayer] = useState<1 | 2 | 3 | null>(null);
  const [edgeIndex, setEdgeIndex] = useState(-1);

  // Stop signal from parent (parent already calls engine stops)
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    setActiveLayer(null);
    setEdgeIndex(-1);
    onLayerChange?.(null);
  }, [stopSignal, onLayerChange]);

  // Each d=N button is both selector and play toggle for that layer.
  const handleLayerToggle = useCallback(
    (targetLayer: 1 | 2 | 3) => {
      engine.stopAlgebra?.();
      if (activeLayer === targetLayer) {
        setActiveLayer(null);
        setEdgeIndex(-1);
        onLayerChange?.(null);
        return;
      }
      engine.initAudio();
      setActiveLayer(targetLayer);
      setEdgeIndex(-1);
      onLayerChange?.(targetLayer);
      engine.playK8Layer?.(targetLayer, (ei) => setEdgeIndex(ei));
    },
    [engine, activeLayer, onLayerChange],
  );

  // Reset defaults signal from parent
  const resetRef = useRef(false);
  useEffect(() => {
    if (!resetRef.current) {
      resetRef.current = true;
      return;
    }
    setActiveLayer(null);
    setEdgeIndex(-1);
    onLayerChange?.(null);
  }, [resetSignal, onLayerChange]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SP.md, width: "100%", flex: 1 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: SP.sm, alignItems: "center" }}>
        <span style={S_LABEL}>{t("music_k8_explorer_title")}</span>
        <div style={{ display: "flex", gap: SP.sm, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
          <button type="button" style={activeLayer === 1 ? S_BTN_SM_ACTIVE : S_BTN_SM} onClick={() => handleLayerToggle(1)}>
            {`${activeLayer === 1 ? "\u23f9" : "\u25b6"} ${t("music_k8_d1")}`}
          </button>
          <button type="button" style={activeLayer === 2 ? S_BTN_SM_ACTIVE : S_BTN_SM} onClick={() => handleLayerToggle(2)}>
            {`${activeLayer === 2 ? "\u23f9" : "\u25b6"} ${t("music_k8_d2")}`}
          </button>
          <button type="button" style={activeLayer === 3 ? S_BTN_SM_ACTIVE : S_BTN_SM} onClick={() => handleLayerToggle(3)}>
            {`${activeLayer === 3 ? "\u23f9" : "\u25b6"} ${t("music_k8_d3")}`}
          </button>
        </div>
      </div>
      <K8LayerGraph
        layer={activeLayer}
        activeEdgeIndex={edgeIndex}
        activeLevels={activeLevels}
        tetraPhase={activeLayer === 2 ? tetraPhase : null}
      />
    </div>
  );
});
