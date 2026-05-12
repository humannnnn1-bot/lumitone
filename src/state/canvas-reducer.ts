/*
 * Canvas reducer - owns both level data and per-pixel candidate override mutations.
 * Candidate overrides are managed here (not in color-reducer) so that undo/redo
 * operations are atomic: a single undo step can revert both the pixel
 * level change and any associated override change together.
 */
import { MAX_UNDO, LEVEL_MASK, isAllowedCanvasSize } from "../constants";
import { computeDiff, applyDiff, applyDiffToPixelCandidateOverrideMap, compressDiff, decompressDiff } from "./undo-diff";
import { RingBuffer } from "../utils/ring-buffer";
import type { AppState, CanvasAction, CompressedDiff, Diff } from "../types";
import { DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT } from "../constants";

/** Build a merged diff that clears both level data and pixel candidate overrides to zero. */
function buildMergedClearDiff(
  levelData: Uint8Array,
  pixelCandidateOverrideMap: Uint8Array,
  levelDataDiff: { indices: Uint32Array; oldValues: Uint8Array; newValues: Uint8Array },
): import("../types").Diff {
  const n = levelData.length;
  const levelDataChanged = new Set<number>();
  for (let i = 0; i < levelDataDiff.indices.length; i++) levelDataChanged.add(levelDataDiff.indices[i]);
  let count = 0;
  for (let i = 0; i < n; i++) {
    if (levelDataChanged.has(i) || pixelCandidateOverrideMap[i] !== 0) count++;
  }
  const indices = new Uint32Array(count);
  const oldValues = new Uint8Array(count),
    newValues = new Uint8Array(count);
  const oldPixelCandidateOverrideValues = new Uint8Array(count),
    newPixelCandidateOverrideValues = new Uint8Array(count);
  let j = 0;
  for (let i = 0; i < n; i++) {
    if (levelDataChanged.has(i) || pixelCandidateOverrideMap[i] !== 0) {
      indices[j] = i;
      oldValues[j] = levelData[i];
      newValues[j] = 0;
      oldPixelCandidateOverrideValues[j] = pixelCandidateOverrideMap[i];
      newPixelCandidateOverrideValues[j] = 0;
      j++;
    }
  }
  return { indices, oldValues, newValues, oldPixelCandidateOverrideValues, newPixelCandidateOverrideValues };
}

function computeLevelHistogram(levelData: Uint8Array): number[] {
  const levelHistogram = new Array(8).fill(0);
  for (let i = 0; i < levelData.length; i++) levelHistogram[levelData[i] & LEVEL_MASK]++;
  return levelHistogram;
}

/** Apply diff delta to histogram. Set reverse=true for undo (swap oldValues/newValues). */
function applyLevelHistogramDelta(
  levelHistogram: number[],
  diff: { indices: Uint32Array; oldValues: Uint8Array; newValues: Uint8Array },
  reverse: boolean,
): number[] {
  const nextLevelHistogram = levelHistogram.slice();
  const src = reverse ? diff.newValues : diff.oldValues;
  const dst = reverse ? diff.oldValues : diff.newValues;
  for (let i = 0; i < diff.indices.length; i++) {
    nextLevelHistogram[src[i] & LEVEL_MASK]--;
    nextLevelHistogram[dst[i] & LEVEL_MASK]++;
  }
  return nextLevelHistogram;
}

