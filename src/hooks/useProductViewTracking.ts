import { useEffect, useRef } from 'react';
import { scheduleAnalyticsTask } from '@/utils/scheduleAnalytics';
import { enqueueAnalyticsProductView } from '@/background/enqueue';

const dedupeKey = (slug: string, productId: string) => `product-view:${slug}:${productId}`;
const DEDUPE_MS = 30 * 60 * 1000;

export type UseProductViewTrackingOptions = {
  /** When false, product view tracking waits until storefront data is available. */
  storefrontReady?: boolean;
};

/**
 * Records an internal product view via slug-bound RPC (tenant-safe).
 * Deferred + deduped + enqueued — never blocks storefront render.
 */
export function useProductViewTracking(
  storeSlug?: string,
  productId?: string | null,
  options: UseProductViewTrackingOptions = {}
) {
  const { storefrontReady = true } = options;
  const inflightRef = useRef<string | null>(null);

  useEffect(() => {
    const normalizedSlug = storeSlug?.trim().toLowerCase();
    const normalizedProductId = productId?.trim();
    if (!normalizedSlug || !normalizedProductId || !storefrontReady) return;

    const key = dedupeKey(normalizedSlug, normalizedProductId);

    try {
      const last = sessionStorage.getItem(key);
      if (last && Date.now() - Number(last) < DEDUPE_MS) return;
    } catch {
      /* ignore */
    }

    if (inflightRef.current === key) return;

    let cancelled = false;

    const cancelDeferred = scheduleAnalyticsTask(() => {
      if (cancelled) return;
      inflightRef.current = key;

      const jobId = enqueueAnalyticsProductView(
        normalizedSlug,
        normalizedProductId,
        typeof window !== 'undefined' ? window.location.pathname : null
      );

      if (jobId) {
        try {
          sessionStorage.setItem(key, String(Date.now()));
        } catch {
          /* ignore */
        }
      }

      if (!cancelled && inflightRef.current === key) inflightRef.current = null;
    });

    return () => {
      cancelled = true;
      cancelDeferred();
      if (inflightRef.current === key) inflightRef.current = null;
    };
  }, [storeSlug, productId, storefrontReady]);
}
