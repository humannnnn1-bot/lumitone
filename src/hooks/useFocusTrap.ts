import { useEffect, useRef } from "react";

/**
 * Traps keyboard focus within a dialog element when active.
 * Handles Tab cycling and optional Escape to close.
 */
export function useFocusTrap(ref: React.RefObject<HTMLElement | null>, active: boolean, onEscape?: () => void): void {
  const previousActiveRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    previousActiveRef.current = document.activeElement as HTMLElement | null;
    if (focusable.length) {
      const first = focusable[0];
      // On touch devices, auto-focusing a form field pops up the virtual keyboard,
      // which is intrusive when the user hasn't asked for it. Combine multiple
      // signals because no single check is reliable across DevTools emulation,
      // hybrid devices, and real mobile browsers.
      const isFormField = first.tagName === "INPUT" || first.tagName === "TEXTAREA" || first.tagName === "SELECT";
      const isTouch = navigator.maxTouchPoints > 0 || "ontouchstart" in window || !window.matchMedia("(pointer: fine)").matches;
      if (!(isFormField && isTouch)) first.focus();
    }
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onEscape) {
        onEscape();
        return;
      }
      if (e.key !== "Tab") return;
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    el.addEventListener("keydown", handler);
    return () => {
      el.removeEventListener("keydown", handler);
      const prev = previousActiveRef.current;
      if (prev && prev !== document.body && document.body.contains(prev)) {
        try {
          prev.focus();
        } catch {
          /* element may not be focusable */
        }
      }
    };
  }, [ref, active, onEscape]);
}
