/**
 * Product catalog mutations — primary DB writes and cache sync.
 */
import {
  productsTable,
  rpcCreateMerchantProductWithStock,
  rpcRecordProductInitialStock,
  rpcPatchMerchantProduct,
  rpcRecordInitialStockMovements,
  rpcLookupProductIdempotency,
  rpcRecordProductIdempotency,
  rpcPublishOwnerProduct,
} from '@/repositories/products/productRepository';
import { getAuthenticatedUserId } from '@/lib/authSession';
import { assertMerchantOwner } from '@/lib/tenantGuard';
import { cache, CacheKeys } from '@/lib/cache';
import { runOncePerKey, type AddProductResult } from '@/lib/productCreateLock';
import { recordHealthEvent } from '@/lib/observability/healthMonitor';
import { removeCachedProduct } from '@/services/merchantProductCatalogService';
import { mapDbProduct } from '@/mappers/productMapper';
import {
  buildProductInsertPayload,
  buildProductUpdateAttempts,
  buildProductLifecyclePatch,
  isSchemaColumnError,
  mapProductInsertError,
  mergeProductForUpdate,
  patchAffectsCatalogStats,
  type ProductLifecycleAction,
  MERCHANT_PRODUCTS_LIST_SELECT,
  MERCHANT_PRODUCTS_STANDARD_SELECT,
  PRODUCT_DETAIL_SELECT,
  PRODUCT_INSERT_RETURN_MINIMAL,
  PRODUCT_MINIMAL_SELECT,
} from '@/lib/productUpdateUtils';
import { fetchStoreByUserId, type StoreRecord } from '@/services/read/store/storeReadService';
import { syncProductCachesAfterMutation } from '@/lib/productCacheSync';
import {
  collectProductImageUrls,
} from '@/utils/productImageCleanup';
import { enqueueImageCleanup, enqueueImageDelete } from '@/background/enqueue';
import { applyStockQuantityPatch } from '@/services/write/inventory/inventoryWriteService';
import { InventoryRestockError } from '@/services/read/inventory/inventoryReadService';
import type { Product } from '@/types';
import type { ProductsCrudResult } from '@/services/read/products/productQueryService';

const SELECT_CHAIN = [
  MERCHANT_PRODUCTS_LIST_SELECT,
  MERCHANT_PRODUCTS_STANDARD_SELECT,
  PRODUCT_MINIMAL_SELECT,
];

async function requireOwnerId(): Promise<string | null> {
  const ownerId = await getAuthenticatedUserId();
  if (!ownerId) return null;
  await assertMerchantOwner(ownerId);
  return ownerId;
}

async function resolveStoreId(ownerId: string): Promise<string | null> {
  const cachedStore = cache.get<StoreRecord>(CacheKeys.store(ownerId));
  if (cachedStore?.id) return cachedStore.id;

  const store = await fetchStoreByUserId(ownerId);
  return store?.id ?? null;
}

