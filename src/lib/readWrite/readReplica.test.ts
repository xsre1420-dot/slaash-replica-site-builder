import { describe, expect, it } from 'vitest';
import {
  requiresPrimary,
  isReplicaEligible,
  getReadOperationSpec,
  getReadAuditSummary,
  listReadOperationsByCategory,
} from '@/lib/readWrite/readConsistencyRegistry';
import { resolveReadRoute } from '@/lib/readWrite/readRouter';

describe('readConsistencyRegistry', () => {
  it('classifies checkout reads as primary-only', () => {
    expect(requiresPrimary('get_checkout_preflight_bundle')).toBe(true);
    expect(requiresPrimary('validate_store_coupon')).toBe(true);
    expect(requiresPrimary('get_order_by_idempotency_key')).toBe(true);
  });

  it('classifies storefront reads as replica-eligible', () => {
    expect(isReplicaEligible('get_storefront_page_bundle')).toBe(true);
    expect(isReplicaEligible('get_store_products_page')).toBe(true);
    expect(isReplicaEligible('get_suggested_products_for_store')).toBe(true);
  });

  it('classifies dashboard reads as replica-safe', () => {
    expect(getReadOperationSpec('get_dashboard_statistics_batch').consistency).toBe('replica_safe');
    expect(getReadOperationSpec('list_merchant_orders').consistency).toBe('replica_safe');
  });

  it('defaults unknown RPCs to primary', () => {
    expect(requiresPrimary('unknown_rpc_xyz')).toBe(true);
  });

  it('provides audit summary by category', () => {
    const summary = getReadAuditSummary();
    expect(summary.total).toBeGreaterThan(40);
    expect(listReadOperationsByCategory('storefront').length).toBeGreaterThan(5);
  });
});

describe('readRouter', () => {
  it('routes checkout RPCs to primary when replica env unset', () => {
    const route = resolveReadRoute('get_checkout_preflight_bundle');
    expect(route.target).toBe('primary');
    expect(route.reason).toBe('requires_primary');
  });

  it('routes storefront RPCs to primary when replica not configured', () => {
    const route = resolveReadRoute('get_storefront_page_bundle');
    expect(route.target).toBe('primary');
    expect(route.reason).toBe('replica_not_configured');
  });

  it('respects forcePrimary override', () => {
    const route = resolveReadRoute('get_storefront_page_bundle', { forcePrimary: true });
    expect(route.target).toBe('primary');
  });
});
