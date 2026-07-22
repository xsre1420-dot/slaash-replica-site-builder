const DEFAULT_DEFER_MS = 800;

/**
 * Defers analytics RPCs briefly so they do not block paint, but still runs reliably.
 * Waits for tab visibility when the page opens in a background tab.
 */
export function scheduleAnalyticsTask(
  task: () => void | Promise<void>,
  deferMs = DEFAULT_DEFER_MS
): () => void {
  if (typeof window === 'undefined') return () => undefined;

  let cancelled = false;
  let completed = false;
  let removeVisibleListener: (() => void) | null = null;

  const run = () => {
    if (cancelled || completed) return;
    completed = true;
    removeVisibleListener?.();
    removeVisibleListener = null;
    try {
      void task();
    } catch {
      /* analytics is best-effort */
    }
  };

  const scheduleRun = () => {
    if (cancelled || completed) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      const onVisibility = () => {
        if (document.visibilityState === 'visible') run();
      };
      document.addEventListener('visibilitychange', onVisibility);
      removeVisibleListener = () =>
        document.removeEventListener('visibilitychange', onVisibility);
      return;
    }
    run();
  };

  const timer = window.setTimeout(scheduleRun, deferMs);

  return () => {
    cancelled = true;
    window.clearTimeout(timer);
    removeVisibleListener?.();
  };
}
