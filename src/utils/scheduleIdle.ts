const DEFAULT_DEFER_MS = 4_000;

/**
 * Runs work after idle time so analytics RPCs do not compete with storefront paint.
 */
export function scheduleIdle(fn: () => void, deferMs = DEFAULT_DEFER_MS): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const run = () => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  };

  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(run, { timeout: 5_000 });
    return () => window.cancelIdleCallback(id);
  }

  const timer = window.setTimeout(run, deferMs);
  return () => window.clearTimeout(timer);
}
