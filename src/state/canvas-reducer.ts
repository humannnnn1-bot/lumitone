/*
 * Canvas reducer — owns both pixel data AND colorMap mutations.
 * colorMap is managed here (not in color-reducer) so that undo/redo
 * operations are atomic: a single undo step can revert both the pixel
 * level change and any associated colorMap change together.
 */
import { MAX_UNDO, LEVEL_MASK, isAllowedCanvasSize } from "../constants";
import { computeDiff, applyDiff, applyDiffToColorMap, compressDiff, decompressDiff } from "./undo-diff";
import { RingBuffer } from "../utils/ring-buffer";
import type { AppState, CanvasAction, CompressedDiff, Diff } from "../types";
import { W0, H0 } from "../constants";

/** Build a merged diff that clears both pixel data and colorMap to zero. */
function buildMergedClearDiff(
  data: Uint8Array,
  colorMap: Uint8Array,
  dataDiff: { indices: Uint32Array; oldValues: Uint8Array; newValues: Uint8Array },
): import("../types").Diff {
  const n = data.length;
  const dataChanged = new Set<number>();
  for (let i = 0; i < dataDiff.indices.length; i++) dataChanged.add(dataDiff.indices[i]);
  // Count total changed pixels (data or colorMap)
  let count = 0;
  for (let i = 0; i < n; i++) {
    if (dataChanged.has(i) || colorMap[i] !== 0) count++;
  }
  const indices = new Uint32Array(count);
  const oldValues = new Uint8Array(count),
    newValues = new Uint8Array(count);
  const oldColorMapValues = new Uint8Array(count),
    newColorMapValues = new Uint8Array(count);
  let j = 0;
  for (let i = 0; i < n; i++) {
    if (dataChanged.has(i) || colorMap[i] !== 0) {
      indices[j] = i;
      oldValues[j] = data[i];
      newValues[j] = 0;
      oldColorMapValues[j] = colorMap[i];
      newColorMapValues[j] = 0;
      j++;
    }
  }
  return { indices, oldValues, newValues, oldColorMapValues, newColorMapValues };
}

function computeHist(data: Uint8Array): number[] {
  const h = new Array(8).fill(0);
  for (let i = 0; i < data.length; i++) h[data[i] & LEVEL_MASK]++;
  return h;
}

/** Apply diff delta to histogram. Set reverse=true for undo (swap oldValues/newValues). */
function applyHistDelta(
  hist: number[],
  diff: { indices: Uint32Array; oldValues: Uint8Array; newValues: Uint8Array },
  reverse: boolean,
): number[] {
  const h = hist.slice();
  const src = reverse ? diff.newValues : diff.oldValues;
  const dst = reverse ? diff.oldValues : diff.newValues;
  for (let i = 0; i < diff.indices.length; i++) {
    h[src[i] & LEVEL_MASK]--;
    h[dst[i] & LEVEL_MASK]++;
  }
  return h;
}

function clearColorMapForDataChanges(colorMap: Uint8Array, diff: Diff): { colorMap: Uint8Array; diff: Diff } {
  let hasColorMapClear = false;
  for (let i = 0; i < diff.indices.length; i++) {
    const ix = diff.indices[i];
    if (ix < colorMap.length && diff.oldValues[i] !== diff.newValues[i] && colorMap[ix] !== 0) {
      hasColorMapClear = true;
      break;
    }
  }

  if (!hasColorMapClear) return { colorMap, diff };

  const nextColorMap = new Uint8Array(colorMap);
  const oldColorMapValues = new Uint8Array(diff.indices.length);
  const newColorMapValues = new Uint8Array(diff.indices.length);
  if (diff.oldColorMapValues && diff.oldColorMapValues.length === diff.indices.length) oldColorMapValues.set(diff.oldColorMapValues);
  if (diff.newColorMapValues && diff.newColorMapValues.length === diff.indices.length) newColorMapValues.set(diff.newColorMapValues);

  for (let i = 0; i < diff.indices.length; i++) {
    const ix = diff.indices[i];
    if (ix < colorMap.length && diff.oldValues[i] !== diff.newValues[i] && colorMap[ix] !== 0) {
      oldColorMapValues[i] = colorMap[ix];
      newColorMapValues[i] = 0;
      nextColorMap[ix] = 0;
    }
  }

  return { colorMap: nextColorMap, diff: { ...diff, oldColorMapValues, newColorMapValues } };
}

export function createInitialState(): AppState {
  const initData = new Uint8Array(W0 * H0);
  return {
    cvs: { w: W0, h: H0, data: initData, colorMap: new Uint8Array(W0 * H0) },
    undoStack: new RingBuffer<CompressedDiff>(MAX_UNDO),
    redoStack: new RingBuffer<CompressedDiff>(MAX_UNDO),
    hist: computeHist(initData),
  };
}

