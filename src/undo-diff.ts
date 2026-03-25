import type { Diff } from "./types";

/* ═══════════════════════════════════════════
   UNDO DIFF
   ═══════════════════════════════════════════ */

export function computeDiff(oldD: Uint8Array, newD: Uint8Array): Diff {
  const len = Math.min(oldD.length, newD.length);
  let count = 0;
  for (let i = 0; i < len; i++) if (oldD[i] !== newD[i]) count++;
  const idx = new Uint32Array(count), ov = new Uint8Array(count), nv = new Uint8Array(count);
  let j = 0;
  for (let i = 0; i < len; i++) {
    if (oldD[i] !== newD[i]) { idx[j] = i; ov[j] = oldD[i]; nv[j] = newD[i]; j++; }
  }
  return { idx, ov, nv };
}

export function applyDiff(data: Uint8Array, diff: Diff, reverse: boolean): Uint8Array {
  const r = new Uint8Array(data), v = reverse ? diff.ov : diff.nv;
  const len = data.length;
  for (let i = 0; i < diff.idx.length; i++) {
    const idx = diff.idx[i];
    if (idx < len) r[idx] = v[i];
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
  const idx = new Uint32Array(validCount);
  const ov = new Uint8Array(validCount);
  const nv = new Uint8Array(validCount);
  let j = 0;
  for (let i = 0; i < changed.length; i++) {
    const ci = changed[i];
    if (ci < bufLen) {
      idx[j] = ci;
      ov[j] = pre[ci];
      nv[j] = buf[ci];
      j++;
    }
  }
  return { idx, ov, nv };
}

/** Compute a diff for colorMap-only changes (data unchanged). */
export function computeGlazeDiff(oldCm: Uint8Array, newCm: Uint8Array, data: Uint8Array): Diff {
  const len = Math.min(oldCm.length, newCm.length);
  let count = 0;
  for (let i = 0; i < len; i++) if (oldCm[i] !== newCm[i]) count++;
  const idx = new Uint32Array(count);
  const ov = new Uint8Array(count), nv = new Uint8Array(count);
  const cmOv = new Uint8Array(count), cmNv = new Uint8Array(count);
  let j = 0;
  for (let i = 0; i < len; i++) {
    if (oldCm[i] !== newCm[i]) {
      idx[j] = i;
      ov[j] = data[i]; nv[j] = data[i];
      cmOv[j] = oldCm[i]; cmNv[j] = newCm[i];
      j++;
    }
  }
  return { idx, ov, nv, cmOv, cmNv };
}

/** Apply the colorMap portion of a diff. Returns original if no cm fields. */
export function applyDiffToColorMap(colorMap: Uint8Array, diff: Diff, reverse: boolean): Uint8Array {
  if (!diff.cmOv || !diff.cmNv) return colorMap;
  const r = new Uint8Array(colorMap);
  const v = reverse ? diff.cmOv : diff.cmNv;
  for (let i = 0; i < diff.idx.length; i++) {
    const ix = diff.idx[i];
    if (ix < r.length) r[ix] = v[i];
  }
  return r;
}

/** Build a diff for glaze flood fill from changed indices. */
export function buildDiffFromGlazeFill(cmPre: Uint8Array, cmBuf: Uint8Array, data: Uint8Array, changed: Uint32Array): Diff {
  const bufLen = Math.min(cmPre.length, cmBuf.length);
  let validCount = 0;
  for (let i = 0; i < changed.length; i++) if (changed[i] < bufLen) validCount++;
  const idx = new Uint32Array(validCount);
  const ov = new Uint8Array(validCount), nv = new Uint8Array(validCount);
  const cmOv = new Uint8Array(validCount), cmNv = new Uint8Array(validCount);
  let j = 0;
  for (let i = 0; i < changed.length; i++) {
    const ci = changed[i];
    if (ci < bufLen) {
      idx[j] = ci; ov[j] = data[ci]; nv[j] = data[ci];
      cmOv[j] = cmPre[ci]; cmNv[j] = cmBuf[ci]; j++;
    }
  }
  return { idx, ov, nv, cmOv, cmNv };
}
