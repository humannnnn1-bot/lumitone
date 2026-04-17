// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
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

/** Create a fake canvas whose toBlob calls back synchronously. */
function fakeCanvasWithBlob(blob: Blob | null) {
  return {
    toBlob: vi.fn((cb: BlobCallback) => cb(blob)),
  } as unknown as HTMLCanvasElement;
}

/* ── Tests ──────────────────────────────────────────────────── */
describe("useExport", () => {
  const origShare = navigator.share;
  const origCanShare = navigator.canShare;
  const origUA = navigator.userAgent;

  const setUA = (ua: string) => {
    Object.defineProperty(navigator, "userAgent", { value: ua, writable: true, configurable: true });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();
    mockShowToast.mockClear();
    mockRenderBuf.mockClear();
    // Default: no Web Share API
    Object.defineProperty(navigator, "share", { value: undefined, writable: true, configurable: true });
    Object.defineProperty(navigator, "canShare", { value: undefined, writable: true, configurable: true });
    // Default UA = desktop Chrome on Windows
    setUA("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(() => {
    Object.defineProperty(navigator, "share", { value: origShare, writable: true, configurable: true });
    Object.defineProperty(navigator, "canShare", { value: origCanShare, writable: true, configurable: true });
    Object.defineProperty(navigator, "userAgent", { value: origUA, writable: true, configurable: true });
  });

  /* ---------- saveColor ---------- */

  describe("saveColor", () => {
    it("falls back to renderBuf when canvas ref is null", () => {
      const { result } = setup();
      const ref = { current: null } as React.RefObject<HTMLCanvasElement | null>;
      vi.spyOn(document.body, "appendChild").mockReturnValue(null as unknown as Node);
      vi.spyOn(document.body, "removeChild").mockReturnValue(null as unknown as Node);
      result.current.saveColor(ref, "test.png");
      expect(mockRenderBuf).toHaveBeenCalledTimes(1);
    });

    it("calls canvas.toBlob with image/png", () => {
      const { result } = setup();
      const blob = new Blob(["x"], { type: "image/png" });
      const canvas = fakeCanvasWithBlob(blob);
      const ref = { current: canvas } as React.RefObject<HTMLCanvasElement | null>;

      const mockAnchor = { href: "", download: "", click: vi.fn() } as unknown as HTMLAnchorElement;
      vi.spyOn(document, "createElement").mockReturnValue(mockAnchor as unknown as HTMLElement);
      vi.spyOn(document.body, "appendChild").mockReturnValue(mockAnchor as unknown as Node);
      vi.spyOn(document.body, "removeChild").mockReturnValue(mockAnchor as unknown as Node);

      result.current.saveColor(ref, "test.png");

      expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/png");
    });

    it("shows error toast if toBlob returns null", () => {
      const { result } = setup();
      const canvas = fakeCanvasWithBlob(null);
      const ref = { current: canvas } as React.RefObject<HTMLCanvasElement | null>;

      result.current.saveColor(ref, "test.png");

      expect(mockShowToast).toHaveBeenCalledWith("toast_image_gen_failed", "error");
    });

    it("creates anchor download when Web Share API is unavailable", () => {
      const { result } = setup();
      const blob = new Blob(["x"], { type: "image/png" });
      const canvas = fakeCanvasWithBlob(blob);
      const ref = { current: canvas } as React.RefObject<HTMLCanvasElement | null>;

      const fakeUrl = "blob:http://localhost/fake";
      vi.spyOn(URL, "createObjectURL").mockReturnValue(fakeUrl);
      vi.spyOn(URL, "revokeObjectURL").mockReturnValue();

      const mockAnchor = { href: "", download: "", click: vi.fn() } as unknown as HTMLAnchorElement;
      vi.spyOn(document, "createElement").mockReturnValue(mockAnchor as unknown as HTMLElement);
      vi.spyOn(document.body, "appendChild").mockReturnValue(mockAnchor as unknown as Node);
      vi.spyOn(document.body, "removeChild").mockReturnValue(mockAnchor as unknown as Node);

      result.current.saveColor(ref, "my-art.png");

      expect(document.createElement).toHaveBeenCalledWith("a");
      expect(mockAnchor.href).toBe(fakeUrl);
      expect(mockAnchor.download).toBe("my-art.png");
      expect(mockAnchor.click).toHaveBeenCalled();
      // revokeObjectURL is called after a setTimeout delay
      vi.advanceTimersByTime(6000);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(fakeUrl);
    });

    it("uses navigator.share on iOS when available", () => {
      setUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1");
      const mockShare = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "share", { value: mockShare, writable: true, configurable: true });
      Object.defineProperty(navigator, "canShare", { value: () => true, writable: true, configurable: true });

      const { result } = setup();
      const blob = new Blob(["x"], { type: "image/png" });
      const canvas = fakeCanvasWithBlob(blob);
      const ref = { current: canvas } as React.RefObject<HTMLCanvasElement | null>;

      result.current.saveColor(ref, "shared.png");

      expect(mockShare).toHaveBeenCalledTimes(1);
      const arg = mockShare.mock.calls[0][0];
      expect(arg.files).toHaveLength(1);
      expect(arg.files[0].name).toBe("shared.png");
    });

    it("does NOT fall back to anchor download when user cancels share (AbortError) on iOS", async () => {
      setUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1");
      const abortErr = Object.assign(new Error("cancelled"), { name: "AbortError" });
      const mockShare = vi.fn().mockRejectedValue(abortErr);
      Object.defineProperty(navigator, "share", { value: mockShare, writable: true, configurable: true });
      Object.defineProperty(navigator, "canShare", { value: () => true, writable: true, configurable: true });

      const { result } = setup();
      const canvas = fakeCanvasWithBlob(new Blob(["x"], { type: "image/png" }));
      const ref = { current: canvas } as React.RefObject<HTMLCanvasElement | null>;

      const mockAnchor = { href: "", download: "", click: vi.fn() } as unknown as HTMLAnchorElement;
      vi.spyOn(document, "createElement").mockReturnValue(mockAnchor as unknown as HTMLElement);
      vi.spyOn(document.body, "appendChild").mockReturnValue(mockAnchor as unknown as Node);
      vi.spyOn(document.body, "removeChild").mockReturnValue(mockAnchor as unknown as Node);
      vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:http://localhost/fake");

      result.current.saveColor(ref, "abort.png");
      await vi.waitFor(() => expect(mockShare).toHaveBeenCalled());

      expect(mockAnchor.click).not.toHaveBeenCalled();
    });

    it("DOES fall back when share fails with non-abort error on iOS", async () => {
      setUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1");
      const notAllowedErr = Object.assign(new Error("blocked"), { name: "NotAllowedError" });
      const mockShare = vi.fn().mockRejectedValue(notAllowedErr);
      Object.defineProperty(navigator, "share", { value: mockShare, writable: true, configurable: true });
      Object.defineProperty(navigator, "canShare", { value: () => true, writable: true, configurable: true });

      const { result } = setup();
      const canvas = fakeCanvasWithBlob(new Blob(["x"], { type: "image/png" }));
      const ref = { current: canvas } as React.RefObject<HTMLCanvasElement | null>;

      const mockAnchor = { href: "", download: "", click: vi.fn() } as unknown as HTMLAnchorElement;
      vi.spyOn(document, "createElement").mockReturnValue(mockAnchor as unknown as HTMLElement);
      vi.spyOn(document.body, "appendChild").mockReturnValue(mockAnchor as unknown as Node);
      vi.spyOn(document.body, "removeChild").mockReturnValue(mockAnchor as unknown as Node);
      vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:http://localhost/fake");
      vi.spyOn(window, "open").mockReturnValue(null);

      result.current.saveColor(ref, "blocked.png");
      await vi.waitFor(() => expect(mockAnchor.click).toHaveBeenCalled());
    });

    it("uses navigator.share on iPadOS 13+ (Mac UA + ontouchend)", () => {
      // iPadOS 13+ reports a Mac user-agent. Touch support is detected via document.ontouchend.
      setUA("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15");
      Object.defineProperty(document, "ontouchend", { value: null, configurable: true });
      const mockShare = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "share", { value: mockShare, writable: true, configurable: true });
      Object.defineProperty(navigator, "canShare", { value: () => true, writable: true, configurable: true });

      const { result } = setup();
      const canvas = fakeCanvasWithBlob(new Blob(["x"], { type: "image/png" }));
      const ref = { current: canvas } as React.RefObject<HTMLCanvasElement | null>;

      result.current.saveColor(ref, "ipad.png");

      expect(mockShare).toHaveBeenCalledTimes(1);

      // Clean up the ontouchend property
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (document as any).ontouchend;
    });

    it("does NOT use navigator.share on desktop even when API is available", () => {
      // Default UA (from beforeEach) is desktop Chrome on Windows.
      const mockShare = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "share", { value: mockShare, writable: true, configurable: true });
      Object.defineProperty(navigator, "canShare", { value: () => true, writable: true, configurable: true });

      const { result } = setup();
      const blob = new Blob(["x"], { type: "image/png" });
      const canvas = fakeCanvasWithBlob(blob);
      const ref = { current: canvas } as React.RefObject<HTMLCanvasElement | null>;

      const mockAnchor = { href: "", download: "", click: vi.fn() } as unknown as HTMLAnchorElement;
      vi.spyOn(document, "createElement").mockReturnValue(mockAnchor as unknown as HTMLElement);
      vi.spyOn(document.body, "appendChild").mockReturnValue(mockAnchor as unknown as Node);
      vi.spyOn(document.body, "removeChild").mockReturnValue(mockAnchor as unknown as Node);
      vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:http://localhost/fake");
      vi.spyOn(URL, "revokeObjectURL").mockReturnValue();

      result.current.saveColor(ref, "desktop.png");

      expect(mockShare).not.toHaveBeenCalled();
      expect(mockAnchor.click).toHaveBeenCalled();
    });
  });

  /* ---------- shareColor ---------- */

  describe("shareColor", () => {
    it("calls navigator.share with file when API is available (desktop)", () => {
      const mockShare = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "share", { value: mockShare, writable: true, configurable: true });
      Object.defineProperty(navigator, "canShare", { value: () => true, writable: true, configurable: true });

      const { result } = setup();
      const blob = new Blob(["x"], { type: "image/png" });
      const canvas = fakeCanvasWithBlob(blob);
      const ref = { current: canvas } as React.RefObject<HTMLCanvasElement | null>;

      result.current.shareColor(ref, "shared.png");

      expect(mockShare).toHaveBeenCalledTimes(1);
      const arg = mockShare.mock.calls[0][0];
      expect(arg.files).toHaveLength(1);
      expect(arg.files[0].name).toBe("shared.png");
    });

    it("shows toast_share_unsupported when navigator.share is absent", () => {
      // Default beforeEach clears share/canShare to undefined.
      const { result } = setup();
      const blob = new Blob(["x"], { type: "image/png" });
      const canvas = fakeCanvasWithBlob(blob);
      const ref = { current: canvas } as React.RefObject<HTMLCanvasElement | null>;

      result.current.shareColor(ref, "nope.png");

      expect(mockShowToast).toHaveBeenCalledWith("toast_share_unsupported", "error");
    });
  });

  /* ---------- saveGlaze ---------- */

  describe("saveGlaze", () => {
    it("creates a temp canvas with correct dimensions", () => {
      const cvs = makeCvs(16, 12);
      const { result } = setup(cvs);

      vi.spyOn(document.body, "appendChild").mockReturnValue(null as unknown as Node);
      vi.spyOn(document.body, "removeChild").mockReturnValue(null as unknown as Node);

      result.current.saveGlaze("glaze.png");

      expect(mockRenderBuf).toHaveBeenCalledTimes(1);
      const args = mockRenderBuf.mock.calls[0];
      expect(args[1]).toBe(16); // w
      expect(args[2]).toBe(12); // h
    });

    it("calls renderBuf then downloadCanvas", () => {
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
