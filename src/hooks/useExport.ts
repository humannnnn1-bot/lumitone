import { useCallback } from "react";
import { renderBuf } from "../drawing/render-buf";
import { openBlobUrlInNewTab } from "../utils";
import type { ExportScale } from "../constants";
import type { CanvasData, ImgCache } from "../types";

interface ExportResult {
  saveColor: (ref: React.RefObject<HTMLCanvasElement | null>, name: string, scale?: ExportScale) => void;
  saveColorWithLUT: (lut: [number, number, number][], name: string, scale?: ExportScale) => void;
  saveGlaze: (name: string, scale?: ExportScale) => void;
  shareColor: (ref: React.RefObject<HTMLCanvasElement | null>, name: string) => void;
  shareGlaze: (name: string) => void;
}

function nameWithScale(name: string, scale: ExportScale): string {
  if (scale === 1) return name;
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return `${name}@${scale}x`;
  return `${name.slice(0, dot)}@${scale}x${name.slice(dot)}`;
}

function scaledCanvas(canvas: HTMLCanvasElement, scale: ExportScale): HTMLCanvasElement | null {
  if (scale === 1) return canvas;
  const c = document.createElement("canvas");
  c.width = canvas.width * scale;
  c.height = canvas.height * scale;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, 0, 0, c.width, c.height);
  return c;
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
      // iOS Safari ignores <a download> — open in new tab as last resort
      if (isIOS) {
        openBlobUrlInNewTab(url);
        showToast(t("toast_save_long_press", name), "info");
      } else if (isAndroid) {
        showToast(t("toast_saved", name), "success");
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
  }, "image/png");
}

function downloadCanvasAtScale(
  canvas: HTMLCanvasElement,
  name: string,
  scale: ExportScale,
  showToast: (message: string, type: "error" | "success" | "info") => void,
  t: import("../i18n").TranslationFn,
): void {
  const c = scaledCanvas(canvas, scale);
  if (!c) {
    showToast(t("toast_image_gen_failed"), "error");
    return;
  }
  downloadCanvas(c, nameWithScale(name, scale), showToast, t);
}

/** Share a canvas via the Web Share API. Desktop power-user entry (right-click on save). */
function shareCanvas(
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
    const file = new File([blob], name, { type: "image/png" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      navigator.share({ files: [file] }).catch(() => {
        // User cancelled or share target rejected — silent.
      });
    } else {
      showToast(t("toast_share_unsupported"), "error");
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
    (ref: React.RefObject<HTMLCanvasElement | null>, name: string, scale: ExportScale = 1) => {
      const c = ref.current ?? renderToTempCanvas(cvs, colorLUT);
      downloadCanvasAtScale(c, name, scale, showToast, t);
    },
    [cvs, colorLUT, showToast, t],
  );

  const saveColorWithLUT = useCallback(
    (lut: [number, number, number][], name: string, scale: ExportScale = 1) => {
      const c = renderToTempCanvas(cvs, lut);
      downloadCanvasAtScale(c, name, scale, showToast, t);
    },
    [cvs, showToast, t],
  );

  const saveGlaze = useCallback(
    (name: string, scale: ExportScale = 1) => {
      const c = renderToTempCanvas(cvs, colorLUT);
      downloadCanvasAtScale(c, name, scale, showToast, t);
    },
    [cvs, colorLUT, showToast, t],
  );

  const shareColor = useCallback(
    (ref: React.RefObject<HTMLCanvasElement | null>, name: string) => {
      const c = ref.current ?? renderToTempCanvas(cvs, colorLUT);
      shareCanvas(c, name, showToast, t);
    },
    [cvs, colorLUT, showToast, t],
  );

  const shareGlaze = useCallback(
    (name: string) => {
      const c = renderToTempCanvas(cvs, colorLUT);
      shareCanvas(c, name, showToast, t);
    },
    [cvs, colorLUT, showToast, t],
  );

  return { saveColor, saveColorWithLUT, saveGlaze, shareColor, shareGlaze };
}
