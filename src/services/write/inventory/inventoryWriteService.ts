/**
 * Inventory stock mutations — primary DB only.
 */
import { rpcIncrementProductStock } from '@/repositories/inventory/inventoryRepository';
import { assertMerchantOwner } from '@/lib/tenantGuard';
import { recordHealthEvent } from '@/lib/observability/healthMonitor';
import type { InventoryProductRow } from '@/utils/inventoryPageUtils';
import { InventoryRestockError } from '@/services/read/inventory/inventoryReadService';

type RestockProductParams = {
  product: InventoryProductRow;
  ownerId: string;
  addAmount: number;
  minLevel?: number;
};

export const restockProduct = async ({
  product,
  ownerId,
  addAmount,
  minLevel,
}: RestockProductParams): Promise<{ newQuantity: number; added: number }> => {
  if (addAmount < 0) {
    throw new InventoryRestockError('لا يمكن خصم المخزون يدوياً — يُخصم تلقائياً عند الطلب');
  }

  await assertMerchantOwner(ownerId);

  const previousQty = product.stock_quantity ?? 0;
  const hasMinChange = minLevel !== undefined && minLevel !== (product.min_stock_level ?? 5);

  if (addAmount === 0 && !hasMinChange) {
    return { newQuantity: previousQty, added: 0 };
  }

  if (addAmount > 0) {
    const rpcParams: Record<string, unknown> = {
      p_product_id: product.id,
      p_owner_id: ownerId,
      p_delta: addAmount,
      p_reason: 'restock',
    };
    if (hasMinChange) {
      rpcParams.p_min_stock_level = minLevel;
    }

    const { data, error } = await rpcIncrementProductStock(rpcParams);
    const payload = data as { success?: boolean; stock_quantity?: number; error?: string };
    if (!error && payload?.success && payload.stock_quantity != null) {
      recordHealthEvent('inventory', true);
      return { newQuantity: payload.stock_quantity, added: addAmount };
    }

    recordHealthEvent('inventory', false, { message: payload?.error ?? error?.message });
    throw new InventoryRestockError('تعذر تحديث المخزون — حاول مرة أخرى');
  }

  if (hasMinChange) {
    const { data, error } = await rpcIncrementProductStock({
      p_product_id: product.id,
      p_owner_id: ownerId,
      p_delta: 0,
      p_reason: 'threshold_update',
      p_min_stock_level: minLevel,
    });
    const payload = data as { success?: boolean; stock_quantity?: number; error?: string };
    if (!error && payload?.success) {
      recordHealthEvent('inventory', true);
      return {
        newQuantity: payload.stock_quantity ?? previousQty,
        added: 0,
      };
    }

    recordHealthEvent('inventory', false, { message: payload?.error ?? error?.message });
    throw new InventoryRestockError('تعذر تحديث حد المخزون — حاول مرة أخرى');
  }

  return { newQuantity: previousQty, added: 0 };
};

/** Apply absolute stock target via locked increment RPC (add-only; deducts rejected). */
export const applyStockQuantityPatch = async (
  productId: string,
  ownerId: string,
  previousQty: number | null | undefined,
  nextQty: number | null | undefined
): Promise<number> => {
  const prev = previousQty ?? 0;
  const next = nextQty ?? 0;
  const delta = next - prev;

  if (delta === 0) return next;

  if (delta < 0) {
    throw new InventoryRestockError('لا يمكن خصم المخزون يدوياً — يُخصم تلقائياً عند الطلب');
  }

  await assertMerchantOwner(ownerId);

  const { data, error } = await rpcIncrementProductStock({
    p_product_id: productId,
    p_owner_id: ownerId,
    p_delta: delta,
    p_reason: 'restock',
  });
  const payload = data as { success?: boolean; stock_quantity?: number; error?: string };
  if (!error && payload?.success && payload.stock_quantity != null) {
    recordHealthEvent('inventory', true);
    return payload.stock_quantity;
  }

  recordHealthEvent('inventory', false, { message: payload?.error ?? error?.message });
  throw new InventoryRestockError('تعذر تحديث المخزون — حاول مرة أخرى');
};
