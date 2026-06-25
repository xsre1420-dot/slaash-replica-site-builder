import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapOrderError, mapOrderRpcFailure } from '@/utils/orderErrors';

const mockRpc = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

vi.mock('@/lib/security/rateLimiter', () => ({
  enforceRateLimit: vi.fn(),
  RATE_LIMITS: { checkout: { maxRequests: 5, windowMs: 60_000 } },
  RateLimitExceededError: class extends Error {},
  formatRateLimitMessageAr: (ms: number) => `wait ${ms}`,
}));

vi.mock('@/lib/tenantGuard', () => ({
  assertMerchantOwner: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/observability', () => ({
  instrumentAsync: (_op: string, fn: () => Promise<unknown>) => fn(),
  instrumentQuery: async (_op: string, fn: () => Promise<unknown>) => fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  metrics: { timing: vi.fn(), increment: vi.fn() },
}));

vi.mock('@/utils/checkoutSession', () => ({
  getOrCreateIdempotencyKey: () => 'test-key',
  clearCheckoutIdempotencyKey: vi.fn(),
}));

vi.mock('@/services/checkoutRecoveryService', () => ({
  tryRecoverCheckoutOrder: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/services/storefrontProductService', () => ({
  invalidateStorefrontForOwner: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/cache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/cache')>();
  return {
    ...actual,
    flushOrderCache: vi.fn(),
  };
});

import { createOrder, clearInflightOrdersForTests } from '@/services/orderService';
import { tryRecoverCheckoutOrder } from '@/services/checkoutRecoveryService';
import { Order } from '@/types';

const sampleOrder: Order = {
  id: 'order-1',
  items: [{ product: { id: 'p1', name: 'A', description: '', category: 'c', price: 1000, image: '' }, quantity: 1 }],
  customerInfo: { name: 'Test', phone: '07', address: 'Addr' },
  total: 1000,
  date: new Date().toISOString(),
  status: 'pending',
};

describe('orderService integration', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    clearInflightOrdersForTests();
    vi.mocked(tryRecoverCheckoutOrder).mockResolvedValue(null);
  });

  it('creates order via RPC on success', async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, order_id: 'order-1', total_amount: 1000 },
      error: null,
    });

    const result = await createOrder(sampleOrder, 'owner-1');
    expect(result.id).toBe('order-1');
    expect(mockRpc).toHaveBeenCalledWith(
      'create_order_with_stock_deduction',
      expect.objectContaining({ p_owner_id: 'owner-1', p_store_slug: null })
    );
  });

  it('throws mapped error on RPC failure', async () => {
    mockRpc.mockResolvedValue({ data: { success: false, error: 'insufficient stock' }, error: null });

    await expect(createOrder(sampleOrder, 'owner-1')).rejects.toThrow(mapOrderError('insufficient stock'));
  });

  it('includes product name in insufficient stock errors', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: false,
        error: 'insufficient stock',
        product_name: 'قميص',
        available: 0,
        requested: 2,
      },
      error: null,
    });

    await expect(createOrder(sampleOrder, 'owner-1')).rejects.toThrow(/قميص/);
    expect(mapOrderRpcFailure({
      error: 'insufficient stock',
      product_name: 'قميص',
      available: 0,
      requested: 2,
    })).toContain('قميص');
  });

  it('retries once when server reports total_amount_mismatch', async () => {
    mockRpc
      .mockResolvedValueOnce({
        data: { success: false, error: 'total_amount_mismatch', expected_total: 1200 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { success: true, order_id: 'order-1', total_amount: 1200 },
        error: null,
      });

    const result = await createOrder(sampleOrder, 'owner-1');
    expect(result.total).toBe(1200);
    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect(mockRpc.mock.calls[1][1].p_total_amount).toBe(1200);
  });

  it('returns existing order on idempotent RPC response', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        order_id: 'existing-order',
        total_amount: 1000,
        idempotent: true,
      },
      error: null,
    });

    const result = await createOrder(sampleOrder, 'owner-1');
    expect(result.id).toBe('existing-order');
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent createOrder calls', async () => {
    let resolveRpc!: (v: unknown) => void;
    const rpcPromise = new Promise((resolve) => {
      resolveRpc = resolve;
    });
    mockRpc.mockReturnValue(rpcPromise);

    const p1 = createOrder(sampleOrder, 'owner-1');
    const p2 = createOrder(sampleOrder, 'owner-1');

    resolveRpc({
      data: { success: true, order_id: 'order-1', total_amount: 1000 },
      error: null,
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.id).toBe('order-1');
    expect(r2.id).toBe('order-1');
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('recovers order after transport error when server already created it', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } });
    vi.mocked(tryRecoverCheckoutOrder).mockResolvedValue({
      orderId: 'recovered-order',
      totalAmount: 1000,
      idempotent: true,
    });

    const result = await createOrder(sampleOrder, 'owner-1', 'cash_on_delivery', null, 'demo-store');
    expect(result.id).toBe('recovered-order');
    expect(result.wasIdempotent).toBe(true);
    expect(tryRecoverCheckoutOrder).toHaveBeenCalledWith('owner-1', 'demo-store');
  });
});
