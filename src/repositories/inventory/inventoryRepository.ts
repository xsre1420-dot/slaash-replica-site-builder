import { supabase } from '@/repositories/base';

export async function rpcIncrementProductStock(args: Record<string, unknown>) {
  return (supabase as any).rpc('increment_product_stock', args);
}

export async function rpcAuditMerchantInventoryIntegrity(p_owner_id: string) {
  return (supabase as any).rpc('audit_merchant_inventory_integrity', { p_owner_id });
}

export function inventoryMovementsTable() {
  return supabase.from('inventory_movements');
}

export async function getAuthUserId() {
  return supabase.auth.getUser();
}
