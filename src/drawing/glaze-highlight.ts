export const GLAZE_HIGHLIGHT_RGBA = {
  fill: [255, 214, 32, 112],
  edge: [255, 255, 255, 235],
  dim: [0, 0, 0, 108],
  dimEdge: [0, 0, 0, 166],
} as const;

type Rgba = (typeof GLAZE_HIGHLIGHT_RGBA)[keyof typeof GLAZE_HIGHLIGHT_RGBA];

function writePixel(out: Uint8ClampedArray, offset: number, rgba: Rgba) {
  out[offset] = rgba[0];
  out[offset + 1] = rgba[1];
  out[offset + 2] = rgba[2];
  out[offset + 3] = rgba[3];
}

function isGlazed(pixelCandidateOverrideMap: Uint8Array, idx: number, n: number) {
  return idx >= 0 && idx < n && pixelCandidateOverrideMap[idx] > 0;
}

function isBoundaryGlaze(pixelCandidateOverrideMap: Uint8Array, idx: number, x: number, y: number, w: number, h: number, n: number) {
  return (
    x === 0 ||
    y === 0 ||
    x === w - 1 ||
    y === h - 1 ||
    !isGlazed(pixelCandidateOverrideMap, idx - 1, n) ||
    !isGlazed(pixelCandidateOverrideMap, idx + 1, n) ||
    !isGlazed(pixelCandidateOverrideMap, idx - w, n) ||
    !isGlazed(pixelCandidateOverrideMap, idx + w, n)
  );
}

function touchesGlaze(pixelCandidateOverrideMap: Uint8Array, idx: number, x: number, y: number, w: number, h: number, n: number) {
  return (
    (x > 0 && isGlazed(pixelCandidateOverrideMap, idx - 1, n)) ||
    (x < w - 1 && isGlazed(pixelCandidateOverrideMap, idx + 1, n)) ||
    (y > 0 && isGlazed(pixelCandidateOverrideMap, idx - w, n)) ||
    (y < h - 1 && isGlazed(pixelCandidateOverrideMap, idx + w, n))
  );
}

export function buildGlazeHighlightPixels(pixelCandidateOverrideMap: Uint8Array, w: number, h: number): Uint8ClampedArray {
  const pixelCount = w > 0 && h > 0 ? w * h : 0;
  const out = new Uint8ClampedArray(pixelCount * 4);
  const n = Math.min(pixelCount, pixelCandidateOverrideMap.length);
  let hasGlaze = false;
  for (let i = 0; i < n; i++) {
    if (pixelCandidateOverrideMap[i] > 0) {
      hasGlaze = true;
      break;
    }
  }
  if (!hasGlaze) return out;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const offset = idx * 4;
      if (isGlazed(pixelCandidateOverrideMap, idx, n)) {
        writePixel(
          out,
          offset,
          isBoundaryGlaze(pixelCandidateOverrideMap, idx, x, y, w, h, n) ? GLAZE_HIGHLIGHT_RGBA.edge : GLAZE_HIGHLIGHT_RGBA.fill,
        );
      } else {
        writePixel(
          out,
          offset,
          touchesGlaze(pixelCandidateOverrideMap, idx, x, y, w, h, n) ? GLAZE_HIGHLIGHT_RGBA.dimEdge : GLAZE_HIGHLIGHT_RGBA.dim,
        );
      }
    }
  }
  return out;
}
