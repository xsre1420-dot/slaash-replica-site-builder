import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const dedupeKey = (slug: string, path: string) => `visit-tracked:${slug}:${path}`;
const slugDedupeKey = (slug: string) => `visit-tracked-slug:${slug}`;
const DEDUPE_MS = 30 * 60 * 1000;
const DEFER_MS = 2_500;

function scheduleIdle(fn: () => void): () => void {
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

  const timer = window.setTimeout(run, DEFER_MS);
  return () => window.clearTimeout(timer);
}

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
      inflightRef.current = key;

      void (supabase as any)
        .rpc('track_store_visit_by_slug', {
          p_store_slug: normalized,
          p_page_path: pagePath,
          p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        })
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
        .finally(() => {
          if (inflightRef.current === key) inflightRef.current = null;
        });
    });

    return cancel;
  }, [storeSlug, location.pathname, location.search]);
}
