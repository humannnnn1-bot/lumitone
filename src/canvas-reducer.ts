/*
 * Canvas reducer — owns both pixel data AND colorMap mutations.
 * colorMap is managed here (not in color-reducer) so that undo/redo
 * operations are atomic: a single undo step can revert both the pixel
 * level change and any associated colorMap change together.
 */
import { MAX_UNDO, LEVEL_MASK, MAX_IMAGE_SIZE } from "./constants";
import { computeDiff, applyDiff, applyDiffToColorMap, compressDiff, decompressDiff } from "./undo-diff";
import { RingBuffer } from "./ring-buffer";
import type { AppState, CanvasAction, CompressedDiff } from "./types";
import { W0, H0 } from "./constants";

/** Build a merged diff that clears both pixel data and colorMap to zero. */
function buildMergedClearDiff(data: Uint8Array, colorMap: Uint8Array, dataDiff: { idx: Uint32Array; ov: Uint8Array; nv: Uint8Array }): import("./types").Diff {
  const n = data.length;
  const dataChanged = new Set<number>();
  for (let i = 0; i < dataDiff.idx.length; i++) dataChanged.add(dataDiff.idx[i]);
  // Count total changed pixels (data or colorMap)
  let count = 0;
  for (let i = 0; i < n; i++) {
    if (dataChanged.has(i) || colorMap[i] !== 0) count++;
  }
  const idx = new Uint32Array(count);
  const ov = new Uint8Array(count), nv = new Uint8Array(count);
  const cmOv = new Uint8Array(count), cmNv = new Uint8Array(count);
  let j = 0;
  for (let i = 0; i < n; i++) {
    if (dataChanged.has(i) || colorMap[i] !== 0) {
      idx[j] = i;
      ov[j] = data[i]; nv[j] = 0;
      cmOv[j] = colorMap[i]; cmNv[j] = 0;
      j++;
    }
  }
  return { idx, ov, nv, cmOv, cmNv };
}

function computeHist(data: Uint8Array): number[] {
  const h = new Array(8).fill(0);
  for (let i = 0; i < data.length; i++) h[data[i] & LEVEL_MASK]++;
  return h;
}

/** Apply diff delta to histogram. Set reverse=true for undo (swap ov/nv). */
function applyHistDelta(hist: number[], diff: { idx: Uint32Array; ov: Uint8Array; nv: Uint8Array }, reverse: boolean): number[] {
  const h = hist.slice();
  const src = reverse ? diff.nv : diff.ov;
  const dst = reverse ? diff.ov : diff.nv;
  for (let i = 0; i < diff.idx.length; i++) {
    h[src[i] & LEVEL_MASK]--;
    h[dst[i] & LEVEL_MASK]++;
  }
  return h;
}

const initData = new Uint8Array(W0 * H0);
export const initialState: AppState = {
  cvs: { w: W0, h: H0, data: initData, colorMap: new Uint8Array(W0 * H0) },
  undoStack: new RingBuffer<CompressedDiff>(MAX_UNDO),
  redoStack: new RingBuffer<CompressedDiff>(MAX_UNDO),
  hist: computeHist(initData),
};

