import { beforeEach, describe, expect, it, vi } from 'vitest';
import { restockProduct, batchRestockProducts, InventoryRestockError } from './inventoryService';

const mockIncrement = vi.fn();
const mockBatch = vi.fn();

vi.mock('@/lib/tenantGuard', () => ({
  assertMerchantOwner: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/supabase/schemaCapabilities', () => ({
  hasWarehouseInventory: vi.fn().mockResolvedValue(false),
  hasBatchRestockRpc: vi.fn().mockResolvedValue(false),
}));

vi.mock('@/repositories/inventory/inventoryRepository', () => ({
  rpcIncrementProductStock: (...args: unknown[]) => mockIncrement(...args),
  rpcBatchRestockProducts: (...args: unknown[]) => mockBatch(...args),
}));

vi.mock('@/lib/tracing', () => ({
  traceCriticalFlow: (_flow: string, _layer: string, _op: string, fn: () => Promise<unknown>) => fn(),
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
    mockIncrement.mockResolvedValue({
      data: { success: true, stock_quantity: 15 },
      error: null,
    });
  });

  it('rejects negative add amounts', async () => {
    await expect(
      restockProduct({ product, ownerId: 'o1', addAmount: -1 })
    ).rejects.toBeInstanceOf(InventoryRestockError);
  });

  it('records restock via increment_product_stock RPC', async () => {
    const result = await restockProduct({ product, ownerId: 'o1', addAmount: 5 });
    expect(result.newQuantity).toBe(15);
    expect(mockIncrement).toHaveBeenCalledWith(
      expect.objectContaining({
        p_product_id: 'p1',
        p_owner_id: 'o1',
        p_delta: 5,
      })
    );
  });

  it('allows min level update via delta=0 increment RPC', async () => {
    mockIncrement.mockResolvedValueOnce({
      data: { success: true, stock_quantity: 10 },
      error: null,
    });
    const result = await restockProduct({ product, ownerId: 'o1', addAmount: 0, minLevel: 8 });
    expect(result.added).toBe(0);
    expect(mockIncrement).toHaveBeenCalledWith(
      expect.objectContaining({
        p_delta: 0,
        p_min_stock_level: 8,
        p_reason: 'threshold_update',
      })
    );
  });

  it('batch restock falls back to sequential increment when batch RPC absent', async () => {
    const result = await batchRestockProducts('o1', [
      { product_id: 'p1', delta: 2 },
      { product_id: 'p2', delta: 3 },
    ]);
    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(0);
    expect(mockBatch).not.toHaveBeenCalled();
    expect(mockIncrement).toHaveBeenCalledTimes(2);
  });

  it('applyStockQuantityPatch rejects negative deltas', async () => {
    const { applyStockQuantityPatch } = await import('./inventoryService');
    await expect(applyStockQuantityPatch('p1', 'o1', 10, 5)).rejects.toBeInstanceOf(
      InventoryRestockError
    );
  });
});
