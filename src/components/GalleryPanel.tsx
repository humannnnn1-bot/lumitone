import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { LEVEL_CANDIDATES, LEVEL_INFO, buildColorLUT } from "../color-engine";
import { S_BTN, S_BTN_ACTIVE } from "../styles";
import { rgbStr } from "../utils";
import { useGallery, renderThumbnail } from "../hooks/useGallery";
import type { GalleryItem } from "../hooks/useGallery";
import type { CanvasData } from "../types";
import type { ColorAction } from "../color-reducer";
import { useTranslation } from "../i18n";
import { C, SP, FS, R, DUR, HUE_GRADIENT } from "../tokens";

interface GalleryPanelProps {
  cvs: CanvasData;
  cc: number[];
  ccDispatch: React.Dispatch<ColorAction>;
  locked: boolean[];
  hist: number[];
  showToast: (message: string, type: "error" | "success" | "info") => void;
}

const BM_KEY = "chromalum_bookmarks";
const _genCache = { key: "" };

function loadBookmarks(): number[][] {
  try {
    const raw = localStorage.getItem(BM_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((a: unknown) => Array.isArray(a) && a.length === 8 && a.every((v: unknown) => typeof v === "number" && Number.isFinite(v)))
      .map((a: number[]) => a.map((v, lv) => {
        const maxCand = LEVEL_CANDIDATES[lv]?.length ?? 1;
        return (v >= 0 && v < maxCand) ? v : v >= 0 ? v % maxCand : 0;
      }));
  } catch { return []; }
}

function saveBookmarks(bms: number[][]) {
  localStorage.setItem(BM_KEY, JSON.stringify(bms));
}

function ccEqual(a: number[], b: number[]): boolean {
  for (let i = 0; i < 8; i++) {
    const na = LEVEL_CANDIDATES[i].length;
    if ((a[i] % na) !== (b[i] % na)) return false;
  }
  return true;
}

/** Compute average hue angle for a pattern's cc[] (for sorting/display). */
function patternHue(patternCc: number[]): number {
  let sumAngle = 0, count = 0;
  for (let lv = 0; lv < 8; lv++) {
    const cands = LEVEL_CANDIDATES[lv];
    if (cands.length <= 1) continue;
    const angle = cands[patternCc[lv] % cands.length].angle;
    if (angle >= 0) { sumAngle += angle; count++; }
  }
  return count > 0 ? sumAngle / count : 0;
}

/** Check if a pattern's cc[] matches a hue filter on a specific level. */
function matchesHueFilter(patternCc: number[], filterLevel: number, filterHue: number, filterRange: number): boolean {
  const cands = LEVEL_CANDIDATES[filterLevel];
  if (cands.length <= 1) return true;
  const ci = patternCc[filterLevel] % cands.length;
  const angle = cands[ci].angle;
  if (angle < 0) return true;
  const diff = Math.abs(angle - filterHue);
  return Math.min(diff, 360 - diff) <= filterRange;
}

const ThumbCanvas = React.memo(function ThumbCanvas({ imageData, w, h }: { imageData: ImageData | null; w: number; h: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !imageData) return;
    if (c.width !== imageData.width || c.height !== imageData.height) {
      c.width = imageData.width; c.height = imageData.height;
    }
    const ctx = c.getContext("2d");
    if (ctx) ctx.putImageData(imageData, 0, 0);
  }, [imageData]);
  return <canvas ref={ref} style={{ width: w, height: h, display: "block", borderRadius: R.sm }} />;
});

type SortMode = "default" | "hue_asc" | "hue_desc" | "similar";

/** Count how many levels differ between two cc[] arrays. */
function ccDistance(a: number[], b: number[]): number {
  let dist = 0;
  for (let i = 0; i < 8; i++) {
    const na = LEVEL_CANDIDATES[i].length;
    if (na <= 1) continue;
    if ((a[i] % na) !== (b[i] % na)) dist++;
  }
  return dist;
}

const S_HUE_FILTER_TRACK: React.CSSProperties = {
  width: 80, height: 14, borderRadius: R.md,
  background: HUE_GRADIENT,
  position: "relative", display: "inline-block",
};
const S_HUE_FILTER_INPUT: React.CSSProperties = {
  position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer",
};

