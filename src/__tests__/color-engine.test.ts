import { describe, it, expect } from "vitest";
import {
  lum, LUMA_R, LUMA_G, LUMA_B,
  hue2rgb, rgb2hue,
  GRAY_LUT, LEVEL_INFO, LEVEL_CANDIDATES,
  buildColorLUT, DEFAULT_CC,
} from "../color-engine";

describe("lum", () => {
  it("black = 0", () => {
    expect(lum(0, 0, 0)).toBe(0);
  });

  it("white = 255", () => {
    expect(lum(255, 255, 255)).toBe(255);
  });

  it("pure red ~76.245", () => {
    expect(lum(255, 0, 0)).toBeCloseTo(255 * LUMA_R, 1);
  });

  it("pure green ~149.685", () => {
    expect(lum(0, 255, 0)).toBeCloseTo(255 * LUMA_G, 1);
  });

  it("pure blue ~29.07", () => {
    expect(lum(0, 0, 255)).toBeCloseTo(255 * LUMA_B, 1);
  });
});

describe("hue2rgb / rgb2hue roundtrip", () => {
  const testAngles = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

  testAngles.forEach(h => {
    it(`roundtrip at ${h}°`, () => {
      const rgb = hue2rgb(h);
      expect(rgb.length).toBe(3);
      rgb.forEach(v => {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(255);
      });
      const recovered = rgb2hue(...rgb);
      // Allow 1° tolerance due to rounding
      const diff = Math.abs(recovered - h);
      expect(Math.min(diff, 360 - diff)).toBeLessThan(1);
    });
  });

  it("handles negative and >360 angles", () => {
    const a = hue2rgb(-60);
    const b = hue2rgb(300);
    expect(a).toEqual(b);

    const c = hue2rgb(420);
    const d = hue2rgb(60);
    expect(c).toEqual(d);
  });
});

describe("GRAY_LUT", () => {
  it("has 256 entries", () => {
    expect(GRAY_LUT.length).toBe(256);
  });

  it("maps 0 to level 0", () => {
    expect(GRAY_LUT[0]).toBe(0);
  });

  it("maps 255 to level 7", () => {
    expect(GRAY_LUT[255]).toBe(7);
  });

  it("all values are 0-7", () => {
    for (let i = 0; i < 256; i++) {
      expect(GRAY_LUT[i]).toBeGreaterThanOrEqual(0);
      expect(GRAY_LUT[i]).toBeLessThanOrEqual(7);
    }
  });

  it("is monotonically non-decreasing", () => {
    for (let i = 1; i < 256; i++) {
      expect(GRAY_LUT[i]).toBeGreaterThanOrEqual(GRAY_LUT[i - 1]);
    }
  });
});

describe("LEVEL_INFO", () => {
  it("has 8 entries", () => {
    expect(LEVEL_INFO.length).toBe(8);
  });

  it("level 0 is Black with gray 0", () => {
    expect(LEVEL_INFO[0].name).toBe("Black");
    expect(LEVEL_INFO[0].gray).toBe(0);
  });

  it("level 7 is White with gray 255", () => {
    expect(LEVEL_INFO[7].name).toBe("White");
    expect(LEVEL_INFO[7].gray).toBe(255);
  });
});

describe("LEVEL_CANDIDATES", () => {
  it("has 8 levels", () => {
    expect(LEVEL_CANDIDATES.length).toBe(8);
  });

  it("each level has at least 1 candidate", () => {
    LEVEL_CANDIDATES.forEach((alts, _i) => {
      expect(alts.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("level 0 is black [0,0,0]", () => {
    expect(LEVEL_CANDIDATES[0][0].rgb).toEqual([0, 0, 0]);
  });

  it("level 7 is white [255,255,255]", () => {
    expect(LEVEL_CANDIDATES[7][0].rgb).toEqual([255, 255, 255]);
  });

  it("intermediate levels have pure color candidates", () => {
    for (let lv = 1; lv <= 6; lv++) {
      LEVEL_CANDIDATES[lv].forEach(c => {
        // Each candidate should have max=255 and min=0 (pure color)
        expect(Math.max(...c.rgb)).toBe(255);
        expect(Math.min(...c.rgb)).toBe(0);
      });
    }
  });
});

describe("buildColorLUT", () => {
  it("returns 8 RGB tuples with default config", () => {
    const lut = buildColorLUT(DEFAULT_CC);
    expect(lut.length).toBe(8);
    lut.forEach(rgb => {
      expect(rgb.length).toBe(3);
      rgb.forEach(v => {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(255);
      });
    });
  });

  it("level 0 is always black", () => {
    const lut = buildColorLUT(DEFAULT_CC);
    expect(lut[0]).toEqual([0, 0, 0]);
  });

  it("level 7 is always white", () => {
    const lut = buildColorLUT(DEFAULT_CC);
    expect(lut[7]).toEqual([255, 255, 255]);
  });
});
