import { describe, it, expect, vi } from "vitest";
import {
  canvasPos,
  canvasPosUnclamped,
  isCanvasPointInBounds,
  trySetPointerCapture,
  tryStartPan,
  canvasPosFromRefs,
  updateStatusBase,
} from "../useDrawingBase";
import type { CanvasData } from "../../types";

/* ── Helpers ────────────────────────────────────────────────── */
function makeCvs(w = 16, h = 16): CanvasData {
  return { width: w, height: h, levelData: new Uint8Array(w * h), pixelCandidateOverrideMap: new Uint8Array(w * h) };
}

function makeRect(left: number, top: number, width: number, height: number) {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) };
}

function makeFakeCanvas(rect: ReturnType<typeof makeRect>) {
  return { getBoundingClientRect: () => rect } as unknown as HTMLCanvasElement;
}

/* ── canvasPos ──────────────────────────────────────────────── */
describe("canvasPos", () => {
  it("returns {x: 0, y: 0} if refEl is null", () => {
    const pos = canvasPos({ clientX: 50, clientY: 50 }, null, 1, { x: 0, y: 0 }, makeCvs());
    expect(pos).toEqual({ x: 0, y: 0 });
  });

  it("returns {x: -1, y: -1} if bounding rect has zero width", () => {
    const el = makeFakeCanvas(makeRect(0, 0, 0, 0));
    const pos = canvasPos({ clientX: 0, clientY: 0 }, el, 1, { x: 0, y: 0 }, makeCvs());
    expect(pos).toEqual({ x: -1, y: -1 });
  });

  it("returns {x: -1, y: -1} if bounding rect has zero height", () => {
    const el = makeFakeCanvas(makeRect(0, 0, 100, 0));
    const pos = canvasPos({ clientX: 50, clientY: 0 }, el, 1, { x: 0, y: 0 }, makeCvs());
    expect(pos).toEqual({ x: -1, y: -1 });
  });

  it("maps center of canvas element to center of canvas data at zoom=1, pan=0", () => {
    const canvasData = makeCvs(16, 16);
    const el = makeFakeCanvas(makeRect(0, 0, 160, 160));
    // Click at center of the element: clientX=80, clientY=80
    const pos = canvasPos({ clientX: 80, clientY: 80 }, el, 1, { x: 0, y: 0 }, canvasData);
    expect(pos.x).toBe(8);
    expect(pos.y).toBe(8);
  });

  it("maps top-left corner of element to (0, 0) at zoom=1, pan=0", () => {
    const canvasData = makeCvs(16, 16);
    const el = makeFakeCanvas(makeRect(0, 0, 160, 160));
    const pos = canvasPos({ clientX: 0, clientY: 0 }, el, 1, { x: 0, y: 0 }, canvasData);
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(0);
  });

  it("clamps coordinates to canvas bounds", () => {
    const canvasData = makeCvs(10, 10);
    const el = makeFakeCanvas(makeRect(0, 0, 100, 100));
    // Click well outside the canvas on the right/bottom
    const pos = canvasPos({ clientX: 200, clientY: 200 }, el, 1, { x: 0, y: 0 }, canvasData);
    expect(pos.x).toBe(9); // w - 1
    expect(pos.y).toBe(9); // h - 1
  });

  it("clamps negative coordinates to 0", () => {
    const canvasData = makeCvs(10, 10);
    const el = makeFakeCanvas(makeRect(100, 100, 100, 100));
    // Click well before the element
    const pos = canvasPos({ clientX: 0, clientY: 0 }, el, 1, { x: 0, y: 0 }, canvasData);
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(0);
  });

  it("can return unclamped coordinates outside the canvas", () => {
    const canvasData = makeCvs(10, 10);
    const el = makeFakeCanvas(makeRect(0, 0, 100, 100));
    const pos = canvasPosUnclamped({ clientX: 200, clientY: -20 }, el, 1, { x: 0, y: 0 }, canvasData);
    expect(pos.x).toBe(20);
    expect(pos.y).toBe(-2);
    expect(isCanvasPointInBounds(pos, canvasData)).toBe(false);
  });

  it("accounts for pan offset", () => {
    const canvasData = makeCvs(16, 16);
    const el = makeFakeCanvas(makeRect(0, 0, 160, 160));
    // Pan shifts the viewport; clicking center with pan should shift result
    const posNoPan = canvasPos({ clientX: 80, clientY: 80 }, el, 1, { x: 0, y: 0 }, canvasData);
    const posPanned = canvasPos({ clientX: 80, clientY: 80 }, el, 1, { x: 4, y: 4 }, canvasData);
    // Panning by +4 should move the apparent position to the left/up
    expect(posPanned.x).toBeLessThan(posNoPan.x);
    expect(posPanned.y).toBeLessThan(posNoPan.y);
  });

  it("accounts for zoom level", () => {
    const canvasData = makeCvs(16, 16);
    const el = makeFakeCanvas(makeRect(0, 0, 160, 160));
    // At zoom=2, clicking the center should still map to center
    const pos = canvasPos({ clientX: 80, clientY: 80 }, el, 2, { x: 0, y: 0 }, canvasData);
    expect(pos.x).toBe(8);
    expect(pos.y).toBe(8);
  });

  it("handles non-square canvas", () => {
    const canvasData = makeCvs(32, 8);
    const el = makeFakeCanvas(makeRect(0, 0, 320, 80));
    const pos = canvasPos({ clientX: 160, clientY: 40 }, el, 1, { x: 0, y: 0 }, canvasData);
    expect(pos.x).toBe(16);
    expect(pos.y).toBe(4);
  });
});

