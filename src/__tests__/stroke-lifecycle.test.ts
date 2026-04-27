import { describe, it, expect } from "vitest";
import { canvasReducer, initialState } from "../state/canvas-reducer";
import { computeDiff, computeGlazeDiff } from "../undo-diff";
import { paintCircle, paintLine } from "../drawing/paint";

/**
 * Integration tests for the stroke → undo → redo lifecycle.
 * Uses real reducer + real diff functions — no mocks.
 */

function mkCanvas(w: number, h: number) {
  return canvasReducer(initialState, { type: "new_canvas", w, h });
}

function applyStroke(state: ReturnType<typeof canvasReducer>, mutator: (data: Uint8Array) => void) {
  const finalData = new Uint8Array(state.cvs.data);
  mutator(finalData);
  const diff = computeDiff(state.cvs.data, finalData);
  return canvasReducer(state, { type: "stroke_end", finalData, diff });
}

describe("stroke lifecycle integration", () => {
  it("brush stroke changes canvas data", () => {
    const s0 = mkCanvas(16, 16);
    expect(s0.cvs.data[0]).toBe(0);

    const s1 = applyStroke(s0, (data) => {
      paintCircle(data, 0, 0, 0, 3, 16, 16);
    });
    expect(s1.cvs.data[0]).toBe(3);
    expect(s1.undoStack.length).toBe(1);
    expect(s1.redoStack.length).toBe(0);
  });

  it("undo reverts brush stroke", () => {
    const s0 = mkCanvas(16, 16);
    const s1 = applyStroke(s0, (data) => {
      paintLine(data, 0, 0, 15, 0, 0, 5, 16, 16);
    });
    // All pixels on row 0 should be 5
    for (let x = 0; x <= 15; x++) expect(s1.cvs.data[x]).toBe(5);

    const s2 = canvasReducer(s1, { type: "undo" });
    // All pixels should be back to 0
    for (let x = 0; x <= 15; x++) expect(s2.cvs.data[x]).toBe(0);
    expect(s2.undoStack.length).toBe(0);
    expect(s2.redoStack.length).toBe(1);
  });

  it("redo restores undone stroke", () => {
    const s0 = mkCanvas(16, 16);
    const s1 = applyStroke(s0, (data) => {
      paintCircle(data, 8, 8, 2, 7, 16, 16);
    });
    const s2 = canvasReducer(s1, { type: "undo" });
    const s3 = canvasReducer(s2, { type: "redo" });

    // Should match post-stroke state
    expect(s3.cvs.data[8 * 16 + 8]).toBe(7); // center
    expect(s3.undoStack.length).toBe(1);
    expect(s3.redoStack.length).toBe(0);
  });

  it("multiple strokes + multiple undos + redo", () => {
    const s0 = mkCanvas(8, 8);

    // Stroke 1: paint pixel (0,0) = 1
    const s1 = applyStroke(s0, (d) => {
      d[0] = 1;
    });
    // Stroke 2: paint pixel (1,0) = 2
    const s2 = applyStroke(s1, (d) => {
      d[1] = 2;
    });
    // Stroke 3: paint pixel (2,0) = 3
    const s3 = applyStroke(s2, (d) => {
      d[2] = 3;
    });

    expect(s3.cvs.data[0]).toBe(1);
    expect(s3.cvs.data[1]).toBe(2);
    expect(s3.cvs.data[2]).toBe(3);
    expect(s3.undoStack.length).toBe(3);

    // Undo stroke 3
    const s4 = canvasReducer(s3, { type: "undo" });
    expect(s4.cvs.data[2]).toBe(0);
    expect(s4.cvs.data[1]).toBe(2); // stroke 2 still applied

    // Undo stroke 2
    const s5 = canvasReducer(s4, { type: "undo" });
    expect(s5.cvs.data[1]).toBe(0);
    expect(s5.cvs.data[0]).toBe(1); // stroke 1 still applied

    // Redo stroke 2
    const s6 = canvasReducer(s5, { type: "redo" });
    expect(s6.cvs.data[1]).toBe(2);
    expect(s6.cvs.data[2]).toBe(0); // stroke 3 still undone

    // Redo stroke 3
    const s7 = canvasReducer(s6, { type: "redo" });
    expect(s7.cvs.data[2]).toBe(3);
  });

  it("new stroke after undo clears redo stack", () => {
    const s0 = mkCanvas(8, 8);
    const s1 = applyStroke(s0, (d) => {
      d[0] = 1;
    });
    const s2 = applyStroke(s1, (d) => {
      d[1] = 2;
    });
    const s3 = canvasReducer(s2, { type: "undo" }); // undo stroke 2
    expect(s3.redoStack.length).toBe(1);

    // New stroke should clear redo stack
    const s4 = applyStroke(s3, (d) => {
      d[2] = 3;
    });
    expect(s4.redoStack.length).toBe(0);
    expect(s4.cvs.data[1]).toBe(0); // stroke 2 is gone
    expect(s4.cvs.data[2]).toBe(3);
  });

  it("glaze stroke with colorMap diff", () => {
    const s0 = mkCanvas(8, 8);
    // First paint some data
    const s1 = applyStroke(s0, (d) => {
      d[0] = 3;
      d[1] = 5;
    });

    // Apply glaze (colorMap change)
    const oldCm = s1.cvs.colorMap;
    const newCm = new Uint8Array(oldCm);
    newCm[0] = 2; // set variant for pixel 0
    newCm[1] = 4; // set variant for pixel 1
    const diff = computeGlazeDiff(oldCm, newCm, s1.cvs.data);

    const s2 = canvasReducer(s1, {
      type: "stroke_end",
      finalData: s1.cvs.data,
      finalColorMap: newCm,
      diff,
    });
    expect(s2.cvs.colorMap[0]).toBe(2);
    expect(s2.cvs.colorMap[1]).toBe(4);

    // Undo should restore colorMap
    const s3 = canvasReducer(s2, { type: "undo" });
    expect(s3.cvs.colorMap[0]).toBe(0);
    expect(s3.cvs.colorMap[1]).toBe(0);

    // Redo should re-apply colorMap
    const s4 = canvasReducer(s3, { type: "redo" });
    expect(s4.cvs.colorMap[0]).toBe(2);
    expect(s4.cvs.colorMap[1]).toBe(4);
  });

  it("histogram tracks level changes through stroke/undo/redo", () => {
    const s0 = mkCanvas(4, 4); // 16 pixels, all level 0
    expect(s0.hist[0]).toBe(16);
    expect(s0.hist[3]).toBe(0);

    // Paint 4 pixels to level 3
    const s1 = applyStroke(s0, (d) => {
      d[0] = 3;
      d[1] = 3;
      d[2] = 3;
      d[3] = 3;
    });
    expect(s1.hist[0]).toBe(12);
    expect(s1.hist[3]).toBe(4);

    // Undo
    const s2 = canvasReducer(s1, { type: "undo" });
    expect(s2.hist[0]).toBe(16);
    expect(s2.hist[3]).toBe(0);

    // Redo
    const s3 = canvasReducer(s2, { type: "redo" });
    expect(s3.hist[0]).toBe(12);
    expect(s3.hist[3]).toBe(4);
  });
});
