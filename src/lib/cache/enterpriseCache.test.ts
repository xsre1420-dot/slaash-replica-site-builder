import { describe, expect, it, beforeEach } from 'vitest';
import { cache } from '@/lib/cache';
import { cachedFetch, cachedFetchNullable } from '@/lib/cache/enterpriseCache';
import { resetCacheMonitoringForTests, getCacheMonitoringSnapshot } from '@/lib/cache/cacheMonitoring';
import { invalidateDashboardCaches } from '@/lib/cache/cacheInvalidation';
import { getCacheAuditSummary } from '@/lib/cache/cacheAuditRegistry';
import { resolveTtlPolicy } from '@/lib/cache/cacheTtlPolicy';

describe('enterpriseCache', () => {
  beforeEach(() => {
    cache.flushAll();
    resetCacheMonitoringForTests();
  });

  it('caches fetch results in L1', async () => {
    let calls = 0;
    const value = await cachedFetch({
      key: 'test:1',
      domain: 'dashboard',
      ttlMs: 60_000,
      staleMs: 30_000,
      fetchFn: async () => {
        calls++;
        return { ok: true };
      },
    });
    expect(value).toEqual({ ok: true });
    expect(calls).toBe(1);

    await cachedFetch({
      key: 'test:1',
      domain: 'dashboard',
      ttlMs: 60_000,
      staleMs: 30_000,
      fetchFn: async () => {
        calls++;
        return { ok: false };
      },
    });
    expect(calls).toBe(1);
  });

  it('returns null on failure with cachedFetchNullable', async () => {
    const result = await cachedFetchNullable({
      key: 'test:fail',
      domain: 'analytics',
      fetchFn: async () => {
        throw new Error('down');
      },
    });
    expect(result).toBeNull();
  });

  it('records hits in monitoring', async () => {
    await cachedFetch({
      key: 'test:mon',
      domain: 'storefront',
      ttlMs: 30_000,
      staleMs: 15_000,
      fetchFn: async () => 'data',
    });
    await cachedFetch({
      key: 'test:mon',
      domain: 'storefront',
      ttlMs: 30_000,
      staleMs: 15_000,
      fetchFn: async () => 'data',
    });
    const snap = getCacheMonitoringSnapshot();
    expect(snap.aggregate.totalHits).toBeGreaterThanOrEqual(1);
  });
});

describe('cacheInvalidation', () => {
  beforeEach(() => {
    cache.flushAll();
    resetCacheMonitoringForTests();
  });

  it('invalidates only dashboard keys', () => {
    cache.set('dashboard-batch:owner1', {}, 60_000);
    cache.set('dashboard-kpis:owner1', {}, 60_000);
    cache.set('products:owner1', {}, 60_000);
    invalidateDashboardCaches('owner1');
    expect(cache.get('dashboard-batch:owner1')).toBeNull();
    expect(cache.get('products:owner1')).toBeTruthy();
  });
});

describe('cacheAuditRegistry', () => {
  it('classifies tiers', () => {
    const summary = getCacheAuditSummary();
    expect(summary.total).toBeGreaterThan(20);
    expect(summary.never).toBeGreaterThan(0);
    expect(summary.long).toBeGreaterThan(0);
  });
});

describe('cacheTtlPolicy', () => {
  it('resolves dashboard batch TTL', () => {
    const policy = resolveTtlPolicy('medium.dashboard_batch');
    expect(policy.ttlMs).toBe(90_000);
  });
});
