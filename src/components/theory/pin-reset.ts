import { createContext, useContext, useEffect } from "react";

/** Context to signal all theory components to clear their pinned state */
export const PinResetContext = createContext(0);

/** Hook for theory components: clears pinned state when background is clicked */
export function usePinReset(setPinned: (v: null) => void) {
  const resetCount = useContext(PinResetContext);
  useEffect(() => {
    if (resetCount > 0) setPinned(null);
  }, [resetCount, setPinned]);
}
