/**
 * Multi-layer cache strategy — configuration only; no infra coupling.
 * L1 = in-process LRU, L2 = optional KV, L3 = edge, L4 = CDN, L5 = browser.
 */
import { features } from '@/config/features';

export type CacheLayer = 'browser' | 'cdn' | 'edge' | 'application_l1' | 'application_l2' | 'database';

export type CacheTierConfig = {
  layer: CacheLayer;
  enabled: boolean;
  defaultTtlMs: number;
  staleWhileRevalidateMs: number;
  versionKeyPrefix: string;
  invalidation: 'ttl' | 'event' | 'version_bump' | 'prefix_flush';
};

export const CACHE_TIERS: Record<string, CacheTierConfig> = {
  storefront_bundle: {
    layer: 'edge',
    enabled: features.storefrontEdge,
    defaultTtlMs: 60_000,
    staleWhileRevalidateMs: 120_000,
    versionKeyPrefix: 'sf:v:',
    invalidation: 'version_bump',
  },
  storefront_products: {
    layer: 'edge',
    enabled: features.storefrontEdge,
    defaultTtlMs: 45_000,
    staleWhileRevalidateMs: 90_000,
    versionKeyPrefix: 'sf:products:',
    invalidation: 'version_bump',
  },
  dashboard_stats: {
    layer: 'application_l1',
    enabled: true,
    defaultTtlMs: 90_000,
    staleWhileRevalidateMs: 180_000,
    versionKeyPrefix: 'dash:',
    invalidation: 'ttl',
  },
  merchant_catalog: {
    layer: 'application_l1',
    enabled: true,
    defaultTtlMs: 30_000,
    staleWhileRevalidateMs: 60_000,
    versionKeyPrefix: 'catalog:',
    invalidation: 'event',
  },
  media_assets: {
    layer: 'cdn',
    enabled: features.cdnMedia,
    defaultTtlMs: 86_400_000,
    staleWhileRevalidateMs: 604_800_000,
    versionKeyPrefix: 'cdn:',
    invalidation: 'version_bump',
  },
  distributed_l2: {
    layer: 'application_l2',
    enabled: features.distributedCache,
    defaultTtlMs: 120_000,
    staleWhileRevalidateMs: 240_000,
    versionKeyPrefix: 'kv:',
    invalidation: 'prefix_flush',
  },
  store_daily_stats: {
    layer: 'database',
    enabled: true,
    defaultTtlMs: 300_000,
    staleWhileRevalidateMs: 600_000,
    versionKeyPrefix: 'rollup:',
    invalidation: 'ttl',
  },
};

export function getCacheStrategySummary(): {
  layers: CacheLayer[];
  tiersEnabled: number;
  l2Configured: boolean;
  cdnConfigured: boolean;
  edgeConfigured: boolean;
} {
  const tiers = Object.values(CACHE_TIERS);
  return {
    layers: [...new Set(tiers.map((t) => t.layer))],
    tiersEnabled: tiers.filter((t) => t.enabled).length,
    l2Configured: features.distributedCache,
    cdnConfigured: features.cdnMedia,
    edgeConfigured: features.storefrontEdge,
  };
}

export function buildVersionedCacheKey(prefix: string, ownerId: string, version?: number): string {
  const v = version ?? 0;
  return `${prefix}${ownerId}:v${v}`;
}
