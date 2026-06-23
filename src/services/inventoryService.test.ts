import { describe, expect, it, vi, beforeEach } from 'vitest';
import { restockProduct, InventoryRestockError } from './inventoryService';

const { mockUpdate, mockInsert, mockRpc } = vi.hoisted(() => ({
  mockUpdate: vi.fn(),
  mockInsert: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: mockRpc,
    from: vi.fn((table: string) => {
      if (table === 'products') {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: mockUpdate,
            })),
          })),
        };
      }
      if (table === 'inventory_movements') {
        return { insert: mockInsert };
      }
      return {};
    }),
  },
}));

const product = {
  id: 'p1',
  name: 'Test',
  price: 100,
  category: 'cat',
  stock_quantity: 10,
  min_stock_level: 5,
  created_at: '2026-01-01',
  lifecycle: 'published' as const,
};

describe('inventoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({
      data: { success: true, stock_quantity: 15 },
      error: null,
    });
    mockUpdate.mockResolvedValue({ error: null });
    mockInsert.mockResolvedValue({ error: null });
  });

  it('rejects negative add amounts', async () => {
    await expect(
      restockProduct({ product, ownerId: 'o1', addAmount: -1 })
    ).rejects.toBeInstanceOf(InventoryRestockError);
  });

  it('records restock movement for positive adds', async () => {
    const result = await restockProduct({ product, ownerId: 'o1', addAmount: 5 });
    expect(result.newQuantity).toBe(15);
    expect(result.added).toBe(5);
    expect(mockRpc).toHaveBeenCalledWith(
      'increment_product_stock',
      expect.objectContaining({
        p_product_id: 'p1',
        p_owner_id: 'o1',
        p_delta: 5,
      })
    );
  });

  it('allows min level update without stock movement', async () => {
    const result = await restockProduct({ product, ownerId: 'o1', addAmount: 0, minLevel: 8 });
    expect(result.added).toBe(0);
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