export const GalleryPanel = React.memo(function GalleryPanel({
  cvs, cc, ccDispatch, locked, hist, showToast,
}: GalleryPanelProps) {
  const { t } = useTranslation();
  const [showGlaze, setShowGlaze] = useState(false);
  const { items, generating, generate, progress } = useGallery(cvs, cc, locked, hist, showGlaze);
  const [bookmarks, setBookmarks] = useState<number[][]>(loadBookmarks);
  const [filter, setFilter] = useState<"all" | "bookmarks">("all");
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [hoverItem, setHoverItem] = useState<GalleryItem | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setHoverDebounced = useCallback((item: GalleryItem | null) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (!item) { setHoverItem(null); return; }
    hoverTimerRef.current = setTimeout(() => setHoverItem(item), 100);
  }, []);

  // Hue filter state
  const [filterLevel, setFilterLevel] = useState<number | null>(null);
  const [filterHue, setFilterHue] = useState(180);
  const [filterRange, setFilterRange] = useState(60);

  // Auto-generate when canvas, colors, locks, or glaze toggle change
  const genKey = useMemo(() => {
    const d = cvs.data, n = d.length;
    const sample = n > 0 ? `${d[0]}_${d[n >> 2]}_${d[n >> 1]}_${d[(3 * n) >> 2]}_${d[n - 1]}` : "0";
    return `${cvs.w}x${cvs.h}_${sample}_${n}_${cc.join(",")}_${locked.join(",")}_${showGlaze}`;
  }, [cvs, cc, locked, showGlaze]);

  useEffect(() => {
    if (_genCache.key !== genKey) {
      _genCache.key = genKey;
      generate();
    }
  }, [genKey, generate]);

  const patternCount = useMemo(() => {
    let total = 1;
    for (let lv = 0; lv < 8; lv++) {
      const n = LEVEL_CANDIDATES[lv].length;
      if (!locked[lv] && hist[lv] > 0 && n > 1) total *= n;
    }
    return total;
  }, [locked, hist]);

  const isBookmarked = useCallback((itemCc: number[]) =>
    bookmarks.some(b => ccEqual(b, itemCc)), [bookmarks]);

  const toggleBookmark = useCallback((itemCc: number[]) => {
    setBookmarks(prev => {
      const idx = prev.findIndex(b => ccEqual(b, itemCc));
      let next: number[][];
      if (idx >= 0) {
        next = [...prev.slice(0, idx), ...prev.slice(idx + 1)];
        showToast(t("gallery_unbookmark"), "info");
      } else {
        next = [...prev, [...itemCc]];
        showToast(t("gallery_bookmark"), "success");
      }
      saveBookmarks(next);
      return next;
    });
  }, [showToast, t]);

  const applyScheme = useCallback((itemCc: number[]) => {
    ccDispatch({ type: "load_all", values: itemCc });
    showToast(t("gallery_apply"), "success");
  }, [ccDispatch, showToast, t]);

  // Bookmark thumbnails
  const bookmarkItems = useMemo(() => {
    if (bookmarks.length === 0) return [];
    const tw = Math.max(1, Math.min(128, cvs.w));
    const th = Math.max(1, Math.min(128, cvs.h));
    const cm = showGlaze ? cvs.colorMap : undefined;
    return bookmarks.map(bcc => {
      const lut = buildColorLUT(bcc);
      const imageData = renderThumbnail(cvs.data, cvs.w, cvs.h, lut, tw, th, cm);
      return { cc: bcc, imageData } as GalleryItem;
    });
  }, [bookmarks, cvs, showGlaze]);

  // Apply sort + filter to display items
  const displayItems = useMemo(() => {
    let list = filter === "bookmarks" ? bookmarkItems : items;

    // Hue filter
    if (filterLevel !== null) {
      list = list.filter(item => matchesHueFilter(item.cc, filterLevel, filterHue, filterRange));
    }

    // Sort
    if (sortMode !== "default") {
      const sorted = [...list];
      if (sortMode === "similar") {
        sorted.sort((a, b) => ccDistance(a.cc, cc) - ccDistance(b.cc, cc));
      } else {
        sorted.sort((a, b) => {
          const ha = patternHue(a.cc), hb = patternHue(b.cc);
          return sortMode === "hue_asc" ? ha - hb : hb - ha;
        });
      }
      return sorted;
    }
    return list;
  }, [filter, items, bookmarkItems, sortMode, filterLevel, filterHue, filterRange, cc]);

  // Hover preview: render larger thumbnail
  const hoverPreviewData = useMemo(() => {
    if (!hoverItem) return null;
    const size = 240;
    const lut = buildColorLUT(hoverItem.cc);
    const cm = showGlaze ? cvs.colorMap : undefined;
    return renderThumbnail(cvs.data, cvs.w, cvs.h, lut, size, Math.round(size * cvs.h / cvs.w), cm);
  }, [hoverItem, cvs, showGlaze]);

  const thumbDisplaySize = 120;

  // Filter levels that have multiple candidates
  const filterableLevels = useMemo(() =>
    LEVEL_INFO.map((info, lv) => ({ lv, name: info.name, count: LEVEL_CANDIDATES[lv].length }))
      .filter(l => l.count > 1),
  []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.lg, width: "100%" }}>
      <div style={{ fontSize: FS.md, color: C.textDim, minHeight: 16 }}>{t("gallery_title")}</div>

      <div style={{ fontSize: FS.sm, color: C.textDimmer, textAlign: "center" }}>
        {generating ? t("gallery_generating")
          : displayItems.length < items.length
            ? t("gallery_patterns_filtered", displayItems.length, patternCount)
            : t("gallery_patterns", patternCount)}
      </div>

      {generating && progress.total > 0 && (
        <div style={{ width: "100%", display: "flex", alignItems: "center", gap: SP.md }}>
          <div style={{ flex: 1, height: 4, background: C.bgSurface, borderRadius: R.sm, overflow: "hidden" }}>
            <div style={{ width: `${progress.current / progress.total * 100}%`, height: "100%", background: C.accent, borderRadius: R.sm, transition: `width ${DUR.fast}` }} />
          </div>
          <span style={{ fontSize: FS.xs, color: C.textDimmer, fontFamily: "monospace" }}>
            {progress.current}/{progress.total}
          </span>
        </div>
      )}

      {/* Filter + Sort + Glaze toggle */}
      <div style={{ display: "flex", gap: SP.xs, justifyContent: "center", flexWrap: "wrap" }}>
        <button onClick={() => setFilter("all")} style={filter === "all" ? S_BTN_ACTIVE : S_BTN}>
          {t("gallery_filter_all")}
        </button>
        <button onClick={() => setFilter("bookmarks")} style={filter === "bookmarks" ? S_BTN_ACTIVE : S_BTN}>
          {t("gallery_filter_bookmarks")} ({bookmarks.length})
        </button>
        <button onClick={() => setSortMode(m => m === "default" ? "hue_asc" : m === "hue_asc" ? "hue_desc" : m === "hue_desc" ? "similar" : "default")}
          style={sortMode !== "default" ? S_BTN_ACTIVE : S_BTN}
          title={t("gallery_sort_title")}>
          {sortMode === "hue_asc" ? t("gallery_sort_hue_asc") : sortMode === "hue_desc" ? t("gallery_sort_hue_desc") : sortMode === "similar" ? t("gallery_sort_similar") : t("gallery_sort_default")}
        </button>
        <label style={{ fontSize: FS.sm, color: C.textDim, cursor: "pointer", display: "flex", alignItems: "center", gap: SP.sm }}>
          <input type="checkbox" checked={showGlaze} onChange={e => setShowGlaze(e.target.checked)} />
          {t("gallery_show_glaze")}
        </label>
      </div>

      {/* Hue filter */}
      <div style={{ display: "flex", gap: SP.md, alignItems: "center", flexWrap: "wrap", justifyContent: "center", fontSize: FS.sm, color: C.textDim }}>
        <span>{t("gallery_filter_hue")}:</span>
        <select value={filterLevel ?? ""} onChange={e => setFilterLevel(e.target.value === "" ? null : Number(e.target.value))}
          style={{ fontSize: FS.sm, background: C.bgSurface, color: C.textPrimary, border: `1px solid ${C.border}`, borderRadius: R.md, padding: `1px ${SP.md}px` }}>
          <option value="">{t("gallery_filter_none")}</option>
          {filterableLevels.map(l => <option key={l.lv} value={l.lv}>L{l.lv} {l.name}</option>)}
        </select>
        {filterLevel !== null && (
          <>
            <div style={S_HUE_FILTER_TRACK}>
              <input type="range" min={0} max={359} step={1} value={filterHue}
                onChange={e => setFilterHue(Number(e.target.value))}
                style={S_HUE_FILTER_INPUT} />
            </div>
            <span style={{ fontFamily: "monospace" }}>{filterHue}°±{filterRange}°</span>
            <input type="range" min={10} max={180} step={5} value={filterRange}
              onChange={e => setFilterRange(Number(e.target.value))}
              style={{ width: 50, accentColor: C.accent }} />
          </>
        )}
      </div>

      {/* Hover preview */}
      {hoverPreviewData && (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: R.lg, overflow: "hidden" }}>
          <ThumbCanvas imageData={hoverPreviewData} w={240} h={Math.round(240 * cvs.h / cvs.w)} />
        </div>
      )}

      {/* Empty states */}
      {filter === "all" && items.length === 0 && !generating && (
        <div style={{ fontSize: FS.md, color: C.textSubtle, textAlign: "center", padding: 16 }}>{t("gallery_empty")}</div>
      )}
      {filter === "bookmarks" && bookmarks.length === 0 && (
        <div style={{ fontSize: FS.md, color: C.textSubtle, textAlign: "center", padding: 16 }}>{t("gallery_no_bookmarks")}</div>
      )}
      {filterLevel !== null && displayItems.length === 0 && items.length > 0 && (
        <div style={{ fontSize: FS.md, color: C.textSubtle, textAlign: "center", padding: 16 }}>{t("gallery_no_match")}</div>
      )}

      {/* Thumbnail grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fill, minmax(${thumbDisplaySize + 14}px, 1fr))`,
        justifyContent: "center",
        gap: SP.lg, width: "100%", padding: "2px 0",
      }}>
        {displayItems.map((item, i) => {
          const isCurrent = ccEqual(item.cc, cc);
          const starred = isBookmarked(item.cc);
          return (
            <div key={i} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: SP.xs,
              padding: 3, borderRadius: R.lg,
              border: isCurrent ? `2px solid ${C.accent}` : `2px solid ${C.bgSurface}`,
              background: isCurrent ? C.activeGlow : "transparent",
              cursor: "pointer",
            }}>
              <div onClick={() => applyScheme(item.cc)}
                onContextMenu={(e) => { e.preventDefault(); toggleBookmark(item.cc); }}
                onMouseEnter={() => setHoverDebounced(item)}
                onMouseLeave={() => setHoverDebounced(null)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); applyScheme(item.cc); }
                  else if (e.key === "b" || e.key === "B") { e.preventDefault(); toggleBookmark(item.cc); }
                }}
                tabIndex={0}
                role="button"
                aria-label={t("gallery_apply") + ` (${i + 1})`}
                title={t("gallery_apply")}>
                <ThumbCanvas imageData={item.imageData} w={thumbDisplaySize} h={Math.round(thumbDisplaySize * cvs.h / cvs.w)} />
              </div>
              <div style={{ display: "flex", gap: SP.xs }}>
                {item.cc.map((ci, lv) => {
                  const alts = LEVEL_CANDIDATES[lv];
                  if (hist[lv] === 0) return null; // skip unused levels
                  const rgb = alts[ci % alts.length]?.rgb ?? [128, 128, 128];
                  return <div key={lv} style={{
                    width: 10, height: 10, borderRadius: R.sm,
                    background: rgbStr(rgb),
                  }} />;
                })}
              </div>
              <button onClick={(e) => { e.stopPropagation(); toggleBookmark(item.cc); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: FS.lg, padding: 2, lineHeight: 1,
                  color: starred ? C.warning : C.textFaint }}
                title={starred ? t("gallery_unbookmark") : t("gallery_bookmark")}>
                {starred ? "\u2605" : "\u2606"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
});
