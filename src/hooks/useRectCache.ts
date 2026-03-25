import { useRef, useEffect, useCallback } from "react";

const CACHE_TTL = 100; // ms

/**
 * Caches getBoundingClientRect() for a canvas element.
 * Invalidates on resize (via ResizeObserver) or scroll.
 * Returns a function that retrieves the cached or fresh rect.
 */
export function useRectCache(ref: React.RefObject<HTMLElement | null>): () => DOMRect {
  const cacheRef = useRef<{ rect: DOMRect; time: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const invalidate = () => { cacheRef.current = null; };
    const observer = new ResizeObserver(invalidate);
    observer.observe(el);
    window.addEventListener("scroll", invalidate, { passive: true, capture: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", invalidate, true);
    };
  }, [ref]);

  return useCallback(() => {
    const el = ref.current;
    if (!el) return new DOMRect();
    const now = performance.now();
    const c = cacheRef.current;
    if (c && now - c.time < CACHE_TTL) return c.rect;
    const rect = el.getBoundingClientRect();
    cacheRef.current = { rect, time: now };
    return rect;
  }, [ref]);
}
