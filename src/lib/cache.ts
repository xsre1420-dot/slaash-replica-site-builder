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

  get<T>(
    key: string,
    revalidateFn?: () => Promise<T>,
    options?: { revalidateDedupKey?: string }
  ): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    const age = Date.now() - entry.createdAt;
    const revalidateKey = options?.revalidateDedupKey ?? `revalidate:${key}`;

    if (age < entry.ttl) return entry.data;

    if (age < entry.ttl + entry.staleWhileRevalidate) {
      if (revalidateFn) {
        void dedup(revalidateKey, async () => {
          const fresh = await revalidateFn();
          this.set(key, fresh, entry.ttl, entry.staleWhileRevalidate);
          return fresh;
        }).catch((err) => console.warn('[cache] revalidate failed:', err));
      }
      return entry.data;
    }

    // Fully expired — serve last good value while a stampede-protected refresh is in flight.
    if (revalidateFn && peekInflight(revalidateKey)) {
      return entry.data;
    }

    this.store.delete(key);
    return null;
  }

  /** Read without triggering SWR — used to serve stale data during in-flight refresh. */
  peek<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    return entry.data;
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

  /** Remove entries past TTL + stale window to prevent unbounded growth on long sessions. */
  pruneExpired(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.store) {
      const age = now - entry.createdAt;
      if (age >= entry.ttl + entry.staleWhileRevalidate) {
        this.store.delete(key);
        removed += 1;
      }
    }
    return removed;
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

export function peekInflight<T>(key: string): Promise<T> | undefined {
  return inflight.get(key) as Promise<T> | undefined;
}

export function dedup<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = Promise.resolve()
    .then(fn)
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, promise);
  return promise;
}

/** Drop an in-flight deduped request so the next call fetches fresh data. */
export function clearInflight(key: string): void {
  inflight.delete(key);
}

export function clearInflightAll(): void {
  inflight.clear();
}

export const CacheKeys = {
  products: (ownerId: string) => `products:${ownerId}`,
  /** Deduped get_owner_bootstrap RPC per owner session */
  ownerBootstrap: (userId: string) => `owner-bootstrap:${userId}`,
  /** Total catalog size from bootstrap — avoids full product list fetch on form pages */
  merchantProductCount: (ownerId: string) => `merchant-product-count:${ownerId}`,
  addProductPage: (ownerId: string) => `add-product-page:${ownerId}`,
  /** Merchant edit product — product + categories for initial form render */
  editProductPage: (ownerId: string, productId: string) =>
    `edit-product-page:${ownerId}:${productId.trim()}`,
  /** Merchant product reviews — product meta + reviews list */
  productReviewsPage: (ownerId: string, productId: string) =>
    `product-reviews-page:${ownerId}:${productId.trim()}`,
  /** Merchant storefront preview (/preview) initial load */
  previewStorePage: (ownerId: string) => `preview-store-page:${ownerId}`,
  /** Merchant inventory / products hub initial load */
  inventoryPage: (ownerId: string) => `inventory-page:${ownerId}`,
  /** Merchant settings page initial load */
  settingsPage: (ownerId: string) => `settings-page:${ownerId}`,
  settingsDomain: (ownerId: string) => `settings-domain:${ownerId}`,
  /** Merchant orders hub — list + tab counts + stats for one filter/page */
  ordersPage: (ownerId: string, filterKey: string, page: number) =>
    `orders-page:${ownerId}:${filterKey}:${page}`,
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
  dashboardKpisLight: (ownerId: string) => `dashboard-kpis:${ownerId}`,
  dashboardWorkflowCounts: (ownerId: string) => `dashboard-workflow:${ownerId}`,
  statistics: (ownerId: string, range: string) => `stats:${ownerId}:${range}`,
  tenantMeta: (slug: string) => `tenant-meta:${slug}`,
  tenantProducts: (slug: string, pageKey: string) => `tenant-products:${slug}:${pageKey}`,
  /** owner_id → store_slug (checkout, invalidation, cross-tab sync) */
  ownerSlug: (ownerId: string) => `owner-slug:${ownerId}`,
  /** store_slug → owner_id (product detail, fallbacks) */
  slugOwner: (slug: string) => `slug-owner:${slug}`,
  storefrontProduct: (slug: string, productId: string) => `storefront-product:${slug}:${productId}`,
  footerSuggested: (slug: string) => `footer-suggested:${slug}`,
  /** Public checkout init — store settings scoped by slug */
  checkoutInit: (slug: string) => `checkout-init:${slug.trim().toLowerCase()}`,
  /** Product detail bundle — aliases storefrontProduct for coordinated loads */
  productDetail: (slug: string, productId: string) =>
    `product-detail:${slug.trim().toLowerCase()}:${productId.trim()}`,
  /** Product detail page — product + reviews + suggested (scoped by store slug or owner) */
  productDetailPage: (scope: string, productId: string) =>
    `product-detail-page:${scope}:${productId.trim()}`,
  /** Checkout page — store init + cart product validation */
  checkoutPage: (scope: string, cartKey: string) => `checkout-page:${scope}:${cartKey}`,
  /** Merchant marketing hub — coupons + discount products + settings */
  marketingPage: (ownerId: string) => `marketing-page:${ownerId}`,
  /** Public landing / pricing — static plan catalog */
  landingPage: () => 'landing-page:public',
  /** Merchant subscription access gate */
  merchantAccess: (userId: string) => `merchant-access:${userId}`,
  /** Admin subscriptions hub — list + overview stats */
  adminSubscriptionsPage: (search: string, status: string) =>
    `admin-subscriptions-page:${search}:${status}`,
  adminSubscriptionsStats: () => 'admin-subscriptions-stats',
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

/** Invalidate order list caches only — preserves dashboard batch / analytics KPIs. */
export function flushOrderListCache(ownerId: string): void {
  cache.flushByPrefix(`orders:${ownerId}:`);
  cache.flushByPrefix(`orders-page:${ownerId}:`);
  cache.del(CacheKeys.ordersStatsSummary(ownerId));
  cache.del(CacheKeys.ordersRecent(ownerId));
}

/** Invalidate order + stats caches only (preserve product catalog). */
export function flushOrderCache(ownerId: string): void {
  flushOrderListCache(ownerId);
  cache.del(CacheKeys.dashboardBatch(ownerId));
  cache.del(CacheKeys.dashboardKpisLight(ownerId));
  cache.del(CacheKeys.dashboardWorkflowCounts(ownerId));
  cache.flushByPrefix(`stats:${ownerId}:`);
}

/** Invalidate cached merchant data for a single tenant (avoids cross-tenant flush). */
export function flushOwnerCache(ownerId: string): void {
  flushOrderCache(ownerId);
  cache.del(CacheKeys.products(ownerId));
  cache.del(CacheKeys.merchantProductCount(ownerId));
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

let cachePruneHookInstalled = false;

/** Prune expired in-memory cache entries when the tab becomes visible (long-session hygiene). */
export function installCachePruneLifecycle(): void {
  if (cachePruneHookInstalled || typeof document === 'undefined') return;
  cachePruneHookInstalled = true;

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) cache.pruneExpired();
  });
}
