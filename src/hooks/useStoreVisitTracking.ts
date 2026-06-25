import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { scheduleIdle } from '@/utils/scheduleIdle';

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

    const cancel = scheduleIdle(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      inflightRef.current = key;

      const visitPromise = (supabase as any).rpc('track_store_visit_by_slug', {
        p_store_slug: normalized,
        p_page_path: pagePath,
        p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error('visit_timeout')), VISIT_RPC_TIMEOUT_MS);
      });

      void Promise.race([visitPromise, timeoutPromise])
        .then(({ data }: { data?: { success?: boolean } }) => {
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
          if (inflightRef.current === key) inflightRef.current = null;
        });
    });

    return cancel;
  }, [storeSlug, location.pathname, location.search]);
}
