/**
 * L1 in-memory + optional L2 KV cache for cross-instance coherence.
 */
import { cache } from '@/lib/cache';
import { isKvCacheEnabled, kvDel, kvFlushPrefix, kvGet, kvSet } from '@/lib/cache/kvAdapter';
import { recordCacheHit, recordCacheMiss, recordCacheRebuild } from '@/lib/cache/cacheMonitoring';

export async function distributedGet<T>(
  key: string,
  ttlMs: number,
  staleMs: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  const l1 = cache.get<T>(key);
  if (l1 != null) {
    recordCacheHit('other', 0, 'l1');
    return l1;
  }

  if (isKvCacheEnabled()) {
    const raw = await kvGet(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as T;
        cache.set(key, parsed, ttlMs, staleMs);
        recordCacheHit('other', 0, 'l2');
        return parsed;
      } catch {
        /* invalid kv payload */
      }
    }
  }

  recordCacheMiss('other');
  const rebuildStart = performance.now();
  const fresh = await fetchFn();
  recordCacheRebuild('other', performance.now() - rebuildStart);
  cache.set(key, fresh, ttlMs, staleMs);
  if (isKvCacheEnabled()) {
    const ttlSec = Math.max(1, Math.ceil((ttlMs + staleMs) / 1000));
    void kvSet(key, JSON.stringify(fresh), ttlSec).catch(() => undefined);
  }
  return fresh;
}

export async function distributedInvalidate(key: string): Promise<void> {
  cache.del(key);
  if (isKvCacheEnabled()) await kvDel(key);
}

export async function distributedFlushPrefix(prefix: string): Promise<void> {
  cache.flushByPrefix(prefix);
  if (isKvCacheEnabled()) await kvFlushPrefix(prefix);
}

export { isKvCacheEnabled };
