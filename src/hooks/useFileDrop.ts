import { useState, useEffect, useRef, useCallback } from "react";
import { MAX_IMAGE_SIZE, MAX_FILE_BYTES, MAX_IMAGE_PIXELS } from "../constants";
import { LUMA_R, LUMA_G, LUMA_B, GRAY_LUT } from "../color-engine";
import { useSyncRef } from "./useSyncRef";

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp"]);

export interface FileDropResult {
  dragging: boolean;
  loadImg: (file: File) => void;
  onDragEnter: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

export function useFileDrop(
  dispatch: React.Dispatch<import("../types").CanvasAction>,
  setZoom: React.Dispatch<React.SetStateAction<number>>,
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>,
  showToast: (message: string, type: "error" | "success" | "info") => void,
  announce: (msg: string) => void,
  t: import("../i18n").TranslationFn,
  onCropRequest?: (img: HTMLImageElement, w: number, h: number) => void,
): FileDropResult {
  const [dragging, setDragging] = useState(false);
  const dragCountRef = useRef(0);

  const loadImg = useCallback(
    (file: File) => {
      if (!file || !ALLOWED_IMAGE_TYPES.has(file.type)) return;
      if (file.size > MAX_FILE_BYTES) {
        showToast(t("toast_image_too_large"), "error");
        return;
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      let retried = false;
      img.onerror = () => {
        // Android Chrome intermittently fails to decode on the first attempt
        // (cold decoder / memory pressure / content:// read race). Retry once.
        if (!retried) {
          retried = true;
          setTimeout(() => {
            img.src = "";
            img.src = url;
          }, 100);
          return;
        }
        URL.revokeObjectURL(url);
        showToast(t("toast_image_load_failed"), "error");
      };
      img.onload = () => {
        URL.revokeObjectURL(url);
        const iw = Math.max(1, img.width),
          ih = Math.max(1, img.height);
        if (iw * ih > MAX_IMAGE_PIXELS) {
          showToast(t("toast_image_too_large"), "error");
          return;
        }
        const scale = Math.min(1, MAX_IMAGE_SIZE / iw, MAX_IMAGE_SIZE / ih);
        const w = Math.min(MAX_IMAGE_SIZE, Math.max(1, Math.round(iw * scale)));
        const h = Math.min(MAX_IMAGE_SIZE, Math.max(1, Math.round(ih * scale)));
        const tc = document.createElement("canvas");
        tc.width = w;
        tc.height = h;
        const ctx = tc.getContext("2d");
        if (!ctx) {
          showToast(t("toast_image_process_failed"), "error");
          return;
        }
        if (img.width > MAX_IMAGE_SIZE || img.height > MAX_IMAGE_SIZE) {
          showToast(t("toast_image_resized", img.width, img.height, w, h), "info");
        }
        if (onCropRequest) {
          // Draw resized image onto a temp canvas so the HTMLImageElement can be used by crop modal
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          // Create a new image from the resized canvas for the crop modal
          const resizedImg = new Image();
          resizedImg.onload = () => onCropRequest(resizedImg, w, h);
          resizedImg.src = tc.toDataURL();
        } else {
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const id = ctx.getImageData(0, 0, w, h);
          const nd = new Uint8Array(w * h);
          const px = id.data;
          for (let i = 0; i < w * h; i++) {
            const off = i * 4;
            const gray = Math.min(255, Math.round(LUMA_R * px[off] + LUMA_G * px[off + 1] + LUMA_B * px[off + 2]));
            nd[i] = GRAY_LUT[gray];
          }
          dispatch({ type: "load_image", w, h, data: nd });
          setZoom(1);
          setPan({ x: 0, y: 0 });
        }
      };
      img.src = url;
    },
    [showToast, dispatch, setZoom, setPan, t, onCropRequest],
  );

  const loadImgRef = useSyncRef(loadImg);

  useEffect(() => {
    const f = (e: ClipboardEvent) => {
      // Skip paste when focus is inside an input, textarea, or contenteditable
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || (active as HTMLElement).isContentEditable)) return;
      const it = e.clipboardData ? e.clipboardData.items : null;
      if (!it) return;
      for (let i = 0; i < it.length; i++) {
        if (ALLOWED_IMAGE_TYPES.has(it[i].type)) {
          const f = it[i].getAsFile();
          if (f) {
            e.preventDefault();
            loadImgRef.current(f);
          }
          break;
        }
      }
    };
    window.addEventListener("paste", f);
    return () => window.removeEventListener("paste", f);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragCountRef.current++;
      setDragging(true);
      announce(t("drop_announce"));
    },
    [announce, t],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragCountRef.current--;
      if (dragCountRef.current <= 0) {
        dragCountRef.current = 0;
        setDragging(false);
        announce("");
      }
    },
    [announce],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragCountRef.current = 0;
      setDragging(false);
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          if (ALLOWED_IMAGE_TYPES.has(files[i].type)) {
            loadImg(files[i]);
            break;
          }
        }
      }
    },
    [loadImg],
  );

  return { dragging, loadImg, onDragEnter, onDragOver, onDragLeave, onDrop };
}
