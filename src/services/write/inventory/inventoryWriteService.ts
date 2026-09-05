/**
 * Inventory stock mutations — primary DB only.
 */
import {
  rpcIncrementProductStock,
  rpcBatchRestockProducts,
  rpcTransferWarehouseStock,
  rpcReceivePurchaseOrderLine,
  rpcStartInventoryCycleCount,
  rpcSubmitCycleCountLine,
  rpcCompleteInventoryCycleCount,
  rpcEnsureDefaultWarehouse,
  suppliersTable,
  purchaseOrdersTable,
  purchaseOrderLinesTable,
  warehousesTable,
} from '@/repositories/inventory/inventoryRepository';
import { assertMerchantOwner } from '@/lib/tenantGuard';
import { hasWarehouseInventory, hasBatchRestockRpc } from '@/lib/supabase/schemaCapabilities';
import { recordHealthEvent } from '@/lib/observability/healthMonitor';
import type { InventoryProductRow } from '@/utils/inventoryPageUtils';
import { InventoryRestockError } from '@/services/read/inventory/inventoryReadService';
import { traceCriticalFlow } from '@/lib/tracing';
import { getSuggestedRestockAmount } from '@/utils/inventoryPageUtils';

type RestockProductParams = {
  product: InventoryProductRow;
  ownerId: string;
  addAmount: number;
  minLevel?: number;
};

export type BatchRestockItem = {
  product_id: string;
  delta: number;
  min_stock_level?: number;
};

export type BatchRestockResult = {
  succeeded: number;
  failed: number;
};

export const restockProduct = async ({
  product,
  ownerId,
  addAmount,
  minLevel,
}: RestockProductParams): Promise<{ newQuantity: number; added: number }> => {
  return traceCriticalFlow('inventory.update', 'rpc', 'restock', async () => {
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
  }, { productId: product.id, ownerId });
};

export const batchRestockProducts = async (
  ownerId: string,
  items: BatchRestockItem[]
): Promise<BatchRestockResult> => {
  await assertMerchantOwner(ownerId);
  if (items.length === 0) return { succeeded: 0, failed: 0 };

  if (await hasBatchRestockRpc()) {
    const { data, error } = await rpcBatchRestockProducts(ownerId, items);
    const payload = data as { success?: boolean; succeeded?: number; failed?: number; error?: string };

    if (error || !payload?.success) {
      throw new InventoryRestockError(payload?.error ?? 'فشل التعبئة الجماعية');
    }

    recordHealthEvent('inventory', (payload.failed ?? 0) === 0);
    return {
      succeeded: payload.succeeded ?? 0,
      failed: payload.failed ?? 0,
    };
  }

  let succeeded = 0;
  let failed = 0;
  for (const item of items) {
    if (item.delta <= 0) {
      failed += 1;
      continue;
    }
    const { data, error } = await rpcIncrementProductStock({
      p_product_id: item.product_id,
      p_owner_id: ownerId,
      p_delta: item.delta,
      p_reason: 'restock',
      ...(item.min_stock_level != null ? { p_min_stock_level: item.min_stock_level } : {}),
    });
    const payload = data as { success?: boolean };
    if (!error && payload?.success) succeeded += 1;
    else failed += 1;
  }

  recordHealthEvent('inventory', failed === 0);
  return { succeeded, failed };
};

export const batchRestockWithSuggestions = async (
  ownerId: string,
  products: InventoryProductRow[]
): Promise<BatchRestockResult> => {
  const items: BatchRestockItem[] = products.map((p) => ({
    product_id: p.id,
    delta: getSuggestedRestockAmount(p),
  }));
  return batchRestockProducts(ownerId, items);
};

export const ensureDefaultWarehouse = async (ownerId: string): Promise<string | null> => {
  await assertMerchantOwner(ownerId);
  if (!(await hasWarehouseInventory())) return null;
  const { data, error } = await rpcEnsureDefaultWarehouse(ownerId);
  if (error) return null;
  return typeof data === 'string' ? data : null;
};

export const transferWarehouseStock = async (args: {
  ownerId: string;
  productId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  notes?: string;
}): Promise<void> => {
  await assertMerchantOwner(args.ownerId);
  if (!(await hasWarehouseInventory())) {
    throw new InventoryRestockError('ميزة المستودعات غير متوفرة في قاعدة البيانات الحالية');
  }
  const { data, error } = await rpcTransferWarehouseStock({
    p_owner_id: args.ownerId,
    p_product_id: args.productId,
    p_from_warehouse_id: args.fromWarehouseId,
    p_to_warehouse_id: args.toWarehouseId,
    p_quantity: args.quantity,
    p_notes: args.notes,
  });
  const payload = data as { success?: boolean; error?: string };
  if (error || !payload?.success) {
    throw new InventoryRestockError(payload?.error ?? 'فشل نقل المخزون');
  }
};

