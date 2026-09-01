import {
  STOREFRONT_BUNDLE_RPC,
  STOREFRONT_PRODUCT_VIEW_RPC,
  STOREFRONT_VISIT_RPC,
} from '@/lib/storefront/storefrontRpcConfig';

/** Request priority for Supabase RPC backpressure. */
export type RpcTrafficClass = 'critical' | 'standard' | 'background';

const CRITICAL_RPCS = new Set([
  STOREFRONT_BUNDLE_RPC,
  'get_store_meta',
  'get_store_policies',
  'create_order_with_stock_deduction',
  'get_order_by_idempotency_key',
]);

const BACKGROUND_RPCS = new Set([
  STOREFRONT_VISIT_RPC,
  STOREFRONT_PRODUCT_VIEW_RPC,
  'flush_merchant_analytics_buffer',
]);

/** Classify RPC traffic for concurrency gating. */
export function resolveRpcTrafficClass(fn: string): RpcTrafficClass {
  if (CRITICAL_RPCS.has(fn)) return 'critical';
  if (BACKGROUND_RPCS.has(fn)) return 'background';
  if (fn.startsWith('get_store') || fn.includes('storefront')) return 'standard';
  return 'standard';
}
