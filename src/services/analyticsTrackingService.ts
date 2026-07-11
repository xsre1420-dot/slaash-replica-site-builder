/**
 * Public storefront analytics events — visit and product view tracking.
 */
import { callSupabaseRpc } from '@/services/database';
import { traceCriticalFlow } from '@/lib/tracing';

export async function trackStoreVisitBySlug(
  storeSlug: string,
  pagePath: string,
  userAgent: string | null
): Promise<{ success?: boolean; deduped?: boolean; rate_limited?: boolean }> {
  return traceCriticalFlow('analytics', 'rpc', 'storeVisit', async () => {
  const { data, error } = await callSupabaseRpc<Record<string, unknown>>('track_store_visit_by_slug', {
    p_store_slug: storeSlug,
    p_page_path: pagePath,
    p_user_agent: userAgent,
  });
  if (error) throw new Error(error);
  return (data ?? {}) as { success?: boolean; deduped?: boolean; rate_limited?: boolean };
  }, { storeSlug, pagePath });
}

export async function trackProductViewBySlug(
  slug: string,
  productId: string,
  pagePath: string | null
): Promise<{ success?: boolean; deduped?: boolean }> {
  const { data, error } = await callSupabaseRpc<Record<string, unknown>>('track_product_view_by_slug', {
    p_slug: slug,
    p_product_id: productId,
    p_page_path: pagePath,
  });
  if (error) throw new Error(error);
  return (data ?? {}) as { success?: boolean; deduped?: boolean };
}

/** Drain buffered storefront analytics so dashboard visitor counts stay accurate. */
export async function flushMerchantAnalyticsBuffer(
  limit = 200
): Promise<{ success?: boolean; processed?: number }> {
  try {
    const { data, error } = await callSupabaseRpc<Record<string, unknown>>(
      'flush_merchant_analytics_buffer',
      { p_limit: limit }
    );
    if (error) return { success: false };
    return {
      success: data?.success === true,
      processed: Number(data?.processed ?? 0),
    };
  } catch {
    return { success: false };
  }
}
