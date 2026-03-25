import { describe, it, expect } from "vitest";
import { paintCircle, paintLine, paintRect, paintEllipse } from "../paint";

function mkBuf(w: number, h: number): Uint8Array {
  return new Uint8Array(w * h);
}

function count(buf: Uint8Array, val: number): number {
  let c = 0;
  for (let i = 0; i < buf.length; i++) if (buf[i] === val) c++;
  return c;
}

describe("paintCircle", () => {
  it("r=0 paints single pixel", () => {
    const buf = mkBuf(10, 10);
    paintCircle(buf, 5, 5, 0, 3, 10, 10);
    expect(count(buf, 3)).toBe(1);
    expect(buf[5 * 10 + 5]).toBe(3);
  });

  it("does not paint outside bounds", () => {
    const buf = mkBuf(10, 10);
    paintCircle(buf, 0, 0, 5, 1, 10, 10);
    for (let i = 0; i < buf.length; i++) {
      const x = i % 10, y = Math.floor(i / 10);
      if (buf[i] === 1) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("r=0 at out-of-bounds position does nothing", () => {
    const buf = mkBuf(10, 10);
    paintCircle(buf, -1, -1, 0, 1, 10, 10);
    expect(count(buf, 1)).toBe(0);
  });

  it("paints a filled circle", () => {
    const buf = mkBuf(20, 20);
    paintCircle(buf, 10, 10, 3, 5, 20, 20);
    expect(count(buf, 5)).toBeGreaterThan(0);
    // Check symmetry
    expect(buf[10 * 20 + 7]).toBe(buf[10 * 20 + 13]); // horizontal
    expect(buf[7 * 20 + 10]).toBe(buf[13 * 20 + 10]); // vertical
  });

  it("clips circle partially outside canvas", () => {
    const buf = mkBuf(10, 10);
    paintCircle(buf, 0, 0, 3, 2, 10, 10);
    const painted = count(buf, 2);
    expect(painted).toBeGreaterThan(0);
    expect(painted).toBeLessThan(Math.PI * 3 * 3 + 4); // less than full circle area
  });

  it("large radius clips to canvas bounds", () => {
    const buf = mkBuf(5, 5);
    paintCircle(buf, 2, 2, 100, 1, 5, 5);
    expect(count(buf, 1)).toBe(25); // fills entire canvas
  });
});

describe("paintLine", () => {
  it("horizontal line", () => {
    const buf = mkBuf(10, 10);
    paintLine(buf, 0, 5, 9, 5, 0, 1, 10, 10);
    for (let x = 0; x < 10; x++) expect(buf[5 * 10 + x]).toBe(1);
  });

  it("vertical line", () => {
    const buf = mkBuf(10, 10);
    paintLine(buf, 5, 0, 5, 9, 0, 2, 10, 10);
    for (let y = 0; y < 10; y++) expect(buf[y * 10 + 5]).toBe(2);
  });

  it("diagonal line covers start and end", () => {
    const buf = mkBuf(10, 10);
    paintLine(buf, 0, 0, 9, 9, 0, 3, 10, 10);
    expect(buf[0]).toBe(3);
    expect(buf[9 * 10 + 9]).toBe(3);
  });

  it("single point line", () => {
    const buf = mkBuf(5, 5);
    paintLine(buf, 2, 2, 2, 2, 0, 4, 5, 5);
    expect(buf[2 * 5 + 2]).toBe(4);
    expect(count(buf, 4)).toBe(1);
  });

  it("partially out-of-bounds line clips properly", () => {
    const buf = mkBuf(10, 10);
    paintLine(buf, -5, 5, 15, 5, 0, 1, 10, 10);
    // Horizontal line at y=5 should paint all x from 0 to 9
    for (let x = 0; x < 10; x++) expect(buf[5 * 10 + x]).toBe(1);
    // No out-of-bounds writes (buffer unchanged beyond valid area)
    expect(count(buf, 1)).toBe(10);
  });
});

describe("paintRect", () => {
  it("draws four sides", () => {
    const buf = mkBuf(10, 10);
    paintRect(buf, 2, 2, 7, 7, 0, 1, 10, 10);
    // Top edge
    for (let x = 2; x <= 7; x++) expect(buf[2 * 10 + x]).toBe(1);
    // Bottom edge
    for (let x = 2; x <= 7; x++) expect(buf[7 * 10 + x]).toBe(1);
    // Left edge
    for (let y = 2; y <= 7; y++) expect(buf[y * 10 + 2]).toBe(1);
    // Right edge
    for (let y = 2; y <= 7; y++) expect(buf[y * 10 + 7]).toBe(1);
    // Interior should be empty
    expect(buf[4 * 10 + 4]).toBe(0);
  });

  it("reversed coordinates still draw correctly", () => {
    const buf = mkBuf(10, 10);
    paintRect(buf, 7, 7, 2, 2, 0, 1, 10, 10);
    for (let x = 2; x <= 7; x++) expect(buf[2 * 10 + x]).toBe(1);
    for (let x = 2; x <= 7; x++) expect(buf[7 * 10 + x]).toBe(1);
  });
});

describe("paintEllipse", () => {
  it("degenerate rx=0 ry=0 paints like circle at center", () => {
    const buf = mkBuf(10, 10);
    paintEllipse(buf, 5, 5, 5, 5, 0, 1, 10, 10);
    expect(buf[5 * 10 + 5]).toBe(1);
  });

  it("degenerate rx=0 paints vertical line", () => {
    const buf = mkBuf(10, 10);
    paintEllipse(buf, 5, 2, 5, 8, 0, 2, 10, 10);
    expect(buf[2 * 10 + 5]).toBe(2);
    expect(buf[8 * 10 + 5]).toBe(2);
  });

  it("degenerate ry=0 paints horizontal line", () => {
    const buf = mkBuf(10, 10);
    paintEllipse(buf, 2, 5, 8, 5, 0, 3, 10, 10);
    expect(buf[5 * 10 + 2]).toBe(3);
    expect(buf[5 * 10 + 8]).toBe(3);
  });

  it("normal ellipse has 4-way symmetry", () => {
    const buf = mkBuf(30, 30);
    paintEllipse(buf, 5, 10, 25, 20, 0, 1, 30, 30);
    const cx = 15, cy = 15;
    // Check that painted pixels exist in all 4 quadrants
    let q1 = false, q2 = false, q3 = false, q4 = false;
    for (let y = 0; y < 30; y++) {
      for (let x = 0; x < 30; x++) {
        if (buf[y * 30 + x] === 1) {
          if (x > cx && y < cy) q1 = true;
          if (x < cx && y < cy) q2 = true;
          if (x < cx && y > cy) q3 = true;
          if (x > cx && y > cy) q4 = true;
        }
      }
    }
    expect(q1 && q2 && q3 && q4).toBe(true);
  });
});

describe("edge cases", () => {
  it("paintCircle does not crash with NaN center", () => {
    const buf = mkBuf(10, 10);
    expect(() => paintCircle(buf, NaN, NaN, 3, 1, 10, 10)).not.toThrow();
  });

  it("paintCircle does not crash with negative coordinates", () => {
    const buf = mkBuf(10, 10);
    expect(() => paintCircle(buf, -5, -5, 3, 1, 10, 10)).not.toThrow();
  });

  it("paintLine does not crash with zero-length line", () => {
    const buf = mkBuf(10, 10);
    expect(() => paintLine(buf, 5, 5, 5, 5, 2, 1, 10, 10)).not.toThrow();
  });

  it("paintRect does not crash with zero-area rect", () => {
    const buf = mkBuf(10, 10);
    expect(() => paintRect(buf, 5, 5, 5, 5, 0, 1, 10, 10)).not.toThrow();
  });
});
