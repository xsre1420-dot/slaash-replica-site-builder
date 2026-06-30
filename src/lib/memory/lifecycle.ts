import { installCachePruneLifecycle, cache } from '@/lib/cache';
import { CACHE_PRUNE_INTERVAL_MS } from '@/lib/costOptimization/computeEfficiency';

let memoryLifecycleInstalled = false;
let pruneTimer: ReturnType<typeof setInterval> | null = null;

/**
 * One-time browser lifecycle hooks: prune caches when tab is hidden/visible
 * and on a periodic interval to control long-session memory growth.
 */
export function installMemoryLifecycle(): void {
  if (memoryLifecycleInstalled || typeof window === 'undefined') return;
  memoryLifecycleInstalled = true;
  installCachePruneLifecycle();

  pruneTimer = setInterval(() => {
    if (typeof document !== 'undefined' && document.hidden) return;
    cache.pruneExpired();
  }, CACHE_PRUNE_INTERVAL_MS);
}

/** @internal test helper */
export function resetMemoryLifecycleForTests(): void {
  if (pruneTimer) {
    clearInterval(pruneTimer);
    pruneTimer = null;
  }
  memoryLifecycleInstalled = false;
}
