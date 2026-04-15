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
  onLayerChange?: (layer: 1 | 2 | 3) => void;
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

export const K8Explorer = React.memo(function K8Explorer({
  engine,
  activeLevels,
  stopSignal,
  resetSignal,
  tetraPhase,
  onLayerChange,
}: K8ExplorerProps) {
  const { t } = useTranslation();

  const [layer, setLayer] = useState<1 | 2 | 3>(1);
  const [edgeIndex, setEdgeIndex] = useState(-1);

  // Stop signal from parent (parent already calls engine stops)
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    setEdgeIndex(-1);
  }, [stopSignal]);

  const handleSelectLayer = useCallback(
    (newLayer: 1 | 2 | 3) => {
      if (edgeIndex >= 0) {
        engine.stopAlgebra?.();
        setEdgeIndex(-1);
      }
      setLayer(newLayer);
      onLayerChange?.(newLayer);
    },
    [engine, edgeIndex, onLayerChange],
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

  // Reset defaults signal from parent
  const resetRef = useRef(false);
  useEffect(() => {
    if (!resetRef.current) {
      resetRef.current = true;
      return;
    }
    setLayer(1);
    onLayerChange?.(1);
  }, [resetSignal, onLayerChange]);

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
      </div>
      <K8LayerGraph layer={layer} activeEdgeIndex={edgeIndex} activeLevels={activeLevels} tetraPhase={layer === 2 ? tetraPhase : null} />
    </div>
  );
});
