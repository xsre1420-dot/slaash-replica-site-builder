import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  hasInventoryPageBundleRpc,
  hasWarehouseInventory,
  resetSchemaCapabilityCacheForTests,
} from '@/lib/supabase/schemaCapabilities';

const mockCallReadRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/readWrite/readClient', () => ({
  callReadRpc: (...args: unknown[]) => mockCallReadRpc(...args),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe('schemaCapabilities', () => {
  beforeEach(() => {
    resetSchemaCapabilityCacheForTests();
    vi.clearAllMocks();
  });

  it('detects missing inventory bundle RPC', async () => {
    mockCallReadRpc.mockResolvedValue({
      error: 'Could not find the function public.get_merchant_inventory_page_bundle',
    });
    await expect(hasInventoryPageBundleRpc()).resolves.toBe(false);
    await expect(hasInventoryPageBundleRpc()).resolves.toBe(false);
    expect(mockCallReadRpc).toHaveBeenCalledTimes(1);
  });

  it('detects missing warehouse tables', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        limit: async () => ({
          error: { code: '42P01', message: 'relation "warehouses" does not exist' },
        }),
      }),
    });
    await expect(hasWarehouseInventory()).resolves.toBe(false);
  });

  it('detects merchant inventory summary RPC', async () => {
    mockCallReadRpc.mockResolvedValueOnce({ data: { success: true }, error: null });
    const { hasMerchantInventorySummaryRpc } = await import('@/lib/supabase/schemaCapabilities');
    await expect(hasMerchantInventorySummaryRpc()).resolves.toBe(true);
  });
});
