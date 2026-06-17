import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Product } from '@/types';

const mockFrom = vi.fn();
const mockGetUser = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: { getUser: () => mockGetUser() },
  },
}));

vi.mock('@/lib/authSession', () => ({
  getAuthenticatedUserId: vi.fn().mockResolvedValue('owner-1'),
}));

vi.mock('@/services/storeService', () => ({
  fetchStoreByUserId: vi.fn().mockResolvedValue({ id: 'store-1' }),
}));

import {
  checkSupabaseConnection,
  listProducts,
  createProduct,
  deleteProduct,
} from './productsCrudService';

const chain = (result: { data?: unknown; error?: { message: string } | null; count?: number }) => {
  const builder: Record<string, unknown> = {};
  const terminal = () => Promise.resolve(result);
  for (const m of ['select', 'eq', 'order', 'range', 'ilike', 'insert', 'update', 'delete', 'limit']) {
    builder[m] = vi.fn(() => builder);
  }
  builder.single = terminal;
  builder.maybeSingle = terminal;
  Object.assign(builder, { then: (resolve: (v: unknown) => void) => resolve(result) });
  return builder;
};

describe('productsCrudService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('checkSupabaseConnection succeeds when products table responds', async () => {
    mockFrom.mockReturnValue(chain({ data: [], error: null }));
    const result = await checkSupabaseConnection();
    expect(result.success).toBe(true);
  });

  it('listProducts maps rows for authenticated owner', async () => {
    mockFrom.mockReturnValue(
      chain({
        data: [
          {
            id: 'p1',
            name: 'Test',
            description: '',
            category: 'cat',
            price: 10,
            image_url: '/img.png',
            owner_id: 'owner-1',
            is_active: true,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
        ],
        error: null,
        count: 1,
      })
    );

    const result = await listProducts({ limit: 10 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.products).toHaveLength(1);
      expect(result.data.products[0].name).toBe('Test');
    }
  });

  it('createProduct rejects blob image URLs', async () => {
    const product = {
      id: 'new',
      name: 'Item',
      description: '',
      category: 'c',
      price: 1,
      image: 'blob:http://localhost/x',
    } as Product;

    const result = await createProduct(product);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('رفع الصورة');
    }
  });

  it('deleteProduct calls delete with owner scope', async () => {
    const builder = chain({ data: null, error: null });
    mockFrom.mockReturnValue(builder);

    const result = await deleteProduct('prod-99');
    expect(result.success).toBe(true);
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('id', 'prod-99');
    expect(builder.eq).toHaveBeenCalledWith('owner_id', 'owner-1');
  });
});
