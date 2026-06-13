import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const dedupeKey = (slug: string, path: string) => `visit-tracked:${slug}:${path}`;
const DEDUPE_MS = 30 * 60 * 1000;

/**
 * Records a storefront page view via slug-bound RPC (tenant-safe).
 * Dedupes the same path within 30 minutes per browser tab session.
 */
export function useStoreVisitTracking(storeSlug?: string) {
  const location = useLocation();
  const inflightRef = useRef<string | null>(null);

  useEffect(() => {
    const normalized = storeSlug?.trim().toLowerCase();
    if (!normalized) return;

    const pagePath = location.pathname + location.search;
    const key = dedupeKey(normalized, pagePath);

    try {
      const last = sessionStorage.getItem(key);
      if (last && Date.now() - Number(last) < DEDUPE_MS) return;
    } catch {
      /* ignore */
    }

    if (inflightRef.current === key) return;
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
            sessionStorage.setItem(key, String(Date.now()));
          } catch {
            /* ignore */
          }
        }
      })
      .finally(() => {
        if (inflightRef.current === key) inflightRef.current = null;
      });
  }, [storeSlug, location.pathname, location.search]);
}
