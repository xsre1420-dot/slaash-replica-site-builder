const seenKeys = new Map<string, number>();
const KEY_TTL_MS = 60 * 60 * 1000;
const MAX_KEYS = 5000;

/** In-process idempotency — prevents duplicate job execution within TTL window. */
export function shouldSkipDuplicate(idempotencyKey: string | undefined): boolean {
  if (!idempotencyKey) return false;
  const now = Date.now();
  pruneExpired(now);
  if (seenKeys.has(idempotencyKey)) return true;
  seenKeys.set(idempotencyKey, now);
  return false;
}

export function markIdempotencyComplete(idempotencyKey: string | undefined): void {
  if (!idempotencyKey) return;
  seenKeys.set(idempotencyKey, Date.now());
}

function pruneExpired(now: number): void {
  if (seenKeys.size <= MAX_KEYS) {
    for (const [key, at] of seenKeys) {
      if (now - at > KEY_TTL_MS) seenKeys.delete(key);
    }
    return;
  }
  const sorted = [...seenKeys.entries()].sort((a, b) => a[1] - b[1]);
  for (let i = 0; i < sorted.length - MAX_KEYS / 2; i++) {
    seenKeys.delete(sorted[i][0]);
  }
}

/** @internal test helper */
export function clearIdempotencyRegistryForTests(): void {
  seenKeys.clear();
}