async function fetchRowById(
  productId: string,
  ownerId: string
): Promise<Record<string, unknown> | null> {
  for (const select of [PRODUCT_DETAIL_SELECT, ...SELECT_CHAIN]) {
    const { data, error } = await productsTable()
      .select(select)
      .eq('id', productId)
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (!error && data) return data as Record<string, unknown>;
    if (error && !isSchemaColumnError(error.message)) return null;
  }
  return null;
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
  const stockQty = Math.max(product.stockQuantity ?? 0, 0);

  const atomicPayloads = [payloads.full, payloads.extended, payloads.standard, payloads.minimal];
  for (const row of atomicPayloads) {
    const { data: atomicData, error: atomicError } = await rpcCreateMerchantProductWithStock({
      p_owner_id: ownerId,
      p_payload: row,
      p_initial_stock: stockQty,
    });

    if (!atomicError && atomicData?.success && atomicData.product_id) {
      const fetched = await fetchRowById(atomicData.product_id, ownerId);
      if (fetched) {
        syncProductCachesAfterMutation(ownerId);
        return { success: true, data: mapDbProduct(fetched) };
      }
    }

    if (atomicError && !isSchemaColumnError(atomicError)) {
      const rpcErr = atomicData?.error ?? atomicError;
      if (rpcErr && rpcErr !== 'product_create_failed') {
        return { success: false, error: mapProductInsertError(String(rpcErr)) };
      }
    }
    if (atomicData?.error && !isSchemaColumnError(atomicData.detail ?? atomicData.error)) {
      if (atomicData.error !== 'product_create_failed') {
        return { success: false, error: mapProductInsertError(atomicData.error) };
      }
    }
    if (atomicError && isSchemaColumnError(atomicError)) break;
    if (atomicData?.detail && isSchemaColumnError(atomicData.detail)) break;
  }

  const attempts = [payloads.full, payloads.extended, payloads.standard, payloads.minimal];
  for (const row of attempts) {
    const { data, error } = await productsTable()
      .insert(row)
      .select(PRODUCT_INSERT_RETURN_MINIMAL)
      .single();

    if (!error && data) {
      syncProductCachesAfterMutation(ownerId);
      const mapped = mapDbProduct(data as Record<string, unknown>);

      if (stockQty > 0) {
        const { data: stockData, error: stockError } = await rpcRecordProductInitialStock({
          p_product_id: mapped.id,
          p_owner_id: ownerId,
          p_quantity: stockQty,
        });
        if (stockError || !stockData?.success) {
          await productsTable().delete().eq('id', mapped.id).eq('owner_id', ownerId);
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

  const existing = mapDbProduct(existingRow);
  let workingProduct = existing;
  const patchForMerge = { ...patch };

  if ('stockQuantity' in patch && patch.stockQuantity !== undefined) {
    try {
      const newQty = await applyStockQuantityPatch(
        productId,
        ownerId,
        existing.stockQuantity,
        patch.stockQuantity
      );
      workingProduct = { ...existing, stockQuantity: newQty };
    } catch (err) {
      const message =
        err instanceof InventoryRestockError
          ? err.message
          : 'تعذر تحديث المخزون — حاول مرة أخرى';
      return { success: false, error: message };
    }
    delete patchForMerge.stockQuantity;
  }

  const merged = mergeProductForUpdate(workingProduct, patchForMerge);
  const attempts = buildProductUpdateAttempts(merged);

  for (const updateRow of attempts) {
    const { data: rpcData, error: rpcError } = await rpcPatchMerchantProduct({
      p_product_id: productId,
      p_owner_id: ownerId,
      p_patch: updateRow,
    });

    if (!rpcError && rpcData?.success) {
      if (rpcData.noop === true) {
        syncProductCachesAfterMutation(ownerId, existingRow, {
          refreshStats: patchAffectsCatalogStats(patch),
        });
        return { success: true, data: existing };
      }

      const refreshed = await fetchRowById(productId, ownerId);
      if (refreshed) {
        enqueueImageCleanup(existingRow, refreshed);
        syncProductCachesAfterMutation(ownerId, refreshed, {
          refreshStats: patchAffectsCatalogStats(patch),
        });
        return { success: true, data: mapDbProduct(refreshed) };
      }
    }

    if (rpcError && !/function|schema cache|does not exist/i.test(rpcError.message)) {
      return { success: false, error: rpcError.message };
    }

    for (const select of [PRODUCT_DETAIL_SELECT, PRODUCT_INSERT_RETURN_MINIMAL]) {
      const { data, error } = await productsTable()
        .update(updateRow)
        .eq('id', productId)
        .eq('owner_id', ownerId)
        .select(select)
        .maybeSingle();

      if (!error && data) {
        enqueueImageCleanup(existingRow, data as Record<string, unknown>);
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

  const { data: row } = await productsTable()
    .select('image_url, additional_images')
    .eq('id', productId)
    .eq('owner_id', ownerId)
    .maybeSingle();

  const { error } = await productsTable()
    .delete()
    .eq('id', productId)
    .eq('owner_id', ownerId);

  if (error) return { success: false, error: error.message };

  if (row) {
    enqueueImageDelete(collectProductImageUrls(row));
  }

  removeCachedProduct(ownerId, productId);
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

    const { data: inserted, error } = await productsTable()
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
      const { data: stockData, error: movementError } = await rpcRecordInitialStockMovements({
        p_owner_id: ownerId,
        p_items: movements,
      });
      if (movementError || !stockData?.success) {
        errors.push(
          `تنبيه: تم رفع المنتجات لكن سجل المخزون فشل: ${movementError ?? stockData?.error ?? 'unknown'}`
        );
      }
    }
  }

  if (success > 0) {
    syncProductCachesAfterMutation(ownerId);
  }

  return { success, failed, errors };
}

/** Merchant create flow — idempotent insert, initial stock ledger, optional publish. */
export async function addProduct(
  product: Product,
  options?: { idempotencyKey?: string }
): Promise<AddProductResult> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return { success: false, error: 'يجب تسجيل الدخول أولاً' };

  if (!product.image?.trim() || product.image.startsWith('blob:')) {
    return { success: false, error: 'انتظر اكتمال رفع الصورة قبل الحفظ' };
  }

  const lockKey = `${userId}:${options?.idempotencyKey ?? product.name}:${product.image}`;

  return runOncePerKey(lockKey, async () => {
    try {
      if (options?.idempotencyKey) {
        const { data: existingId, error: lookupError } = await rpcLookupProductIdempotency({ p_owner_id: userId, p_key: options.idempotencyKey }
        );
        if (!lookupError && existingId) {
          return { success: true, productId: existingId };
        }
      }

      const publishIntent = product.isActive !== false;
      const toCreate = publishIntent ? { ...product, isActive: true, archivedAt: null } : product;
      const created = await createProduct(toCreate);

      if (!created.success) {
        recordHealthEvent('product.create', false, { message: created.error });
        return { success: false, error: created.error };
      }

      const productId = created.data.id;

      if (options?.idempotencyKey) {
        await rpcRecordProductIdempotency({
          p_owner_id: userId,
          p_key: options.idempotencyKey,
          p_product_id: productId,
        });
      }

      if (publishIntent) {
        const published = await publishProduct(productId);
        if (!published.success && published.error) {
          return { success: true, productId, error: published.error };
        }
      }

      recordHealthEvent('product.create', true);
      return { success: true, productId };
    } catch (err) {
      recordHealthEvent('product.create', false, {
        message: err instanceof Error ? err.message : 'unknown',
      });
      return { success: false, error: err instanceof Error ? err.message : 'فشل في إضافة المنتج' };
    }
  });
}

/** Single publish path — RPC first, lifecycle patch fallback. */
export async function publishProduct(
  productId: string
): Promise<{ success: boolean; error?: string }> {
  const ownerId = await requireOwnerId();
  if (!ownerId) return { success: false, error: 'يجب تسجيل الدخول أولاً' };

  try {
    const { data, error } = await rpcPublishOwnerProduct({ p_product_id: productId });

    if (!error && data?.success && data?.product) {
      syncProductCachesAfterMutation(ownerId, data.product as Record<string, unknown>);
      recordHealthEvent('product.publish', true);
      return { success: true };
    }
    recordHealthEvent('product.publish', false, { message: error ?? 'rpc failed' });
  } catch {
    /* fall through to lifecycle patch */
  }

  return setProductLifecycle(productId, 'publish');
}

/** Lifecycle transitions (draft / publish / archive). */
export async function setProductLifecycle(
  productId: string,
  action: ProductLifecycleAction
): Promise<{ success: boolean; error?: string }> {
  const result = await updateProduct(productId, buildProductLifecyclePatch(action));
  return result.success
    ? { success: true }
    : { success: false, error: result.error };
}
