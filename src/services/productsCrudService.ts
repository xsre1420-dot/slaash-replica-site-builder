/**
 * Supabase products table — typed CRUD layer.
 * Requires VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY in .env
 * and authenticated merchant session for write operations.
 */
import { supabase } from '@/integrations/supabase/client';
import { getAuthenticatedUserId } from '@/lib/authSession';
import { mapDbProduct, safeMapDbProduct } from '@/mappers/productMapper';
import {
  buildProductInsertPayload,
  buildProductUpdateAttempts,
  isSchemaColumnError,
  mapProductInsertError,
  mergeProductForUpdate,
  patchAffectsCatalogStats,
  MERCHANT_PRODUCTS_LIST_SELECT,
  MERCHANT_PRODUCTS_STANDARD_SELECT,
  PRODUCT_DETAIL_SELECT,
  PRODUCT_INSERT_RETURN_MINIMAL,
  PRODUCT_MINIMAL_SELECT,
} from '@/lib/productUpdateUtils';
import { fetchStoreByUserId } from '@/services/storeService';
import { syncProductCachesAfterMutation } from '@/lib/productCacheSync';
import {
  collectProductImageUrls,
  cleanupRemovedProductImages,
  deleteProductStorageImages,
} from '@/utils/productImageCleanup';
import type { Product } from '@/types';

export type ProductsCrudResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export type ListProductsOptions = {
  limit?: number;
  offset?: number;
  category?: string;
  search?: string;
};

const SELECT_CHAIN = [
  MERCHANT_PRODUCTS_LIST_SELECT,
  MERCHANT_PRODUCTS_STANDARD_SELECT,
  PRODUCT_MINIMAL_SELECT,
];

async function requireOwnerId(): Promise<string | null> {
  return getAuthenticatedUserId();
}

async function resolveStoreId(ownerId: string): Promise<string | null> {
  const store = await fetchStoreByUserId(ownerId);
  return store?.id ?? null;
}

async function fetchRowById(
  productId: string,
  ownerId: string
): Promise<Record<string, unknown> | null> {
  for (const select of [PRODUCT_DETAIL_SELECT, ...SELECT_CHAIN]) {
    const { data, error } = await supabase
      .from('products')
      .select(select)
      .eq('id', productId)
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (!error && data) return data as Record<string, unknown>;
    if (error && !isSchemaColumnError(error.message)) return null;
  }
  return null;
}

/** Verify Supabase connectivity (anon key + products table). */
export async function checkSupabaseConnection(): Promise<ProductsCrudResult<{ connected: true }>> {
  try {
    const { error } = await supabase.from('products').select('id').limit(1);
    if (error) {
      if (/JWT|Invalid API key|fetch/i.test(error.message)) {
        return { success: false, error: 'تعذر الاتصال — تحقق من VITE_SUPABASE_URL و VITE_SUPABASE_PUBLISHABLE_KEY' };
      }
      if (error.message.includes('Could not find the table')) {
        return { success: false, error: 'جدول products غير موجود — طبّق migrations على Supabase' };
      }
      return { success: false, error: error.message };
    }
    return { success: true, data: { connected: true } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'فشل الاتصال بـ Supabase',
    };
  }
}

/** List products for the signed-in merchant. */
export async function listProducts(
  options: ListProductsOptions = {}
): Promise<ProductsCrudResult<{ products: Product[]; total: number }>> {
  const ownerId = await requireOwnerId();
  if (!ownerId) return { success: false, error: 'يجب تسجيل الدخول أولاً' };

  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);

  for (const select of SELECT_CHAIN) {
    let query = supabase
      .from('products')
      .select(select, { count: 'exact' })
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (options.category && options.category !== 'all') {
      query = query.eq('category', options.category);
    }
    if (options.search?.trim()) {
      query = query.ilike('name', `%${options.search.trim()}%`);
    }

    const { data, error, count } = await query;
    if (!error) {
      const products = (data ?? [])
        .map((row) => safeMapDbProduct(row as Record<string, unknown>))
        .filter((p): p is Product => p != null);
      return { success: true, data: { products, total: count ?? products.length } };
    }
    if (!isSchemaColumnError(error.message)) {
      return { success: false, error: error.message };
    }
  }

  return { success: false, error: 'تعذر تحميل المنتجات — تحقق من مخطط قاعدة البيانات' };
}

/** Get one product by id (merchant-owned). */
export async function getProductById(productId: string): Promise<ProductsCrudResult<Product>> {
  const ownerId = await requireOwnerId();
  if (!ownerId) return { success: false, error: 'يجب تسجيل الدخول أولاً' };

  const row = await fetchRowById(productId, ownerId);
  if (!row) return { success: false, error: 'المنتج غير موجود' };

  return { success: true, data: mapDbProduct(row) };
}

