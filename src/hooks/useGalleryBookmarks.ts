import { useCallback, useState } from "react";
import { LEVEL_CANDIDATES } from "../color-engine";
import { ccEqual } from "./galleryView";

const GALLERY_BOOKMARKS_KEY = "chromalum_bookmarks";
export const GALLERY_BOOKMARKS_MAX = 500;

interface UseGalleryBookmarksOptions {
  limit?: number;
  onLimitReached?: () => void;
  onSaveFailed?: (action: "add" | "remove") => void;
}

function getStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function normalizeGalleryBookmark(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length !== 8) return null;
  if (!value.every((v: unknown) => typeof v === "number" && Number.isFinite(v))) return null;

  return value.map((v, lv) => {
    const maxCand = LEVEL_CANDIDATES[lv]?.length ?? 1;
    return v >= 0 && v < maxCand ? v : v >= 0 ? v % maxCand : 0;
  });
}

function loadGalleryBookmarks(storage: Storage | null = getStorage()): number[][] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(GALLERY_BOOKMARKS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map(normalizeGalleryBookmark).filter((bookmark): bookmark is number[] => bookmark !== null);
  } catch {
    return [];
  }
}

function saveGalleryBookmarks(bookmarks: number[][], storage: Storage | null = getStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(GALLERY_BOOKMARKS_KEY, JSON.stringify(bookmarks));
    return true;
  } catch {
    return false;
  }
}

export function useGalleryBookmarks({ limit = GALLERY_BOOKMARKS_MAX, onLimitReached, onSaveFailed }: UseGalleryBookmarksOptions = {}) {
  const [bookmarks, setBookmarks] = useState<number[][]>(loadGalleryBookmarks);

  const isBookmarked = useCallback((itemCc: number[]) => bookmarks.some((bookmark) => ccEqual(bookmark, itemCc)), [bookmarks]);

  const toggleBookmark = useCallback(
    (itemCc: number[]) => {
      const idx = bookmarks.findIndex((bookmark) => ccEqual(bookmark, itemCc));
      if (idx >= 0) {
        const next = [...bookmarks.slice(0, idx), ...bookmarks.slice(idx + 1)];
        if (!saveGalleryBookmarks(next)) {
          onSaveFailed?.("remove");
          return;
        }
        setBookmarks(next);
        return;
      }

      if (bookmarks.length >= limit) {
        onLimitReached?.();
        return;
      }

      const next = [...bookmarks, [...itemCc]];
      if (!saveGalleryBookmarks(next)) {
        onSaveFailed?.("add");
        return;
      }
      setBookmarks(next);
    },
    [bookmarks, limit, onLimitReached, onSaveFailed],
  );

  return { bookmarks, isBookmarked, toggleBookmark };
}
