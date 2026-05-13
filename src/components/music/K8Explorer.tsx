import React, { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "../../i18n";
import { C } from "../../styles/tokens";
import { K8LayerGraph } from "./K8LayerGraph";
import type { MusicEngineReturn } from "../../hooks/useMusicEngine";
import { S_CARD_CONTROL_BTN, S_CARD_CONTROL_BTN_ACTIVE } from "./music-panel-styles";

interface K8ExplorerProps {
  engine: MusicEngineReturn;
  activeLevels: { levelIndex: number; rgb: readonly [number, number, number] }[];
  stopSignal: number;
  resetSignal: number;
}

const S_LABEL: React.CSSProperties = {
  fontSize: "var(--music-card-label-fs, 11px)",
  color: C.textDim,
  whiteSpace: "nowrap",
};

export const K8Explorer = React.memo(function K8Explorer({ engine, activeLevels, stopSignal, resetSignal }: K8ExplorerProps) {
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
  }, [stopSignal]);

  // Each d=N button is both selector and play toggle for that layer.
  const handleLayerToggle = useCallback(
    (targetLayer: 1 | 2 | 3) => {
      engine.stopAlgebra?.();
      if (activeLayer === targetLayer) {
        setActiveLayer(null);
        setEdgeIndex(-1);
        return;
      }
      engine.initAudio();
      setActiveLayer(targetLayer);
      setEdgeIndex(-1);
      engine.playK8Layer?.(targetLayer, (ei) => setEdgeIndex(ei));
    },
    [engine, activeLayer],
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
  }, [resetSignal]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--music-card-gap, 4px)", width: "100%", flex: 1 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--music-card-control-gap, 3px)", alignItems: "center" }}>
        <span style={S_LABEL}>{t("music_k8_explorer_title")}</span>
        <div
          style={{
            display: "flex",
            gap: "var(--music-card-control-gap, 3px)",
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <button
            type="button"
            style={activeLayer === 1 ? S_CARD_CONTROL_BTN_ACTIVE : S_CARD_CONTROL_BTN}
            onClick={() => handleLayerToggle(1)}
          >
            {`${activeLayer === 1 ? "\u23f9" : "\u25b6"} ${t("music_k8_d1")}`}
          </button>
          <button
            type="button"
            style={activeLayer === 2 ? S_CARD_CONTROL_BTN_ACTIVE : S_CARD_CONTROL_BTN}
            onClick={() => handleLayerToggle(2)}
          >
            {`${activeLayer === 2 ? "\u23f9" : "\u25b6"} ${t("music_k8_d2")}`}
          </button>
          <button
            type="button"
            style={activeLayer === 3 ? S_CARD_CONTROL_BTN_ACTIVE : S_CARD_CONTROL_BTN}
            onClick={() => handleLayerToggle(3)}
          >
            {`${activeLayer === 3 ? "\u23f9" : "\u25b6"} ${t("music_k8_d3")}`}
          </button>
        </div>
      </div>
      <K8LayerGraph layer={activeLayer} activeEdgeIndex={edgeIndex} activeLevels={activeLevels} />
    </div>
  );
});
