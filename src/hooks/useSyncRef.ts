import { useRef, useLayoutEffect } from "react";

export function useSyncRef<T>(value: T): React.MutableRefObject<T> {
  const ref = useRef(value);
  useLayoutEffect(() => { ref.current = value; });
  return ref;
}

/**
 * Sync multiple values into a single ref object with one useLayoutEffect.
 * Reduces hook overhead when many values need to be bridged to imperative code.
 *
 * Usage:
 *   const refs = useSyncRefs({ cvs, colorLUT, brushSize, tool });
 *   // In event handler: refs.current.cvs, refs.current.tool, etc.
 */
export function useSyncRefs<T extends Record<string, unknown>>(values: T): React.MutableRefObject<T> {
  const ref = useRef(values);
  useLayoutEffect(() => { Object.assign(ref.current, values); });
  return ref;
}
