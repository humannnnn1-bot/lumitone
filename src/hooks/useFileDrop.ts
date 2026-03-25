import { useState, useEffect, useRef, useCallback } from "react";
import { MAX_IMAGE_SIZE } from "../constants";
import { LUMA_R, LUMA_G, LUMA_B, GRAY_LUT } from "../color-engine";

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
): FileDropResult {
  const [dragging, setDragging] = useState(false);
  const dragCountRef = useRef(0);

  const loadImg = useCallback((file: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); showToast(t("toast_image_load_failed"), "error"); };
    img.onload = () => {
      URL.revokeObjectURL(url);
        const iw = Math.max(1, img.width), ih = Math.max(1, img.height);
        const scale = Math.min(1, MAX_IMAGE_SIZE / iw, MAX_IMAGE_SIZE / ih);
        const w = Math.min(MAX_IMAGE_SIZE, Math.max(1, Math.round(iw * scale)));
        const h = Math.min(MAX_IMAGE_SIZE, Math.max(1, Math.round(ih * scale)));
        const tc = document.createElement("canvas"); tc.width = w; tc.height = h;
        const ctx = tc.getContext("2d");
        if (!ctx) { showToast(t("toast_image_process_failed"), "error"); return; }
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const id = ctx.getImageData(0, 0, w, h);
        const nd = new Uint8Array(w * h);
        const px = id.data;
        for (let i = 0; i < w * h; i++) {
          const off = i * 4;
          const gray = Math.min(255, Math.round(
            LUMA_R * px[off] + LUMA_G * px[off + 1] + LUMA_B * px[off + 2]
          ));
          nd[i] = GRAY_LUT[gray];
        }
        dispatch({ type: "load_image", w, h, data: nd });
        setZoom(1); setPan({ x: 0, y: 0 });
        if (img.width > MAX_IMAGE_SIZE || img.height > MAX_IMAGE_SIZE) {
          showToast(t("toast_image_resized", img.width, img.height, w, h), "info");
        }
      };
    img.src = url;
  }, [showToast, dispatch, setZoom, setPan, t]);

  useEffect(() => {
    const f = (e: ClipboardEvent) => {
      // Skip paste when focus is inside an input, textarea, or contenteditable
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || (active as HTMLElement).isContentEditable)) return;
      const it = e.clipboardData ? e.clipboardData.items : null; if (!it) return;
      for (let i = 0; i < it.length; i++) {
        if (it[i].type.startsWith("image/")) { const f = it[i].getAsFile(); if (f) { e.preventDefault(); loadImg(f); } break; }
      }
    };
    window.addEventListener("paste", f);
    return () => window.removeEventListener("paste", f);
  }, [loadImg]);

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault(); dragCountRef.current++; setDragging(true); announce(t("drop_announce"));
  }, [announce, t]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); dragCountRef.current--;
    if (dragCountRef.current <= 0) { dragCountRef.current = 0; setDragging(false); announce(""); }
  }, [announce]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); dragCountRef.current = 0; setDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith("image/")) { loadImg(files[i]); break; }
      }
    }
  }, [loadImg]);

  return { dragging, loadImg, onDragEnter, onDragOver, onDragLeave, onDrop };
}
