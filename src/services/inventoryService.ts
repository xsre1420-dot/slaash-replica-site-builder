import { supabase } from '@/integrations/supabase/client';
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

  const previousQty = product.stock_quantity ?? 0;
  const hasMinChange = minLevel !== undefined && minLevel !== (product.min_stock_level ?? 5);

  if (addAmount === 0 && !hasMinChange) {
    return { newQuantity: previousQty, added: 0 };
  }

  if (addAmount > 0) {
    const { data, error } = await (supabase as any).rpc('increment_product_stock', {
      p_product_id: product.id,
      p_owner_id: ownerId,
      p_delta: addAmount,
      p_reason: 'restock',
    });
    const payload = data as { success?: boolean; stock_quantity?: number; error?: string };
    if (!error && payload?.success && payload.stock_quantity != null) {
      if (hasMinChange) {
        await (supabase as any)
          .from('products')
          .update({ min_stock_level: minLevel })
          .eq('id', product.id)
          .eq('owner_id', ownerId);
      }
      return { newQuantity: payload.stock_quantity, added: addAmount };
    }

    throw new InventoryRestockError('تعذر تحديث المخزون — حاول مرة أخرى');
  }

  if (hasMinChange) {
    const { error } = await (supabase as any)
      .from('products')
      .update({ min_stock_level: minLevel })
      .eq('id', product.id)
      .eq('owner_id', ownerId);

    if (error) throw error;
  }

  return { newQuantity: previousQty, added: 0 };
};

export type InventoryMovementRow = {
  id: string;
  quantity_delta: number;
  reason: string;
  created_at: string;
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
