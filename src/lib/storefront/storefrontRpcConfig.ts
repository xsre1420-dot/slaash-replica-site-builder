/**
 * Storefront hot-path RPC defaults — single attempt, bounded timeout, no replica fallback.
 */
import type { RpcCallOptions } from '@/integrations/supabase/rpc';
import type { ReadRpcOptions } from '@/lib/readWrite/readClient';

/** Bundle / catalog reads — fail fast under queue pressure. */
export const STOREFRONT_READ_TIMEOUT_MS = 8_000;

/** Visit / product-view writes — fail fast; must not hold connections under queue pressure. */
export const STOREFRONT_WRITE_TIMEOUT_MS = 5_000;

export const STOREFRONT_BUNDLE_RPC = 'get_storefront_page_bundle';
export const STOREFRONT_VISIT_RPC = 'track_store_visit_by_slug';
export const STOREFRONT_PRODUCT_VIEW_RPC = 'track_product_view_by_slug';

export type StorefrontBundleRequestOptions = {
  limit?: number;
  cursor?: string | null;
  category?: string;
  search?: string;
};

/** In-flight dedup key — includes every RPC argument that changes the response. */
export function storefrontBundleInflightKey(
  slug: string,
  options: StorefrontBundleRequestOptions = {},
  scope: 'fetch' | 'rpc' = 'fetch'
): string {
  const normalized = slug.trim().toLowerCase();
  const limit = options.limit ?? 24;
  const cursor = options.cursor || '';
  const category = options.category?.trim() || '';
  const search = options.search?.trim() || '';
  return `${scope}:${STOREFRONT_BUNDLE_RPC}:${normalized}:${limit}:${cursor}:${category}:${search}`;
}

/**
 * Singleflight key for first-page bundle loads/refreshes.
 * Collapses cache expiry bursts into one shared in-flight request per store slug.
 */
export function storefrontBundleStampedeKey(
  slug: string,
  options: StorefrontBundleRequestOptions = {}
): string {
  const normalized = slug.trim().toLowerCase();
  if (isStorefrontBundleFirstPage(options)) {
    return `stampede:storefront-bundle:${normalized}`;
  }
  return storefrontBundleInflightKey(normalized, options, 'fetch');
}

/** Shared SWR revalidate dedup key — aligned with stampede singleflight. */
export function storefrontBundleRevalidateKey(
  slug: string,
  options: StorefrontBundleRequestOptions = {}
): string {
  return `revalidate:${storefrontBundleStampedeKey(slug, options)}`;
}

export function isStorefrontBundleFirstPage(options: StorefrontBundleRequestOptions = {}): boolean {
  return !options.cursor && !options.category?.trim() && !options.search?.trim();
}

export function getStorefrontReadRpcOptions(
  overrides: ReadRpcOptions = {}
): ReadRpcOptions {
  return {
    timeoutMs: STOREFRONT_READ_TIMEOUT_MS,
    skipReplicaFallback: true,
    trafficClass: 'critical',
    ...overrides,
  };
}

export function getStorefrontVisitWriteOptions(
  overrides: RpcCallOptions = {}
): RpcCallOptions {
  return {
    timeoutMs: STOREFRONT_WRITE_TIMEOUT_MS,
    forcePrimary: true,
    skipReplicaFallback: true,
    skipBreaker: true,
    trafficClass: 'background',
    ...overrides,
  };
}
