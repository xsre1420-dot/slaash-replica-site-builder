import { describe, expect, it, vi, beforeEach } from 'vitest';
import { restockProduct, InventoryRestockError } from './inventoryService';

const { mockUpdate, mockInsert, mockRpc } = vi.hoisted(() => ({
  mockUpdate: vi.fn(),
  mockInsert: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock('@/lib/tenantGuard', () => ({
  assertMerchantOwner: vi.fn().mockResolvedValue(undefined),
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

  it('allows min level update via locked stock RPC without movement', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: true, stock_quantity: 10 },
      error: null,
    });
    const result = await restockProduct({ product, ownerId: 'o1', addAmount: 0, minLevel: 8 });
    expect(result.added).toBe(0);
    expect(mockRpc).toHaveBeenCalledWith(
      'increment_product_stock',
      expect.objectContaining({
        p_delta: 0,
        p_min_stock_level: 8,
        p_reason: 'threshold_update',
      })
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('passes min level to restock RPC when stock and threshold change together', async () => {
    await restockProduct({ product, ownerId: 'o1', addAmount: 5, minLevel: 8 });
    expect(mockRpc).toHaveBeenCalledWith(
      'increment_product_stock',
      expect.objectContaining({
        p_min_stock_level: 8,
      })
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('applyStockQuantityPatch uses increment RPC for positive deltas', async () => {
    const { applyStockQuantityPatch } = await import('./inventoryService');
    const qty = await applyStockQuantityPatch('p1', 'o1', 10, 15);
    expect(qty).toBe(15);
    expect(mockRpc).toHaveBeenCalledWith(
      'increment_product_stock',
      expect.objectContaining({ p_delta: 5, p_reason: 'restock' })
    );
  });

  it('applyStockQuantityPatch rejects negative deltas', async () => {
    const { applyStockQuantityPatch } = await import('./inventoryService');
    await expect(applyStockQuantityPatch('p1', 'o1', 10, 5)).rejects.toBeInstanceOf(
      InventoryRestockError
    );
  });

  it('auditInventoryIntegrity maps RPC payload', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        success: true,
        score: 95,
        total_products: 10,
        issues_count: 1,
        summary: {
          negative_stock: 0,
          variant_drift: 1,
          duplicate_initial_stock: 0,
          missing_initial_stock: 0,
          ledger_mismatch: 0,
          orphan_movements: 0,
          archived_still_active: 0,
        },
        issues: [{ type: 'variant_drift', product_id: 'p1' }],
      },
      error: null,
    });
    const { auditInventoryIntegrity } = await import('./inventoryService');
    const result = await auditInventoryIntegrity('o1');
    expect(result?.score).toBe(95);
    expect(result?.summary.variant_drift).toBe(1);
    expect(mockRpc).toHaveBeenCalledWith('audit_merchant_inventory_integrity', {
      p_owner_id: 'o1',
    });
  });
});
