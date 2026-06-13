import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapOrderError } from '@/utils/orderErrors';

const mockRpc = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
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

import { createOrder } from '@/services/orderService';
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
});
