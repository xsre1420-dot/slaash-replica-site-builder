/**
 * In-memory cache with TTL, stale-while-revalidate, LRU eviction, and namespace invalidation.
 */

interface CacheEntry<T = unknown> {
  data: T;
  createdAt: number;
  ttl: number;
  staleWhileRevalidate: number;
}

const MAX_CACHE_ENTRIES = 2000;

class CacheStore {
  private store = new Map<string, CacheEntry>();
  private revalidating = new Set<string>();

  private evictIfNeeded(): void {
    if (this.store.size <= MAX_CACHE_ENTRIES) return;
    const oldestKey = this.store.keys().next().value;
    if (oldestKey) this.store.delete(oldestKey);
  }

  set<T>(key: string, data: T, ttlMs = 60_000, staleMs = 30_000): void {
    this.evictIfNeeded();
    this.store.set(key, {
      data,
      createdAt: Date.now(),
      ttl: ttlMs,
      staleWhileRevalidate: staleMs,
    });
  }

  get<T>(key: string, revalidateFn?: () => Promise<T>): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    const age = Date.now() - entry.createdAt;

    if (age < entry.ttl) return entry.data;

    if (age < entry.ttl + entry.staleWhileRevalidate) {
      if (revalidateFn && !this.revalidating.has(key)) {
        this.revalidating.add(key);
        revalidateFn()
          .then((fresh) => this.set(key, fresh, entry.ttl, entry.staleWhileRevalidate))
          .catch((err) => console.warn('[cache] revalidate failed:', err))
          .finally(() => this.revalidating.delete(key));
      }
      return entry.data;
    }

    this.store.delete(key);
    return null;
  }

  del(key: string): void {
    this.store.delete(key);
  }

  flushByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  flushAll(): void {
    this.store.clear();
  }

  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    const age = Date.now() - entry.createdAt;
    return age < entry.ttl + entry.staleWhileRevalidate;
  }

  stats(): { size: number; keys: string[] } {
    return { size: this.store.size, keys: [...this.store.keys()] };
  }
}

export const cache = new CacheStore();

const inflight = new Map<string, Promise<any>>();

export function dedup<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fn().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

/** Drop an in-flight deduped request so the next call fetches fresh data. */
export function clearInflight(key: string): void {
  inflight.delete(key);
}

export const CacheKeys = {
  products: (ownerId: string) => `products:${ownerId}`,
  productsByStore: (storeId: string) => `products:store:${storeId}`,
  categories: (ownerId: string) => `categories:${ownerId}`,
  categoriesByStore: (storeId: string) => `categories:store:${storeId}`,
  storeSettings: (ownerId: string) => `store_settings:${ownerId}`,
  store: (userId: string) => `store:${userId}`,
  orders: (ownerId: string, page: number) => `orders:${ownerId}:${page}`,
  ordersFiltered: (ownerId: string, filterKey: string, page: number, cursor = '') =>
    `orders:${ownerId}:f:${filterKey}:${page}:${cursor}`,
  ordersWorkflowCounts: (ownerId: string, filterKey: string) =>
    `orders:${ownerId}:wc:${filterKey}`,
  ordersRecent: (ownerId: string) => `orders:${ownerId}:recent`,
  ordersStatsSummary: (ownerId: string) => `orders:stats:${ownerId}`,
  dashboardBatch: (ownerId: string) => `dashboard-batch:${ownerId}`,
  statistics: (ownerId: string, range: string) => `stats:${ownerId}:${range}`,
  tenantMeta: (slug: string) => `tenant-meta:${slug}`,
  tenantProducts: (slug: string, pageKey: string) => `tenant-products:${slug}:${pageKey}`,
  /** owner_id → store_slug (checkout, invalidation, cross-tab sync) */
  ownerSlug: (ownerId: string) => `owner-slug:${ownerId}`,
  /** store_slug → owner_id (product detail, fallbacks) */
  slugOwner: (slug: string) => `slug-owner:${slug}`,
  storefrontProduct: (slug: string, productId: string) => `storefront-product:${slug}:${productId}`,
  footerSuggested: (slug: string) => `footer-suggested:${slug}`,
} as const;

export const CacheTTL = {
  SHORT: 30_000,
  MEDIUM: 60_000,
  LONG: 300_000,
  STALE: 15_000,
  /** Aggregated KPI RPC responses — safe to cache longer when rollups are stable */
  ANALYTICS: 90_000,
  ANALYTICS_STALE: 45_000,
  /** Public storefront catalog — longer TTL reduces RPC churn under viral traffic */
  STOREFRONT: 120_000,
  STOREFRONT_STALE: 60_000,
} as const;

/** Invalidate order + stats caches only (preserve product catalog). */
export function flushOrderCache(ownerId: string): void {
  cache.flushByPrefix(`orders:${ownerId}:`);
  cache.del(CacheKeys.ordersStatsSummary(ownerId));
  cache.del(CacheKeys.dashboardBatch(ownerId));
  cache.flushByPrefix(`stats:${ownerId}:`);
}

/** Invalidate cached merchant data for a single tenant (avoids cross-tenant flush). */
export function flushOwnerCache(ownerId: string): void {
  flushOrderCache(ownerId);
  cache.del(CacheKeys.products(ownerId));
  cache.del(CacheKeys.categories(ownerId));
  cache.del(CacheKeys.storeSettings(ownerId));
  cache.del(CacheKeys.store(ownerId));
  cache.del(CacheKeys.ownerSlug(ownerId));
}

/** Drop slug ↔ owner resolution entries after settings or slug changes. */
export function flushSlugResolutionCache(ownerId: string, slug?: string | null): void {
  cache.del(CacheKeys.ownerSlug(ownerId));
  if (slug?.trim()) {
    cache.del(CacheKeys.slugOwner(slug.trim().toLowerCase()));
  }
}
