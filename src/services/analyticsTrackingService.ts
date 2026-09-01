/**
 * Public storefront analytics events — visit and product view tracking.
 */
import { callWriteRpc } from '@/lib/readWrite/writeClient';
import { traceCriticalFlow } from '@/lib/tracing';
import { dedup, peekInflight } from '@/lib/cache';
import {
  getStorefrontVisitWriteOptions,
  STOREFRONT_PRODUCT_VIEW_RPC,
  STOREFRONT_VISIT_RPC,
} from '@/lib/storefront/storefrontRpcConfig';
import { logStorefrontRequest } from '@/lib/storefront/storefrontRequestDebug';

const VISIT_SLUG_DEDUPE_MS = 30 * 60 * 1000;
const PRODUCT_VIEW_DEDUPE_MS = 30 * 60 * 1000;
const recentSlugVisits = new Map<string, number>();
const recentProductViews = new Map<string, number>();

const visitSlugInflightKey = (storeSlug: string) =>
  `visit-slug:${storeSlug.trim().toLowerCase()}`;

const productViewInflightKey = (slug: string, productId: string) =>
  `product-view:${slug.trim().toLowerCase()}:${productId}`;

function shouldSkipRecentSlugVisit(normalized: string): boolean {
  const last = recentSlugVisits.get(normalized);
  if (!last) return false;
  if (Date.now() - last >= VISIT_SLUG_DEDUPE_MS) {
    recentSlugVisits.delete(normalized);
    return false;
  }
  return true;
}

function markRecentSlugVisit(normalized: string): void {
  recentSlugVisits.set(normalized, Date.now());
  if (recentSlugVisits.size > 500) {
    const cutoff = Date.now() - VISIT_SLUG_DEDUPE_MS;
    for (const [slug, ts] of recentSlugVisits) {
      if (ts < cutoff) recentSlugVisits.delete(slug);
    }
  }
}

function shouldSkipRecentProductView(key: string): boolean {
  const last = recentProductViews.get(key);
  if (!last) return false;
  if (Date.now() - last >= PRODUCT_VIEW_DEDUPE_MS) {
    recentProductViews.delete(key);
    return false;
  }
  return true;
}

function markRecentProductView(key: string): void {
  recentProductViews.set(key, Date.now());
  if (recentProductViews.size > 500) {
    const cutoff = Date.now() - PRODUCT_VIEW_DEDUPE_MS;
    for (const [viewKey, ts] of recentProductViews) {
      if (ts < cutoff) recentProductViews.delete(viewKey);
    }
  }
}

export async function trackStoreVisitBySlug(
  storeSlug: string,
  pagePath: string,
  userAgent: string | null
): Promise<{ success?: boolean; deduped?: boolean; rate_limited?: boolean; error?: string }> {
  const normalized = storeSlug.trim().toLowerCase();
  const path = pagePath || '/';
  const key = visitSlugInflightKey(normalized);

  if (shouldSkipRecentSlugVisit(normalized)) {
    logStorefrontRequest(STOREFRONT_VISIT_RPC, 'dedup_hit', {
      slug: normalized,
      path,
      reason: 'slug_window',
    });
    return { success: true, deduped: true };
  }

  if (peekInflight(key)) {
    logStorefrontRequest(STOREFRONT_VISIT_RPC, 'dedup_hit', { slug: normalized, path, reason: 'inflight' });
  }

  return dedup(key, async () => {
    if (shouldSkipRecentSlugVisit(normalized)) {
      return { success: true, deduped: true };
    }

    try {
      return await traceCriticalFlow('analytics', 'rpc', 'storeVisit', async () => {
        logStorefrontRequest(STOREFRONT_VISIT_RPC, 'start', { slug: normalized, path });
        const started = Date.now();
        const { data, error } = await callWriteRpc<Record<string, unknown>>(
          STOREFRONT_VISIT_RPC,
          {
            p_store_slug: normalized,
            p_page_path: path,
            p_user_agent: userAgent,
          },
          { ...getStorefrontVisitWriteOptions(), singleTransport: true }
        );
        const durationMs = Date.now() - started;
        if (error) {
          logStorefrontRequest(STOREFRONT_VISIT_RPC, 'error', {
            durationMs,
            message: error.slice(0, 80),
          });
          return { success: false, error };
        }
        markRecentSlugVisit(normalized);
        logStorefrontRequest(STOREFRONT_VISIT_RPC, 'end', { durationMs });
        return (data ?? {}) as { success?: boolean; deduped?: boolean; rate_limited?: boolean };
      }, { storeSlug: normalized, pagePath: path });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'visit tracking failed';
      logStorefrontRequest(STOREFRONT_VISIT_RPC, 'error', { message: message.slice(0, 80) });
      return { success: false, error: message };
    }
  });
}

export async function trackProductViewBySlug(
  slug: string,
  productId: string,
  pagePath: string | null
): Promise<{ success?: boolean; deduped?: boolean; error?: string }> {
  const normalized = slug.trim().toLowerCase();
  const normalizedProductId = productId.trim();
  const key = productViewInflightKey(normalized, normalizedProductId);

  if (shouldSkipRecentProductView(key)) {
    logStorefrontRequest(STOREFRONT_PRODUCT_VIEW_RPC, 'dedup_hit', {
      slug: normalized,
      productId: normalizedProductId,
      reason: 'view_window',
    });
    return { success: true, deduped: true };
  }

  if (peekInflight(key)) {
    logStorefrontRequest(STOREFRONT_PRODUCT_VIEW_RPC, 'dedup_hit', {
      slug: normalized,
      productId: normalizedProductId,
      reason: 'inflight',
    });
  }

  return dedup(key, async () => {
    if (shouldSkipRecentProductView(key)) {
      return { success: true, deduped: true };
    }

    try {
      return await traceCriticalFlow('analytics', 'rpc', 'productView', async () => {
        logStorefrontRequest(STOREFRONT_PRODUCT_VIEW_RPC, 'start', {
          slug: normalized,
          productId: normalizedProductId,
        });
        const started = Date.now();
        const { data, error } = await callWriteRpc<Record<string, unknown>>(
          STOREFRONT_PRODUCT_VIEW_RPC,
          {
            p_slug: normalized,
            p_product_id: normalizedProductId,
            p_page_path: pagePath,
          },
          { ...getStorefrontVisitWriteOptions(), singleTransport: true }
        );
        const durationMs = Date.now() - started;
        if (error) {
          logStorefrontRequest(STOREFRONT_PRODUCT_VIEW_RPC, 'error', {
            durationMs,
            message: error.slice(0, 80),
          });
          return { success: false, error };
        }
        markRecentProductView(key);
        logStorefrontRequest(STOREFRONT_PRODUCT_VIEW_RPC, 'end', { durationMs });
        return (data ?? {}) as { success?: boolean; deduped?: boolean };
      }, { storeSlug: normalized, productId: normalizedProductId });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'product view tracking failed';
      logStorefrontRequest(STOREFRONT_PRODUCT_VIEW_RPC, 'error', {
        message: message.slice(0, 80),
      });
      return { success: false, error: message };
    }
  });
}

/** Drain buffered storefront analytics so dashboard visitor counts stay accurate. */
export async function flushMerchantAnalyticsBuffer(
  limit = 200
): Promise<{ success?: boolean; processed?: number }> {
  try {
    const { data, error } = await callWriteRpc<Record<string, unknown>>(
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
