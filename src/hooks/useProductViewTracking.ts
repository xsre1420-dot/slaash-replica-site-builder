import { useEffect, useRef } from 'react';
import { scheduleIdle } from '@/utils/scheduleIdle';
import { trackProductViewBySlug } from '@/services/analyticsTrackingService';
import { raceWithTimeout } from '@/lib/memory/asyncGuards';

const dedupeKey = (slug: string, productId: string) => `product-view:${slug}:${productId}`;
const DEDUPE_MS = 30 * 60 * 1000;
const VIEW_RPC_TIMEOUT_MS = 8_000;

/**
 * Records an internal product view via slug-bound RPC (tenant-safe).
 * Deferred + deduped to reduce DB writes under high traffic.
 */
export function useProductViewTracking(storeSlug?: string, productId?: string | null) {
  const inflightRef = useRef<string | null>(null);

  useEffect(() => {
    const normalizedSlug = storeSlug?.trim().toLowerCase();
    const normalizedProductId = productId?.trim();
    if (!normalizedSlug || !normalizedProductId) return;

    const key = dedupeKey(normalizedSlug, normalizedProductId);

    try {
      const last = sessionStorage.getItem(key);
      if (last && Date.now() - Number(last) < DEDUPE_MS) return;
    } catch {
      /* ignore */
    }

    if (inflightRef.current === key) return;

    let cancelled = false;
    let timeoutClear: (() => void) | null = null;

    const cancelIdle = scheduleIdle(() => {
      if (cancelled || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
      inflightRef.current = key;

      const viewPromise = trackProductViewBySlug(
        normalizedSlug,
        normalizedProductId,
        typeof window !== 'undefined' ? window.location.pathname : null
      );

      const timed = raceWithTimeout(viewPromise, VIEW_RPC_TIMEOUT_MS);
      timeoutClear = timed.clear;

      void timed.race
        .then((data) => {
          if (cancelled) return;
          if (data?.success) {
            try {
              sessionStorage.setItem(key, String(Date.now()));
            } catch {
              /* ignore */
            }
          }
        })
        .catch(() => {
          /* product view tracking is best-effort */
        })
        .finally(() => {
          timeoutClear?.();
          if (!cancelled && inflightRef.current === key) inflightRef.current = null;
        });
    });

    return () => {
      cancelled = true;
      timeoutClear?.();
      cancelIdle();
      if (inflightRef.current === key) inflightRef.current = null;
    };
  }, [storeSlug, productId]);
}
