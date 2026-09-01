/**
 * Lightweight storefront RPC debug — enable with VITE_STOREFRONT_DEBUG_RPC=true
 * No secrets logged.
 */
import { env } from '@/lib/env';

export type StorefrontRequestEvent =
  | 'start'
  | 'end'
  | 'timeout'
  | 'abort'
  | 'cache_hit'
  | 'dedup_hit'
  | 'retry'
  | 'error';

let enabled: boolean | null = null;

export function isStorefrontRpcDebugEnabled(): boolean {
  if (enabled != null) return enabled;
  const flag = import.meta.env.VITE_STOREFRONT_DEBUG_RPC;
  enabled = flag === 'true' || flag === '1';
  if (!enabled && env.VITE_APP_ENV === 'development') {
    enabled = false;
  }
  return enabled;
}

export function logStorefrontRequest(
  rpc: string,
  event: StorefrontRequestEvent,
  detail?: Record<string, unknown>
): void {
  if (!isStorefrontRpcDebugEnabled()) return;
  const payload = detail ? ` ${JSON.stringify(detail)}` : '';
  console.debug(`[storefront-rpc] ${rpc} ${event}${payload}`);
}
