import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { scheduleAnalyticsTask } from '@/utils/scheduleAnalytics';
import { enqueueAnalyticsVisit } from '@/background/enqueue';
import { logStorefrontRequest } from '@/lib/storefront/storefrontRequestDebug';
import { STOREFRONT_VISIT_RPC } from '@/lib/storefront/storefrontRpcConfig';

const slugDedupeKey = (slug: string) => `visit-tracked-slug:${slug}`;
const pendingKey = (slug: string) => `visit-pending-slug:${slug}`;
const DEDUPE_MS = 30 * 60 * 1000;
const VISIT_PENDING_MS = 15_000;

export type UseStoreVisitTrackingOptions = {
  /** When false, visit tracking waits until storefront data is available. */
  storefrontReady?: boolean;
};

function markVisitPending(slug: string): void {
  try {
    sessionStorage.setItem(pendingKey(slug), String(Date.now()));
  } catch {
    /* ignore */
  }
}

function clearVisitPending(slug: string): void {
  try {
    sessionStorage.removeItem(pendingKey(slug));
  } catch {
    /* ignore */
  }
}

function scheduleVisitWhenIdle(task: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;

  let cancelled = false;
  let cancelAnalytics: (() => void) | null = null;

  const run = () => {
    if (cancelled) return;
    cancelAnalytics = scheduleAnalyticsTask(task, 0);
  };

  if (typeof requestIdleCallback !== 'undefined') {
    const idleId = requestIdleCallback(run, { timeout: 4_000 });
    return () => {
      cancelled = true;
      cancelIdleCallback(idleId);
      cancelAnalytics?.();
    };
  }

  cancelAnalytics = scheduleAnalyticsTask(run, 800);
  return () => {
    cancelled = true;
    cancelAnalytics?.();
  };
}

/**
 * Records a storefront page view via slug-bound RPC (tenant-safe).
 * Runs only after storefront data is ready; enqueued in background — never blocks render.
 */
export function useStoreVisitTracking(
  storeSlug?: string,
  options: UseStoreVisitTrackingOptions = {}
) {
  const { storefrontReady = true } = options;
  const location = useLocation();
  const inflightRef = useRef<string | null>(null);

  useEffect(() => {
    const normalized = storeSlug?.trim().toLowerCase();
    if (!normalized || !storefrontReady) return;

    const pagePath = location.pathname + location.search;
    const slugKey = slugDedupeKey(normalized);

    try {
      const lastSlug = sessionStorage.getItem(slugKey);
      if (lastSlug && Date.now() - Number(lastSlug) < DEDUPE_MS) {
        logStorefrontRequest(STOREFRONT_VISIT_RPC, 'dedup_hit', { slug: normalized, reason: 'slug_session' });
        return;
      }

      const slugPending = sessionStorage.getItem(pendingKey(normalized));
      if (slugPending && Date.now() - Number(slugPending) < VISIT_PENDING_MS) {
        logStorefrontRequest(STOREFRONT_VISIT_RPC, 'dedup_hit', { slug: normalized, reason: 'pending' });
        return;
      }
    } catch {
      /* ignore */
    }

    if (inflightRef.current === slugKey) {
      logStorefrontRequest(STOREFRONT_VISIT_RPC, 'dedup_hit', { slug: normalized, reason: 'inflight_ref' });
      return;
    }

    markVisitPending(normalized);

    let cancelled = false;

    const cancelDeferred = scheduleVisitWhenIdle(() => {
      if (cancelled) return;
      inflightRef.current = slugKey;

      logStorefrontRequest(STOREFRONT_VISIT_RPC, 'start', { slug: normalized, path: pagePath, queued: true });

      const jobId = enqueueAnalyticsVisit(
        normalized,
        pagePath,
        typeof navigator !== 'undefined' ? navigator.userAgent : null
      );

      if (jobId) {
        try {
          sessionStorage.setItem(slugKey, String(Date.now()));
        } catch {
          /* ignore */
        }
        logStorefrontRequest(STOREFRONT_VISIT_RPC, 'end', { slug: normalized, queued: true });
      } else {
        logStorefrontRequest(STOREFRONT_VISIT_RPC, 'error', { slug: normalized, queued: true });
      }

      clearVisitPending(normalized);
      if (!cancelled && inflightRef.current === slugKey) inflightRef.current = null;
    });

    return () => {
      cancelled = true;
      cancelDeferred();
      clearVisitPending(normalized);
      if (inflightRef.current === slugKey) inflightRef.current = null;
    };
  }, [storeSlug, location.pathname, location.search, storefrontReady]);
}