/* ── trySetPointerCapture ───────────────────────────────────── */
describe("trySetPointerCapture", () => {
  it("calls setPointerCapture when method exists", () => {
    const mockSetCapture = vi.fn();
    const event = {
      target: { setPointerCapture: mockSetCapture },
      pointerId: 42,
    } as unknown as React.PointerEvent;

    trySetPointerCapture(event);

    expect(mockSetCapture).toHaveBeenCalledWith(42);
  });

  it("does not throw when setPointerCapture is missing", () => {
    const event = {
      target: {},
      pointerId: 1,
    } as unknown as React.PointerEvent;

    expect(() => trySetPointerCapture(event)).not.toThrow();
  });

  it("does not throw when setPointerCapture throws", () => {
    const event = {
      target: {
        setPointerCapture: () => {
          throw new Error("browser inconsistency");
        },
      },
      pointerId: 1,
    } as unknown as React.PointerEvent;

    expect(() => trySetPointerCapture(event)).not.toThrow();
  });
});

/* ── tryStartPan ────────────────────────────────────────────── */
describe("tryStartPan", () => {
  it("returns true and calls startPan for middle mouse button (button=1)", () => {
    const startPan = vi.fn();
    const spaceRef = { current: false };
    const startPanRef = { current: startPan };
    const event = { button: 1 } as React.PointerEvent;

    const result = tryStartPan(event, spaceRef, startPanRef);

    expect(result).toBe(true);
    expect(startPan).toHaveBeenCalledWith(event);
  });

  it("returns true and calls startPan when space key is held", () => {
    const startPan = vi.fn();
    const spaceRef = { current: true };
    const startPanRef = { current: startPan };
    const event = { button: 0 } as React.PointerEvent;

    const result = tryStartPan(event, spaceRef, startPanRef);

    expect(result).toBe(true);
    expect(startPan).toHaveBeenCalledWith(event);
  });

  it("returns false when not middle button and space is not held", () => {
    const startPan = vi.fn();
    const spaceRef = { current: false };
    const startPanRef = { current: startPan };
    const event = { button: 0 } as React.PointerEvent;

    const result = tryStartPan(event, spaceRef, startPanRef);

    expect(result).toBe(false);
    expect(startPan).not.toHaveBeenCalled();
  });

  it("returns false for right-click (button=2) without space", () => {
    const startPan = vi.fn();
    const spaceRef = { current: false };
    const startPanRef = { current: startPan };
    const event = { button: 2 } as React.PointerEvent;

    const result = tryStartPan(event, spaceRef, startPanRef);

    expect(result).toBe(false);
    expect(startPan).not.toHaveBeenCalled();
  });
});

/* ── canvasPosFromRefs ───────────────────────────────────────────── */
describe("canvasPosFromRefs", () => {
  it("delegates to canvasPos with values from refs", () => {
    const canvasData = makeCvs(16, 16);
    const refs = {
      zoomRef: { current: 2 },
      panRef: { current: { x: 3, y: 5 } },
      canvasDataRef: { current: canvasData },
    };
    const el = makeFakeCanvas(makeRect(0, 0, 160, 160));
    const event = { clientX: 80, clientY: 80 } as React.PointerEvent;

    const pos = canvasPosFromRefs(event, el, refs);

    // Should match calling canvasPos directly with same args
    const expected = canvasPos(event, el, 2, { x: 3, y: 5 }, canvasData);
    expect(pos).toEqual(expected);
  });

  it("returns {x: 0, y: 0} when refEl is null", () => {
    const refs = {
      zoomRef: { current: 1 },
      panRef: { current: { x: 0, y: 0 } },
      canvasDataRef: { current: makeCvs() },
    };
    const event = { clientX: 50, clientY: 50 } as React.PointerEvent;

    const pos = canvasPosFromRefs(event, null, refs);
    expect(pos).toEqual({ x: 0, y: 0 });
  });
});

/* ── updateStatusBase ───────────────────────────────────────── */
describe("updateStatusBase", () => {
  it("clears the status when pointer capture sends an outside coordinate", () => {
    const canvasData = makeCvs(10, 10);
    const refs = {
      zoomRef: { current: 1 },
      panRef: { current: { x: 0, y: 0 } },
      canvasDataRef: { current: canvasData },
    };
    const el = makeFakeCanvas(makeRect(0, 0, 100, 100));
    const statusEl = { textContent: "", title: "inside" } as HTMLDivElement;
    const formatText = vi.fn(() => "inside");

    updateStatusBase({ clientX: 120, clientY: 50 } as React.PointerEvent, statusEl, el, refs, canvasData.levelData, formatText);

    expect(statusEl.textContent).toBe("\u2014");
    expect(statusEl.title).toBe("");
    expect(formatText).not.toHaveBeenCalled();
  });

  it("mirrors visible status text into the title for truncated rows", () => {
    const canvasData = makeCvs(10, 10);
    canvasData.levelData[55] = 3;
    const refs = {
      zoomRef: { current: 1 },
      panRef: { current: { x: 0, y: 0 } },
      canvasDataRef: { current: canvasData },
    };
    const el = makeFakeCanvas(makeRect(0, 0, 100, 100));
    const statusEl = { textContent: "", title: "" } as HTMLDivElement;
    const formatText = vi.fn(() => "long status text");

    updateStatusBase({ clientX: 55, clientY: 55 } as React.PointerEvent, statusEl, el, refs, canvasData.levelData, formatText);

    expect(statusEl.textContent).toBe("long status text");
    expect(statusEl.title).toBe("long status text");
  });
});
