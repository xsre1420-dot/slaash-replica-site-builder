import { useEffect, useRef } from 'react';

/**
 * Runs callback on an interval only while the document is visible.
 * Clears immediately when the component unmounts or the tab is hidden.
 */
export function useVisibilityAwareInterval(
  callback: () => void,
  intervalMs: number,
  enabled = true
): void {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;

    const tick = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      savedCallback.current();
    };

    const id = window.setInterval(tick, intervalMs);

    const onVisibility = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, intervalMs]);
}
