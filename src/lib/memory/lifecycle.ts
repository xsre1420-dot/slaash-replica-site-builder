import { installCachePruneLifecycle } from '@/lib/cache';

let memoryLifecycleInstalled = false;

/**
 * One-time browser lifecycle hooks: prune caches when tab is hidden/visible.
 */
export function installMemoryLifecycle(): void {
  if (memoryLifecycleInstalled || typeof window === 'undefined') return;
  memoryLifecycleInstalled = true;
  installCachePruneLifecycle();
}
