import { describe, expect, it } from 'vitest';
import {
  ALL_RPC_DEFINITIONS,
  DEFERRED_RPCS,
  REQUIRED_RPCS,
  getRpcDefinition,
  isDeferredRpc,
  isRequiredRpc,
} from '@/lib/supabase/rpcRegistry';
import { CHECKOUT_CREATE_RPC } from '@/lib/checkout/checkoutContract';

describe('rpcRegistry', () => {
  it('defines checkout RPC as required with canonical migration', () => {
    const def = getRpcDefinition(CHECKOUT_CREATE_RPC);
    expect(def?.status).toBe('required');
    expect(def?.migration).toBe('20260906000002');
  });

  it('marks premium inventory RPCs as deferred', () => {
    expect(isDeferredRpc('get_merchant_inventory_page_bundle')).toBe(true);
    expect(isDeferredRpc('ensure_default_warehouse')).toBe(true);
    expect(isRequiredRpc('increment_product_stock')).toBe(true);
  });

  it('has unique RPC names within each status group', () => {
    const names = ALL_RPC_DEFINITIONS.map((r) => r.name);
    const requiredNames = REQUIRED_RPCS.map((r) => r.name);
    expect(new Set(requiredNames).size).toBe(requiredNames.length);
    expect(DEFERRED_RPCS.every((r) => r.status === 'deferred')).toBe(true);
    expect(names.length).toBeGreaterThan(20);
  });
});
