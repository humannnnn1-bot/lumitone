/**
 * Unified error handler utility for Lumitone.
 *
 * Usage:
 *   const handle = createErrorHandler("AutoSave");
 *   saveState(data).catch(handle);
 *
 *   // With optional toast callback:
 *   const handle = createErrorHandler("Restore", (msg) => showToast(msg, "error"));
 *   loadState().catch(handle);
 */

export type AnnounceCallback = (message: string) => void;

export function createErrorHandler(context: string, onError?: AnnounceCallback) {
  return (err: unknown): void => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Lumitone [${context}]: ${message}`);
    if (onError) onError(message);
  };
}
