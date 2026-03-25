import { describe, it, expect } from "vitest";
import { floodFill } from "../flood-fill";

function mkBuf(w: number, h: number, fill = 0): Uint8Array {
  const buf = new Uint8Array(w * h);
  if (fill) buf.fill(fill);
  return buf;
}

describe("floodFill", () => {
  it("returns null for out-of-bounds seed", () => {
    const buf = mkBuf(10, 10);
    expect(floodFill(buf, -1, 0, 1, 10, 10)).toBeNull();
    expect(floodFill(buf, 0, -1, 1, 10, 10)).toBeNull();
    expect(floodFill(buf, 10, 0, 1, 10, 10)).toBeNull();
    expect(floodFill(buf, 0, 10, 1, 10, 10)).toBeNull();
  });

  it("returns null when seed matches target", () => {
    const buf = mkBuf(10, 10, 3);
    expect(floodFill(buf, 5, 5, 3, 10, 10)).toBeNull();
  });

  it("fills entire uniform canvas", () => {
    const buf = mkBuf(5, 5, 0);
    const result = floodFill(buf, 0, 0, 1, 5, 5);
    expect(result).not.toBeNull();
    expect(result!.changed.length).toBe(25);
    expect(result!.truncated).toBe(false);
    for (let i = 0; i < 25; i++) expect(buf[i]).toBe(1);
  });

  it("fills only connected region", () => {
    const buf = mkBuf(5, 5, 0);
    // Create a wall at column 2
    for (let y = 0; y < 5; y++) buf[y * 5 + 2] = 2;
    floodFill(buf, 0, 0, 1, 5, 5);
    // Left side should be filled
    expect(buf[0 * 5 + 0]).toBe(1);
    expect(buf[0 * 5 + 1]).toBe(1);
    // Wall should remain
    expect(buf[0 * 5 + 2]).toBe(2);
    // Right side should NOT be filled
    expect(buf[0 * 5 + 3]).toBe(0);
    expect(buf[0 * 5 + 4]).toBe(0);
  });

  it("returns correct changed indices", () => {
    const buf = mkBuf(3, 3, 0);
    buf[1 * 3 + 1] = 5; // center is different
    const result = floodFill(buf, 0, 0, 7, 3, 3);
    expect(result).not.toBeNull();
    // 8 cells should be changed (all except center)
    expect(result!.changed.length).toBe(8);
    expect(buf[1 * 3 + 1]).toBe(5); // center unchanged
  });

  it("fills from corner seed (0,0)", () => {
    const buf = mkBuf(4, 4, 0);
    const result = floodFill(buf, 0, 0, 2, 4, 4);
    expect(result).not.toBeNull();
    expect(result!.changed.length).toBe(16);
  });

  it("fills from corner seed (w-1, h-1)", () => {
    const buf = mkBuf(4, 4, 0);
    const result = floodFill(buf, 3, 3, 2, 4, 4);
    expect(result).not.toBeNull();
    expect(result!.changed.length).toBe(16);
  });

  it("fills L-shaped region", () => {
    const buf = mkBuf(5, 5, 1);
    // Create L-shape of 0s
    buf[0 * 5 + 0] = 0; buf[1 * 5 + 0] = 0; buf[2 * 5 + 0] = 0;
    buf[2 * 5 + 1] = 0; buf[2 * 5 + 2] = 0;
    const result = floodFill(buf, 0, 0, 3, 5, 5);
    expect(result).not.toBeNull();
    expect(result!.changed.length).toBe(5);
    expect(buf[0]).toBe(3);
    expect(buf[2 * 5 + 2]).toBe(3);
  });

  it("does not cross diagonally (4-connectivity)", () => {
    const buf = mkBuf(3, 3, 1);
    buf[0] = 0;              // (0,0)
    buf[1 * 3 + 1] = 0;      // (1,1) diagonal from (0,0)
    const result = floodFill(buf, 0, 0, 5, 3, 3);
    expect(result).not.toBeNull();
    expect(result!.changed.length).toBe(1); // only (0,0)
    expect(buf[1 * 3 + 1]).toBe(0); // diagonal not filled
  });
});

describe("edge cases", () => {
  it("returns null for 1x1 canvas when seed matches new value", () => {
    const data = new Uint8Array([3]);
    const result = floodFill(data, 0, 0, 3, 1, 1);
    expect(result).toBeNull();
  });

  it("fills entire 1x1 canvas", () => {
    const data = new Uint8Array([0]);
    const result = floodFill(data, 0, 0, 5, 1, 1);
    expect(result).not.toBeNull();
    expect(data[0]).toBe(5);
  });
});