export function canvasReducer(state: AppState, action: CanvasAction): AppState {
  switch (action.type) {
    case "stroke_end": {
      const { finalData, finalColorMap, diff } = action;
      if (!diff || diff.idx.length === 0) return state;
      const newCvs = { ...state.cvs, data: finalData };
      if (finalColorMap) newCvs.colorMap = finalColorMap;
      const newUndo = state.undoStack.clone();
      newUndo.push(compressDiff(diff));
      return { ...state, cvs: newCvs,
        undoStack: newUndo, redoStack: new RingBuffer<CompressedDiff>(MAX_UNDO),
        hist: applyHistDelta(state.hist, diff, false) };
    }
    case "undo": {
      if (!state.undoStack.length) return state;
      const cdiff = state.undoStack.peekLast()!;
      const diff = decompressDiff(cdiff);
      const newUndo = state.undoStack.clone();
      newUndo.pop();
      const newRedo = state.redoStack.clone();
      newRedo.unshift(cdiff);
      return { ...state,
        cvs: { ...state.cvs, data: applyDiff(state.cvs.data, diff, true), colorMap: applyDiffToColorMap(state.cvs.colorMap, diff, true) },
        undoStack: newUndo, redoStack: newRedo,
        hist: applyHistDelta(state.hist, diff, true) };
    }
    case "redo": {
      if (!state.redoStack.length) return state;
      const cdiff = state.redoStack.at(0)!;
      const diff = decompressDiff(cdiff);
      const newRedo = state.redoStack.clone();
      newRedo.shift();
      const newUndo = state.undoStack.clone();
      newUndo.push(cdiff);
      return { ...state,
        cvs: { ...state.cvs, data: applyDiff(state.cvs.data, diff, false), colorMap: applyDiffToColorMap(state.cvs.colorMap, diff, false) },
        undoStack: newUndo, redoStack: newRedo,
        hist: applyHistDelta(state.hist, diff, false) };
    }
    case "load_image": {
      const { w, h, data } = action;
      if (w <= 0 || h <= 0 || w > MAX_IMAGE_SIZE || h > MAX_IMAGE_SIZE) return state;
      if (data.length !== w * h) return state;
      const colorMap = action.colorMap && action.colorMap.length === w * h ? action.colorMap : new Uint8Array(w * h);
      return { ...state, cvs: { w, h, data, colorMap },
        undoStack: new RingBuffer<CompressedDiff>(MAX_UNDO), redoStack: new RingBuffer<CompressedDiff>(MAX_UNDO),
        hist: computeHist(data) };
    }
    case "clear": {
      const n = state.cvs.w * state.cvs.h;
      const blank = new Uint8Array(n);
      const dataDiff = computeDiff(state.cvs.data, blank);
      if (dataDiff.idx.length === 0 && state.cvs.colorMap.every(v => v === 0)) return state;
      const clearHist = new Array(8).fill(0);
      clearHist[0] = n;
      const mergedDiff = buildMergedClearDiff(state.cvs.data, state.cvs.colorMap, dataDiff);
      if (mergedDiff.idx.length === 0) return state;
      const newUndo = state.undoStack.clone();
      newUndo.push(compressDiff(mergedDiff));
      return { ...state, cvs: { ...state.cvs, data: blank, colorMap: new Uint8Array(n) },
        undoStack: newUndo,
        redoStack: new RingBuffer<CompressedDiff>(MAX_UNDO), hist: clearHist };
    }
    case "new_canvas": {
      const { w, h } = action;
      if (w <= 0 || h <= 0 || w > MAX_IMAGE_SIZE || h > MAX_IMAGE_SIZE) return state;
      const data = new Uint8Array(w * h);
      const hist = new Array(8).fill(0);
      hist[0] = w * h;
      return { cvs: { w, h, data, colorMap: new Uint8Array(w * h) },
        undoStack: new RingBuffer<CompressedDiff>(MAX_UNDO), redoStack: new RingBuffer<CompressedDiff>(MAX_UNDO), hist };
    }
    case "glaze_clear": {
      const oldCm = state.cvs.colorMap;
      const n = oldCm.length;
      let count = 0;
      for (let i = 0; i < n; i++) if (oldCm[i] !== 0) count++;
      if (count === 0) return state;
      const idx = new Uint32Array(count);
      const ov = new Uint8Array(count), nv = new Uint8Array(count);
      const cmOv = new Uint8Array(count), cmNv = new Uint8Array(count);
      let j = 0;
      for (let i = 0; i < n; i++) {
        if (oldCm[i] !== 0) {
          idx[j] = i; ov[j] = state.cvs.data[i]; nv[j] = state.cvs.data[i];
          cmOv[j] = oldCm[i]; cmNv[j] = 0; j++;
        }
      }
      const newUndo = state.undoStack.clone();
      newUndo.push(compressDiff({ idx, ov, nv, cmOv, cmNv }));
      return { ...state, cvs: { ...state.cvs, colorMap: new Uint8Array(n) },
        undoStack: newUndo,
        redoStack: new RingBuffer<CompressedDiff>(MAX_UNDO) };
    }
    default: return state;
  }
}
