import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { scheduleIdle } from '@/utils/scheduleIdle';
import { trackStoreVisitBySlug } from '@/services/analyticsTrackingService';
import { raceWithTimeout } from '@/lib/memory/asyncGuards';

const dedupeKey = (slug: string, path: string) => `visit-tracked:${slug}:${path}`;
const slugDedupeKey = (slug: string) => `visit-tracked-slug:${slug}`;
const DEDUPE_MS = 30 * 60 * 1000;
const VISIT_RPC_TIMEOUT_MS = 8_000;

/**
 * Records a storefront page view via slug-bound RPC (tenant-safe).
 * Deferred + deduped to reduce DB writes under high traffic (1000+ users).
 */
export function useStoreVisitTracking(storeSlug?: string) {
  const location = useLocation();
  const inflightRef = useRef<string | null>(null);

  useEffect(() => {
    const normalized = storeSlug?.trim().toLowerCase();
    if (!normalized) return;

    const pagePath = location.pathname + location.search;
    const key = dedupeKey(normalized, pagePath);
    const slugKey = slugDedupeKey(normalized);
    const isStoreHome = pagePath === `/store/${normalized}` || pagePath === `/store/${normalized}/`;

    try {
      const lastPath = sessionStorage.getItem(key);
      if (lastPath && Date.now() - Number(lastPath) < DEDUPE_MS) return;

      if (isStoreHome) {
        const lastSlug = sessionStorage.getItem(slugKey);
        if (lastSlug && Date.now() - Number(lastSlug) < DEDUPE_MS) return;
      }
    } catch {
      /* ignore */
    }

    if (inflightRef.current === key) return;

    let cancelled = false;
    let timeoutClear: (() => void) | null = null;

    const cancelIdle = scheduleIdle(() => {
      if (cancelled || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
      inflightRef.current = key;

      const visitPromise = trackStoreVisitBySlug(
        normalized,
        pagePath,
        typeof navigator !== 'undefined' ? navigator.userAgent : null
      );

      const timed = raceWithTimeout(visitPromise, VISIT_RPC_TIMEOUT_MS);
      timeoutClear = timed.clear;

      void timed.race
        .then((data) => {
          if (cancelled) return;
          if (data?.success) {
            try {
              const now = String(Date.now());
              sessionStorage.setItem(key, now);
              if (isStoreHome) sessionStorage.setItem(slugKey, now);
            } catch {
              /* ignore */
            }
          }
        })
        .catch(() => {
          /* visit tracking is best-effort — never block storefront */
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
  }, [storeSlug, location.pathname, location.search]);
}
