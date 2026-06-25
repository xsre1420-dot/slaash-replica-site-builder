import { supabase } from '@/integrations/supabase/client';
import { assertMerchantOwner } from '@/lib/tenantGuard';
import { recordHealthEvent } from '@/lib/observability/healthMonitor';
import type { InventoryProductRow } from '@/utils/inventoryPageUtils';

export class InventoryRestockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryRestockError';
  }
}

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

    const { data, error } = await (supabase as any).rpc('increment_product_stock', rpcParams);
    const payload = data as { success?: boolean; stock_quantity?: number; error?: string };
    if (!error && payload?.success && payload.stock_quantity != null) {
      recordHealthEvent('inventory', true);
      return { newQuantity: payload.stock_quantity, added: addAmount };
    }

    recordHealthEvent('inventory', false, { message: payload?.error ?? error?.message });
    throw new InventoryRestockError('تعذر تحديث المخزون — حاول مرة أخرى');
  }

  if (hasMinChange) {
    const { data, error } = await (supabase as any).rpc('increment_product_stock', {
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

export type InventoryMovementRow = {
  id: string;
  quantity_delta: number;
  reason: string;
  created_at: string;
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

  const { data, error } = await (supabase as any).rpc('increment_product_stock', {
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

export type InventoryIntegritySummary = {
  negative_stock: number;
  variant_drift: number;
  duplicate_initial_stock: number;
  missing_initial_stock: number;
  ledger_mismatch: number;
  orphan_movements: number;
  archived_still_active: number;
};

export type InventoryIntegrityResult = {
  score: number;
  totalProducts: number;
  issuesCount: number;
  summary: InventoryIntegritySummary;
  issues: Record<string, unknown>[];
};

export const auditInventoryIntegrity = async (
  ownerId: string
): Promise<InventoryIntegrityResult | null> => {
  await assertMerchantOwner(ownerId);

  const { data, error } = await (supabase as any).rpc('audit_merchant_inventory_integrity', {
    p_owner_id: ownerId,
  });

  const payload = data as {
    success?: boolean;
    score?: number;
    total_products?: number;
    issues_count?: number;
    summary?: InventoryIntegritySummary;
    issues?: Record<string, unknown>[];
    error?: string;
  };

  if (error || !payload?.success) return null;

  return {
    score: payload.score ?? 0,
    totalProducts: payload.total_products ?? 0,
    issuesCount: payload.issues_count ?? 0,
    summary: payload.summary ?? {
      negative_stock: 0,
      variant_drift: 0,
      duplicate_initial_stock: 0,
      missing_initial_stock: 0,
      ledger_mismatch: 0,
      orphan_movements: 0,
      archived_still_active: 0,
    },
    issues: payload.issues ?? [],
  };
};

export const fetchProductMovements = async (
  productId: string,
  limit = 20,
  ownerId?: string
): Promise<InventoryMovementRow[]> => {
  let tenantId = ownerId;
  if (!tenantId) {
    const { data: authData } = await supabase.auth.getUser();
    tenantId = authData.user?.id;
  }
  if (!tenantId) return [];
  await assertMerchantOwner(tenantId);

  const { data, error } = await (supabase as any)
    .from('inventory_movements')
    .select('id, quantity_delta, reason, created_at')
    .eq('product_id', productId)
    .eq('owner_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as InventoryMovementRow[];
};
