import React, { useState, useRef, useEffect, useCallback } from "react";
import { S_BTN, S_BTN_ACTIVE } from "../styles/shared";
import { useTranslation } from "../i18n";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { C, Z, SP, FS, R } from "../styles/tokens";

interface CropModalProps {
  img: HTMLImageElement;
  imgW: number;
  imgH: number;
  onConfirm: (x: number, y: number, w: number, h: number) => void;
  onCancel: () => void;
}

const MIN_CROP = 4;
const HANDLE_VISUAL = 10;
const HANDLE_TOUCH = 44; // minimum recommended touch target

type DragMode = "move" | "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w" | null;

export const CropModal = React.memo(function CropModal({ img, imgW, imgH, onConfirm, onCancel }: CropModalProps) {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Crop rect in image-pixel coordinates
  const [cx, setCx] = useState(0);
  const [cy, setCy] = useState(0);
  const [cw, setCw] = useState(imgW);
  const [ch, setCh] = useState(imgH);

  // Display scale: image pixels → screen pixels
  const [displayScale, setDisplayScale] = useState(1);

  useFocusTrap(modalRef, true, onCancel);

  // Draw image on canvas and compute display scale
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const maxW = Math.min(window.innerWidth * 0.85, 800);
    const maxH = window.innerHeight * 0.6;
    const scale = Math.min(1, maxW / imgW, maxH / imgH);
    setDisplayScale(scale);

    const dw = Math.round(imgW * scale);
    const dh = Math.round(imgH * scale);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(dw * dpr);
    canvas.height = Math.round(dh * dpr);
    canvas.style.width = `${dw}px`;
    canvas.style.height = `${dh}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }, [img, imgW, imgH]);

  // Active drag mode for visual feedback
  const [activeMode, setActiveMode] = useState<DragMode>(null);

  // Drag state
  const dragRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    origCx: number;
    origCy: number;
    origCw: number;
    origCh: number;
  } | null>(null);

  const clamp = useCallback(
    (nx: number, ny: number, nw: number, nh: number) => {
      nw = Math.max(MIN_CROP, Math.min(nw, imgW));
      nh = Math.max(MIN_CROP, Math.min(nh, imgH));
      nx = Math.max(0, Math.min(nx, imgW - nw));
      ny = Math.max(0, Math.min(ny, imgH - nh));
      return { nx, ny, nw, nh };
    },
    [imgW, imgH],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, mode: DragMode) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setActiveMode(mode);
      dragRef.current = {
        mode,
        startX: e.clientX,
        startY: e.clientY,
        origCx: cx,
        origCy: cy,
        origCw: cw,
        origCh: ch,
      };
    },
    [cx, cy, cw, ch],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d || !d.mode) return;
      const dx = (e.clientX - d.startX) / displayScale;
      const dy = (e.clientY - d.startY) / displayScale;

      let nx = d.origCx,
        ny = d.origCy,
        nw = d.origCw,
        nh = d.origCh;

      if (d.mode === "move") {
        nx = d.origCx + dx;
        ny = d.origCy + dy;
      } else {
        // Resize
        if (d.mode.includes("w")) {
          nx = d.origCx + dx;
          nw = d.origCw - dx;
        }
        if (d.mode.includes("e")) {
          nw = d.origCw + dx;
        }
        if (d.mode.includes("n")) {
          ny = d.origCy + dy;
          nh = d.origCh - dy;
        }
        if (d.mode.includes("s")) {
          nh = d.origCh + dy;
        }
        // Prevent negative size
        if (nw < MIN_CROP) {
          if (d.mode.includes("w")) nx = d.origCx + d.origCw - MIN_CROP;
          nw = MIN_CROP;
        }
        if (nh < MIN_CROP) {
          if (d.mode.includes("n")) ny = d.origCy + d.origCh - MIN_CROP;
          nh = MIN_CROP;
        }
      }

      const c = clamp(nx, ny, nw, nh);
      setCx(Math.round(c.nx));
      setCy(Math.round(c.ny));
      setCw(Math.round(c.nw));
      setCh(Math.round(c.nh));
    },
    [displayScale, clamp],
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
    setActiveMode(null);
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm(cx, cy, cw, ch);
  }, [cx, cy, cw, ch, onConfirm]);

  // Screen-coordinate crop rect
  const sx = cx * displayScale;
  const sy = cy * displayScale;
  const sw = cw * displayScale;
  const sh = ch * displayScale;

  const mkHandle = (): React.CSSProperties => ({
    position: "absolute",
    width: HANDLE_TOUCH,
    height: HANDLE_TOUCH,
    background: "transparent",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    touchAction: "none",
  });

  const mkHandleVisual = (mode: DragMode): React.CSSProperties => ({
    width: HANDLE_VISUAL,
    height: HANDLE_VISUAL,
    background: activeMode === mode ? C.accentBright : C.accent,
    borderRadius: 2,
    boxShadow: activeMode === mode ? `0 0 6px 1px ${C.accentBright}` : `0 0 2px rgba(0,0,0,0.5)`,
    transform: activeMode === mode ? "scale(1.3)" : "none",
    transition: activeMode ? "none" : "transform 0.15s, box-shadow 0.15s",
    pointerEvents: "none",
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: C.bgOverlay,
        zIndex: Z.modal,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        touchAction: "none",
        overscrollBehavior: "contain",
      }}
      onClick={onCancel}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("crop_image_title")}
        style={{
          background: C.bgModal,
          border: `1px solid ${C.borderHover}`,
          borderRadius: R["2xl"],
          padding: SP["2xl"],
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: SP.lg,
          maxWidth: "90vw",
          maxHeight: "90vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Crop area */}
        <div
          ref={containerRef}
          style={{
            position: "relative",
            display: "inline-block",
            lineHeight: 0,
            touchAction: "none",
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* Image canvas */}
          <canvas ref={canvasRef} style={{ display: "block", borderRadius: R.md }} />

          {/* Dim overlay — 4 rects around the crop area */}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            {/* Top */}
            <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: sy, background: "rgba(0,0,0,0.55)" }} />
            {/* Bottom */}
            <div style={{ position: "absolute", left: 0, top: sy + sh, right: 0, bottom: 0, background: "rgba(0,0,0,0.55)" }} />
            {/* Left */}
            <div style={{ position: "absolute", left: 0, top: sy, width: sx, height: sh, background: "rgba(0,0,0,0.55)" }} />
            {/* Right */}
            <div style={{ position: "absolute", left: sx + sw, top: sy, right: 0, height: sh, background: "rgba(0,0,0,0.55)" }} />
          </div>

          {/* Crop border */}
          <div
            style={{
              position: "absolute",
              left: sx,
              top: sy,
              width: sw,
              height: sh,
              border: `2px solid ${activeMode === "move" ? C.accentBright : C.accent}`,
              boxShadow: activeMode === "move" ? `inset 0 0 0 1px ${C.accentBright}` : "none",
              boxSizing: "border-box",
              cursor: "move",
              touchAction: "none",
            }}
            onPointerDown={(e) => handlePointerDown(e, "move")}
          />

          {/* Resize handles — 44px touch target, 10px visual square */}
          {/* Corners */}
          <div
            style={{ ...mkHandle(), left: sx - HANDLE_TOUCH / 2, top: sy - HANDLE_TOUCH / 2, cursor: "nw-resize" }}
            onPointerDown={(e) => handlePointerDown(e, "nw")}
          >
            <div style={mkHandleVisual("nw")} />
          </div>
          <div
            style={{ ...mkHandle(), left: sx + sw - HANDLE_TOUCH / 2, top: sy - HANDLE_TOUCH / 2, cursor: "ne-resize" }}
            onPointerDown={(e) => handlePointerDown(e, "ne")}
          >
            <div style={mkHandleVisual("ne")} />
          </div>
          <div
            style={{ ...mkHandle(), left: sx - HANDLE_TOUCH / 2, top: sy + sh - HANDLE_TOUCH / 2, cursor: "sw-resize" }}
            onPointerDown={(e) => handlePointerDown(e, "sw")}
          >
            <div style={mkHandleVisual("sw")} />
          </div>
          <div
            style={{ ...mkHandle(), left: sx + sw - HANDLE_TOUCH / 2, top: sy + sh - HANDLE_TOUCH / 2, cursor: "se-resize" }}
            onPointerDown={(e) => handlePointerDown(e, "se")}
          >
            <div style={mkHandleVisual("se")} />
          </div>
          {/* Edges */}
          <div
            style={{ ...mkHandle(), left: sx + sw / 2 - HANDLE_TOUCH / 2, top: sy - HANDLE_TOUCH / 2, cursor: "n-resize" }}
            onPointerDown={(e) => handlePointerDown(e, "n")}
          >
            <div style={mkHandleVisual("n")} />
          </div>
          <div
            style={{ ...mkHandle(), left: sx + sw / 2 - HANDLE_TOUCH / 2, top: sy + sh - HANDLE_TOUCH / 2, cursor: "s-resize" }}
            onPointerDown={(e) => handlePointerDown(e, "s")}
          >
            <div style={mkHandleVisual("s")} />
          </div>
          <div
            style={{ ...mkHandle(), left: sx - HANDLE_TOUCH / 2, top: sy + sh / 2 - HANDLE_TOUCH / 2, cursor: "w-resize" }}
            onPointerDown={(e) => handlePointerDown(e, "w")}
          >
            <div style={mkHandleVisual("w")} />
          </div>
          <div
            style={{ ...mkHandle(), left: sx + sw - HANDLE_TOUCH / 2, top: sy + sh / 2 - HANDLE_TOUCH / 2, cursor: "e-resize" }}
            onPointerDown={(e) => handlePointerDown(e, "e")}
          >
            <div style={mkHandleVisual("e")} />
          </div>
        </div>

        {/* Info */}
        <div style={{ fontSize: FS.lg, color: C.textDim, fontFamily: "monospace" }}>
          {cw} × {ch} px
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: SP.xl }}>
          <button onClick={handleConfirm} style={{ ...S_BTN_ACTIVE, padding: "6px 20px" }}>
            {t("btn_ok")}
          </button>
          <button onClick={onCancel} style={{ ...S_BTN, padding: "6px 20px" }}>
            {t("btn_cancel")}
          </button>
        </div>
      </div>
    </div>
  );
});