export function canvasReducer(state: AppState, action: CanvasAction): AppState {
  switch (action.type) {
    case "stroke_end": {
      const { finalData, finalColorMap, diff } = action;
      if (!diff || diff.indices.length === 0) return state;
      const colorMapUpdate = finalColorMap ? { colorMap: finalColorMap, diff } : clearColorMapForDataChanges(state.cvs.colorMap, diff);
      const newCvs = { ...state.cvs, data: finalData };
      if (colorMapUpdate.colorMap !== state.cvs.colorMap) newCvs.colorMap = colorMapUpdate.colorMap;
      const newUndo = state.undoStack.clone();
      newUndo.push(compressDiff(colorMapUpdate.diff));
      return {
        ...state,
        cvs: newCvs,
        undoStack: newUndo,
        redoStack: new RingBuffer<CompressedDiff>(MAX_UNDO),
        hist: applyHistDelta(state.hist, colorMapUpdate.diff, false),
      };
    }
    case "undo": {
      if (!state.undoStack.length) return state;
      const cdiff = state.undoStack.peekLast()!;
      const diff = decompressDiff(cdiff);
      const newUndo = state.undoStack.clone();
      newUndo.pop();
      const newRedo = state.redoStack.clone();
      newRedo.unshift(cdiff);
      return {
        ...state,
        cvs: { ...state.cvs, data: applyDiff(state.cvs.data, diff, true), colorMap: applyDiffToColorMap(state.cvs.colorMap, diff, true) },
        undoStack: newUndo,
        redoStack: newRedo,
        hist: applyHistDelta(state.hist, diff, true),
      };
    }
    case "redo": {
      if (!state.redoStack.length) return state;
      const cdiff = state.redoStack.at(0)!;
      const diff = decompressDiff(cdiff);
      const newRedo = state.redoStack.clone();
      newRedo.shift();
      const newUndo = state.undoStack.clone();
      newUndo.push(cdiff);
      return {
        ...state,
        cvs: { ...state.cvs, data: applyDiff(state.cvs.data, diff, false), colorMap: applyDiffToColorMap(state.cvs.colorMap, diff, false) },
        undoStack: newUndo,
        redoStack: newRedo,
        hist: applyHistDelta(state.hist, diff, false),
      };
    }
    case "load_image": {
      const { w, h, data } = action;
      if (!isAllowedCanvasSize(w, h)) return state;
      if (data.length !== w * h) return state;
      const colorMap = action.colorMap && action.colorMap.length === w * h ? action.colorMap : new Uint8Array(w * h);
      return {
        ...state,
        cvs: { w, h, data, colorMap },
        undoStack: new RingBuffer<CompressedDiff>(MAX_UNDO),
        redoStack: new RingBuffer<CompressedDiff>(MAX_UNDO),
        hist: computeHist(data),
      };
    }
    case "clear": {
      const n = state.cvs.w * state.cvs.h;
      const blank = new Uint8Array(n);
      const dataDiff = computeDiff(state.cvs.data, blank);
      if (dataDiff.indices.length === 0 && state.cvs.colorMap.every((v) => v === 0)) return state;
      const clearHist = new Array(8).fill(0);
      clearHist[0] = n;
      const mergedDiff = buildMergedClearDiff(state.cvs.data, state.cvs.colorMap, dataDiff);
      if (mergedDiff.indices.length === 0) return state;
      const newUndo = state.undoStack.clone();
      newUndo.push(compressDiff(mergedDiff));
      return {
        ...state,
        cvs: { ...state.cvs, data: blank, colorMap: new Uint8Array(n) },
        undoStack: newUndo,
        redoStack: new RingBuffer<CompressedDiff>(MAX_UNDO),
        hist: clearHist,
      };
    }
    case "new_canvas": {
      const { w, h } = action;
      if (!isAllowedCanvasSize(w, h)) return state;
      const data = new Uint8Array(w * h);
      const hist = new Array(8).fill(0);
      hist[0] = w * h;
      return {
        cvs: { w, h, data, colorMap: new Uint8Array(w * h) },
        undoStack: new RingBuffer<CompressedDiff>(MAX_UNDO),
        redoStack: new RingBuffer<CompressedDiff>(MAX_UNDO),
        hist,
      };
    }
    case "glaze_clear": {
      const oldCm = state.cvs.colorMap;
      const n = oldCm.length;
      let count = 0;
      for (let i = 0; i < n; i++) if (oldCm[i] !== 0) count++;
      if (count === 0) return state;
      const indices = new Uint32Array(count);
      const oldValues = new Uint8Array(count),
        newValues = new Uint8Array(count);
      const oldColorMapValues = new Uint8Array(count),
        newColorMapValues = new Uint8Array(count);
      let j = 0;
      for (let i = 0; i < n; i++) {
        if (oldCm[i] !== 0) {
          indices[j] = i;
          oldValues[j] = state.cvs.data[i];
          newValues[j] = state.cvs.data[i];
          oldColorMapValues[j] = oldCm[i];
          newColorMapValues[j] = 0;
          j++;
        }
      }
      const newUndo = state.undoStack.clone();
      newUndo.push(compressDiff({ indices, oldValues, newValues, oldColorMapValues, newColorMapValues }));
      return {
        ...state,
        cvs: { ...state.cvs, colorMap: new Uint8Array(n) },
        undoStack: newUndo,
        redoStack: new RingBuffer<CompressedDiff>(MAX_UNDO),
      };
    }
    default:
      return state;
  }
}
