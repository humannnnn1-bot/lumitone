import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { LEVEL_CANDIDATES, buildColorLUT, hue2rgb } from "../color-engine";
import { S_BTN, S_BTN_ACTIVE, S_BTN_SM, S_BTN_SM_ACTIVE } from "../styles/shared";
import { rgbStr, timestamp } from "../utils";
import { useGallery, renderThumbnail } from "../hooks/useGallery";
import type { GalleryItem } from "../hooks/useGallery";
import { useGalleryBookmarks, GALLERY_BOOKMARKS_MAX } from "../hooks/useGalleryBookmarks";
import { ccEqual, getDisplayGalleryItems, getGalleryPatternCount } from "../hooks/galleryView";
import type { GalleryFilter, GallerySortMode } from "../hooks/galleryView";
import type { CanvasData } from "../types";
import type { ColorAction } from "../state/color-reducer";
import { useTranslation } from "../i18n";
import { C, SP, FS, R, DUR, Z, HUE_GRADIENT, FONT } from "../styles/tokens";

interface GalleryPanelProps {
  cvs: CanvasData;
  cc: number[];
  ccDispatch: React.Dispatch<ColorAction>;
  locked: boolean[];
  hist: number[];
  showToast: (message: string, type: "error" | "success" | "info") => void;
  saveColorWithLUT: (lut: [number, number, number][], name: string) => void;
  active?: boolean;
  scrollToCurrent?: boolean;
  onScrollDone?: () => void;
}

const ThumbCanvas = React.memo(function ThumbCanvas({ imageData, w, h }: { imageData: ImageData | null; w: number; h: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !imageData) return;
    const dpr = window.devicePixelRatio || 1;
    const bw = Math.round(w * dpr);
    const bh = Math.round(h * dpr);
    if (c.width !== bw || c.height !== bh) {
      c.width = bw;
      c.height = bh;
    }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const tmp = document.createElement("canvas");
    tmp.width = imageData.width;
    tmp.height = imageData.height;
    const tmpCtx = tmp.getContext("2d")!;
    tmpCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(tmp, 0, 0, bw, bh);
  }, [imageData, w, h]);
  return <canvas ref={ref} className="gallery-thumb-canvas" style={{ width: w, height: h }} />;
});

const S_HUE_FILTER_TRACK: React.CSSProperties = {
  flex: "2 1 100px",
  minWidth: 80,
  maxWidth: 280,
  height: 14,
  borderRadius: R.md,
  background: HUE_GRADIENT,
  position: "relative",
};
const S_HUE_FILTER_INPUT: React.CSSProperties = {
  position: "absolute",
  boxSizing: "border-box",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  margin: 0,
  opacity: 0,
  cursor: "pointer",
};
const S_GALLERY_TOOLBAR_BUTTON_BASE: React.CSSProperties = {
  boxSizing: "border-box",
  height: 22,
  minHeight: 22,
  padding: "0 8px",
  fontSize: FS.lg,
  lineHeight: "20px",
  whiteSpace: "nowrap",
};
const S_GALLERY_FILTER_BUTTON: React.CSSProperties = { ...S_BTN, ...S_GALLERY_TOOLBAR_BUTTON_BASE, minWidth: 52 };
const S_GALLERY_FILTER_BUTTON_ACTIVE: React.CSSProperties = { ...S_BTN_ACTIVE, ...S_GALLERY_TOOLBAR_BUTTON_BASE, minWidth: 52 };
const S_GALLERY_BOOKMARK_BUTTON: React.CSSProperties = { ...S_BTN, ...S_GALLERY_TOOLBAR_BUTTON_BASE, minWidth: 92 };
const S_GALLERY_BOOKMARK_BUTTON_ACTIVE: React.CSSProperties = { ...S_BTN_ACTIVE, ...S_GALLERY_TOOLBAR_BUTTON_BASE, minWidth: 92 };
const S_GALLERY_SORT_BUTTON: React.CSSProperties = { ...S_BTN, ...S_GALLERY_TOOLBAR_BUTTON_BASE, minWidth: 64 };
const S_GALLERY_SORT_BUTTON_ACTIVE: React.CSSProperties = { ...S_BTN_ACTIVE, ...S_GALLERY_TOOLBAR_BUTTON_BASE, minWidth: 64 };
const S_GALLERY_SIZE_BUTTON_BASE: React.CSSProperties = {
  ...S_GALLERY_TOOLBAR_BUTTON_BASE,
  width: 24,
  minWidth: 24,
  padding: 0,
};
const S_GALLERY_SIZE_BUTTON: React.CSSProperties = { ...S_BTN_SM, ...S_GALLERY_SIZE_BUTTON_BASE };
const S_GALLERY_SIZE_BUTTON_ACTIVE: React.CSSProperties = { ...S_BTN_SM_ACTIVE, ...S_GALLERY_SIZE_BUTTON_BASE };

