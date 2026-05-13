// @vitest-environment jsdom
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CANDIDATE_INDEX_BY_LEVEL, LEVEL_CANDIDATES } from "../../color-engine";
import type { CanvasData } from "../../types";
import type { GalleryItem } from "../../hooks/useGallery";
import { GalleryPanel } from "../GalleryPanel";

const galleryMock = vi.hoisted(() => ({
  items: [] as GalleryItem[],
  generating: false,
  generate: vi.fn(),
  cancel: vi.fn(),
  progress: { current: 0, total: 0 },
  useGallery: vi.fn(),
}));

vi.mock("../../i18n", () => ({
  useTranslation: () => ({
    t: (key: string, ...args: unknown[]) => (args.length ? `${key}(${args.join(",")})` : key),
  }),
}));

vi.mock("../../hooks/useGallery", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../hooks/useGallery")>();
  return {
    ...actual,
    useGallery: galleryMock.useGallery,
  };
});

const BM_KEY = "chromalum_bookmarks";

function makeCvs(w = 4, h = 4): CanvasData {
  const data = new Uint8Array(w * h);
  for (let i = 0; i < data.length; i++) data[i] = i % 8;
  return { width: w, height: h, levelData: data, pixelCandidateOverrideMap: new Uint8Array(w * h) };
}

function makeItem(candidateIndexByLevel = DEFAULT_CANDIDATE_INDEX_BY_LEVEL): GalleryItem {
  return { candidateIndexByLevel: [...candidateIndexByLevel], imageData: new ImageData(2, 2) };
}

function withLevel(lv: number, candidate: number): number[] {
  const candidateIndexByLevel = [...DEFAULT_CANDIDATE_INDEX_BY_LEVEL];
  candidateIndexByLevel[lv] = Math.min(candidate, LEVEL_CANDIDATES[lv].length - 1);
  return candidateIndexByLevel;
}

function farFromHue(hue: number): number[] {
  const candidateIndexByLevel = [...DEFAULT_CANDIDATE_INDEX_BY_LEVEL];
  for (let lv = 1; lv <= 6; lv++) {
    let best = 0;
    let bestDistance = -1;
    LEVEL_CANDIDATES[lv].forEach((candidate, idx) => {
      const diff = Math.abs(candidate.hueAngleDeg - hue);
      const distance = Math.min(diff, 360 - diff);
      if (distance > bestDistance) {
        best = idx;
        bestDistance = distance;
      }
    });
    candidateIndexByLevel[lv] = best;
  }
  return candidateIndexByLevel;
}

function renderGallery(overrides?: Partial<React.ComponentProps<typeof GalleryPanel>>) {
  const props: React.ComponentProps<typeof GalleryPanel> = {
    canvasData: makeCvs(),
    candidateIndexByLevel: [...DEFAULT_CANDIDATE_INDEX_BY_LEVEL],
    candidateIndexDispatch: vi.fn(),
    lockedLevels: new Array(8).fill(false),
    levelHistogram: new Array(8).fill(1),
    showToast: vi.fn(),
    saveColorWithLUT: vi.fn(),
    active: true,
    scrollToCurrent: false,
    onScrollDone: vi.fn(),
    ...overrides,
  };
  const view = render(<GalleryPanel {...props} />);
  return { ...view, props };
}

