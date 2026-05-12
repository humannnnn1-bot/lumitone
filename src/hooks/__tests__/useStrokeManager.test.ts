import { describe, it, expect } from "vitest";
import {
  allocateStrokeBuffers,
  createStrokeState,
  applyBrushStroke,
  applyBrushDot,
  applyShapeStroke,
  applyShapeDot,
  computeStrokeResult,
  resolveLevel,
  isShapeTool,
} from "../useStrokeManager";
import type { BufferPool } from "../useStrokeManager";

function mkBuf(w: number, h: number, fill = 0): Uint8Array {
  const buf = new Uint8Array(w * h);
  if (fill) buf.fill(fill);
  return buf;
}

describe("allocateStrokeBuffers", () => {
  it("allocates new buffers when pool is empty", () => {
    const pool: BufferPool = { pre: null, buf: null, size: 0 };
    const data = mkBuf(10, 10, 3);
    const { pre, buf } = allocateStrokeBuffers(pool, data);
    expect(pre.length).toBe(100);
    expect(buf.length).toBe(100);
    expect(pre[0]).toBe(3);
    expect(buf[0]).toBe(3);
    expect(pool.size).toBe(100);
  });

  it("reuses pool when size matches", () => {
    const pool: BufferPool = { pre: new Uint8Array(100), buf: new Uint8Array(100), size: 100 };
    const origPre = pool.pre;
    const origBuf = pool.buf;
    const data = mkBuf(10, 10, 5);
    const { pre, buf } = allocateStrokeBuffers(pool, data);
    expect(pre).toBe(origPre); // same reference
    expect(buf).toBe(origBuf);
    expect(pre[0]).toBe(5);
    expect(buf[0]).toBe(5);
  });

  it("reallocates when size differs", () => {
    const pool: BufferPool = { pre: new Uint8Array(50), buf: new Uint8Array(50), size: 50 };
    const origPre = pool.pre;
    const data = mkBuf(10, 10, 2);
    const { pre, buf } = allocateStrokeBuffers(pool, data);
    expect(pre).not.toBe(origPre); // new allocation
    expect(pre.length).toBe(100);
    expect(buf.length).toBe(100);
    expect(pool.size).toBe(100);
  });

  it("copies data correctly", () => {
    const pool: BufferPool = { pre: null, buf: null, size: 0 };
    const data = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
    const { pre, buf } = allocateStrokeBuffers(pool, data);
    expect(Array.from(pre)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(Array.from(buf)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});

describe("createStrokeState", () => {
  it("creates state with correct fields", () => {
    const buf = mkBuf(4, 4);
    const pre = mkBuf(4, 4);
    const state = createStrokeState(buf, pre, "brush", 3, 5, { x: 2, y: 3 });
    expect(state.buf).toBe(buf);
    expect(state.pre).toBe(pre);
    expect(state.params.tool).toBe("brush");
    expect(state.params.brushLevel).toBe(3);
    expect(state.params.brushSize).toBe(5);
    expect(state.shapeStart).toEqual({ x: 2, y: 3 });
    expect(state.prevShapeBBox).toBeNull();
    expect(state.fillChanged).toBeNull();
  });
});

describe("resolveLevel", () => {
  it("returns brushLevel for brush tool", () => {
    expect(resolveLevel("brush", 5)).toBe(5);
  });

  it("returns 0 for eraser", () => {
    expect(resolveLevel("eraser", 5)).toBe(0);
  });

  it("returns brushLevel for shape tools", () => {
    expect(resolveLevel("line", 3)).toBe(3);
    expect(resolveLevel("rect", 7)).toBe(7);
    expect(resolveLevel("ellipse", 1)).toBe(1);
  });

  it("returns brushLevel for fill tool", () => {
    expect(resolveLevel("fill", 4)).toBe(4);
  });
});

describe("isShapeTool", () => {
  it("identifies shape tools", () => {
    expect(isShapeTool("line")).toBe(true);
    expect(isShapeTool("rect")).toBe(true);
    expect(isShapeTool("ellipse")).toBe(true);
  });

  it("rejects non-shape tools", () => {
    expect(isShapeTool("brush")).toBe(false);
    expect(isShapeTool("eraser")).toBe(false);
    expect(isShapeTool("fill")).toBe(false);
  });
});

describe("applyBrushDot", () => {
  it("paints a single dot and returns dirty rect", () => {
    const buf = mkBuf(10, 10);
    const dirty = applyBrushDot(buf, { x: 5, y: 5 }, 1, 3, 10, 10);
    expect(buf[5 * 10 + 5]).toBe(3);
    expect(dirty).not.toBeNull();
    expect(dirty!.x).toBeLessThanOrEqual(5);
    expect(dirty!.y).toBeLessThanOrEqual(5);
  });

  it("uses distinct exact footprints for adjacent small brush sizes", () => {
    const size2 = mkBuf(10, 10);
    const dirty2 = applyBrushDot(size2, { x: 4, y: 4 }, 2, 3, 10, 10);
    expect(dirty2).toEqual({ x: 4, y: 4, w: 2, h: 2 });
    expect(size2[4 * 10 + 4]).toBe(3);
    expect(size2[4 * 10 + 5]).toBe(3);
    expect(size2[5 * 10 + 4]).toBe(3);
    expect(size2[5 * 10 + 5]).toBe(3);
    expect(size2[4 * 10 + 3]).toBe(0);

    const size3 = mkBuf(10, 10);
    const dirty3 = applyBrushDot(size3, { x: 4, y: 4 }, 3, 3, 10, 10);
    expect(dirty3).toEqual({ x: 3, y: 3, w: 3, h: 3 });
    expect(size3[4 * 10 + 4]).toBe(3);
    expect(size3[3 * 10 + 4]).toBe(3);
    expect(size3[4 * 10 + 3]).toBe(3);
    expect(size3[3 * 10 + 3]).toBe(0);
  });

  it("handles brush size > 1", () => {
    const buf = mkBuf(20, 20);
    const dirty = applyBrushDot(buf, { x: 10, y: 10 }, 5, 2, 20, 20);
    // Center pixel should be painted
    expect(buf[10 * 20 + 10]).toBe(2);
    expect(dirty).not.toBeNull();
    // Dirty rect should be larger than point
    expect(dirty!.w).toBeGreaterThan(1);
    expect(dirty!.h).toBeGreaterThan(1);
  });
});

describe("applyBrushStroke", () => {
  it("paints line between two points", () => {
    const buf = mkBuf(20, 20);
    const dirty = applyBrushStroke(buf, { x: 0, y: 0 }, { x: 5, y: 0 }, 1, 4, 20, 20);
    // Pixels along the line should be painted
    expect(buf[0]).toBe(4); // (0,0)
    expect(buf[5]).toBe(4); // (5,0)
    expect(dirty).not.toBeNull();
  });

  it("returns dirty rect covering both points", () => {
    const dirty = applyBrushStroke(mkBuf(20, 20), { x: 2, y: 3 }, { x: 15, y: 10 }, 3, 1, 20, 20);
    expect(dirty).not.toBeNull();
    expect(dirty!.x).toBeLessThanOrEqual(2);
    expect(dirty!.y).toBeLessThanOrEqual(3);
    expect(dirty!.x + dirty!.w).toBeGreaterThanOrEqual(15);
    expect(dirty!.y + dirty!.h).toBeGreaterThanOrEqual(10);
  });
});

describe("applyShapeDot", () => {
  it("draws initial shape and returns bbox", () => {
    const buf = mkBuf(20, 20);
    const bb = applyShapeDot(buf, "line", { x: 5, y: 5 }, 1, 3, 20, 20);
    expect(buf[5 * 20 + 5]).toBe(3);
    expect(bb).not.toBeNull();
  });
});

describe("applyShapeStroke", () => {
  it("restores pre-buffer then draws shape", () => {
    const W = 20,
      H = 20;
    const pre = mkBuf(W, H, 0);
    const buf = mkBuf(W, H, 0);
    // First draw a shape
    const bb1 = applyShapeDot(buf, "rect", { x: 2, y: 2 }, 3, 5, W, H);
    // Now update shape to new position — should restore and redraw
    const { shapeBBox, dirtyBBox } = applyShapeStroke(buf, pre, "rect", { x: 2, y: 2 }, { x: 10, y: 10 }, 3, 5, W, H, bb1);
    expect(shapeBBox).not.toBeNull();
    expect(dirtyBBox).not.toBeNull();
    // The new shape should be drawn (rect from 2,2 to 10,10)
    // Top edge should have the level value
    expect(buf[2 * W + 5]).toBe(5); // somewhere on top edge
  });

  it("works with null prevBBox", () => {
    const W = 10,
      H = 10;
    const pre = mkBuf(W, H, 0);
    const buf = mkBuf(W, H, 0);
    const { shapeBBox, dirtyBBox } = applyShapeStroke(buf, pre, "line", { x: 0, y: 0 }, { x: 9, y: 9 }, 1, 2, W, H, null);
    expect(shapeBBox).not.toBeNull();
    // dirtyBBox should equal shapeBBox when prevBBox is null
    expect(dirtyBBox).toEqual(shapeBBox);
  });
});

describe("computeStrokeResult", () => {
  it("returns null when no changes", () => {
    const data = mkBuf(10, 10, 3);
    const diff = computeStrokeResult(data, new Uint8Array(data), null);
    expect(diff).not.toBeNull();
    expect(diff!.indices.length).toBe(0);
  });

  it("computes diff for brush changes", () => {
    const pre = mkBuf(10, 10, 0);
    const buf = mkBuf(10, 10, 0);
    buf[0] = 3;
    buf[1] = 3;
    buf[2] = 3;
    const diff = computeStrokeResult(pre, buf, null);
    expect(diff).not.toBeNull();
    expect(diff!.indices.length).toBe(3);
    expect(diff!.newValues[0]).toBe(3);
    expect(diff!.oldValues[0]).toBe(0);
  });

  it("uses buildDiffFromFill when fillChanged provided", () => {
    const pre = mkBuf(10, 10, 0);
    const buf = mkBuf(10, 10, 0);
    buf[5] = 2;
    buf[15] = 2;
    buf[25] = 2;
    const changed = new Uint32Array([5, 15, 25]);
    const diff = computeStrokeResult(pre, buf, changed);
    expect(diff).not.toBeNull();
    expect(diff!.indices.length).toBe(3);
    // fillChanged indices should match
    expect(diff!.indices[0]).toBe(5);
    expect(diff!.indices[1]).toBe(15);
    expect(diff!.indices[2]).toBe(25);
  });
});
