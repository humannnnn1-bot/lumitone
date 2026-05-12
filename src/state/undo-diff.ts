import type { Diff, CompressedDiff } from "../types";

/* ═══════════════════════════════════════════
   UNDO DIFF
   ═══════════════════════════════════════════ */

export function computeDiff(beforeData: Uint8Array, afterData: Uint8Array): Diff {
  const len = Math.min(beforeData.length, afterData.length);
  let count = 0;
  for (let i = 0; i < len; i++) if (beforeData[i] !== afterData[i]) count++;
  const indices = new Uint32Array(count),
    oldValues = new Uint8Array(count),
    newValues = new Uint8Array(count);
  let j = 0;
  for (let i = 0; i < len; i++) {
    if (beforeData[i] !== afterData[i]) {
      indices[j] = i;
      oldValues[j] = beforeData[i];
      newValues[j] = afterData[i];
      j++;
    }
  }
  return { indices, oldValues, newValues };
}

export function applyDiff(data: Uint8Array, diff: Diff, reverse: boolean): Uint8Array {
  const result = new Uint8Array(data);
  const values = reverse ? diff.oldValues : diff.newValues;
  const len = data.length;
  for (let i = 0; i < diff.indices.length; i++) {
    const indices = diff.indices[i];
    if (indices < len) result[indices] = values[i];
  }
  return result;
}

/** Build a Diff directly from flood-fill changed indices, avoiding a full-buffer scan. */
export function buildDiffFromFill(beforeData: Uint8Array, workingData: Uint8Array, changed: Uint32Array): Diff {
  const dataLength = Math.min(beforeData.length, workingData.length);
  // Filter out any out-of-bounds indices
  let validCount = 0;
  for (let i = 0; i < changed.length; i++) {
    if (changed[i] < dataLength) validCount++;
  }
  const indices = new Uint32Array(validCount);
  const oldValues = new Uint8Array(validCount);
  const newValues = new Uint8Array(validCount);
  let j = 0;
  for (let i = 0; i < changed.length; i++) {
    const ci = changed[i];
    if (ci < dataLength) {
      indices[j] = ci;
      oldValues[j] = beforeData[ci];
      newValues[j] = workingData[ci];
      j++;
    }
  }
  return { indices, oldValues, newValues };
}

/** Compute a diff for pixel candidate override-only changes (level data unchanged). */
export function computeGlazeDiff(oldOverrideMap: Uint8Array, newOverrideMap: Uint8Array, levelData: Uint8Array): Diff {
  const len = Math.min(oldOverrideMap.length, newOverrideMap.length);
  let count = 0;
  for (let i = 0; i < len; i++) if (oldOverrideMap[i] !== newOverrideMap[i]) count++;
  const indices = new Uint32Array(count);
  const oldValues = new Uint8Array(count),
    newValues = new Uint8Array(count);
  const oldPixelCandidateOverrideValues = new Uint8Array(count),
    newPixelCandidateOverrideValues = new Uint8Array(count);
  let j = 0;
  for (let i = 0; i < len; i++) {
    if (oldOverrideMap[i] !== newOverrideMap[i]) {
      indices[j] = i;
      oldValues[j] = levelData[i];
      newValues[j] = levelData[i];
      oldPixelCandidateOverrideValues[j] = oldOverrideMap[i];
      newPixelCandidateOverrideValues[j] = newOverrideMap[i];
      j++;
    }
  }
  return { indices, oldValues, newValues, oldPixelCandidateOverrideValues, newPixelCandidateOverrideValues };
}

/** Apply the pixel candidate override portion of a diff. Returns original if no override fields. */
export function applyDiffToPixelCandidateOverrideMap(pixelCandidateOverrideMap: Uint8Array, diff: Diff, reverse: boolean): Uint8Array {
  if (!diff.oldPixelCandidateOverrideValues || !diff.newPixelCandidateOverrideValues) return pixelCandidateOverrideMap;
  const result = new Uint8Array(pixelCandidateOverrideMap);
  const values = reverse ? diff.oldPixelCandidateOverrideValues : diff.newPixelCandidateOverrideValues;
  for (let i = 0; i < diff.indices.length; i++) {
    const ix = diff.indices[i];
    if (ix < result.length) result[ix] = values[i];
  }
  return result;
}