function clearOverridesForLevelChanges(
  pixelCandidateOverrideMap: Uint8Array,
  diff: Diff,
): { pixelCandidateOverrideMap: Uint8Array; diff: Diff } {
  let hasOverrideClear = false;
  for (let i = 0; i < diff.indices.length; i++) {
    const ix = diff.indices[i];
    if (ix < pixelCandidateOverrideMap.length && diff.oldValues[i] !== diff.newValues[i] && pixelCandidateOverrideMap[ix] !== 0) {
      hasOverrideClear = true;
      break;
    }
  }

  if (!hasOverrideClear) return { pixelCandidateOverrideMap, diff };

  const nextPixelCandidateOverrideMap = new Uint8Array(pixelCandidateOverrideMap);
  const oldPixelCandidateOverrideValues = new Uint8Array(diff.indices.length);
  const newPixelCandidateOverrideValues = new Uint8Array(diff.indices.length);
  if (diff.oldPixelCandidateOverrideValues && diff.oldPixelCandidateOverrideValues.length === diff.indices.length)
    oldPixelCandidateOverrideValues.set(diff.oldPixelCandidateOverrideValues);
  if (diff.newPixelCandidateOverrideValues && diff.newPixelCandidateOverrideValues.length === diff.indices.length)
    newPixelCandidateOverrideValues.set(diff.newPixelCandidateOverrideValues);

  for (let i = 0; i < diff.indices.length; i++) {
    const ix = diff.indices[i];
    if (ix < pixelCandidateOverrideMap.length && diff.oldValues[i] !== diff.newValues[i] && pixelCandidateOverrideMap[ix] !== 0) {
      oldPixelCandidateOverrideValues[i] = pixelCandidateOverrideMap[ix];
      newPixelCandidateOverrideValues[i] = 0;
      nextPixelCandidateOverrideMap[ix] = 0;
    }
  }

  return {
    pixelCandidateOverrideMap: nextPixelCandidateOverrideMap,
    diff: { ...diff, oldPixelCandidateOverrideValues, newPixelCandidateOverrideValues },
  };
}

export function createInitialState(): AppState {
  const initData = new Uint8Array(DEFAULT_CANVAS_WIDTH * DEFAULT_CANVAS_HEIGHT);
  return {
    canvasData: {
      width: DEFAULT_CANVAS_WIDTH,
      height: DEFAULT_CANVAS_HEIGHT,
      levelData: initData,
      pixelCandidateOverrideMap: new Uint8Array(DEFAULT_CANVAS_WIDTH * DEFAULT_CANVAS_HEIGHT),
    },
    undoStack: new RingBuffer<CompressedDiff>(MAX_UNDO),
    redoStack: new RingBuffer<CompressedDiff>(MAX_UNDO),
    levelHistogram: computeLevelHistogram(initData),
  };
}