export const GalleryPanel = React.memo(function GalleryPanel({
  cvs,
  cc,
  ccDispatch,
  locked,
  hist,
  showToast,
  saveColorWithLUT,
  active,
  scrollToCurrent,
  onScrollDone,
}: GalleryPanelProps) {
  const { t } = useTranslation();
  const { items, generating, progress } = useGallery(cvs, cc, locked, hist, active === true);
  const handleBookmarkLimit = useCallback(() => showToast(t("toast_bookmark_limit", GALLERY_BOOKMARKS_MAX), "error"), [showToast, t]);
  const handleBookmarkSaveFailed = useCallback(
    (action: "add" | "remove") => {
      showToast(t(action === "add" ? "toast_bookmark_failed" : "toast_unbookmark_failed"), "error");
    },
    [showToast, t],
  );
  const { bookmarks, isBookmarked, toggleBookmark } = useGalleryBookmarks({
    onLimitReached: handleBookmarkLimit,
    onSaveFailed: handleBookmarkSaveFailed,
  });
  const [filter, setFilter] = useState<GalleryFilter>("all");
  const [sortMode, setSortMode] = useState<GallerySortMode>("default");
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const currentItemRef = useRef<HTMLDivElement>(null);

  // Hue filter state
  const [filterHue, setFilterHue] = useState(180);
  const [filterRange, setFilterRange] = useState(180);

  // Scroll to current pattern only when requested (e.g. from Diagram tab link)
  useEffect(() => {
    if (scrollToCurrent && active) {
      setFilter("all");
      requestAnimationFrame(() => {
        if (currentItemRef.current) {
          currentItemRef.current.scrollIntoView({ behavior: "instant", block: "center" });
        }
        onScrollDone?.();
      });
    }
  }, [scrollToCurrent, active, onScrollDone]);

  const patternCount = useMemo(() => getGalleryPatternCount(locked, hist), [locked, hist]);

  const applyScheme = useCallback(
    (itemCc: number[]) => {
      ccDispatch({ type: "load_all", values: itemCc });
      showToast(t("gallery_apply"), "success");
    },
    [ccDispatch, showToast, t],
  );

  // Bookmark thumbnails
  const bookmarkItems = useMemo(() => {
    if (bookmarks.length === 0) return [];
    const tw = Math.max(1, Math.min(260, cvs.w));
    const th = Math.max(1, Math.min(260, cvs.h));
    return bookmarks.map((bcc) => {
      const lut = buildColorLUT(bcc);
      const imageData = renderThumbnail(cvs.data, cvs.w, cvs.h, lut, tw, th);
      return { cc: bcc, imageData } as GalleryItem;
    });
  }, [bookmarks, cvs]);

  const displayItems = useMemo(() => {
    return getDisplayGalleryItems({ filter, items, bookmarkItems, sortMode, filterHue, filterRange, currentCc: cc });
  }, [filter, items, bookmarkItems, sortMode, filterHue, filterRange, cc]);

  type ThumbSize = "S" | "M" | "L";
  const THUMB_SIZES: Record<ThumbSize, number> = { S: 120, M: 180, L: 260 };
  const [thumbSize, setThumbSize] = useState<ThumbSize>("M");
  const thumbDisplaySize = THUMB_SIZES[thumbSize];
  // Fit expanded preview within viewport while preserving aspect ratio
  // Reserve space for border (4px) + gap + buttons (~50px)
  const expandedMaxW = typeof window !== "undefined" ? Math.floor(window.innerWidth * 0.9) : 300;
  const expandedMaxH = typeof window !== "undefined" ? Math.floor(window.innerHeight * 0.9 - 60) : 300;
  const expandedAspect = cvs.w / Math.max(1, cvs.h);
  const expandedDisplayW = expandedAspect >= expandedMaxW / expandedMaxH ? expandedMaxW : Math.round(expandedMaxH * expandedAspect);
  const expandedDisplayH = expandedAspect >= expandedMaxW / expandedMaxH ? Math.round(expandedMaxW / expandedAspect) : expandedMaxH;

  // High-res thumbnail for expanded item (render at 2x for sharp display on high-DPI screens)
  const expandedRenderScale = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;
  const expandedRenderW = Math.min(cvs.w, Math.round(expandedDisplayW * expandedRenderScale));
  const expandedRenderH = Math.min(cvs.h, Math.round(expandedDisplayH * expandedRenderScale));
  const expandedImageData = useMemo(() => {
    if (expandedIndex === null || expandedIndex >= displayItems.length) return null;
    const item = displayItems[expandedIndex];
    const lut = buildColorLUT(item.cc);
    return renderThumbnail(cvs.data, cvs.w, cvs.h, lut, expandedRenderW, expandedRenderH);
  }, [expandedIndex, displayItems, cvs, expandedRenderW, expandedRenderH]);

  return (
    <div ref={panelRef} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.lg, width: "100%" }}>
      <div style={{ fontSize: FS.md, color: C.textDim, textAlign: "center", lineHeight: "14px" }}>{t("gallery_title")}</div>

      <div style={{ fontSize: FS.sm, color: C.textDimmer, textAlign: "center", width: "100%", minHeight: 16 }}>
        {generating && progress.total > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: SP.md }}>
            <div style={{ flex: 1, height: 4, background: C.bgSurface, borderRadius: R.sm, overflow: "hidden" }}>
              <div
                style={{
                  width: `${(progress.current / progress.total) * 100}%`,
                  height: "100%",
                  background: C.accent,
                  borderRadius: R.sm,
                  transition: `width ${DUR.fast}`,
                }}
              />
            </div>
            <span style={{ fontSize: FS.xs, color: C.textDimmer, fontFamily: FONT.mono }}>
              {progress.current}/{progress.total}
            </span>
          </div>
        ) : displayItems.length < items.length ? (
          t("gallery_patterns_filtered", displayItems.length, patternCount)
        ) : (
          t("gallery_patterns", patternCount)
        )}
      </div>

      {/* Filter + Sort + Size — grouped with spacing between groups */}
      <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", alignItems: "center", gap: SP.sm }}>
        {/* Filter group */}
        <div style={{ display: "flex", gap: SP.sm }}>
          <button onClick={() => setFilter("all")} style={filter === "all" ? S_GALLERY_FILTER_BUTTON_ACTIVE : S_GALLERY_FILTER_BUTTON}>
            {t("gallery_filter_all")}
          </button>
          <button
            onClick={() => setFilter("bookmarks")}
            style={filter === "bookmarks" ? S_GALLERY_BOOKMARK_BUTTON_ACTIVE : S_GALLERY_BOOKMARK_BUTTON}
          >
            {t("gallery_filter_bookmarks")} ({bookmarks.length})
          </button>
        </div>
        {/* Sort group */}
        <div style={{ display: "flex", gap: SP.sm, marginInline: SP.sm }}>
          <button
            onClick={() =>
              setSortMode((m) => (m === "default" ? "hue_asc" : m === "hue_asc" ? "hue_desc" : m === "hue_desc" ? "similar" : "default"))
            }
            style={sortMode !== "default" ? S_GALLERY_SORT_BUTTON_ACTIVE : S_GALLERY_SORT_BUTTON}
            title={t("gallery_sort_title")}
          >
            {sortMode === "hue_asc"
              ? t("gallery_sort_hue_asc")
              : sortMode === "hue_desc"
                ? t("gallery_sort_hue_desc")
                : sortMode === "similar"
                  ? t("gallery_sort_similar")
                  : t("gallery_sort_default")}
          </button>
        </div>
        {/* Size group */}
        <div style={{ display: "flex", gap: SP.xs }}>
          {(["S", "M", "L"] as ThumbSize[]).map((sz) => (
            <button
              key={sz}
              onClick={() => setThumbSize(sz)}
              style={thumbSize === sz ? S_GALLERY_SIZE_BUTTON_ACTIVE : S_GALLERY_SIZE_BUTTON}
              aria-label={t("aria_gallery_thumb_size", sz)}
            >
              {t(`gallery_thumb_${sz}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Hue filter sliders — shown only when a level is selected */}
      {
        <div
          style={{
            display: "flex",
            gap: SP.md,
            alignItems: "center",
            width: "100%",
            justifyContent: "center",
            fontSize: FS.sm,
            color: C.textDim,
          }}
        >
          <div style={S_HUE_FILTER_TRACK}>
            {/* Range boundary lines + arrow colored by hue angle */}
            {(() => {
              const lo = (((filterHue - filterRange) % 360) + 360) % 360;
              const hi = (((filterHue + filterRange) % 360) + 360) % 360;
              const hueColor = `rgb(${hue2rgb(filterHue).join(",")})`;
              const line: React.CSSProperties = {
                position: "absolute",
                top: 0,
                width: 2,
                height: "100%",
                background: hueColor,
                pointerEvents: "none",
              };
              return (
                <>
                  <div style={{ ...line, left: `${(lo / 359) * 100}%` }} />
                  <div style={{ ...line, left: `${(hi / 359) * 100}%` }} />
                </>
              );
            })()}
            {/* Current position indicator — colored by hue angle */}
            <div
              style={{
                position: "absolute",
                left: `${(filterHue / 359) * 100}%`,
                bottom: -6,
                transform: "translateX(-4px)",
                width: 0,
                height: 0,
                borderLeft: "4px solid transparent",
                borderRight: "4px solid transparent",
                borderBottom: `5px solid rgb(${hue2rgb(filterHue).join(",")})`,
                pointerEvents: "none",
              }}
            />
            <input
              type="range"
              min={0}
              max={359}
              step={1}
              value={filterHue}
              onChange={(e) => setFilterHue(Number(e.target.value))}
              aria-label={t("aria_gallery_filter_hue")}
              style={S_HUE_FILTER_INPUT}
            />
          </div>
          <span style={{ fontFamily: FONT.mono, whiteSpace: "nowrap", width: "9ch", flexShrink: 0, textAlign: "right" }}>
            {filterHue}°±{filterRange}°
          </span>
          <div style={{ position: "relative", flex: "0 1 140px", minWidth: 60, height: 20 }}>
            <input
              type="range"
              min={10}
              max={180}
              step={5}
              value={filterRange}
              onChange={(e) => setFilterRange(Number(e.target.value))}
              aria-label={t("aria_gallery_filter_range")}
              style={{
                position: "absolute",
                boxSizing: "border-box",
                top: 0,
                left: 0,
                width: "100%",
                height: 14,
                margin: 0,
                accentColor: C.accent,
              }}
            />
            {/* Tick marks at 45° intervals — below the slider */}
            {[45, 90, 135].map((deg) => (
              <div
                key={deg}
                style={{
                  position: "absolute",
                  left: `${((deg - 10) / 170) * 100}%`,
                  top: 14,
                  width: 1,
                  height: 6,
                  background: "rgba(255,255,255,0.25)",
                  pointerEvents: "none",
                }}
              />
            ))}
          </div>
        </div>
      }

      {/* Expanded preview modal */}
      {expandedImageData && expandedIndex !== null && expandedIndex < displayItems.length && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("gallery_preview_dialog")}
          onClick={() => setExpandedIndex(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: Z.galleryPreview,
            background: C.bgOverlay,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: SP.xl,
              cursor: "default",
              maxWidth: "90vw",
              maxHeight: "85vh",
            }}
          >
            <div style={{ border: `2px solid ${C.accent}`, borderRadius: R.lg, overflow: "hidden" }}>
              <ThumbCanvas imageData={expandedImageData} w={expandedDisplayW} h={expandedDisplayH} />
            </div>
            <div style={{ display: "flex", gap: SP.xl }}>
              <button
                onClick={() => {
                  applyScheme(displayItems[expandedIndex].cc);
                  setExpandedIndex(null);
                }}
                style={{
                  ...S_BTN,
                  padding: `${SP.md}px ${SP.lg}px`,
                  fontSize: FS.xl,
                  background: C.accent,
                  color: C.bgRoot,
                  border: `1px solid ${C.accentBright}`,
                }}
              >
                {t("gallery_apply_btn")}
              </button>
              <button
                onClick={() => toggleBookmark(displayItems[expandedIndex].cc)}
                style={{
                  ...S_BTN,
                  padding: `${SP.md}px ${SP.lg}px`,
                  fontSize: FS.xl,
                  background: C.bgSurfaceAlt,
                  color: C.textPrimary,
                  border: `1px solid ${C.borderHover}`,
                }}
              >
                {isBookmarked(displayItems[expandedIndex].cc) ? t("gallery_unbookmark") : t("gallery_bookmark")}
              </button>
              <button
                onClick={() => {
                  const lut = buildColorLUT(displayItems[expandedIndex].cc);
                  saveColorWithLUT(lut, `chromalum_color_${timestamp()}.png`);
                }}
                style={{
                  ...S_BTN,
                  padding: `${SP.md}px ${SP.lg}px`,
                  fontSize: FS.xl,
                  background: C.bgSurfaceAlt,
                  color: C.textPrimary,
                  border: `1px solid ${C.borderHover}`,
                }}
              >
                {t("gallery_save_btn")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty states */}
      {filter === "all" && items.length === 0 && !generating && (
        <div style={{ fontSize: FS.md, color: C.textSubtle, textAlign: "center", padding: 16 }}>{t("gallery_empty")}</div>
      )}
      {filter === "bookmarks" && bookmarks.length === 0 && (
        <div style={{ fontSize: FS.md, color: C.textSubtle, textAlign: "center", padding: 16 }}>{t("gallery_no_bookmarks")}</div>
      )}
      {filterRange < 180 && displayItems.length === 0 && items.length > 0 && (
        <div style={{ fontSize: FS.md, color: C.textSubtle, textAlign: "center", padding: 16 }}>{t("gallery_no_match")}</div>
      )}

      {/* Thumbnail grid */}
      <div className="gallery-grid" style={{ "--gallery-thumb-track": `${thumbDisplaySize + 14}px` } as React.CSSProperties}>
        {displayItems.map((item, i) => {
          const isCurrent = ccEqual(item.cc, cc);
          const starred = isBookmarked(item.cc);
          return (
            <div
              key={i}
              ref={isCurrent ? currentItemRef : undefined}
              className={isCurrent ? "gallery-card gallery-card--current" : "gallery-card"}
            >
              <div
                onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
                onContextMenu={
                  filter === "bookmarks"
                    ? undefined
                    : (e) => {
                        e.preventDefault();
                        toggleBookmark(item.cc);
                      }
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setExpandedIndex(expandedIndex === i ? null : i);
                  } else if (e.key === "b" || e.key === "B") {
                    e.preventDefault();
                    toggleBookmark(item.cc);
                  } else if (e.key === "Escape") setExpandedIndex(null);
                }}
                tabIndex={0}
                role="button"
                aria-label={t("gallery_preview") + ` (${i + 1})`}
                title={t("gallery_preview")}
                className={expandedIndex === i ? "gallery-preview-button gallery-preview-button--expanded" : "gallery-preview-button"}
              >
                <ThumbCanvas imageData={item.imageData} w={thumbDisplaySize} h={Math.round((thumbDisplaySize * cvs.h) / cvs.w)} />
              </div>
              <div className="gallery-swatches">
                {item.cc.map((ci, lv) => {
                  const alts = LEVEL_CANDIDATES[lv];
                  if (hist[lv] === 0) return null; // skip unused levels
                  const rgb = alts[ci % alts.length]?.rgb ?? [128, 128, 128];
                  return <div key={lv} className="gallery-swatch" style={{ background: rgbStr(rgb) }} />;
                })}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleBookmark(item.cc);
                }}
                className={starred ? "gallery-bookmark-button gallery-bookmark-button--starred" : "gallery-bookmark-button"}
                aria-label={starred ? `${t("gallery_unbookmark")} (${i + 1})` : `${t("gallery_bookmark")} (${i + 1})`}
                aria-pressed={starred}
                title={starred ? t("gallery_unbookmark") : t("gallery_bookmark")}
              >
                {starred ? "\u2605" : "\u2606"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
});
