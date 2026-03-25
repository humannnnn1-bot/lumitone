import { useCallback } from "react";
import { renderBuf } from "../render-buf";
import type { CanvasData, ImgCache } from "../types";

export interface ExportResult {
  saveColor: (ref: React.RefObject<HTMLCanvasElement | null>, name: string) => void;
  saveGlaze: (name: string) => void;
}

export function useExport(
  cvs: CanvasData,
  colorLUT: [number, number, number][],
  showToast: (message: string, type: "error" | "success" | "info") => void,
  t: import("../i18n").TranslationFn,
): ExportResult {
  const saveColor = useCallback((ref: React.RefObject<HTMLCanvasElement | null>, name: string) => {
    const c = ref.current; if (!c) return;
    const u = c.toDataURL("image/png");
    if (!u || u === "data:,") { showToast(t("toast_image_gen_failed"), "error"); return; }
    const a = document.createElement("a"); a.href = u; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }, [showToast, t]);

  const saveGlaze = useCallback((name: string) => {
    const c = document.createElement("canvas");
    c.width = cvs.w; c.height = cvs.h;
    const cache: ImgCache = { src: null, prv: null, s32: null, p32: null };
    renderBuf(cvs.data, cvs.w, cvs.h, colorLUT, null, c, cache, undefined, cvs.colorMap);
    const tmpRef = { current: c } as React.RefObject<HTMLCanvasElement | null>;
    saveColor(tmpRef, name);
  }, [cvs, colorLUT, saveColor]);

  return { saveColor, saveGlaze };
}
