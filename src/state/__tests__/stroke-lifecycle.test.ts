import { describe, it, expect } from "vitest";
import { canvasReducer, createInitialState } from "../canvas-reducer";
import { computeDiff, computeGlazeDiff } from "../undo-diff";
import { paintCircle, paintLine } from "../../drawing/paint";

/**
 * Integration tests for the stroke → undo → redo lifecycle.
 * Uses real reducer + real diff functions — no mocks.
 */

function mkCanvas(w: number, h: number) {
  return canvasReducer(createInitialState(), { type: "new_canvas", width: w, height: h });
}

function applyStroke(state: ReturnType<typeof canvasReducer>, mutator: (data: Uint8Array) => void) {
  const finalLevelData = new Uint8Array(state.canvasData.levelData);
  mutator(finalLevelData);
  const diff = computeDiff(state.canvasData.levelData, finalLevelData);
  return canvasReducer(state, { type: "stroke_end", finalLevelData, diff });
}

describe("stroke lifecycle integration", () => {
  it("brush stroke changes canvas data", () => {
    const s0 = mkCanvas(16, 16);
    expect(s0.canvasData.levelData[0]).toBe(0);

    const s1 = applyStroke(s0, (data) => {
      paintCircle(data, 0, 0, 0, 3, 16, 16);
    });
    expect(s1.canvasData.levelData[0]).toBe(3);
    expect(s1.undoStack.length).toBe(1);
    expect(s1.redoStack.length).toBe(0);
  });

  it("undo reverts brush stroke", () => {
    const s0 = mkCanvas(16, 16);
    const s1 = applyStroke(s0, (data) => {
      paintLine(data, 0, 0, 15, 0, 0, 5, 16, 16);
    });
    // All pixels on row 0 should be 5
    for (let x = 0; x <= 15; x++) expect(s1.canvasData.levelData[x]).toBe(5);

    const s2 = canvasReducer(s1, { type: "undo" });
    // All pixels should be back to 0
    for (let x = 0; x <= 15; x++) expect(s2.canvasData.levelData[x]).toBe(0);
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
    expect(s3.canvasData.levelData[8 * 16 + 8]).toBe(7); // center
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

    expect(s3.canvasData.levelData[0]).toBe(1);
    expect(s3.canvasData.levelData[1]).toBe(2);
    expect(s3.canvasData.levelData[2]).toBe(3);
    expect(s3.undoStack.length).toBe(3);

    // Undo stroke 3
    const s4 = canvasReducer(s3, { type: "undo" });
    expect(s4.canvasData.levelData[2]).toBe(0);
    expect(s4.canvasData.levelData[1]).toBe(2); // stroke 2 still applied

    // Undo stroke 2
    const s5 = canvasReducer(s4, { type: "undo" });
    expect(s5.canvasData.levelData[1]).toBe(0);
    expect(s5.canvasData.levelData[0]).toBe(1); // stroke 1 still applied

    // Redo stroke 2
    const s6 = canvasReducer(s5, { type: "redo" });
    expect(s6.canvasData.levelData[1]).toBe(2);
    expect(s6.canvasData.levelData[2]).toBe(0); // stroke 3 still undone

    // Redo stroke 3
    const s7 = canvasReducer(s6, { type: "redo" });
    expect(s7.canvasData.levelData[2]).toBe(3);
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
    expect(s4.canvasData.levelData[1]).toBe(0); // stroke 2 is gone
    expect(s4.canvasData.levelData[2]).toBe(3);
  });

  it("glaze stroke with pixelCandidateOverrideMap diff", () => {
    const s0 = mkCanvas(8, 8);
    // First paint some data
    const s1 = applyStroke(s0, (d) => {
      d[0] = 3;
      d[1] = 5;
    });

    // Apply glaze (pixelCandidateOverrideMap change)
    const oldOverrideMap = s1.canvasData.pixelCandidateOverrideMap;
    const newOverrideMap = new Uint8Array(oldOverrideMap);
    newOverrideMap[0] = 2; // set variant for pixel 0
    newOverrideMap[1] = 4; // set variant for pixel 1
    const diff = computeGlazeDiff(oldOverrideMap, newOverrideMap, s1.canvasData.levelData);

    const s2 = canvasReducer(s1, {
      type: "stroke_end",
      finalLevelData: s1.canvasData.levelData,
      finalPixelCandidateOverrideMap: newOverrideMap,
      diff,
    });
    expect(s2.canvasData.pixelCandidateOverrideMap[0]).toBe(2);
    expect(s2.canvasData.pixelCandidateOverrideMap[1]).toBe(4);

    // Undo should restore pixelCandidateOverrideMap
    const s3 = canvasReducer(s2, { type: "undo" });
    expect(s3.canvasData.pixelCandidateOverrideMap[0]).toBe(0);
    expect(s3.canvasData.pixelCandidateOverrideMap[1]).toBe(0);

    // Redo should re-apply pixelCandidateOverrideMap
    const s4 = canvasReducer(s3, { type: "redo" });
    expect(s4.canvasData.pixelCandidateOverrideMap[0]).toBe(2);
    expect(s4.canvasData.pixelCandidateOverrideMap[1]).toBe(4);
  });

  it("source stroke clears stale glaze overrides and preserves them through undo/redo", () => {
    const s0 = mkCanvas(8, 8);
    const s1 = applyStroke(s0, (d) => {
      d[0] = 3;
      d[1] = 5;
    });

    const newOverrideMap = new Uint8Array(s1.canvasData.pixelCandidateOverrideMap);
    newOverrideMap[0] = 2;
    newOverrideMap[1] = 1;
    const glazeDiff = computeGlazeDiff(s1.canvasData.pixelCandidateOverrideMap, newOverrideMap, s1.canvasData.levelData);
    const s2 = canvasReducer(s1, {
      type: "stroke_end",
      finalLevelData: s1.canvasData.levelData,
      finalPixelCandidateOverrideMap: newOverrideMap,
      diff: glazeDiff,
    });

    const finalLevelData = new Uint8Array(s2.canvasData.levelData);
    finalLevelData[0] = 1;
    const sourceDiff = computeDiff(s2.canvasData.levelData, finalLevelData);
    const s3 = canvasReducer(s2, { type: "stroke_end", finalLevelData, diff: sourceDiff });

    expect(s3.canvasData.levelData[0]).toBe(1);
    expect(s3.canvasData.pixelCandidateOverrideMap[0]).toBe(0);
    expect(s3.canvasData.pixelCandidateOverrideMap[1]).toBe(1);

    const s4 = canvasReducer(s3, { type: "undo" });
    expect(s4.canvasData.levelData[0]).toBe(3);
    expect(s4.canvasData.pixelCandidateOverrideMap[0]).toBe(2);
    expect(s4.canvasData.pixelCandidateOverrideMap[1]).toBe(1);

    const s5 = canvasReducer(s4, { type: "redo" });
    expect(s5.canvasData.levelData[0]).toBe(1);
    expect(s5.canvasData.pixelCandidateOverrideMap[0]).toBe(0);
    expect(s5.canvasData.pixelCandidateOverrideMap[1]).toBe(1);
  });

  it("histogram tracks level changes through stroke/undo/redo", () => {
    const s0 = mkCanvas(4, 4); // 16 pixels, all level 0
    expect(s0.levelHistogram[0]).toBe(16);
    expect(s0.levelHistogram[3]).toBe(0);

    // Paint 4 pixels to level 3
    const s1 = applyStroke(s0, (d) => {
      d[0] = 3;
      d[1] = 3;
      d[2] = 3;
      d[3] = 3;
    });
    expect(s1.levelHistogram[0]).toBe(12);
    expect(s1.levelHistogram[3]).toBe(4);

    // Undo
    const s2 = canvasReducer(s1, { type: "undo" });
    expect(s2.levelHistogram[0]).toBe(16);
    expect(s2.levelHistogram[3]).toBe(0);

    // Redo
    const s3 = canvasReducer(s2, { type: "redo" });
    expect(s3.levelHistogram[0]).toBe(12);
    expect(s3.levelHistogram[3]).toBe(4);
  });
});
