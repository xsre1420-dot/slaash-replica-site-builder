import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const dedupeKey = (slug: string, productId: string) => `product-view:${slug}:${productId}`;
const DEDUPE_MS = 30 * 60 * 1000;

/**
 * Records an internal product view via slug-bound RPC (tenant-safe).
 * Dedupes the same product within 30 minutes per browser tab session.
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
    inflightRef.current = key;

    void (supabase as any)
      .rpc('track_product_view_by_slug', {
        p_slug: normalizedSlug,
        p_product_id: normalizedProductId,
        p_page_path: typeof window !== 'undefined' ? window.location.pathname : null,
      })
      .then(({ error }: { error?: { message?: string } | null }) => {
        if (!error) {
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
  }, [storeSlug, productId]);
}
