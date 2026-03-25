import { describe, it, expect, beforeEach } from "vitest";
import { GRAY_VALUES, renderBuf } from "../render-buf";
import { LEVEL_INFO, buildColorLUT, DEFAULT_CC } from "../color-engine";
import type { ImgCache } from "../types";


describe("GRAY_VALUES", () => {
  it("has 8 entries", () => {
    expect(GRAY_VALUES.length).toBe(8);
  });

  it("matches LEVEL_INFO gray values", () => {
    for (let i = 0; i < 8; i++) {
      expect(GRAY_VALUES[i]).toBe(LEVEL_INFO[i].gray);
    }
  });

  it("level 0 is 0 (black)", () => {
    expect(GRAY_VALUES[0]).toBe(0);
  });

  it("level 7 is 255 (white)", () => {
    expect(GRAY_VALUES[7]).toBe(255);
  });

  it("values are monotonically non-decreasing", () => {
    for (let i = 1; i < 8; i++) {
      expect(GRAY_VALUES[i]).toBeGreaterThanOrEqual(GRAY_VALUES[i - 1]);
    }
  });
});

/* ─── Helpers ─── */

/** Build ABGR pixel as unsigned 32-bit (matches Uint32Array storage). */
function rgba32(r: number, g: number, b: number): number {
  return (0xFF000000 | (b << 16) | (g << 8) | r) >>> 0;
}

function gray32(g: number): number {
  return (0xFF000000 | (g << 16) | (g << 8) | g) >>> 0;
}

/* ─── Minimal HTMLCanvasElement / CanvasRenderingContext2D stubs ─── */

