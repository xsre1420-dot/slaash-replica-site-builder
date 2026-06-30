/**
 * Enterprise multi-layer cache facade — L1 memory + optional L2 Redis/KV + DB fallback.
 * Phase 7: cache failures never interrupt users; always attempt origin fetch.
 */
import { cache, dedup } from '@/lib/cache';
import { isKvCacheEnabled, kvGet, kvSet } from '@/lib/cache/kvAdapter';
import { CacheTTLPolicy, resolveTtlPolicy } from '@/lib/cache/cacheTtlPolicy';
import {
  recordCacheHit,
  recordCacheMiss,
  recordCacheRebuild,
  recordCacheFetchFailure,
  type CacheDomain,
} from '@/lib/cache/cacheMonitoring';
import { logger } from '@/lib/observability';

export type CachedFetchOptions<T> = {
  key: string;
  domain: CacheDomain;
  fetchFn: () => Promise<T>;
  ttlMs?: number;
  staleMs?: number;
  skipCache?: boolean;
  /** Use dedup to collapse concurrent misses for same key */
  deduplicate?: boolean;
  ttlPolicyPath?: string;
};

function resolveTtl(opts: CachedFetchOptions<unknown>): { ttlMs: number; staleMs: number } {
  if (opts.ttlMs != null) {
    return { ttlMs: opts.ttlMs, staleMs: opts.staleMs ?? opts.ttlMs / 2 };
  }
  if (opts.ttlPolicyPath) {
    const policy = resolveTtlPolicy(opts.ttlPolicyPath);
    return { ttlMs: policy.ttlMs, staleMs: policy.staleWhileRevalidateMs };
  }
  return {
    ttlMs: CacheTTLPolicy.medium.default.ttlMs,
    staleMs: CacheTTLPolicy.medium.default.staleWhileRevalidateMs,
  };
}

async function cachedFetchInner<T>(opts: CachedFetchOptions<T>): Promise<T> {
  const start = performance.now();
  const { ttlMs, staleMs } = resolveTtl(opts as CachedFetchOptions<unknown>);

  if (!opts.skipCache) {
    const l1 = cache.get<T>(opts.key);
    if (l1 != null) {
      recordCacheHit(opts.domain, performance.now() - start, 'l1');
      return l1;
    }

    if (isKvCacheEnabled()) {
      try {
        const raw = await kvGet(opts.key);
        if (raw) {
          const parsed = JSON.parse(raw) as T;
          cache.set(opts.key, parsed, ttlMs, staleMs);
          recordCacheHit(opts.domain, performance.now() - start, 'l2');
          return parsed;
        }
      } catch (err) {
        logger.warn('cache.l2_read_failed', {
          key: opts.key,
          domain: opts.domain,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  recordCacheMiss(opts.domain);

  const rebuildStart = performance.now();
  let fresh: T;
  try {
    fresh = await opts.fetchFn();
  } catch (err) {
    recordCacheFetchFailure(opts.domain);
    const stale = cache.get<T>(opts.key);
    if (stale != null) {
      logger.warn('cache.origin_failed_serving_stale', { key: opts.key, domain: opts.domain });
      return stale;
    }
    throw err;
  }

  const rebuildMs = performance.now() - rebuildStart;
  recordCacheRebuild(opts.domain, rebuildMs);

  try {
    cache.set(opts.key, fresh, ttlMs, staleMs);
    if (isKvCacheEnabled()) {
      const ttlSec = Math.max(1, Math.ceil((ttlMs + staleMs) / 1000));
      void kvSet(opts.key, JSON.stringify(fresh), ttlSec).catch(() => undefined);
    }
  } catch (err) {
    logger.warn('cache.write_failed', {
      key: opts.key,
      domain: opts.domain,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return fresh;
}

/** Fetch with L1 → L2 → origin; rebuild cache on miss; serve stale on origin failure. */
export async function cachedFetch<T>(opts: CachedFetchOptions<T>): Promise<T> {
  if (opts.deduplicate !== false) {
    return dedup(`ec:${opts.key}`, () => cachedFetchInner(opts));
  }
  return cachedFetchInner(opts);
}

/** Nullable variant — returns null instead of throwing when origin and stale both unavailable. */
export async function cachedFetchNullable<T>(
  opts: CachedFetchOptions<T | null>
): Promise<T | null> {
  try {
    return await cachedFetch(opts);
  } catch {
    return null;
  }
}

export function peekCache<T>(key: string): T | null {
  return cache.get<T>(key);
}

export { CacheTTLPolicy };
