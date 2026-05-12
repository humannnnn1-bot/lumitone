import { bench, describe } from "vitest";
import { DEFAULT_CANDIDATE_INDEX_BY_LEVEL, buildColorLUT } from "../color-engine";
import { floodFill } from "../drawing/flood-fill";
import { renderCanvasBuffers } from "../drawing/render-buf";
import {
  computeLocalDiversity,
  computeBoundaryDistance,
  computeGradient,
  computeNeighborIsolationAndLevelTone,
  computeRegion,
} from "../utils/pixel-analysis";
import { applyDiff, compressDiff, computeDiff, decompressDiff } from "../state/undo-diff";
import type { ImgCache } from "../types";

const BENCH_OPTIONS = {
  time: 200,
  warmupTime: 50,
};

function makePattern(w: number, h: number): Uint8Array {
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      data[y * w + x] = ((x >> 4) ^ (y >> 4) ^ ((x + y) >> 6)) & 7;
    }
  }
  return data;
}

function makeChangedPattern(source: Uint8Array, stride: number): Uint8Array {
  const next = new Uint8Array(source);
  for (let i = 0; i < next.length; i += stride) {
    next[i] = (next[i] + 3) & 7;
  }
  return next;
}

function makePixelCandidateOverrideMap(levelData: Uint8Array): Uint8Array {
  const pixelCandidateOverrideMap = new Uint8Array(levelData.length);
  for (let i = 0; i < levelData.length; i++) {
    const level = levelData[i] & 7;
    pixelCandidateOverrideMap[i] = level >= 2 && level <= 5 && i % 5 === 0 ? 2 : 0;
  }
  return pixelCandidateOverrideMap;
}

function makeImageData(width: number, height: number): ImageData {
  return {
    width,
    height,
    colorSpace: "srgb",
    data: new Uint8ClampedArray(width * height * 4),
  } as ImageData;
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const ctx = {
    createImageData: (w: number, h: number) => makeImageData(w, h),
    putImageData: () => {},
  } as unknown as CanvasRenderingContext2D;
  return {
    width,
    height,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;
}

describe("renderCanvasBuffers", () => {
  const w = 320;
  const h = 320;
  const data = makePattern(w, h);
  const pixelCandidateOverrideMap = makePixelCandidateOverrideMap(data);
  const lut = buildColorLUT(DEFAULT_CANDIDATE_INDEX_BY_LEVEL);

  bench(
    "full render, source and preview",
    () => {
      const cache: ImgCache = { sourceImageData: null, previewImageData: null, sourcePixels32: null, previewPixels32: null };
      renderCanvasBuffers(data, w, h, lut, makeCanvas(w, h), makeCanvas(w, h), cache);
    },
    BENCH_OPTIONS,
  );

  bench(
    "dirty rect render with pixel candidate overrides",
    () => {
      const cache: ImgCache = { sourceImageData: null, previewImageData: null, sourcePixels32: null, previewPixels32: null };
      renderCanvasBuffers(
        data,
        w,
        h,
        lut,
        makeCanvas(w, h),
        makeCanvas(w, h),
        cache,
        { x: 96, y: 96, w: 96, h: 96 },
        pixelCandidateOverrideMap,
      );
    },
    BENCH_OPTIONS,
  );
});

describe("floodFill", () => {
  const w = 256;
  const h = 256;
  const openRegion = new Uint8Array(w * h);
  for (let y = 32; y < h - 32; y++) {
    for (let x = 32; x < w - 32; x++) {
      openRegion[y * w + x] = 1;
    }
  }

  bench(
    "scanline fill bounded region",
    () => {
      const data = new Uint8Array(openRegion);
      floodFill(data, 64, 64, 5, w, h);
    },
    BENCH_OPTIONS,
  );
});

describe("pixel analysis", () => {
  const w = 128;
  const h = 128;
  const n = w * h;
  const data = makePattern(w, h);
  const pixelCandidateOverrideMap = makePixelCandidateOverrideMap(data);

  bench(
    "neighbor isolation + level tone",
    () => {
      computeNeighborIsolationAndLevelTone(data, w, h, new Float32Array(n), new Float32Array(n), pixelCandidateOverrideMap);
    },
    BENCH_OPTIONS,
  );

  bench(
    "local diversity",
    () => {
      computeLocalDiversity(data, w, h, new Float32Array(n), pixelCandidateOverrideMap);
    },
    BENCH_OPTIONS,
  );

  bench(
    "edge depth",
    () => {
      computeBoundaryDistance(data, w, h, new Uint8Array(n), new Float32Array(n), pixelCandidateOverrideMap);
    },
    BENCH_OPTIONS,
  );

  bench(
    "gradient",
    () => {
      computeGradient(data, w, h, new Float32Array(n), new Float32Array(n), new Float32Array(n));
    },
    BENCH_OPTIONS,
  );

  bench(
    "regions",
    () => {
      computeRegion(data, w, h, new Int32Array(n), new Uint8Array(n), pixelCandidateOverrideMap);
    },
    BENCH_OPTIONS,
  );
});

describe("undo diff", () => {
  const base = makePattern(320, 320);
  const changed = makeChangedPattern(base, 11);
  const diff = computeDiff(base, changed);
  const compressed = compressDiff(diff);

  bench(
    "compute sparse diff",
    () => {
      computeDiff(base, changed);
    },
    BENCH_OPTIONS,
  );

  bench(
    "apply sparse diff",
    () => {
      applyDiff(base, diff, false);
    },
    BENCH_OPTIONS,
  );

  bench(
    "compress sparse diff",
    () => {
      compressDiff(diff);
    },
    BENCH_OPTIONS,
  );

  bench(
    "decompress sparse diff",
    () => {
      decompressDiff(compressed);
    },
    BENCH_OPTIONS,
  );
});
