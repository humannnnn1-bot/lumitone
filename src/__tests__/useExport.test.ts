// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useExport } from "../hooks/useExport";
import type { CanvasData } from "../types";

/* ── Mock renderBuf ─────────────────────────────────────────── */
vi.mock("../render-buf", () => ({
  renderBuf: vi.fn(),
}));
import { renderBuf } from "../render-buf";
const mockRenderBuf = vi.mocked(renderBuf);

/* ── Helpers ────────────────────────────────────────────────── */
function makeCvs(w = 4, h = 4): CanvasData {
  return {
    w,
    h,
    data: new Uint8Array(w * h),
    colorMap: new Uint8Array(w * h),
  };
}

const noopT = (key: string) => key;
const mockShowToast = vi.fn();

function setup(cvs?: CanvasData, colorLUT?: [number, number, number][]) {
  return renderHook(() => useExport(cvs ?? makeCvs(), colorLUT ?? [[0, 0, 0]], mockShowToast, noopT as import("../i18n").TranslationFn));
}

/* ── Tests ──────────────────────────────────────────────────── */
describe("useExport", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockShowToast.mockClear();
    mockRenderBuf.mockClear();
  });

  /* ---------- saveColor ---------- */

  describe("saveColor", () => {
    it("falls back to renderBuf when canvas ref is null", () => {
      const { result } = setup();
      const ref = { current: null } as React.RefObject<HTMLCanvasElement | null>;
      // Should not throw; falls back to off-screen render via renderBuf
      vi.spyOn(document.body, "appendChild").mockReturnValue(null as unknown as Node);
      vi.spyOn(document.body, "removeChild").mockReturnValue(null as unknown as Node);
      result.current.saveColor(ref, "test.png");
      expect(mockRenderBuf).toHaveBeenCalledTimes(1);
    });

    it("calls canvas.toDataURL with image/png", () => {
      const { result } = setup();
      const mockToDataURL = vi.fn().mockReturnValue("data:image/png;base64,abc123");
      const fakeCanvas = { toDataURL: mockToDataURL } as unknown as HTMLCanvasElement;
      const ref = { current: fakeCanvas } as React.RefObject<HTMLCanvasElement | null>;

      // Mock anchor element
      const mockAnchor = { href: "", download: "", click: vi.fn() } as unknown as HTMLAnchorElement;
      vi.spyOn(document, "createElement").mockReturnValue(mockAnchor as unknown as HTMLElement);
      vi.spyOn(document.body, "appendChild").mockReturnValue(mockAnchor as unknown as Node);
      vi.spyOn(document.body, "removeChild").mockReturnValue(mockAnchor as unknown as Node);

      result.current.saveColor(ref, "test.png");

      expect(mockToDataURL).toHaveBeenCalledWith("image/png");
    });

    it("shows error toast if toDataURL returns empty string", () => {
      const { result } = setup();
      const fakeCanvas = { toDataURL: vi.fn().mockReturnValue("") } as unknown as HTMLCanvasElement;
      const ref = { current: fakeCanvas } as React.RefObject<HTMLCanvasElement | null>;

      result.current.saveColor(ref, "test.png");

      expect(mockShowToast).toHaveBeenCalledWith("toast_image_gen_failed", "error");
    });

    it("shows error toast if toDataURL returns 'data:,'", () => {
      const { result } = setup();
      const fakeCanvas = { toDataURL: vi.fn().mockReturnValue("data:,") } as unknown as HTMLCanvasElement;
      const ref = { current: fakeCanvas } as React.RefObject<HTMLCanvasElement | null>;

      result.current.saveColor(ref, "test.png");

      expect(mockShowToast).toHaveBeenCalledWith("toast_image_gen_failed", "error");
    });

    it("creates anchor, sets href/download, clicks, and removes from DOM", () => {
      const { result } = setup();
      const dataUrl = "data:image/png;base64,abc123";
      const fakeCanvas = { toDataURL: vi.fn().mockReturnValue(dataUrl) } as unknown as HTMLCanvasElement;
      const ref = { current: fakeCanvas } as React.RefObject<HTMLCanvasElement | null>;

      const mockAnchor = { href: "", download: "", click: vi.fn() } as unknown as HTMLAnchorElement;
      const spyCreate = vi.spyOn(document, "createElement").mockReturnValue(mockAnchor as unknown as HTMLElement);
      const spyAppend = vi.spyOn(document.body, "appendChild").mockReturnValue(mockAnchor as unknown as Node);
      const spyRemove = vi.spyOn(document.body, "removeChild").mockReturnValue(mockAnchor as unknown as Node);

      result.current.saveColor(ref, "my-art.png");

      expect(spyCreate).toHaveBeenCalledWith("a");
      expect(mockAnchor.href).toBe(dataUrl);
      expect(mockAnchor.download).toBe("my-art.png");
      expect(spyAppend).toHaveBeenCalledWith(mockAnchor);
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(spyRemove).toHaveBeenCalledWith(mockAnchor);
    });
  });

  /* ---------- saveGlaze ---------- */

  describe("saveGlaze", () => {
    it("creates a temp canvas with correct dimensions", () => {
      const cvs = makeCvs(16, 12);
      const { result } = setup(cvs);

      // saveGlaze creates a canvas internally then calls saveColor which creates an anchor
      vi.spyOn(document.body, "appendChild").mockReturnValue(null as unknown as Node);
      vi.spyOn(document.body, "removeChild").mockReturnValue(null as unknown as Node);

      result.current.saveGlaze("glaze.png");

      // renderBuf is called with the correct dimensions
      expect(mockRenderBuf).toHaveBeenCalledTimes(1);
      const args = mockRenderBuf.mock.calls[0];
      expect(args[1]).toBe(16); // w
      expect(args[2]).toBe(12); // h
    });

    it("calls renderBuf then saveColor", () => {
      const cvs = makeCvs(8, 8);
      const colorLUT: [number, number, number][] = [[255, 0, 0]];
      const { result } = setup(cvs, colorLUT);

      vi.spyOn(document.body, "appendChild").mockReturnValue(null as unknown as Node);
      vi.spyOn(document.body, "removeChild").mockReturnValue(null as unknown as Node);

      result.current.saveGlaze("glaze-export.png");

      expect(mockRenderBuf).toHaveBeenCalledTimes(1);
      const args = mockRenderBuf.mock.calls[0];
      expect(args[0]).toBe(cvs.data); // data
      expect(args[1]).toBe(8); // w
      expect(args[2]).toBe(8); // h
      expect(args[3]).toBe(colorLUT); // lut
      expect(args[4]).toBeNull(); // srcCanvas
      expect(args[5]).toBeInstanceOf(HTMLCanvasElement); // prvCanvas
      expect(args[6]).toEqual({ src: null, prv: null, s32: null, p32: null }); // imgCache
    });
  });
});
