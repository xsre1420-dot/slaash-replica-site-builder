/**
 * In-memory cache with TTL, stale-while-revalidate, LRU eviction, and namespace invalidation.
 */

interface CacheEntry<T = unknown> {
  data: T;
  createdAt: number;
  ttl: number;
  staleWhileRevalidate: number;
}

const MAX_CACHE_ENTRIES = 500;

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

export const CacheKeys = {
  products: (ownerId: string) => `products:${ownerId}`,
  categories: (ownerId: string) => `categories:${ownerId}`,
  storeSettings: (ownerId: string) => `store_settings:${ownerId}`,
  orders: (ownerId: string, page: number) => `orders:${ownerId}:${page}`,
  statistics: (ownerId: string, range: string) => `stats:${ownerId}:${range}`,
} as const;

export const CacheTTL = {
  SHORT: 30_000,
  MEDIUM: 60_000,
  LONG: 300_000,
  STALE: 15_000,
} as const;
