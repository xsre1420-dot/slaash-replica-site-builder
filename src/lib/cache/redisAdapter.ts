/**
 * Redis-compatible cache adapter interface (Phase 5).
 * Swap MemoryCacheStore for RedisCacheStore in production without changing callers.
 */

export interface CacheAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  flushByPrefix(prefix: string): Promise<void>;
}

/** In-memory implementation matching Redis key semantics */
export class MemoryCacheAdapter implements CacheAdapter {
  private store = new Map<string, { value: unknown; expiresAt: number }>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds = 300): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async flushByPrefix(prefix: string): Promise<void> {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }
}

/**
 * Redis implementation stub — wire up ioredis/redis in production:
 *
 * ```ts
 * import Redis from 'ioredis';
 * export class RedisCacheAdapter implements CacheAdapter {
 *   constructor(private redis: Redis) {}
 *   async get<T>(key: string) {
 *     const raw = await this.redis.get(key);
 *     return raw ? JSON.parse(raw) as T : null;
 *   }
 *   async set<T>(key: string, value: T, ttlSeconds = 300) {
 *     await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
 *   }
 *   ...
 * }
 * ```
 */
export const defaultCacheAdapter: CacheAdapter = new MemoryCacheAdapter();