export const createSupplier = async (
  ownerId: string,
  input: { name: string; phone?: string; email?: string; notes?: string }
): Promise<string | null> => {
  await assertMerchantOwner(ownerId);
  if (!(await hasWarehouseInventory())) return null;
  const { data, error } = await suppliersTable()
    .insert({ owner_id: ownerId, ...input })
    .select('id')
    .single();
  if (error || !data) return null;
  return (data as { id: string }).id;
};

export const createPurchaseOrder = async (
  ownerId: string,
  input: {
    supplierId?: string;
    warehouseId?: string;
    referenceCode?: string;
    expectedAt?: string;
    notes?: string;
    lines: Array<{ productId: string; quantity: number; unitCost?: number }>;
  }
): Promise<string | null> => {
  await assertMerchantOwner(ownerId);
  if (!(await hasWarehouseInventory())) return null;
  const whId = input.warehouseId ?? (await ensureDefaultWarehouse(ownerId));
  const { data: po, error: poErr } = await purchaseOrdersTable()
    .insert({
      owner_id: ownerId,
      supplier_id: input.supplierId ?? null,
      warehouse_id: whId,
      status: 'ordered',
      reference_code: input.referenceCode ?? null,
      expected_at: input.expectedAt ?? null,
      notes: input.notes ?? null,
    })
    .select('id')
    .single();
  if (poErr || !po) return null;

  const poId = (po as { id: string }).id;
  const lineRows = input.lines.map((l) => ({
    purchase_order_id: poId,
    product_id: l.productId,
    owner_id: ownerId,
    quantity_ordered: l.quantity,
    unit_cost: l.unitCost ?? null,
  }));
  const { error: linesErr } = await purchaseOrderLinesTable().insert(lineRows);
  if (linesErr) return null;
  return poId;
};

export const receivePurchaseOrderLine = async (
  ownerId: string,
  lineId: string,
  quantity: number
): Promise<number | null> => {
  await assertMerchantOwner(ownerId);
  if (!(await hasWarehouseInventory())) return null;
  const { data, error } = await rpcReceivePurchaseOrderLine(ownerId, lineId, quantity);
  const payload = data as { success?: boolean; stock_quantity?: number; error?: string };
  if (error || !payload?.success) {
    throw new InventoryRestockError(payload?.error ?? 'فشل استلام البضاعة');
  }
  return payload.stock_quantity ?? null;
};

export const startCycleCount = async (
  ownerId: string,
  name?: string,
  warehouseId?: string
): Promise<string | null> => {
  await assertMerchantOwner(ownerId);
  if (!(await hasWarehouseInventory())) return null;
  const { data, error } = await rpcStartInventoryCycleCount(ownerId, warehouseId, name);
  const payload = data as { success?: boolean; cycle_count_id?: string };
  if (error || !payload?.success) return null;
  return payload.cycle_count_id ?? null;
};

export const submitCycleCountLine = async (
  ownerId: string,
  lineId: string,
  countedQty: number,
  applyAdjustment = false
): Promise<number> => {
  await assertMerchantOwner(ownerId);
  if (!(await hasWarehouseInventory())) {
    throw new InventoryRestockError('ميزة الجرد غير متوفرة في قاعدة البيانات الحالية');
  }
  const { data, error } = await rpcSubmitCycleCountLine(
    ownerId,
    lineId,
    countedQty,
    applyAdjustment
  );
  const payload = data as { success?: boolean; variance?: number; error?: string };
  if (error || !payload?.success) {
    throw new InventoryRestockError(payload?.error ?? 'فشل حفظ الجرد');
  }
  return payload.variance ?? 0;
};

export const completeCycleCount = async (ownerId: string, cycleCountId: string): Promise<void> => {
  await assertMerchantOwner(ownerId);
  if (!(await hasWarehouseInventory())) {
    throw new InventoryRestockError('ميزة الجرد غير متوفرة في قاعدة البيانات الحالية');
  }
  const { data, error } = await rpcCompleteInventoryCycleCount(ownerId, cycleCountId);
  const payload = data as { success?: boolean };
  if (error || !payload?.success) {
    throw new InventoryRestockError('فشل إنهاء الجرد');
  }
};

export const createWarehouse = async (
  ownerId: string,
  input: { name: string; code?: string; address?: string }
): Promise<string | null> => {
  await assertMerchantOwner(ownerId);
  if (!(await hasWarehouseInventory())) return null;
  const { data, error } = await warehousesTable()
    .insert({
      owner_id: ownerId,
      name: input.name,
      code: input.code ?? null,
      address: input.address ?? null,
      is_default: false,
    })
    .select('id')
    .single();
  if (error || !data) return null;
  return (data as { id: string }).id;
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