describe("GalleryPanel", () => {
  beforeEach(() => {
    galleryMock.items = [];
    galleryMock.generating = false;
    galleryMock.progress = { current: 0, total: 0 };
    galleryMock.generate.mockClear();
    galleryMock.cancel.mockClear();
    galleryMock.useGallery.mockImplementation(() => galleryMock);
    galleryMock.useGallery.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes the active state to useGallery", () => {
    const activeView = renderGallery({ canvasData: makeCvs(3, 3), active: true });
    expect(galleryMock.useGallery).toHaveBeenLastCalledWith(
      activeView.props.canvasData,
      activeView.props.candidateIndexByLevel,
      activeView.props.lockedLevels,
      activeView.props.levelHistogram,
      true,
    );

    activeView.unmount();
    const hiddenView = renderGallery({ canvasData: makeCvs(5, 5), active: false });
    expect(galleryMock.useGallery).toHaveBeenLastCalledWith(
      hiddenView.props.canvasData,
      hiddenView.props.candidateIndexByLevel,
      hiddenView.props.lockedLevels,
      hiddenView.props.levelHistogram,
      false,
    );
  });

  it("shows progress, cycles sort modes, and reports an empty hue-filter result", () => {
    galleryMock.items = [makeItem(farFromHue(180))];
    galleryMock.generating = true;
    galleryMock.progress = { current: 1, total: 4 };
    renderGallery({ canvasData: makeCvs(4, 4) });

    expect(screen.getByText("1/4")).toBeTruthy();

    const sortButton = screen.getByRole("button", { name: "gallery_sort_default" });
    fireEvent.click(sortButton);
    expect(screen.getByRole("button", { name: "gallery_sort_hue_asc" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "gallery_sort_hue_asc" }));
    expect(screen.getByRole("button", { name: "gallery_sort_hue_desc" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "gallery_sort_hue_desc" }));
    expect(screen.getByRole("button", { name: "gallery_sort_similar" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("aria_gallery_filter_range"), { target: { value: "10" } });
    expect(screen.getByText("gallery_no_match")).toBeTruthy();
  });

  it("loads bookmarks, filters them, and toggles bookmark actions from cards", () => {
    const bookmarked = withLevel(2, 1);
    galleryMock.items = [makeItem(DEFAULT_CANDIDATE_INDEX_BY_LEVEL), makeItem(bookmarked)];
    localStorage.setItem(BM_KEY, JSON.stringify([bookmarked]));
    renderGallery();

    expect(screen.getByRole("button", { name: "gallery_filter_bookmarks (1)" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /gallery_preview/ })).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "gallery_filter_bookmarks (1)" }));
    expect(screen.getAllByRole("button", { name: /gallery_preview/ })).toHaveLength(1);

    const preview = screen.getByRole("button", { name: /gallery_preview/ });
    fireEvent.contextMenu(preview);
    expect(JSON.parse(localStorage.getItem(BM_KEY) ?? "[]")).toHaveLength(1);

    fireEvent.keyDown(preview, { key: "b" });
    expect(JSON.parse(localStorage.getItem(BM_KEY) ?? "[]")).toHaveLength(0);
  });

  it("prevents adding bookmarks past the storage limit", () => {
    const itemCandidateIndexByLevel = withLevel(2, 1);
    galleryMock.items = [makeItem(itemCandidateIndexByLevel)];
    localStorage.setItem(BM_KEY, JSON.stringify(Array.from({ length: 500 }, () => [...DEFAULT_CANDIDATE_INDEX_BY_LEVEL])));
    const { props } = renderGallery();

    fireEvent.click(screen.getByRole("button", { name: "gallery_bookmark (1)" }));

    expect(props.showToast).toHaveBeenCalledWith("toast_bookmark_limit(500)", "error");
    expect(JSON.parse(localStorage.getItem(BM_KEY) ?? "[]")).toHaveLength(500);
  });

  it("reports bookmark storage failures without changing bookmark state", () => {
    const itemCandidateIndexByLevel = withLevel(2, 1);
    galleryMock.items = [makeItem(itemCandidateIndexByLevel)];
    const { props } = renderGallery();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key) => {
      if (key === BM_KEY) throw new DOMException("Quota exceeded", "QuotaExceededError");
    });

    fireEvent.click(screen.getByRole("button", { name: "gallery_bookmark (1)" }));

    expect(props.showToast).toHaveBeenCalledWith("toast_bookmark_failed", "error");
    expect(screen.getByRole("button", { name: "gallery_bookmark (1)" }).getAttribute("aria-pressed")).toBe("false");
    expect(localStorage.getItem(BM_KEY)).toBeNull();
  });

  it("reports unbookmark storage failures without removing the bookmark", () => {
    const itemCandidateIndexByLevel = withLevel(2, 1);
    galleryMock.items = [makeItem(itemCandidateIndexByLevel)];
    localStorage.setItem(BM_KEY, JSON.stringify([itemCandidateIndexByLevel]));
    const { props } = renderGallery();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key) => {
      if (key === BM_KEY) throw new DOMException("Quota exceeded", "QuotaExceededError");
    });

    fireEvent.click(screen.getByRole("button", { name: "gallery_unbookmark (1)" }));

    expect(props.showToast).toHaveBeenCalledWith("toast_unbookmark_failed", "error");
    expect(screen.getByRole("button", { name: "gallery_unbookmark (1)" }).getAttribute("aria-pressed")).toBe("true");
    expect(JSON.parse(localStorage.getItem(BM_KEY) ?? "[]")).toHaveLength(1);
  });

  it("opens the preview dialog and routes apply, bookmark, save, and dismiss actions", () => {
    const itemCandidateIndexByLevel = withLevel(3, 1);
    galleryMock.items = [makeItem(itemCandidateIndexByLevel)];
    const { props } = renderGallery();

    const preview = screen.getByRole("button", { name: /gallery_preview/ });
    fireEvent.keyDown(preview, { key: "Enter" });
    expect(screen.getByRole("dialog", { name: "gallery_preview_dialog" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "gallery_save_btn" }));
    expect(props.saveColorWithLUT).toHaveBeenCalledWith(
      expect.any(Array),
      expect.stringMatching(/^chromalum_color_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.png$/),
    );

    fireEvent.click(screen.getByRole("button", { name: "gallery_bookmark" }));
    expect(JSON.parse(localStorage.getItem(BM_KEY) ?? "[]")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "gallery_apply_btn" }));
    expect(props.candidateIndexDispatch).toHaveBeenCalledWith({ type: "load_all", values: itemCandidateIndexByLevel });
    expect(props.showToast).toHaveBeenCalledWith("gallery_apply", "success");
    expect(screen.queryByRole("dialog", { name: "gallery_preview_dialog" })).toBeNull();

    fireEvent.click(preview);
    fireEvent.click(screen.getByRole("dialog", { name: "gallery_preview_dialog" }));
    expect(screen.queryByRole("dialog", { name: "gallery_preview_dialog" })).toBeNull();
  });

  it("scrolls to the current item only when requested on an active panel", () => {
    galleryMock.items = [makeItem(DEFAULT_CANDIDATE_INDEX_BY_LEVEL), makeItem(withLevel(2, 1))];
    const rafCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    const onScrollDone = vi.fn();

    renderGallery({ scrollToCurrent: true, active: true, onScrollDone });

    expect(rafCallbacks).toHaveLength(1);
    act(() => {
      rafCallbacks[0](0);
    });
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "instant", block: "center" });
    expect(onScrollDone).toHaveBeenCalledTimes(1);
  });
});
