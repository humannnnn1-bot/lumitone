import type { Diff, CompressedDiff } from "../types";

/* ═══════════════════════════════════════════
   UNDO DIFF
   ═══════════════════════════════════════════ */

export function computeDiff(oldD: Uint8Array, newD: Uint8Array): Diff {
  const len = Math.min(oldD.length, newD.length);
  let count = 0;
  for (let i = 0; i < len; i++) if (oldD[i] !== newD[i]) count++;
  const indices = new Uint32Array(count),
    oldValues = new Uint8Array(count),
    newValues = new Uint8Array(count);
  let j = 0;
  for (let i = 0; i < len; i++) {
    if (oldD[i] !== newD[i]) {
      indices[j] = i;
      oldValues[j] = oldD[i];
      newValues[j] = newD[i];
      j++;
    }
  }
  return { indices, oldValues, newValues };
}

export function applyDiff(data: Uint8Array, diff: Diff, reverse: boolean): Uint8Array {
  const r = new Uint8Array(data),
    v = reverse ? diff.oldValues : diff.newValues;
  const len = data.length;
  for (let i = 0; i < diff.indices.length; i++) {
    const indices = diff.indices[i];
    if (indices < len) r[indices] = v[i];
  }
  return r;
}

/** Build a Diff directly from flood-fill changed indices, avoiding a full-buffer scan. */
export function buildDiffFromFill(pre: Uint8Array, buf: Uint8Array, changed: Uint32Array): Diff {
  const bufLen = Math.min(pre.length, buf.length);
  // Filter out any out-of-bounds indices
  let validCount = 0;
  for (let i = 0; i < changed.length; i++) {
    if (changed[i] < bufLen) validCount++;
  }
  const indices = new Uint32Array(validCount);
  const oldValues = new Uint8Array(validCount);
  const newValues = new Uint8Array(validCount);
  let j = 0;
  for (let i = 0; i < changed.length; i++) {
    const ci = changed[i];
    if (ci < bufLen) {
      indices[j] = ci;
      oldValues[j] = pre[ci];
      newValues[j] = buf[ci];
      j++;
    }
  }
  return { indices, oldValues, newValues };
}

/** Compute a diff for colorMap-only changes (data unchanged). */
export function computeGlazeDiff(oldCm: Uint8Array, newCm: Uint8Array, data: Uint8Array): Diff {
  const len = Math.min(oldCm.length, newCm.length);
  let count = 0;
  for (let i = 0; i < len; i++) if (oldCm[i] !== newCm[i]) count++;
  const indices = new Uint32Array(count);
  const oldValues = new Uint8Array(count),
    newValues = new Uint8Array(count);
  const oldColorMapValues = new Uint8Array(count),
    newColorMapValues = new Uint8Array(count);
  let j = 0;
  for (let i = 0; i < len; i++) {
    if (oldCm[i] !== newCm[i]) {
      indices[j] = i;
      oldValues[j] = data[i];
      newValues[j] = data[i];
      oldColorMapValues[j] = oldCm[i];
      newColorMapValues[j] = newCm[i];
      j++;
    }
  }
  return { indices, oldValues, newValues, oldColorMapValues, newColorMapValues };
}

/** Apply the colorMap portion of a diff. Returns original if no cm fields. */
export function applyDiffToColorMap(colorMap: Uint8Array, diff: Diff, reverse: boolean): Uint8Array {
  if (!diff.oldColorMapValues || !diff.newColorMapValues) return colorMap;
  const r = new Uint8Array(colorMap);
  const v = reverse ? diff.oldColorMapValues : diff.newColorMapValues;
  for (let i = 0; i < diff.indices.length; i++) {
    const ix = diff.indices[i];
    if (ix < r.length) r[ix] = v[i];
  }
  return r;
}

/** Build a diff for glaze flood fill from changed indices. */
export function buildDiffFromGlazeFill(cmPre: Uint8Array, cmBuf: Uint8Array, data: Uint8Array, changed: Uint32Array): Diff {
  const bufLen = Math.min(cmPre.length, cmBuf.length);
  let validCount = 0;
  for (let i = 0; i < changed.length; i++) if (changed[i] < bufLen) validCount++;
  const indices = new Uint32Array(validCount);
  const oldValues = new Uint8Array(validCount),
    newValues = new Uint8Array(validCount);
  const oldColorMapValues = new Uint8Array(validCount),
    newColorMapValues = new Uint8Array(validCount);
  let j = 0;
  for (let i = 0; i < changed.length; i++) {
    const ci = changed[i];
    if (ci < bufLen) {
      indices[j] = ci;
      oldValues[j] = data[ci];
      newValues[j] = data[ci];
      oldColorMapValues[j] = cmPre[ci];
      newColorMapValues[j] = cmBuf[ci];
      j++;
    }
  }
  return { indices, oldValues, newValues, oldColorMapValues, newColorMapValues };
}

/** Compress a Diff by RLE-encoding the indices array (consecutive indices become runs). */
export function compressDiff(diff: Diff): CompressedDiff {
  const { indices, oldValues, newValues, oldColorMapValues, newColorMapValues } = diff;
  if (indices.length === 0) {
    return {
      runs: new Uint32Array(0),
      oldValues,
      newValues,
      ...(oldColorMapValues !== undefined ? { oldColorMapValues } : {}),
      ...(newColorMapValues !== undefined ? { newColorMapValues } : {}),
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
    ...(oldColorMapValues !== undefined ? { oldColorMapValues } : {}),
    ...(newColorMapValues !== undefined ? { newColorMapValues } : {}),
  };
}

/** Decompress a CompressedDiff back to a Diff. */
export function decompressDiff(cd: CompressedDiff): Diff {
  const { runs, oldValues, newValues, oldColorMapValues, newColorMapValues } = cd;
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
    ...(oldColorMapValues !== undefined ? { oldColorMapValues } : {}),
    ...(newColorMapValues !== undefined ? { newColorMapValues } : {}),
  };
}
