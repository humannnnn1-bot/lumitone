import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import type { AnalysisPixelMaps, CanvasData } from "../types";
import type { MapMode } from "../types";
import { buildRegionSizeMap, getAnalysisMapHoverInfo, rasterizeAnalysisMap } from "../drawing/analysis-map-render";
import { C, SP, FS, R, FONT } from "../styles/tokens";
import { openBlobUrlInNewTab, timestamp } from "../utils";
import { recordDebugPerf, startDebugPerf } from "../utils/perf-debug";
import { useTranslation } from "../i18n";
import { ConfirmModal } from "./ConfirmModal";
import { S_CANVAS_STATUS_STABLE } from "../styles/shared";
import { getFullStatusText, getVisibleStatusText, type StatusText, useCompactStatus } from "../utils/status-display";

const EMPTY_REGION_SIZE_BY_ID = new Map<number, number>();

/* ── Map canvas component ── */
export function MapCanvas({
  mode,
  pixelMaps,
  colorLUT,
  candidateIndexByLevel,
  canvasData,
  displayWidth,
  displayHeight,
  showToast,
}: {
  mode: MapMode;
  pixelMaps: AnalysisPixelMaps;
  colorLUT: [number, number, number][];
  candidateIndexByLevel: readonly number[];
  canvasData: CanvasData;
  displayWidth: number;
  displayHeight: number;
  showToast?: (message: string, type: "error" | "success" | "info") => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLCanvasElement>(null);
  const cw = canvasData.width;
  const ch = canvasData.height;
  const regionSizeCache = useMemo(
    () =>
      mode === "region" && pixelMaps.width === cw && pixelMaps.height === ch && pixelMaps.regionId.length >= cw * ch
        ? buildRegionSizeMap(pixelMaps)
        : EMPTY_REGION_SIZE_BY_ID,
    [mode, pixelMaps, cw, ch],
  );
  const compactStatus = useCompactStatus();

  useEffect(() => {
    const c = ref.current;
    if (!c || cw === 0 || ch === 0) return;
    const perfStart = startDebugPerf();
    if (c.width !== cw || c.height !== ch) {
      c.width = cw;
      c.height = ch;
    }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(cw, ch);
    const d32 = new Uint32Array(img.data.buffer);
    const n = cw * ch;
    const status = rasterizeAnalysisMap({ mode, pixelMaps, colorLUT, canvasData, target: d32, regionSizeById: regionSizeCache });
    ctx.putImageData(img, 0, 0);
    recordDebugPerf(`MapCanvas:${mode}`, perfStart, {
      status,
      w: cw,
      h: ch,
      pixels: n,
    });
  }, [mode, pixelMaps, colorLUT, canvasData, cw, ch, regionSizeCache]);

  // Hover info
  const [hoverInfo, setHoverInfo] = useState<StatusText | null>(null);

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const px = (((e.clientX - rect.left) / rect.width) * cw) | 0;
      const py = (((e.clientY - rect.top) / rect.height) * ch) | 0;
      if (px < 0 || px >= cw || py < 0 || py >= ch) {
        setHoverInfo(null);
        return;
      }
      const info = getAnalysisMapHoverInfo({
        x: px,
        y: py,
        mode,
        pixelMaps,
        colorLUT,
        candidateIndexByLevel,
        canvasData,
        regionSizeById: regionSizeCache,
      });
      setHoverInfo(info);
    },
    [mode, pixelMaps, colorLUT, candidateIndexByLevel, canvasData, cw, ch, regionSizeCache],
  );

  const onMouseLeave = useCallback(() => setHoverInfo(null), []);

  // Long-press to save map image (mobile)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSaveHint, setShowSaveHint] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);

  const saveMap = useCallback(() => {
    const c = ref.current;
    if (!c) return;
    c.toBlob((blob) => {
      if (!blob) return;
      const name = `chromalum_map_${mode}_${timestamp()}.png`;
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Mac") && "ontouchend" in document);
      const isAndroid = /Android/i.test(navigator.userAgent);
      const fallbackSave = (b: Blob) => {
        const url = URL.createObjectURL(b);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        if (isIOS) {
          openBlobUrlInNewTab(url);
          showToast?.(t("toast_save_long_press", name), "info");
        } else if (isAndroid) {
          showToast?.(t("toast_saved", name), "success");
        }
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      };
      const file = new File([blob], name, { type: "image/png" });
      // Share sheet only on iOS; desktop Chrome/Edge also expose navigator.share but
      // users expect an immediate download there.
      if (isIOS && navigator.share && navigator.canShare?.({ files: [file] })) {
        navigator.share({ files: [file] }).catch((err: unknown) => {
          // AbortError = user dismissed the share sheet; don't surprise them with a download.
          if ((err as { name?: string })?.name !== "AbortError") fallbackSave(blob);
        });
      } else {
        fallbackSave(blob);
      }
    });
  }, [mode, showToast, t]);

  const longPressOrigin = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    longPressOrigin.current = { x: e.clientX, y: e.clientY };
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      longPressOrigin.current = null;
      setConfirmSaveOpen(true);
    }, 1000);
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    longPressOrigin.current = null;
  }, []);

  const onPointerMoveLP = useCallback(
    (e: React.PointerEvent) => {
      if (!longPressOrigin.current || !longPressTimer.current) return;
      const dx = e.clientX - longPressOrigin.current.x;
      const dy = e.clientY - longPressOrigin.current.y;
      if (dx * dx + dy * dy > 100) cancelLongPress(); // >10px movement cancels
    },
    [cancelLongPress],
  );

  return (
    <div
      className="map-canvas-frame"
      style={{
        alignItems: "center",
        display: "flex",
        flexDirection: "column",
        maxWidth: "100%",
        position: "relative",
        width: displayWidth,
      }}
    >
      <canvas
        ref={ref}
        role="img"
        aria-label={t("map_title")}
        width={cw || 1}
        height={ch || 1}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onPointerDown={onPointerDown}
        onPointerUp={cancelLongPress}
        onPointerCancel={cancelLongPress}
        onPointerMove={onPointerMoveLP}
        style={{
          width: displayWidth,
          height: displayHeight,
          display: "block",
          imageRendering: "pixelated",
          borderRadius: R.lg,
          border: `1px solid ${C.border}`,
          cursor: "crosshair",
          touchAction: "none",
        }}
      />
      {showSaveHint && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "rgba(0,0,0,0.75)",
            color: "#fff",
            padding: `${SP.md}px ${SP.xl}px`,
            borderRadius: R.lg,
            fontSize: FS.sm,
            fontFamily: FONT.mono,
            pointerEvents: "none",
          }}
        >
          Saving...
        </div>
      )}
      <div
        className="map-status-line"
        title={hoverInfo ? getFullStatusText(hoverInfo) : undefined}
        style={{
          ...S_CANVAS_STATUS_STABLE,
          alignSelf: "center",
          maxWidth: "var(--map-status-line-max-width, var(--canvas-status-line-max-width, 100%))",
          width: "var(--map-status-line-width, var(--canvas-status-line-width, 100%))",
        }}
      >
        {hoverInfo ? getVisibleStatusText(hoverInfo, compactStatus) : "\u2014"}
      </div>
      <ConfirmModal
        open={confirmSaveOpen}
        message={t("confirm_save_map")}
        onConfirm={() => {
          setConfirmSaveOpen(false);
          setShowSaveHint(true);
          setTimeout(() => setShowSaveHint(false), 1500);
          saveMap();
        }}
        onCancel={() => setConfirmSaveOpen(false)}
      />
    </div>
  );
}