function createStubCanvas(w: number, h: number) {
  const imgData = new ImageData(w, h);
  const ctx = {
    createImageData: (iw: number, ih: number) => new ImageData(iw, ih),
    putImageData: () => {},
  } as unknown as CanvasRenderingContext2D;

  const canvas = {
    width: w,
    height: h,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;

  return { canvas, ctx, imgData };
}

describe("renderBuf", () => {
  let lut: [number, number, number][];

  beforeEach(() => {
    lut = buildColorLUT(DEFAULT_CC);
  });

  it("returns early when both canvases are null", () => {
    const data = new Uint8Array(4);
    const cache: ImgCache = { src: null, prv: null, s32: null, p32: null };
    expect(() => renderBuf(data, 2, 2, lut, null, null, cache)).not.toThrow();
    // Cache should remain null — nothing was created
    expect(cache.src).toBeNull();
    expect(cache.prv).toBeNull();
  });

  it("creates ImageData cache on first call", () => {
    const w = 4, h = 4;
    const data = new Uint8Array(w * h); // all zeros (level 0)
    const { canvas: srcCanvas } = createStubCanvas(w, h);
    const cache: ImgCache = { src: null, prv: null, s32: null, p32: null };

    renderBuf(data, w, h, lut, srcCanvas, null, cache);

    expect(cache.src).not.toBeNull();
    expect(cache.src!.width).toBe(w);
    expect(cache.src!.height).toBe(h);
  });

  it("recreates ImageData when canvas size changes", () => {
    const { canvas: srcCanvas } = createStubCanvas(4, 4);
    const cache: ImgCache = { src: null, prv: null, s32: null, p32: null };
    const data4 = new Uint8Array(16);

    renderBuf(data4, 4, 4, lut, srcCanvas, null, cache);
    const firstSrc = cache.src;
    expect(firstSrc).not.toBeNull();

    // Now render with different dimensions
    const data8 = new Uint8Array(64);
    renderBuf(data8, 8, 8, lut, srcCanvas, null, cache);
    expect(cache.src).not.toBe(firstSrc);
    expect(cache.src!.width).toBe(8);
  });

  it("writes correct gray values for level 0 (black)", () => {
    const w = 2, h = 2;
    const data = new Uint8Array(w * h); // all level 0
    const { canvas: srcCanvas } = createStubCanvas(w, h);
    const cache: ImgCache = { src: null, prv: null, s32: null, p32: null };

    renderBuf(data, w, h, lut, srcCanvas, null, cache);

    const s32 = new Uint32Array(cache.src!.data.buffer);
    const expectedPixel = gray32(GRAY_VALUES[0]);
    for (let i = 0; i < w * h; i++) {
      expect(s32[i]).toBe(expectedPixel);
    }
  });

  it("writes correct gray values for level 7 (white)", () => {
    const w = 2, h = 2;
    const data = new Uint8Array(w * h).fill(7);
    const { canvas: srcCanvas } = createStubCanvas(w, h);
    const cache: ImgCache = { src: null, prv: null, s32: null, p32: null };

    renderBuf(data, w, h, lut, srcCanvas, null, cache);

    const s32 = new Uint32Array(cache.src!.data.buffer);
    const expectedPixel = gray32(GRAY_VALUES[7]);
    for (let i = 0; i < w * h; i++) {
      expect(s32[i]).toBe(expectedPixel);
    }
  });

  it("applies color LUT correctly to preview canvas", () => {
    const w = 2, h = 2;
    const data = new Uint8Array(w * h).fill(2); // level 2 = Red
    const { canvas: prvCanvas } = createStubCanvas(w, h);
    const cache: ImgCache = { src: null, prv: null, s32: null, p32: null };

    renderBuf(data, w, h, lut, null, prvCanvas, cache);

    const p32 = new Uint32Array(cache.prv!.data.buffer);
    const rgb = lut[2];
    const expectedPixel = rgba32(rgb[0], rgb[1], rgb[2]);
    for (let i = 0; i < w * h; i++) {
      expect(p32[i]).toBe(expectedPixel);
    }
  });

  it("masks pixel data to 3 bits (LEVEL_MASK)", () => {
    const w = 2, h = 2;
    // Value 15 = 0b1111, should be masked to 7 = 0b0111
    const data = new Uint8Array(w * h).fill(15);
    const { canvas: srcCanvas } = createStubCanvas(w, h);
    const cache: ImgCache = { src: null, prv: null, s32: null, p32: null };

    renderBuf(data, w, h, lut, srcCanvas, null, cache);

    const s32 = new Uint32Array(cache.src!.data.buffer);
    const expectedPixel = gray32(GRAY_VALUES[7]);
    for (let i = 0; i < w * h; i++) {
      expect(s32[i]).toBe(expectedPixel);
    }
  });

  it("handles mixed levels correctly", () => {
    const w = 4, h = 1;
    const data = new Uint8Array([0, 3, 5, 7]);
    const { canvas: srcCanvas } = createStubCanvas(w, h);
    const cache: ImgCache = { src: null, prv: null, s32: null, p32: null };

    renderBuf(data, w, h, lut, srcCanvas, null, cache);

    const s32 = new Uint32Array(cache.src!.data.buffer);
    for (let i = 0; i < 4; i++) {
      expect(s32[i]).toBe(gray32(GRAY_VALUES[data[i]]));
    }
  });

  describe("dirty rect rendering", () => {
    it("only updates pixels within dirty rect bounds", () => {
      const w = 4, h = 4;
      const data = new Uint8Array(w * h).fill(7); // all white

      const { canvas: srcCanvas } = createStubCanvas(w, h);
      const cache: ImgCache = { src: null, prv: null, s32: null, p32: null };

      // First render: full canvas at level 0
      const data0 = new Uint8Array(w * h).fill(0);
      renderBuf(data0, w, h, lut, srcCanvas, null, cache);

      // Second render: all level 7 but only dirty rect at (1,1,2,2)
      renderBuf(data, w, h, lut, srcCanvas, null, cache, { x: 1, y: 1, w: 2, h: 2 });

      const s32 = new Uint32Array(cache.src!.data.buffer);
      const white = gray32(GRAY_VALUES[7]);
      const black = gray32(GRAY_VALUES[0]);

      // Inside dirty rect: updated to white
      expect(s32[1 * w + 1]).toBe(white);
      expect(s32[1 * w + 2]).toBe(white);
      expect(s32[2 * w + 1]).toBe(white);
      expect(s32[2 * w + 2]).toBe(white);

      // Outside dirty rect: still black (from first render)
      expect(s32[0]).toBe(black);
      expect(s32[3]).toBe(black);
      expect(s32[3 * w + 3]).toBe(black);
    });

    it("clamps dirty rect to canvas bounds", () => {
      const w = 4, h = 4;
      const data = new Uint8Array(w * h).fill(3);
      const { canvas: srcCanvas } = createStubCanvas(w, h);
      const cache: ImgCache = { src: null, prv: null, s32: null, p32: null };

      // Dirty rect extends beyond canvas
      expect(() => {
        renderBuf(data, w, h, lut, srcCanvas, null, cache, { x: -1, y: -1, w: 10, h: 10 });
      }).not.toThrow();
    });

    it("skips rendering when dirty rect has zero area", () => {
      const w = 4, h = 4;
      const data = new Uint8Array(w * h).fill(5);
      const { canvas: srcCanvas } = createStubCanvas(w, h);
      const cache: ImgCache = { src: null, prv: null, s32: null, p32: null };

      // First render full
      renderBuf(data.fill(0), w, h, lut, srcCanvas, null, cache);
      const s32Before = new Uint32Array(cache.src!.data.buffer.slice(0));

      // Dirty rect with zero width — should not update
      renderBuf(data.fill(7), w, h, lut, srcCanvas, null, cache, { x: 5, y: 5, w: 1, h: 1 });
      const s32After = new Uint32Array(cache.src!.data.buffer);

      // Should remain unchanged
      expect(Array.from(s32After)).toEqual(Array.from(s32Before));
    });
  });

  it("renders to both src and prv canvases simultaneously", () => {
    const w = 2, h = 2;
    const data = new Uint8Array(w * h).fill(4); // level 4 = Green
    const { canvas: srcCanvas } = createStubCanvas(w, h);
    const { canvas: prvCanvas } = createStubCanvas(w, h);
    const cache: ImgCache = { src: null, prv: null, s32: null, p32: null };

    renderBuf(data, w, h, lut, srcCanvas, prvCanvas, cache);

    // src should have gray values
    expect(cache.src).not.toBeNull();
    const s32 = new Uint32Array(cache.src!.data.buffer);
    const g = GRAY_VALUES[4];
    expect(s32[0]).toBe(gray32(g));

    // prv should have color values
    expect(cache.prv).not.toBeNull();
    const p32 = new Uint32Array(cache.prv!.data.buffer);
    const rgb = lut[4];
    expect(p32[0]).toBe(rgba32(rgb[0], rgb[1], rgb[2]));
  });

  it("handles data shorter than w*h gracefully", () => {
    const w = 4, h = 4;
    const data = new Uint8Array(8); // only 8 pixels for 16-pixel canvas
    const { canvas: srcCanvas } = createStubCanvas(w, h);
    const cache: ImgCache = { src: null, prv: null, s32: null, p32: null };

    // Should not throw — renders min(w*h, data.length) pixels
    expect(() => renderBuf(data, w, h, lut, srcCanvas, null, cache)).not.toThrow();
  });
});
