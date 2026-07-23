/**
 * Phase 6 — Documented TTL policies per data class and surface.
 * All values in milliseconds unless noted.
 */
export type TtlPolicy = {
  ttlMs: number;
  staleWhileRevalidateMs: number;
  tier: 'never' | 'short' | 'medium' | 'long' | 'static';
  notes: string;
};

export const CacheTTLPolicy = {
  /** Critical — do not cache at application layer */
  critical: {
    checkout: { ttlMs: 0, staleWhileRevalidateMs: 0, tier: 'never' as const, notes: 'Checkout reads bypass cache' },
    payment: { ttlMs: 0, staleWhileRevalidateMs: 0, tier: 'never' as const, notes: 'Payment verification' },
    inventory_live: { ttlMs: 0, staleWhileRevalidateMs: 0, tier: 'never' as const, notes: 'Live stock at checkout' },
  },

  /** Short — 30s fresh, 15s SWR */
  short: {
    default: { ttlMs: 30_000, staleWhileRevalidateMs: 15_000, tier: 'short' as const, notes: 'Order lists, workflow counts' },
    orders_filtered: { ttlMs: 30_000, staleWhileRevalidateMs: 15_000, tier: 'short' as const, notes: 'Merchant order list pages' },
    platform_health: { ttlMs: 30_000, staleWhileRevalidateMs: 15_000, tier: 'short' as const, notes: 'Health probe cache' },
    merchant_catalog: { ttlMs: 30_000, staleWhileRevalidateMs: 15_000, tier: 'short' as const, notes: 'Merchant product list' },
    merchant_categories: { ttlMs: 300_000, staleWhileRevalidateMs: 60_000, tier: 'long' as const, notes: 'Merchant categories — rare changes, CRUD invalidates' },
  },

  /** Medium — 60–90s fresh */
  medium: {
    default: { ttlMs: 60_000, staleWhileRevalidateMs: 30_000, tier: 'medium' as const, notes: 'General semi-static reads' },
    dashboard_batch: { ttlMs: 90_000, staleWhileRevalidateMs: 45_000, tier: 'medium' as const, notes: 'Dashboard statistics batch' },
    dashboard_kpis: { ttlMs: 90_000, staleWhileRevalidateMs: 45_000, tier: 'medium' as const, notes: 'Dashboard light KPIs' },
    statistics: { ttlMs: 90_000, staleWhileRevalidateMs: 45_000, tier: 'medium' as const, notes: 'Analytics reports page' },
    store_settings: { ttlMs: 300_000, staleWhileRevalidateMs: 60_000, tier: 'medium' as const, notes: 'Merchant store settings' },
    product_detail: { ttlMs: 60_000, staleWhileRevalidateMs: 30_000, tier: 'medium' as const, notes: 'Storefront product detail' },
    recommendations: { ttlMs: 60_000, staleWhileRevalidateMs: 30_000, tier: 'medium' as const, notes: 'Suggested / footer products' },
  },

  /** Long — 2–5 min fresh (storefront) */
  long: {
    storefront: { ttlMs: 120_000, staleWhileRevalidateMs: 60_000, tier: 'long' as const, notes: 'Public storefront bundle + pages' },
    marketing_public: { ttlMs: 180_000, staleWhileRevalidateMs: 90_000, tier: 'long' as const, notes: 'Public marketing config' },
    distributed_l2: { ttlMs: 120_000, staleWhileRevalidateMs: 60_000, tier: 'long' as const, notes: 'Redis/KV L2 default' },
    database_rollup: { ttlMs: 300_000, staleWhileRevalidateMs: 600_000, tier: 'long' as const, notes: 'store_daily_stats rollups' },
  },

  /** Static — hours/days (CDN / browser) */
  static: {
    media_cdn: { ttlMs: 86_400_000, staleWhileRevalidateMs: 604_800_000, tier: 'static' as const, notes: 'CDN media assets 24h–7d' },
    policies: { ttlMs: 600_000, staleWhileRevalidateMs: 300_000, tier: 'static' as const, notes: 'Store policies — rare changes' },
    landing: { ttlMs: 300_000, staleWhileRevalidateMs: 180_000, tier: 'static' as const, notes: 'Marketing landing pages' },
    browser_idb_storefront: { ttlMs: 600_000, staleWhileRevalidateMs: 300_000, tier: 'static' as const, notes: 'IndexedDB storefront tier' },
  },

  /** Edge layer (edge function in-memory) */
  edge: {
    bundle: { ttlMs: 60_000, staleWhileRevalidateMs: 120_000, tier: 'long' as const, notes: 'Edge storefront bundle' },
    products_page: { ttlMs: 45_000, staleWhileRevalidateMs: 90_000, tier: 'long' as const, notes: 'Edge product listing' },
  },
} as const;

/** Resolve TTL for a named policy path e.g. 'dashboard.batch' */
export function resolveTtlPolicy(path: string): TtlPolicy {
  const parts = path.split('.');
  let node: unknown = CacheTTLPolicy;
  for (const p of parts) {
    if (node && typeof node === 'object' && p in (node as object)) {
      node = (node as Record<string, unknown>)[p];
    } else {
      return CacheTTLPolicy.medium.default;
    }
  }
  if (node && typeof node === 'object' && 'ttlMs' in (node as object)) {
    return node as TtlPolicy;
  }
  return CacheTTLPolicy.medium.default;
}

/** Backward-compatible re-export aligned with legacy CacheTTL constants */
export const LegacyCacheTTLMap = {
  SHORT: CacheTTLPolicy.short.default.ttlMs,
  MEDIUM: CacheTTLPolicy.medium.default.ttlMs,
  LONG: CacheTTLPolicy.long.storefront.ttlMs,
  ANALYTICS: CacheTTLPolicy.medium.dashboard_batch.ttlMs,
  STOREFRONT: CacheTTLPolicy.long.storefront.ttlMs,
} as const;
