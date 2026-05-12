import { useCallback } from "react";
import { renderCanvasBuffers } from "../drawing/render-buf";
import { openBlobUrlInNewTab } from "../utils";
import type { CanvasData, ImgCache } from "../types";

interface ExportResult {
  saveColor: (ref: React.RefObject<HTMLCanvasElement | null>, name: string) => void;
  saveColorWithLUT: (lut: [number, number, number][], name: string) => void;
  saveGlaze: (name: string) => void;
  shareColor: (ref: React.RefObject<HTMLCanvasElement | null>, name: string) => void;
  shareGlaze: (name: string) => void;
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
function renderToTempCanvas(canvasData: CanvasData, colorLUT: [number, number, number][]): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = canvasData.width;
  c.height = canvasData.height;
  const cache: ImgCache = { sourceImageData: null, previewImageData: null, sourcePixels32: null, previewPixels32: null };
  renderCanvasBuffers(
    canvasData.levelData,
    canvasData.width,
    canvasData.height,
    colorLUT,
    null,
    c,
    cache,
    undefined,
    canvasData.pixelCandidateOverrideMap,
  );
  return c;
}

export function useExport(
  canvasData: CanvasData,
  colorLUT: [number, number, number][],
  showToast: (message: string, type: "error" | "success" | "info") => void,
  t: import("../i18n").TranslationFn,
): ExportResult {
  const saveColor = useCallback(
    (ref: React.RefObject<HTMLCanvasElement | null>, name: string) => {
      const c = ref.current ?? renderToTempCanvas(canvasData, colorLUT);
      downloadCanvas(c, name, showToast, t);
    },
    [canvasData, colorLUT, showToast, t],
  );

  const saveColorWithLUT = useCallback(
    (lut: [number, number, number][], name: string) => {
      const c = renderToTempCanvas(canvasData, lut);
      downloadCanvas(c, name, showToast, t);
    },
    [canvasData, showToast, t],
  );

  const saveGlaze = useCallback(
    (name: string) => {
      const c = renderToTempCanvas(canvasData, colorLUT);
      downloadCanvas(c, name, showToast, t);
    },
    [canvasData, colorLUT, showToast, t],
  );

  const shareColor = useCallback(
    (ref: React.RefObject<HTMLCanvasElement | null>, name: string) => {
      const c = ref.current ?? renderToTempCanvas(canvasData, colorLUT);
      shareCanvas(c, name, showToast, t);
    },
    [canvasData, colorLUT, showToast, t],
  );

  const shareGlaze = useCallback(
    (name: string) => {
      const c = renderToTempCanvas(canvasData, colorLUT);
      shareCanvas(c, name, showToast, t);
    },
    [canvasData, colorLUT, showToast, t],
  );

  return { saveColor, saveColorWithLUT, saveGlaze, shareColor, shareGlaze };
}