export function canvasReducer(state: AppState, action: CanvasAction): AppState {
  switch (action.type) {
    case "stroke_end": {
      const { finalLevelData, finalPixelCandidateOverrideMap, diff } = action;
      if (!diff || diff.indices.length === 0) return state;
      const overrideUpdate = finalPixelCandidateOverrideMap
        ? { pixelCandidateOverrideMap: finalPixelCandidateOverrideMap, diff }
        : clearOverridesForLevelChanges(state.canvasData.pixelCandidateOverrideMap, diff);
      const newCanvasData = { ...state.canvasData, levelData: finalLevelData };
      if (overrideUpdate.pixelCandidateOverrideMap !== state.canvasData.pixelCandidateOverrideMap) {
        newCanvasData.pixelCandidateOverrideMap = overrideUpdate.pixelCandidateOverrideMap;
      }
      const newUndo = state.undoStack.clone();
      newUndo.push(compressDiff(overrideUpdate.diff));
      return {
        ...state,
        canvasData: newCanvasData,
        undoStack: newUndo,
        redoStack: new RingBuffer<CompressedDiff>(MAX_UNDO),
        levelHistogram: applyLevelHistogramDelta(state.levelHistogram, overrideUpdate.diff, false),
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
        canvasData: {
          ...state.canvasData,
          levelData: applyDiff(state.canvasData.levelData, diff, true),
          pixelCandidateOverrideMap: applyDiffToPixelCandidateOverrideMap(state.canvasData.pixelCandidateOverrideMap, diff, true),
        },
        undoStack: newUndo,
        redoStack: newRedo,
        levelHistogram: applyLevelHistogramDelta(state.levelHistogram, diff, true),
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
        canvasData: {
          ...state.canvasData,
          levelData: applyDiff(state.canvasData.levelData, diff, false),
          pixelCandidateOverrideMap: applyDiffToPixelCandidateOverrideMap(state.canvasData.pixelCandidateOverrideMap, diff, false),
        },
        undoStack: newUndo,
        redoStack: newRedo,
        levelHistogram: applyLevelHistogramDelta(state.levelHistogram, diff, false),
      };
    }
    case "load_image": {
      const { width, height, levelData } = action;
      if (!isAllowedCanvasSize(width, height)) return state;
      if (levelData.length !== width * height) return state;
      const pixelCandidateOverrideMap =
        action.pixelCandidateOverrideMap && action.pixelCandidateOverrideMap.length === width * height
          ? action.pixelCandidateOverrideMap
          : new Uint8Array(width * height);
      return {
        ...state,
        canvasData: { width, height, levelData, pixelCandidateOverrideMap },
        undoStack: new RingBuffer<CompressedDiff>(MAX_UNDO),
        redoStack: new RingBuffer<CompressedDiff>(MAX_UNDO),
        levelHistogram: computeLevelHistogram(levelData),
      };
    }
    case "clear": {
      const n = state.canvasData.width * state.canvasData.height;
      const blank = new Uint8Array(n);
      const levelDataDiff = computeDiff(state.canvasData.levelData, blank);
      if (levelDataDiff.indices.length === 0 && state.canvasData.pixelCandidateOverrideMap.every((v) => v === 0)) return state;
      const clearHist = new Array(8).fill(0);
      clearHist[0] = n;
      const mergedDiff = buildMergedClearDiff(state.canvasData.levelData, state.canvasData.pixelCandidateOverrideMap, levelDataDiff);
      if (mergedDiff.indices.length === 0) return state;
      const newUndo = state.undoStack.clone();
      newUndo.push(compressDiff(mergedDiff));
      return {
        ...state,
        canvasData: { ...state.canvasData, levelData: blank, pixelCandidateOverrideMap: new Uint8Array(n) },
        undoStack: newUndo,
        redoStack: new RingBuffer<CompressedDiff>(MAX_UNDO),
        levelHistogram: clearHist,
      };
    }
    case "new_canvas": {
      const { width, height } = action;
      if (!isAllowedCanvasSize(width, height)) return state;
      const levelData = new Uint8Array(width * height);
      const levelHistogram = new Array(8).fill(0);
      levelHistogram[0] = width * height;
      return {
        canvasData: { width, height, levelData, pixelCandidateOverrideMap: new Uint8Array(width * height) },
        undoStack: new RingBuffer<CompressedDiff>(MAX_UNDO),
        redoStack: new RingBuffer<CompressedDiff>(MAX_UNDO),
        levelHistogram,
      };
    }
    case "glaze_clear": {
      const oldPixelCandidateOverrideMap = state.canvasData.pixelCandidateOverrideMap;
      const n = oldPixelCandidateOverrideMap.length;
      let count = 0;
      for (let i = 0; i < n; i++) if (oldPixelCandidateOverrideMap[i] !== 0) count++;
      if (count === 0) return state;
      const indices = new Uint32Array(count);
      const oldValues = new Uint8Array(count),
        newValues = new Uint8Array(count);
      const oldPixelCandidateOverrideValues = new Uint8Array(count),
        newPixelCandidateOverrideValues = new Uint8Array(count);
      let j = 0;
      for (let i = 0; i < n; i++) {
        if (oldPixelCandidateOverrideMap[i] !== 0) {
          indices[j] = i;
          oldValues[j] = state.canvasData.levelData[i];
          newValues[j] = state.canvasData.levelData[i];
          oldPixelCandidateOverrideValues[j] = oldPixelCandidateOverrideMap[i];
          newPixelCandidateOverrideValues[j] = 0;
          j++;
        }
      }
      const newUndo = state.undoStack.clone();
      newUndo.push(compressDiff({ indices, oldValues, newValues, oldPixelCandidateOverrideValues, newPixelCandidateOverrideValues }));
      return {
        ...state,
        canvasData: { ...state.canvasData, pixelCandidateOverrideMap: new Uint8Array(n) },
        undoStack: newUndo,
        redoStack: new RingBuffer<CompressedDiff>(MAX_UNDO),
      };
    }
    default:
      return state;
  }
}
