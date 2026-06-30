import { describe, expect, it } from 'vitest';
import {
  getSubsystemForQueue,
  isBestEffortQueue,
  runIsolatedSubsystem,
  safeEnqueueBestEffort,
} from '@/core/distributed/failureIsolation';
import { getWorkerInstanceId, resetWorkerInstanceIdForTests } from '@/core/distributed/workerIdentity';
import { getCacheStrategySummary, buildVersionedCacheKey } from '@/core/distributed/cacheStrategy';
import { listExtractableServices, getServiceBoundary } from '@/core/distributed/serviceBoundaries';

describe('failureIsolation', () => {
  it('classifies analytics as best-effort', () => {
    expect(isBestEffortQueue('analytics')).toBe(true);
    expect(isBestEffortQueue('orders')).toBe(false);
    expect(getSubsystemForQueue('webhook')?.id).toBe('notifications');
  });

  it('runIsolatedSubsystem swallows errors', async () => {
    const result = await runIsolatedSubsystem('analytics', async () => {
      throw new Error('downstream');
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.isolated).toBe(true);
  });

  it('safeEnqueueBestEffort never throws', () => {
    const id = safeEnqueueBestEffort('analytics', () => {
      throw new Error('queue full');
    });
    expect(id).toBe('');
  });
});

describe('workerIdentity', () => {
  it('returns stable instance id within session', () => {
    resetWorkerInstanceIdForTests();
    const a = getWorkerInstanceId();
    const b = getWorkerInstanceId();
    expect(a).toBe(b);
    expect(a.startsWith('w-')).toBe(true);
  });
});

describe('cacheStrategy', () => {
  it('summarizes cache layers', () => {
    const summary = getCacheStrategySummary();
    expect(summary.layers.length).toBeGreaterThan(3);
    expect(buildVersionedCacheKey('sf:', 'owner1', 3)).toBe('sf:owner1:v3');
  });
});

describe('serviceBoundaries', () => {
  it('defines extractable services without blocking checkout', () => {
    expect(listExtractableServices()).toContain('storefront');
    expect(getServiceBoundary('analytics')?.blocksCheckout).toBe(false);
    expect(getServiceBoundary('checkout')?.blocksCheckout).toBe(true);
  });
});
