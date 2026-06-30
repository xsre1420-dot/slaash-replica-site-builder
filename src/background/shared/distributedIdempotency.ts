/**
 * Cross-instance idempotency via optional KV L2.
 * L1 = in-process map (idempotency.ts); L2 = shared KV when configured.
 */
import { isKvCacheEnabled, kvGet, kvSet } from '@/lib/cache/kvAdapter';

const KV_PREFIX = 'job:idem:';
const DEFAULT_TTL_SEC = 3600;

/** Try to claim an idempotency key across workers. Returns false if already claimed. */
export async function tryClaimDistributedIdempotency(
  idempotencyKey: string | undefined,
  ttlSeconds = DEFAULT_TTL_SEC
): Promise<boolean> {
  if (!idempotencyKey) return true;
  if (!isKvCacheEnabled()) return true;

  const key = `${KV_PREFIX}${idempotencyKey}`;
  const existing = await kvGet(key);
  if (existing) return false;

  await kvSet(key, '1', ttlSeconds);
  return true;
}

/** Mark completion in KV (extends TTL for dedup window). */
export async function markDistributedIdempotencyComplete(
  idempotencyKey: string | undefined,
  ttlSeconds = DEFAULT_TTL_SEC
): Promise<void> {
  if (!idempotencyKey || !isKvCacheEnabled()) return;
  await kvSet(`${KV_PREFIX}${idempotencyKey}`, 'done', ttlSeconds);
}
