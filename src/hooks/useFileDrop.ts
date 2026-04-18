import { useState, useEffect, useRef, useCallback } from "react";
import { MAX_IMAGE_SIZE, MAX_FILE_BYTES, MAX_IMAGE_PIXELS } from "../constants";
import { LUMA_R, LUMA_G, LUMA_B, GRAY_LUT } from "../color-engine";
import { useSyncRef } from "./useSyncRef";

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp"]);

type DecodedImage = CanvasImageSource & { readonly width: number; readonly height: number };
type ImageLoadSource =
  | "stable Blob ImageBitmap"
  | "stable Blob object URL"
  | "stable Blob Data URL"
  | "direct ImageBitmap"
  | "direct object URL";

function isImageLoadDebugEnabled(): boolean {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debugImageLoad");
}

export interface FileDropResult {
  dragging: boolean;
  loadImg: (file: File) => Promise<void>;
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
      return new Promise<void>((resolve) => {
        const finish = () => resolve();
        if (!file || !ALLOWED_IMAGE_TYPES.has(file.type)) {
          finish();
          return;
        }
        if (file.size > MAX_FILE_BYTES) {
          showToast(t("toast_image_too_large"), "error");
          finish();
          return;
        }

        const debugImageLoad = isImageLoadDebugEnabled();
        const describeError = (err: unknown): string => {
          if (err instanceof DOMException) return `${err.name}: ${err.message}`;
          if (err instanceof Error) return `${err.name}: ${err.message}`;
          return String(err);
        };
        const debug = (message: string) => {
          if (!debugImageLoad) return;
          console.info("CHROMALUM image load:", message, {
            name: file.name,
            size: file.size,
            type: file.type,
          });
          showToast(`[img] ${message}`, "info");
        };
        const failLoad = (message: string) => {
          if (debugImageLoad) {
            console.info("CHROMALUM image load:", message, {
              name: file.name,
              size: file.size,
              type: file.type,
            });
            showToast(`[img] ${message}`, "error");
            finish();
            return;
          }
          if (message.includes("NotReadableError")) {
            showToast(t("toast_image_permission_failed"), "error");
            finish();
            return;
          }
          showToast(t("toast_image_load_failed"), "error");
          finish();
        };

        const sleep = (ms: number) => new Promise<void>((resolveSleep) => window.setTimeout(resolveSleep, ms));

        const processImg = (img: DecodedImage, source: ImageLoadSource, cleanup?: () => void) => {
          let cleaned = false;
          const cleanupOnce = () => {
            if (cleaned) return;
            cleaned = true;
            cleanup?.();
          };

          try {
            const iw = Math.max(1, img.width),
              ih = Math.max(1, img.height);
            if (iw * ih > MAX_IMAGE_PIXELS) {
              cleanupOnce();
              showToast(t("toast_image_too_large"), "error");
              finish();
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
              cleanupOnce();
              showToast(t("toast_image_process_failed"), "error");
              finish();
              return;
            }
            if (img.width > MAX_IMAGE_SIZE || img.height > MAX_IMAGE_SIZE) {
              showToast(t("toast_image_resized", img.width, img.height, w, h), "info");
            }
            ctx.fillStyle = "#fff";
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            cleanupOnce();

            if (onCropRequest) {
              // Create a new image from the resized canvas for the crop modal.
              const resizedImg = new Image();
              resizedImg.onload = () => {
                debug(`${source} ready: ${iw}x${ih} -> ${w}x${h}`);
                onCropRequest(resizedImg, w, h);
                finish();
              };
              resizedImg.onerror = () => {
                failLoad("resized crop image decode failed");
              };
              resizedImg.src = tc.toDataURL();
            } else {
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
              debug(`${source} ready: ${iw}x${ih} -> ${w}x${h}`);
              finish();
            }
          } catch (err) {
            cleanupOnce();
            failLoad(`${source} process failed: ${describeError(err)}`);
          }
        };

        const tryObjectUrl = (blob: Blob, source: ImageLoadSource, reason: string, onError: (reason: string) => void) => {
          debug(`${reason}; trying ${source}`);
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => {
            URL.revokeObjectURL(url);
            processImg(img, source);
          };
          img.onerror = () => {
            URL.revokeObjectURL(url);
            onError(`${source} decode failed`);
          };
          img.src = url;
        };

        const tryStableBlobDataUrl = (blob: Blob, reason: string, onError: (reason: string) => void) => {
          debug(`${reason}; trying stable Blob Data URL`);
          const fr = new FileReader();
          fr.onerror = () => {
            onError(`stable Blob FileReader failed (${fr.error ? describeError(fr.error) : "unknown"})`);
          };
          fr.onload = () => {
            debug("stable Blob FileReader loaded; decoding Data URL");
            const img = new Image();
            img.onload = () => processImg(img, "stable Blob Data URL");
            img.onerror = () => {
              onError("stable Blob Data URL decode failed");
            };
            img.src = fr.result as string;
          };
          fr.readAsDataURL(blob);
        };

        const readStableBlob = async () => {
          const delays = [0, 150, 400, 900];
          let lastError = "unknown";
          for (let attempt = 0; attempt < delays.length; attempt++) {
            if (delays[attempt] > 0) await sleep(delays[attempt]);
            try {
              debug(`copying file bytes (${attempt + 1}/${delays.length})`);
              const bytes = await file.arrayBuffer();
              return new Blob([bytes], { type: file.type || "application/octet-stream" });
            } catch (err) {
              lastError = describeError(err);
              debug(`file byte copy failed (${attempt + 1}/${delays.length}): ${lastError}`);
            }
          }
          throw new Error(lastError);
        };

        const readStableBlobWithFileReader = async () => {
          const delays = [0, 150, 400, 900];
          let lastError = "unknown";
          for (let attempt = 0; attempt < delays.length; attempt++) {
            if (delays[attempt] > 0) await sleep(delays[attempt]);
            try {
              debug(`copying file bytes with FileReader (${attempt + 1}/${delays.length})`);
              const bytes = await new Promise<ArrayBuffer>((resolveBytes, rejectBytes) => {
                const reader = new FileReader();
                reader.onerror = () => rejectBytes(reader.error ?? new Error("FileReader readAsArrayBuffer failed"));
                reader.onload = () => {
                  if (reader.result instanceof ArrayBuffer) resolveBytes(reader.result);
                  else rejectBytes(new Error("FileReader returned no ArrayBuffer"));
                };
                reader.readAsArrayBuffer(file);
              });
              return new Blob([bytes], { type: file.type || "application/octet-stream" });
            } catch (err) {
              lastError = describeError(err);
              debug(`FileReader byte copy failed (${attempt + 1}/${delays.length}): ${lastError}`);
            }
          }
          throw new Error(lastError);
        };

        const tryDirectFallbacks = (reason: string) => {
          debug(`${reason}; trying direct ImageBitmap`);
          if ("createImageBitmap" in window) {
            window
              .createImageBitmap(file)
              .then((bitmap) => processImg(bitmap, "direct ImageBitmap", () => bitmap.close()))
              .catch((err: unknown) => {
                tryObjectUrl(file, "direct object URL", `direct ImageBitmap failed (${describeError(err)})`, (objectReason) => {
                  failLoad(`${reason}; ${objectReason}`);
                });
              });
          } else {
            tryObjectUrl(file, "direct object URL", "direct ImageBitmap unavailable", (objectReason) => {
              failLoad(`${reason}; ${objectReason}`);
            });
          }
        };

        const decodeStableBlob = (blob: Blob) => {
          debug("decoding stable Blob with ImageBitmap");
          if ("createImageBitmap" in window) {
            window
              .createImageBitmap(blob)
              .then((bitmap) => processImg(bitmap, "stable Blob ImageBitmap", () => bitmap.close()))
              .catch((err: unknown) => {
                tryObjectUrl(blob, "stable Blob object URL", `stable Blob ImageBitmap failed (${describeError(err)})`, (objectReason) => {
                  tryStableBlobDataUrl(blob, objectReason, (dataReason) => {
                    tryDirectFallbacks(`stable Blob decode failed: ${dataReason}`);
                  });
                });
              });
          } else {
            tryObjectUrl(blob, "stable Blob object URL", "stable Blob ImageBitmap unavailable", (objectReason) => {
              tryStableBlobDataUrl(blob, objectReason, (dataReason) => {
                tryDirectFallbacks(`stable Blob decode failed: ${dataReason}`);
              });
            });
          }
        };

        readStableBlob()
          .then(decodeStableBlob)
          .catch((err: unknown) => {
            readStableBlobWithFileReader()
              .then(decodeStableBlob)
              .catch((readerErr: unknown) => {
                tryDirectFallbacks(
                  `stable byte copy failed (${describeError(err)}); FileReader byte copy failed (${describeError(readerErr)})`,
                );
              });
          });
      });
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
            void loadImgRef.current(f);
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
            void loadImg(files[i]);
            break;
          }
        }
      }
    },
    [loadImg],
  );

  return { dragging, loadImg, onDragEnter, onDragOver, onDragLeave, onDrop };
}
