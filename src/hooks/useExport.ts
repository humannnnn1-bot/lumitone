import { useCallback } from "react";
import { renderBuf } from "../render-buf";
import type { CanvasData, ImgCache } from "../types";

export interface ExportResult {
  saveColor: (ref: React.RefObject<HTMLCanvasElement | null>, name: string) => void;
  saveGlaze: (name: string) => void;
}

/** Download a canvas element as PNG. Uses Web Share API on mobile, falls back to anchor download. */
function downloadCanvas(
  canvas: HTMLCanvasElement,
  name: string,
  showToast: (message: string, type: "error" | "success" | "info") => void,
  t: import("../i18n").TranslationFn,
): void {
  canvas.toBlob((blob) => {
    if (!blob) {
      showToast(t("toast_image_gen_failed"), "error");
      return;
    }
    const fallbackSave = (b: Blob) => {
      const url = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // iOS Safari ignores <a download> — open in new tab as last resort
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Mac") && "ontouchend" in document);
      if (isIOS) {
        window.open(url, "_blank");
        showToast(t("toast_save_long_press"), "info");
      }
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    };
    const file = new File([blob], name, { type: "image/png" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      navigator.share({ files: [file] }).catch(() => fallbackSave(blob));
    } else {
      fallbackSave(blob);
    }
  }, "image/png");
}

/** Render color preview to a temporary off-screen canvas. */
function renderToTempCanvas(cvs: CanvasData, colorLUT: [number, number, number][]): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = cvs.w;
  c.height = cvs.h;
  const cache: ImgCache = { src: null, prv: null, s32: null, p32: null };
  renderBuf(cvs.data, cvs.w, cvs.h, colorLUT, null, c, cache, undefined, cvs.colorMap);
  return c;
}

export function useExport(
  cvs: CanvasData,
  colorLUT: [number, number, number][],
  showToast: (message: string, type: "error" | "success" | "info") => void,
  t: import("../i18n").TranslationFn,
): ExportResult {
  const saveColor = useCallback(
    (ref: React.RefObject<HTMLCanvasElement | null>, name: string) => {
      const c = ref.current ?? renderToTempCanvas(cvs, colorLUT);
      downloadCanvas(c, name, showToast, t);
    },
    [cvs, colorLUT, showToast, t],
  );

  const saveGlaze = useCallback(
    (name: string) => {
      const c = renderToTempCanvas(cvs, colorLUT);
      downloadCanvas(c, name, showToast, t);
    },
    [cvs, colorLUT, showToast, t],
  );

  return { saveColor, saveGlaze };
}
