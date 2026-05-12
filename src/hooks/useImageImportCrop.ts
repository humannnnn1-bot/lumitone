import { useCallback, useState, type Dispatch, type SetStateAction } from "react";

import { GRAY_LUT, LUMA_B, LUMA_G, LUMA_R } from "../color-engine";
import type { CanvasAction } from "../types";

interface CropImage {
  img: HTMLImageElement;
  w: number;
  h: number;
}

interface UseImageImportCropOptions {
  dispatch: Dispatch<CanvasAction>;
  setZoom: Dispatch<SetStateAction<number>>;
  setPan: Dispatch<SetStateAction<{ x: number; y: number }>>;
}

export function useImageImportCrop({ dispatch, setZoom, setPan }: UseImageImportCropOptions) {
  const [cropImage, setCropImage] = useState<CropImage | null>(null);

  const handleCropRequest = useCallback((img: HTMLImageElement, w: number, h: number) => {
    setCropImage({ img, w, h });
  }, []);

  const handleCropConfirm = useCallback(
    (x: number, y: number, w: number, h: number) => {
      const ci = cropImage;
      if (!ci) return;

      const tc = document.createElement("canvas");
      tc.width = w;
      tc.height = h;
      const ctx = tc.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(ci.img, x, y, w, h, 0, 0, w, h);

      const id = ctx.getImageData(0, 0, w, h);
      const nd = new Uint8Array(w * h);
      const px = id.data;
      for (let i = 0; i < w * h; i++) {
        const off = i * 4;
        const gray = Math.min(255, Math.round(LUMA_R * px[off] + LUMA_G * px[off + 1] + LUMA_B * px[off + 2]));
        nd[i] = GRAY_LUT[gray];
      }

      dispatch({ type: "load_image", width: w, height: h, levelData: nd });
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setCropImage(null);
    },
    [cropImage, dispatch, setPan, setZoom],
  );

  const handleCropCancel = useCallback(() => setCropImage(null), []);

  return {
    cropImage,
    handleCropRequest,
    handleCropConfirm,
    handleCropCancel,
  };
}
