import { getRpcConcurrencySnapshot } from '@/lib/requestConcurrency/rpcConcurrencyGate';

/** Max pending analytics jobs per tab — prevents unbounded accumulation under spikes. */
export const ANALYTICS_MAX_PENDING = 24;

/** Process critical/standard RPC queues before analytics background work. */
export const QUEUE_PROCESSING_ORDER = [
  'orders',
  'inventory',
  'cache',
  'search',
  'notifications',
  'webhook',
  'import',
  'export',
  'image',
  'analytics',
] as const;

export function isAnalyticsQueueSaturated(pendingCount: number): boolean {
  return pendingCount >= ANALYTICS_MAX_PENDING;
}

/** Defer analytics worker ticks while storefront or checkout RPCs are in flight. */
export function shouldDeferAnalyticsProcessing(): boolean {
  const snap = getRpcConcurrencySnapshot();
  return snap.inflightByClass.critical > 0 || snap.inflightByClass.standard > 0;
}
