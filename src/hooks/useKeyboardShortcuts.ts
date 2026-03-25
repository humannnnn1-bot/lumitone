import { useEffect } from "react";
import { BRUSH_MIN, BRUSH_MAX, BRUSH_STEP, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from "../constants";
import type { ToolId } from "../constants";
import { LEVEL_INFO } from "../color-engine";

export function useKeyboardShortcuts(
  setTool: React.Dispatch<React.SetStateAction<ToolId>>,
  setBrushLevel: React.Dispatch<React.SetStateAction<number>>,
  setBrushSize: React.Dispatch<React.SetStateAction<number>>,
  dispatch: React.Dispatch<import("../types").CanvasAction>,
  announce: (msg: string) => void,
  endPan: () => void,
  setShowHelp: React.Dispatch<React.SetStateAction<boolean>>,
  setCursorMode: React.Dispatch<React.SetStateAction<null | "grab" | "grabbing">>,
  spaceRef: React.MutableRefObject<boolean>,
  panningRef: React.MutableRefObject<boolean>,
  brushSizeRef: React.MutableRefObject<number>,
  setShowNewCanvas: React.Dispatch<React.SetStateAction<boolean>>,
  t: import("../i18n").TranslationFn,
  setZoom: React.Dispatch<React.SetStateAction<number>>,
  onSave: () => void,
  onSaveAs: () => void,
) {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space' && !e.repeat) { spaceRef.current = true; setCursorMode("grab"); e.preventDefault(); return; }
      if (e.key === 'F1') { e.preventDefault(); setShowHelp(v => !v); return; }
      if (e.ctrlKey || e.metaKey) {
        const mk = e.key.toLowerCase();
        if (mk === 'n') { e.preventDefault(); setShowNewCanvas(true); return; }
        if (mk === 's' && e.shiftKey) { e.preventDefault(); onSaveAs(); return; }
        if (mk === 's') { e.preventDefault(); onSave(); return; }
        if (mk === 'z' && e.shiftKey) { e.preventDefault(); dispatch({ type: "redo" }); }
        else if (mk === 'z') { e.preventDefault(); dispatch({ type: "undo" }); }
        else if (mk === 'y') { e.preventDefault(); dispatch({ type: "redo" }); }
        if (mk === '=' || mk === '+') { e.preventDefault(); setZoom(z => Math.min(ZOOM_MAX, z * ZOOM_STEP)); return; }
        if (mk === '-') { e.preventDefault(); setZoom(z => Math.max(ZOOM_MIN, z / ZOOM_STEP)); return; }
        return;
      }
      const k = e.key.toLowerCase();
      if (k === 'b') { setTool("brush"); announce(t("announce_brush")); return; }
      if (k === 'e') { setTool("eraser"); announce(t("announce_eraser")); return; }
      if (k === 'f') { setTool("fill"); announce(t("announce_fill")); return; }
      if (k === 'l') { setTool("line"); announce(t("announce_line")); return; }
      if (k === 'r') { setTool("rect"); announce(t("announce_rect")); return; }
      if (k === 'o') { setTool("ellipse"); announce(t("announce_ellipse")); return; }
      if (k >= '0' && k <= '7') { setBrushLevel(+k); announce(t("announce_level", k, LEVEL_INFO[+k].name)); return; }
      if (e.key === '[') { const nv = Math.max(BRUSH_MIN, brushSizeRef.current - BRUSH_STEP); setBrushSize(nv); announce(t("announce_size", nv)); return; }
      if (e.key === ']') { const nv = Math.min(BRUSH_MAX, brushSizeRef.current + BRUSH_STEP); setBrushSize(nv); announce(t("announce_size", nv)); return; }
      if (e.key === '+' || e.key === '=') { setZoom(z => Math.min(ZOOM_MAX, z * ZOOM_STEP)); return; }
      if (e.key === '-') { setZoom(z => Math.max(ZOOM_MIN, z / ZOOM_STEP)); return; }
      if (e.key === '?') { setShowHelp(v => !v); return; }
      if (e.key === 'Escape') { setShowHelp(false); return; }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') { spaceRef.current = false; setCursorMode(null); if (panningRef.current) endPan(); }
    };
    const blur = () => {
      if (spaceRef.current) { spaceRef.current = false; setCursorMode(null); if (panningRef.current) endPan(); }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- spaceRef, panningRef, brushSizeRef are stable refs
  }, [setTool, setBrushLevel, setBrushSize, dispatch, announce, endPan, setShowHelp, setCursorMode, setShowNewCanvas, t, setZoom, onSave, onSaveAs]);
}