/** Create a product row in Supabase. */
export async function createProduct(product: Product): Promise<ProductsCrudResult<Product>> {
  const ownerId = await requireOwnerId();
  if (!ownerId) return { success: false, error: 'يجب تسجيل الدخول أولاً' };

  if (!product.name?.trim()) {
    return { success: false, error: 'اسم المنتج مطلوب' };
  }
  if (!product.image?.trim() || product.image.startsWith('blob:')) {
    return { success: false, error: 'انتظر اكتمال رفع الصورة قبل الحفظ' };
  }

  const storeId = await resolveStoreId(ownerId);
  const payloads = buildProductInsertPayload(product, ownerId, storeId);
  const attempts = [payloads.full, payloads.extended, payloads.standard, payloads.minimal];

  for (const row of attempts) {
    const { data, error } = await supabase
      .from('products')
      .insert(row)
      .select(PRODUCT_INSERT_RETURN_MINIMAL)
      .single();

    if (!error && data) {
      syncProductCachesAfterMutation(ownerId);
      const mapped = mapDbProduct(data as Record<string, unknown>);

      const stockQty = product.stockQuantity ?? 0;
      if (stockQty > 0) {
        const { data: stockData, error: stockError } = await (supabase as any).rpc(
          'record_product_initial_stock',
          {
            p_product_id: mapped.id,
            p_owner_id: ownerId,
            p_quantity: stockQty,
          }
        );
        if (stockError || !stockData?.success) {
          await supabase.from('products').delete().eq('id', mapped.id).eq('owner_id', ownerId);
          return {
            success: false,
            error: 'فشل تسجيل المخزون الافتتاحي — لم يتم إنشاء المنتج. حاول مرة أخرى.',
          };
        }
      }

      return { success: true, data: mapped };
    }
    if (error && !isSchemaColumnError(error.message)) {
      return { success: false, error: mapProductInsertError(error.message) };
    }
  }

  return { success: false, error: 'فشل في إضافة المنتج — تحقق من migrations' };
}

/** Update a product (partial patch supported). */
export async function updateProduct(
  productId: string,
  patch: Partial<Product>
): Promise<ProductsCrudResult<Product>> {
  const ownerId = await requireOwnerId();
  if (!ownerId) return { success: false, error: 'يجب تسجيل الدخول أولاً' };

  const existingRow = await fetchRowById(productId, ownerId);
  if (!existingRow) return { success: false, error: 'المنتج غير موجود' };

  const merged = mergeProductForUpdate(mapDbProduct(existingRow), patch);
  const attempts = buildProductUpdateAttempts(merged);

  for (const updateRow of attempts) {
    for (const select of [PRODUCT_DETAIL_SELECT, PRODUCT_INSERT_RETURN_MINIMAL]) {
      const { data, error } = await supabase
        .from('products')
        .update(updateRow)
        .eq('id', productId)
        .eq('owner_id', ownerId)
        .select(select)
        .maybeSingle();

      if (!error && data) {
        void cleanupRemovedProductImages(existingRow, data as Record<string, unknown>);
        syncProductCachesAfterMutation(ownerId, data as Record<string, unknown>, {
          refreshStats: patchAffectsCatalogStats(patch),
        });
        return { success: true, data: mapDbProduct(data as Record<string, unknown>) };
      }
      if (error && !isSchemaColumnError(error.message)) {
        return { success: false, error: error.message };
      }
    }
  }

  return { success: false, error: 'فشل في تحديث المنتج' };
}

/** Delete a product permanently. */
export async function deleteProduct(productId: string): Promise<ProductsCrudResult<{ id: string }>> {
  const ownerId = await requireOwnerId();
  if (!ownerId) return { success: false, error: 'يجب تسجيل الدخول أولاً' };

  const { data: row } = await supabase
    .from('products')
    .select('image_url, additional_images')
    .eq('id', productId)
    .eq('owner_id', ownerId)
    .maybeSingle();

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId)
    .eq('owner_id', ownerId);

  if (error) return { success: false, error: error.message };

  if (row) {
    void deleteProductStorageImages(collectProductImageUrls(row));
  }

  syncProductCachesAfterMutation(ownerId);

  return { success: true, data: { id: productId } };
}

export type BulkImportRow = {
  name: string;
  description: string;
  category: string;
  price: number;
  cost?: number;
  stock_quantity?: number;
  sizes?: string[];
  image_url?: string;
};

export type BulkImportResult = {
  success: number;
  failed: number;
  errors: string[];
};

/** CSV bulk import — drafts with optional initial stock movements. */
export async function bulkImportProducts(
  rows: BulkImportRow[],
  ownerId: string,
  storeId: string | null,
  options?: { chunkSize?: number }
): Promise<BulkImportResult> {
  const chunkSize = options?.chunkSize ?? 20;
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  const deduped = rows.filter((product, index, list) => {
    const key = product.name.trim().toLowerCase();
    return list.findIndex((p) => p.name.trim().toLowerCase() === key) === index;
  });

  for (let i = 0; i < deduped.length; i += chunkSize) {
    const chunk = deduped.slice(i, i + chunkSize).map((p) => ({
      name: p.name,
      description: p.description,
      category: p.category,
      price: p.price,
      cost: p.cost ?? null,
      stock_quantity: p.stock_quantity ?? 0,
      sizes: p.sizes ?? null,
      image_url: p.image_url ?? null,
      owner_id: ownerId,
      is_active: false,
      ...(storeId ? { store_id: storeId } : {}),
    }));

    const { data: inserted, error } = await supabase
      .from('products')
      .insert(chunk)
      .select('id, stock_quantity');

    if (error) {
      failed += chunk.length;
      errors.push(`خطأ في رفع الدفعة ${Math.floor(i / chunkSize) + 1}: ${error.message}`);
      continue;
    }

    success += inserted?.length ?? chunk.length;

    const movements = (inserted ?? [])
      .filter((row) => (row.stock_quantity ?? 0) > 0)
      .map((row) => ({
        product_id: row.id,
        owner_id: ownerId,
        quantity_delta: row.stock_quantity,
        reason: 'initial_stock',
      }));

    if (movements.length > 0) {
      const { data: stockData, error: movementError } = await (supabase as any).rpc(
        'record_initial_stock_movements',
        {
          p_owner_id: ownerId,
          p_items: movements,
        }
      );
      if (movementError || !stockData?.success) {
        errors.push(
          `تنبيه: تم رفع المنتجات لكن سجل المخزون فشل: ${movementError?.message ?? stockData?.error ?? 'unknown'}`
        );
      }
    }
  }

  if (success > 0) {
    syncProductCachesAfterMutation(ownerId);
  }

  return { success, failed, errors };
}
