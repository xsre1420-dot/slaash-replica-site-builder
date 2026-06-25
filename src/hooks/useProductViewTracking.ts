import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { scheduleIdle } from '@/utils/scheduleIdle';

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

    const cancel = scheduleIdle(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      inflightRef.current = key;

      const viewPromise = (supabase as any).rpc('track_product_view_by_slug', {
        p_slug: normalizedSlug,
        p_product_id: normalizedProductId,
        p_page_path: typeof window !== 'undefined' ? window.location.pathname : null,
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error('view_timeout')), VIEW_RPC_TIMEOUT_MS);
      });

      void Promise.race([viewPromise, timeoutPromise])
        .then(({ data, error }: { data?: { success?: boolean }; error?: { message?: string } | null }) => {
          if (!error && data?.success) {
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
          if (inflightRef.current === key) inflightRef.current = null;
        });
    });

    return cancel;
  }, [storeSlug, productId]);
}
