import { beforeEach, describe, it, expect } from "vitest";
import { canvasReducer, createInitialState } from "../canvas-reducer";
import { computeDiff } from "../undo-diff";
import { MAX_UNDO } from "../../constants";

let initialState: ReturnType<typeof createInitialState>;

beforeEach(() => {
  initialState = createInitialState();
});

describe("canvasReducer", () => {
  describe("stroke_end", () => {
    it("updates data and histogram", () => {
      const state = { ...initialState };
      const finalLevelData = new Uint8Array(state.canvasData.levelData.length);
      finalLevelData[0] = 3;
      const diff = computeDiff(state.canvasData.levelData, finalLevelData);
      const next = canvasReducer(state, { type: "stroke_end", finalLevelData, diff });
      expect(next.canvasData.levelData[0]).toBe(3);
      expect(next.undoStack.length).toBe(1);
      expect(next.redoStack.length).toBe(0);
      expect(next.levelHistogram[0]).toBe(state.levelHistogram[0] - 1);
      expect(next.levelHistogram[3]).toBe(1);
    });

    it("no-op for empty diff", () => {
      const state = { ...initialState };
      const finalLevelData = new Uint8Array(state.canvasData.levelData);
      const diff = computeDiff(state.canvasData.levelData, finalLevelData);
      const next = canvasReducer(state, { type: "stroke_end", finalLevelData, diff });
      expect(next).toBe(state);
    });

    it("null diff returns same state", () => {
      const state = { ...initialState };
      const next = canvasReducer(state, { type: "stroke_end", finalLevelData: new Uint8Array(state.canvasData.levelData), diff: null });
      expect(next).toBe(state);
    });
  });

  describe("undo / redo", () => {
    it("undo reverses stroke", () => {
      const finalLevelData = new Uint8Array(initialState.canvasData.levelData.length);
      finalLevelData[0] = 5;
      const diff = computeDiff(initialState.canvasData.levelData, finalLevelData);
      const afterStroke = canvasReducer(initialState, { type: "stroke_end", finalLevelData, diff });
      expect(afterStroke.canvasData.levelData[0]).toBe(5);

      const afterUndo = canvasReducer(afterStroke, { type: "undo" });
      expect(afterUndo.canvasData.levelData[0]).toBe(0);
      expect(afterUndo.undoStack.length).toBe(0);
      expect(afterUndo.redoStack.length).toBe(1);
    });

    it("redo restores undone stroke", () => {
      const finalLevelData = new Uint8Array(initialState.canvasData.levelData.length);
      finalLevelData[0] = 5;
      const diff = computeDiff(initialState.canvasData.levelData, finalLevelData);
      const s1 = canvasReducer(initialState, { type: "stroke_end", finalLevelData, diff });
      const s2 = canvasReducer(s1, { type: "undo" });
      const s3 = canvasReducer(s2, { type: "redo" });
      expect(s3.canvasData.levelData[0]).toBe(5);
      expect(s3.undoStack.length).toBe(1);
      expect(s3.redoStack.length).toBe(0);
    });

    it("undo on empty stack is no-op", () => {
      const next = canvasReducer(initialState, { type: "undo" });
      expect(next).toBe(initialState);
    });

    it("redo on empty stack is no-op", () => {
      const next = canvasReducer(initialState, { type: "redo" });
      expect(next).toBe(initialState);
    });
  });

  describe("undo stack limit", () => {
    it("caps undo stack at MAX_UNDO", () => {
      let state = canvasReducer(initialState, { type: "new_canvas", width: 4, height: 4 });
      for (let i = 0; i < MAX_UNDO + 10; i++) {
        const finalLevelData = new Uint8Array(state.canvasData.levelData);
        finalLevelData[0] = (i % 7) + 1;
        const diff = computeDiff(state.canvasData.levelData, finalLevelData);
        state = canvasReducer(state, { type: "stroke_end", finalLevelData, diff });
      }
      expect(state.undoStack.length).toBe(MAX_UNDO);
    });
  });

  describe("clear", () => {
    it("clears canvas and pushes to undo", () => {
      const finalLevelData = new Uint8Array(initialState.canvasData.levelData.length);
      finalLevelData.fill(3);
      const diff = computeDiff(initialState.canvasData.levelData, finalLevelData);
      const s1 = canvasReducer(initialState, { type: "stroke_end", finalLevelData, diff });

      const s2 = canvasReducer(s1, { type: "clear" });
      expect(s2.canvasData.levelData[0]).toBe(0);
      expect(s2.levelHistogram[0]).toBe(s2.canvasData.width * s2.canvasData.height);
      expect(s2.undoStack.length).toBe(2); // stroke + clear
    });

    it("clearing already blank canvas is no-op", () => {
      const next = canvasReducer(initialState, { type: "clear" });
      expect(next).toBe(initialState);
    });
  });

  describe("new_canvas", () => {
    it("creates new blank canvas with given dimensions", () => {
      const next = canvasReducer(initialState, { type: "new_canvas", width: 64, height: 48 });
      expect(next.canvasData.width).toBe(64);
      expect(next.canvasData.height).toBe(48);
      expect(next.canvasData.levelData.length).toBe(64 * 48);
      expect(next.undoStack.length).toBe(0);
      expect(next.redoStack.length).toBe(0);
      expect(next.levelHistogram[0]).toBe(64 * 48);
    });

    it.each([
      [1200, 630],
      [630, 1200],
      [2048, 2048],
    ])("allows canvas size %sx%s within the maximum", (w, h) => {
      const next = canvasReducer(initialState, { type: "new_canvas", width: w, height: h });
      expect(next.canvasData.width).toBe(w);
      expect(next.canvasData.height).toBe(h);
      expect(next.canvasData.levelData.length).toBe(w * h);
      expect(next.levelHistogram[0]).toBe(w * h);
    });

    it("rejects invalid dimensions", () => {
      expect(canvasReducer(initialState, { type: "new_canvas", width: 0, height: 100 })).toBe(initialState);
      expect(canvasReducer(initialState, { type: "new_canvas", width: 100, height: -1 })).toBe(initialState);
      expect(canvasReducer(initialState, { type: "new_canvas", width: 2049, height: 100 })).toBe(initialState);
      expect(canvasReducer(initialState, { type: "new_canvas", width: 1200, height: 2049 })).toBe(initialState);
    });
  });

  describe("load_image", () => {
    it("loads image data and resets stacks", () => {
      const data = new Uint8Array(16);
      data[0] = 2;
      data[1] = 5;
      const next = canvasReducer(initialState, { type: "load_image", width: 4, height: 4, levelData: data });
      expect(next.canvasData.width).toBe(4);
      expect(next.canvasData.height).toBe(4);
      expect(next.canvasData.levelData[0]).toBe(2);
      expect(next.undoStack.length).toBe(0);
      expect(next.levelHistogram[2]).toBe(1);
      expect(next.levelHistogram[5]).toBe(1);
    });

    it("loads non-square image data within the maximum", () => {
      const data = new Uint8Array(1200 * 630);
      const next = canvasReducer(initialState, { type: "load_image", width: 1200, height: 630, levelData: data });
      expect(next.canvasData.width).toBe(1200);
      expect(next.canvasData.height).toBe(630);
      expect(next.canvasData.levelData.length).toBe(1200 * 630);
    });

    it("rejects mismatched data length", () => {
      const data = new Uint8Array(10); // doesn't match 4x4
      expect(canvasReducer(initialState, { type: "load_image", width: 4, height: 4, levelData: data })).toBe(initialState);
    });
  });
});

describe("edge cases", () => {
  it("undo on empty stack returns same state", () => {
    const state = { ...initialState };
    const next = canvasReducer(state, { type: "undo" });
    expect(next).toBe(state);
  });

  it("redo on empty stack returns same state", () => {
    const state = { ...initialState };
    const next = canvasReducer(state, { type: "redo" });
    expect(next).toBe(state);
  });

  it("stroke_end with empty diff returns same state", () => {
    const state = { ...initialState };
    const next = canvasReducer(state, {
      type: "stroke_end",
      finalLevelData: state.canvasData.levelData,
      diff: { indices: new Uint32Array(0), oldValues: new Uint8Array(0), newValues: new Uint8Array(0) },
    });
    expect(next).toBe(state);
  });
});