/** Build a diff for glaze flood fill from changed indices. */
export function buildDiffFromGlazeFill(
  beforeOverrideMap: Uint8Array,
  workingOverrideMap: Uint8Array,
  levelData: Uint8Array,
  changed: Uint32Array,
): Diff {
  const overrideMapLength = Math.min(beforeOverrideMap.length, workingOverrideMap.length);
  let validCount = 0;
  for (let i = 0; i < changed.length; i++) if (changed[i] < overrideMapLength) validCount++;
  const indices = new Uint32Array(validCount);
  const oldValues = new Uint8Array(validCount),
    newValues = new Uint8Array(validCount);
  const oldPixelCandidateOverrideValues = new Uint8Array(validCount),
    newPixelCandidateOverrideValues = new Uint8Array(validCount);
  let j = 0;
  for (let i = 0; i < changed.length; i++) {
    const ci = changed[i];
    if (ci < overrideMapLength) {
      indices[j] = ci;
      oldValues[j] = levelData[ci];
      newValues[j] = levelData[ci];
      oldPixelCandidateOverrideValues[j] = beforeOverrideMap[ci];
      newPixelCandidateOverrideValues[j] = workingOverrideMap[ci];
      j++;
    }
  }
  return { indices, oldValues, newValues, oldPixelCandidateOverrideValues, newPixelCandidateOverrideValues };
}

/** Compress a Diff by RLE-encoding the indices array (consecutive indices become runs). */
export function compressDiff(diff: Diff): CompressedDiff {
  const { indices, oldValues, newValues, oldPixelCandidateOverrideValues, newPixelCandidateOverrideValues } = diff;
  if (indices.length === 0) {
    return {
      runs: new Uint32Array(0),
      oldValues,
      newValues,
      ...(oldPixelCandidateOverrideValues !== undefined ? { oldPixelCandidateOverrideValues } : {}),
      ...(newPixelCandidateOverrideValues !== undefined ? { newPixelCandidateOverrideValues } : {}),
    };
  }
  // Count runs
  let runCount = 1;
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] !== indices[i - 1] + 1) runCount++;
  }
  const runs = new Uint32Array(runCount * 2);
  let ri = 0,
    runStart = indices[0],
    runLen = 1;
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] === indices[i - 1] + 1) {
      runLen++;
    } else {
      runs[ri++] = runStart;
      runs[ri++] = runLen;
      runStart = indices[i];
      runLen = 1;
    }
  }
  runs[ri++] = runStart;
  runs[ri] = runLen;
  return {
    runs,
    oldValues,
    newValues,
    ...(oldPixelCandidateOverrideValues !== undefined ? { oldPixelCandidateOverrideValues } : {}),
    ...(newPixelCandidateOverrideValues !== undefined ? { newPixelCandidateOverrideValues } : {}),
  };
}

/** Decompress a CompressedDiff back to a Diff. */
export function decompressDiff(cd: CompressedDiff): Diff {
  const { runs, oldValues, newValues, oldPixelCandidateOverrideValues, newPixelCandidateOverrideValues } = cd;
  // Calculate total count
  let total = 0;
  for (let i = 1; i < runs.length; i += 2) total += runs[i];
  const indices = new Uint32Array(total);
  let j = 0;
  for (let i = 0; i < runs.length; i += 2) {
    const start = runs[i],
      len = runs[i + 1];
    for (let k = 0; k < len; k++) indices[j++] = start + k;
  }
  return {
    indices,
    oldValues,
    newValues,
    ...(oldPixelCandidateOverrideValues !== undefined ? { oldPixelCandidateOverrideValues } : {}),
    ...(newPixelCandidateOverrideValues !== undefined ? { newPixelCandidateOverrideValues } : {}),
  };
}
