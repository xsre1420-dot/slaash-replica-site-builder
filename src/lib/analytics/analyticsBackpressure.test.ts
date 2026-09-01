import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_MAX_PENDING,
  isAnalyticsQueueSaturated,
  shouldDeferAnalyticsProcessing,
} from '@/lib/analytics/analyticsBackpressure';
import {
  acquireRpcSlot,
  resetRpcConcurrencyGateForTests,
} from '@/lib/requestConcurrency/rpcConcurrencyGate';

describe('analyticsBackpressure', () => {
  it('detects saturated analytics queue', () => {
    expect(isAnalyticsQueueSaturated(ANALYTICS_MAX_PENDING - 1)).toBe(false);
    expect(isAnalyticsQueueSaturated(ANALYTICS_MAX_PENDING)).toBe(true);
  });

  it('defers analytics while critical RPC slots are in flight', async () => {
    resetRpcConcurrencyGateForTests();
    const release = await acquireRpcSlot('critical');
    expect(shouldDeferAnalyticsProcessing()).toBe(true);
    release();
    expect(shouldDeferAnalyticsProcessing()).toBe(false);
  });
});
