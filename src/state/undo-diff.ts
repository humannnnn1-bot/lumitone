import type { Diff, CompressedDiff } from "../types";

/* ═══════════════════════════════════════════
   UNDO DIFF
   ═══════════════════════════════════════════ */

export function computeDiff(beforeData: Uint8Array, afterData: Uint8Array): Diff {
  const len = Math.min(beforeData.length, afterData.length);
  let count = 0;
  for (let i = 0; i < len; i++) if (beforeData[i] !== afterData[i]) count++;
  const indices = new Uint32Array(count),
    oldLevelValues = new Uint8Array(count),
    newLevelValues = new Uint8Array(count);
  let j = 0;
  for (let i = 0; i < len; i++) {
    if (beforeData[i] !== afterData[i]) {
      indices[j] = i;
      oldLevelValues[j] = beforeData[i];
      newLevelValues[j] = afterData[i];
      j++;
    }
  }
  return { indices, oldLevelValues, newLevelValues };
}

export function applyDiff(data: Uint8Array, diff: Diff, reverse: boolean): Uint8Array {
  const result = new Uint8Array(data);
  const values = reverse ? diff.oldLevelValues : diff.newLevelValues;
  const len = data.length;
  for (let i = 0; i < diff.indices.length; i++) {
    const indices = diff.indices[i];
    if (indices < len) result[indices] = values[i];
  }
  return result;
}

/** Build a Diff directly from flood-fill changed indices, avoiding a full-buffer scan. */
export function buildDiffFromFill(beforeData: Uint8Array, workingData: Uint8Array, changedIndices: Uint32Array): Diff {
  const dataLength = Math.min(beforeData.length, workingData.length);
  // Filter out any out-of-bounds indices
  let validCount = 0;
  for (let i = 0; i < changedIndices.length; i++) {
    if (changedIndices[i] < dataLength) validCount++;
  }
  const indices = new Uint32Array(validCount);
  const oldLevelValues = new Uint8Array(validCount);
  const newLevelValues = new Uint8Array(validCount);
  let j = 0;
  for (let i = 0; i < changedIndices.length; i++) {
    const ci = changedIndices[i];
    if (ci < dataLength) {
      indices[j] = ci;
      oldLevelValues[j] = beforeData[ci];
      newLevelValues[j] = workingData[ci];
      j++;
    }
  }
  return { indices, oldLevelValues, newLevelValues };
}

/** Compute a diff for pixel candidate override-only changes (level data unchanged). */
export function computeGlazeDiff(oldOverrideMap: Uint8Array, newOverrideMap: Uint8Array, levelData: Uint8Array): Diff {
  const len = Math.min(oldOverrideMap.length, newOverrideMap.length);
  let count = 0;
  for (let i = 0; i < len; i++) if (oldOverrideMap[i] !== newOverrideMap[i]) count++;
  const indices = new Uint32Array(count);
  const oldLevelValues = new Uint8Array(count),
    newLevelValues = new Uint8Array(count);
  const oldPixelCandidateOverrideValues = new Uint8Array(count),
    newPixelCandidateOverrideValues = new Uint8Array(count);
  let j = 0;
  for (let i = 0; i < len; i++) {
    if (oldOverrideMap[i] !== newOverrideMap[i]) {
      indices[j] = i;
      oldLevelValues[j] = levelData[i];
      newLevelValues[j] = levelData[i];
      oldPixelCandidateOverrideValues[j] = oldOverrideMap[i];
      newPixelCandidateOverrideValues[j] = newOverrideMap[i];
      j++;
    }
  }
  return { indices, oldLevelValues, newLevelValues, oldPixelCandidateOverrideValues, newPixelCandidateOverrideValues };
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
  changedIndices: Uint32Array,
): Diff {
  const overrideMapLength = Math.min(beforeOverrideMap.length, workingOverrideMap.length);
  let validCount = 0;
  for (let i = 0; i < changedIndices.length; i++) if (changedIndices[i] < overrideMapLength) validCount++;
  const indices = new Uint32Array(validCount);
  const oldLevelValues = new Uint8Array(validCount),
    newLevelValues = new Uint8Array(validCount);
  const oldPixelCandidateOverrideValues = new Uint8Array(validCount),
    newPixelCandidateOverrideValues = new Uint8Array(validCount);
  let j = 0;
  for (let i = 0; i < changedIndices.length; i++) {
    const ci = changedIndices[i];
    if (ci < overrideMapLength) {
      indices[j] = ci;
      oldLevelValues[j] = levelData[ci];
      newLevelValues[j] = levelData[ci];
      oldPixelCandidateOverrideValues[j] = beforeOverrideMap[ci];
      newPixelCandidateOverrideValues[j] = workingOverrideMap[ci];
      j++;
    }
  }
  return { indices, oldLevelValues, newLevelValues, oldPixelCandidateOverrideValues, newPixelCandidateOverrideValues };
}

/** Compress a Diff by RLE-encoding the indices array (consecutive indices become index runs). */
export function compressDiff(diff: Diff): CompressedDiff {
  const { indices, oldLevelValues, newLevelValues, oldPixelCandidateOverrideValues, newPixelCandidateOverrideValues } = diff;
  if (indices.length === 0) {
    return {
      indexRuns: new Uint32Array(0),
      oldLevelValues,
      newLevelValues,
      ...(oldPixelCandidateOverrideValues !== undefined ? { oldPixelCandidateOverrideValues } : {}),
      ...(newPixelCandidateOverrideValues !== undefined ? { newPixelCandidateOverrideValues } : {}),
    };
  }
  // Count index runs
  let runCount = 1;
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] !== indices[i - 1] + 1) runCount++;
  }
  const indexRuns = new Uint32Array(runCount * 2);
  let ri = 0,
    runStart = indices[0],
    runLen = 1;
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] === indices[i - 1] + 1) {
      runLen++;
    } else {
      indexRuns[ri++] = runStart;
      indexRuns[ri++] = runLen;
      runStart = indices[i];
      runLen = 1;
    }
  }
  indexRuns[ri++] = runStart;
  indexRuns[ri] = runLen;
  return {
    indexRuns,
    oldLevelValues,
    newLevelValues,
    ...(oldPixelCandidateOverrideValues !== undefined ? { oldPixelCandidateOverrideValues } : {}),
    ...(newPixelCandidateOverrideValues !== undefined ? { newPixelCandidateOverrideValues } : {}),
  };
}

/** Decompress a CompressedDiff back to a Diff. */
export function decompressDiff(cd: CompressedDiff): Diff {
  const { indexRuns, oldLevelValues, newLevelValues, oldPixelCandidateOverrideValues, newPixelCandidateOverrideValues } = cd;
  // Calculate total count
  let total = 0;
  for (let i = 1; i < indexRuns.length; i += 2) total += indexRuns[i];
  const indices = new Uint32Array(total);
  let j = 0;
  for (let i = 0; i < indexRuns.length; i += 2) {
    const start = indexRuns[i],
      len = indexRuns[i + 1];
    for (let k = 0; k < len; k++) indices[j++] = start + k;
  }
  return {
    indices,
    oldLevelValues,
    newLevelValues,
    ...(oldPixelCandidateOverrideValues !== undefined ? { oldPixelCandidateOverrideValues } : {}),
    ...(newPixelCandidateOverrideValues !== undefined ? { newPixelCandidateOverrideValues } : {}),
  };
}
