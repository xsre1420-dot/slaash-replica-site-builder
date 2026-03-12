/**
 * Redis-compatible in-memory cache with TTL, stale-while-revalidate,
 * and namespace-based invalidation.
 * 
 * Design: Mirror Redis patterns (GET/SET/DEL/FLUSH) so migration
 * to Redis is a drop-in replacement of this module.
 */

interface CacheEntry<T = unknown> {
  data: T;
  createdAt: number;
  ttl: number; // ms
  staleWhileRevalidate: number; // additional ms after TTL where stale data is OK
}

class CacheStore {
  private store = new Map<string, CacheEntry>();
  private revalidating = new Set<string>();

  /** SET — store with TTL (default 60s) and optional stale window (default 30s) */
  set<T>(key: string, data: T, ttlMs = 60_000, staleMs = 30_000): void {
    this.store.set(key, {
      data,
      createdAt: Date.now(),
      ttl: ttlMs,
      staleWhileRevalidate: staleMs,
    });
  }

  /** GET — returns data if fresh, or stale data + calls revalidate fn */
  get<T>(key: string, revalidateFn?: () => Promise<T>): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    const age = Date.now() - entry.createdAt;

    // Fresh
    if (age < entry.ttl) return entry.data;

    // Stale but within revalidation window
    if (age < entry.ttl + entry.staleWhileRevalidate) {
      if (revalidateFn && !this.revalidating.has(key)) {
        this.revalidating.add(key);
        revalidateFn()
          .then((fresh) => this.set(key, fresh, entry.ttl, entry.staleWhileRevalidate))
          .catch(() => {})
          .finally(() => this.revalidating.delete(key));
      }
      return entry.data; // serve stale
    }

    // Expired
    this.store.delete(key);
    return null;
  }

  /** DEL — remove a specific key */
  del(key: string): void {
    this.store.delete(key);
  }

  /** FLUSH by prefix — like Redis SCAN + DEL pattern */
  flushByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  /** FLUSHALL */
  flushAll(): void {
    this.store.clear();
  }

  /** Check if key exists and is fresh */
  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    const age = Date.now() - entry.createdAt;
    return age < entry.ttl + entry.staleWhileRevalidate;
  }

  /** Get cache stats (for debugging) */
  stats(): { size: number; keys: string[] } {
    return { size: this.store.size, keys: [...this.store.keys()] };
  }
}

// Singleton — mirrors a single Redis connection
export const cache = new CacheStore();

// Cache key namespaces (like Redis key prefixes)
export const CacheKeys = {
  products: (ownerId: string) => `products:${ownerId}`,
  categories: (ownerId: string) => `categories:${ownerId}`,
  storeSettings: (ownerId: string) => `store_settings:${ownerId}`,
  orders: (ownerId: string, page: number) => `orders:${ownerId}:${page}`,
  statistics: (ownerId: string, range: string) => `stats:${ownerId}:${range}`,
} as const;

// TTL presets (ms)
export const CacheTTL = {
  SHORT: 30_000,      // 30s — volatile data (orders)
  MEDIUM: 60_000,     // 1min — products, categories
  LONG: 300_000,      // 5min — store settings
  STALE: 30_000,      // 30s stale window
} as const;
