import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn((cb?: (status: string) => void) => {
    cb?.('SUBSCRIBED');
    return mockChannel;
  }),
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    channel: vi.fn(() => mockChannel),
    removeChannel: vi.fn(),
  },
}));

vi.mock('@/lib/cache', () => ({ flushOrderCache: vi.fn() }));
vi.mock('@/services/productService', () => ({
  appendCachedProduct: vi.fn(),
  patchCachedProduct: vi.fn(),
  removeCachedProduct: vi.fn(),
}));
vi.mock('@/services/storefrontProductService', () => ({
  invalidateStorefrontForOwner: vi.fn(),
}));
vi.mock('@/services/storefrontCacheService', () => ({
  patchStorefrontProductFromDbRow: vi.fn(),
}));
vi.mock('@/lib/localMutationGuard', () => ({
  markLocalStorefrontMutation: vi.fn(),
  shouldSuppressRealtimeStorefrontInvalidation: vi.fn(() => false),
}));
vi.mock('@/lib/observability/healthMonitor', () => ({
  recordHealthEvent: vi.fn(),
}));

import {
  subscribeMerchantProducts,
  subscribeMerchantOrders,
  getMerchantRealtimeHubStatus,
  resetMerchantRealtimeHubMetricsForTests,
  teardownMerchantRealtimeHub,
} from './merchantRealtimeHub';

describe('merchantRealtimeHub metrics', () => {
  beforeEach(() => {
    teardownMerchantRealtimeHub();
    resetMerchantRealtimeHubMetricsForTests();
    vi.clearAllMocks();
    mockChannel.on.mockReturnThis();
  });

  it('tracks active channels and handler counts', () => {
    const unsubP = subscribeMerchantProducts('user-1', vi.fn());
    const unsubO = subscribeMerchantOrders('user-1', vi.fn());

    const status = getMerchantRealtimeHubStatus();
    expect(status.activeProductChannels).toBe(1);
    expect(status.activeOrderChannels).toBe(1);
    expect(status.productHandlerCount).toBe(1);
    expect(status.orderHandlerCount).toBe(1);

    unsubP();
    unsubO();
    expect(getMerchantRealtimeHubStatus().activeProductChannels).toBe(0);
  });

  it('shares one product channel across multiple subscribers', () => {
    subscribeMerchantProducts('user-1', vi.fn());
    subscribeMerchantProducts('user-1', vi.fn());
    const status = getMerchantRealtimeHubStatus();
    expect(status.activeProductChannels).toBe(1);
    expect(status.productHandlerCount).toBe(2);
  });
});
