/**
 * Browser-executed jobs catalog — Phase 4.4 server-side migration candidates.
 * Read-only registry; does not change runtime behavior.
 */
import type { QueueKind } from '@/background/shared/types';

export type BrowserJobPriority = 'critical' | 'high' | 'normal' | 'low' | 'background';

export type BrowserJobEntry = {
  id: string;
  name: string;
  queue: QueueKind;
  priority: BrowserJobPriority;
  processor: string;
  serverSideCandidate: boolean;
  notes: string;
};

/** Jobs currently executed in the browser (IndexedDB queue + scheduler). */
export const BROWSER_JOB_CATALOG: BrowserJobEntry[] = [
  {
    id: 'analytics.trackVisit',
    name: 'Store visit tracking',
    queue: 'analytics',
    priority: 'low',
    processor: 'analytics.trackVisit',
    serverSideCandidate: true,
    notes: 'Buffered client-side; server buffer RPC exists',
  },
  {
    id: 'analytics.trackProductView',
    name: 'Product view tracking',
    queue: 'analytics',
    priority: 'low',
    processor: 'analytics.trackProductView',
    serverSideCandidate: true,
    notes: 'High volume at scale — prefer edge beacon or server ingest',
  },
  {
    id: 'cache.invalidateScope',
    name: 'Storefront cache invalidation',
    queue: 'cache',
    priority: 'high',
    processor: 'cache.invalidateScope',
    serverSideCandidate: false,
    notes: 'Must stay client-side for immediate UI coherence',
  },
  {
    id: 'cache.invalidateForOwner',
    name: 'Full storefront cache flush',
    queue: 'cache',
    priority: 'high',
    processor: 'cache.invalidateForOwner',
    serverSideCandidate: false,
    notes: 'Client L1/L2 invalidation; edge purge is separate',
  },
  {
    id: 'cache.edgePurge',
    name: 'Edge CDN purge',
    queue: 'cache',
    priority: 'normal',
    processor: 'cache.edgePurge',
    serverSideCandidate: true,
    notes: 'Could move to server webhook on product publish',
  },
  {
    id: 'orders.metaConversions',
    name: 'Meta CAPI conversion',
    queue: 'orders',
    priority: 'normal',
    processor: 'orders.metaConversions',
    serverSideCandidate: true,
    notes: 'Already uses edge function — queue should run server-side',
  },
  {
    id: 'image.cleanupRemoved',
    name: 'Product image cleanup',
    queue: 'image',
    priority: 'background',
    processor: 'image.cleanupRemoved',
    serverSideCandidate: true,
    notes: 'Storage deletes should run server-side with service role',
  },
  {
    id: 'image.deleteStorage',
    name: 'Storage object delete',
    queue: 'image',
    priority: 'background',
    processor: 'image.deleteStorage',
    serverSideCandidate: true,
    notes: 'Requires service role for reliable cleanup',
  },
  {
    id: 'image.cleanupBranding',
    name: 'Branding image cleanup',
    queue: 'image',
    priority: 'background',
    processor: 'image.cleanupBranding',
    serverSideCandidate: true,
    notes: 'Same as product image cleanup',
  },
  {
    id: 'import.processBatch',
    name: 'Product CSV import batch',
    queue: 'import',
    priority: 'normal',
    processor: 'import.processBatch',
    serverSideCandidate: true,
    notes: 'Long-running; should use server worker + progress RPC',
  },
];

export function listServerSideCandidates(): BrowserJobEntry[] {
  return BROWSER_JOB_CATALOG.filter((j) => j.serverSideCandidate);
}

export function groupJobsByPriority(): Record<BrowserJobPriority, BrowserJobEntry[]> {
  const groups: Record<BrowserJobPriority, BrowserJobEntry[]> = {
    critical: [],
    high: [],
    normal: [],
    low: [],
    background: [],
  };
  for (const job of BROWSER_JOB_CATALOG) {
    groups[job.priority].push(job);
  }
  return groups;
}
