import { LEVEL_CANDIDATES } from "../color-engine";
import type { GalleryItem } from "./useGallery";

export type GalleryFilter = "all" | "bookmarks";
export type GallerySortMode = "default" | "hue_asc" | "hue_desc" | "similar";

export function colorChoiceIndicesEqual(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < 8; i++) {
    const na = LEVEL_CANDIDATES[i].length;
    if (a[i] % na !== b[i] % na) return false;
  }
  return true;
}

export function getGalleryPatternCount(locked: readonly boolean[], hist: readonly number[]): number {
  let total = 1;
  for (let lv = 0; lv < 8; lv++) {
    const n = LEVEL_CANDIDATES[lv].length;
    if (!locked[lv] && hist[lv] > 0 && n > 1) total *= n;
  }
  return total;
}

/** Compute average hue angle for a pattern's colorChoiceIndices[] for sorting/display. */
function patternHue(patternColorChoiceIndices: readonly number[]): number {
  let sumAngle = 0;
  let count = 0;
  for (let lv = 0; lv < 8; lv++) {
    const cands = LEVEL_CANDIDATES[lv];
    if (cands.length <= 1) continue;
    const angle = cands[patternColorChoiceIndices[lv] % cands.length].angle;
    if (angle >= 0) {
      sumAngle += angle;
      count++;
    }
  }
  return count > 0 ? sumAngle / count : 0;
}

/** Check whether any chromatic level in a pattern matches the hue filter. */
function matchesHueFilter(patternColorChoiceIndices: readonly number[], filterHue: number, filterRange: number): boolean {
  for (let lv = 1; lv <= 6; lv++) {
    const cands = LEVEL_CANDIDATES[lv];
    if (cands.length <= 1) continue;
    const ci = patternColorChoiceIndices[lv] % cands.length;
    const angle = cands[ci].angle;
    if (angle < 0) continue;
    const diff = Math.abs(angle - filterHue);
    if (Math.min(diff, 360 - diff) <= filterRange) return true;
  }
  return false;
}

/** Count how many variant levels differ between two colorChoiceIndices[] arrays. */
function ccDistance(a: readonly number[], b: readonly number[]): number {
  let dist = 0;
  for (let i = 0; i < 8; i++) {
    const na = LEVEL_CANDIDATES[i].length;
    if (na <= 1) continue;
    if (a[i] % na !== b[i] % na) dist++;
  }
  return dist;
}

interface GalleryDisplayOptions {
  filter: GalleryFilter;
  items: GalleryItem[];
  bookmarkItems: GalleryItem[];
  sortMode: GallerySortMode;
  filterHue: number;
  filterRange: number;
  currentColorChoiceIndices: readonly number[];
}

export function getDisplayGalleryItems({
  filter,
  items,
  bookmarkItems,
  sortMode,
  filterHue,
  filterRange,
  currentColorChoiceIndices,
}: GalleryDisplayOptions): GalleryItem[] {
  let list = filter === "bookmarks" ? bookmarkItems : items;

  if (filterRange < 180) {
    list = list.filter((item) => matchesHueFilter(item.colorChoiceIndices, filterHue, filterRange));
  }

  if (sortMode === "default") return list;

  const sorted = [...list];
  if (sortMode === "similar") {
    sorted.sort(
      (a, b) => ccDistance(a.colorChoiceIndices, currentColorChoiceIndices) - ccDistance(b.colorChoiceIndices, currentColorChoiceIndices),
    );
    return sorted;
  }

  sorted.sort((a, b) => {
    const ha = patternHue(a.colorChoiceIndices);
    const hb = patternHue(b.colorChoiceIndices);
    return sortMode === "hue_asc" ? ha - hb : hb - ha;
  });
  return sorted;
}
