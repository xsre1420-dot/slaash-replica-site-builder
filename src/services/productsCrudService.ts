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
  MERCHANT_PRODUCTS_LIST_SELECT,
  MERCHANT_PRODUCTS_STANDARD_SELECT,
  PRODUCT_DETAIL_SELECT,
  PRODUCT_INSERT_RETURN_MINIMAL,
  PRODUCT_MINIMAL_SELECT,
} from '@/lib/productUpdateUtils';
import { fetchStoreByUserId } from '@/services/storeService';
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
      return { success: true, data: mapDbProduct(data as Record<string, unknown>) };
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

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId)
    .eq('owner_id', ownerId);

  if (error) return { success: false, error: error.message };

  return { success: true, data: { id: productId } };
}
