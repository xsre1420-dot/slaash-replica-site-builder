import { supabase } from '@/repositories/base';

export async function rpcIncrementProductStock(args: Record<string, unknown>) {
  return (supabase as any).rpc('increment_product_stock', args);
}

export async function rpcAuditMerchantInventoryIntegrity(p_owner_id: string) {
  return (supabase as any).rpc('audit_merchant_inventory_integrity', { p_owner_id });
}

export async function rpcBatchRestockProducts(p_owner_id: string, p_items: unknown[]) {
  return (supabase as any).rpc('batch_restock_products', {
    p_owner_id,
    p_items,
  });
}

export async function rpcMerchantInventorySummary(p_owner_id: string) {
  return (supabase as any).rpc('merchant_inventory_summary', { p_owner_id });
}

export async function rpcListMerchantInventoryMovements(
  p_owner_id: string,
  p_from?: string,
  p_to?: string,
  p_limit?: number
) {
  return (supabase as any).rpc('list_merchant_inventory_movements', {
    p_owner_id,
    p_from,
    p_to,
    p_limit,
  });
}

export async function rpcMerchantInventoryForecast(p_owner_id: string) {
  return (supabase as any).rpc('merchant_inventory_forecast', { p_owner_id });
}

export async function rpcMerchantAbcAnalysis(p_owner_id: string) {
  return (supabase as any).rpc('merchant_abc_analysis', { p_owner_id });
}

export async function rpcLookupProductByBarcode(p_owner_id: string, p_barcode: string) {
  return (supabase as any).rpc('lookup_product_by_barcode', {
    p_owner_id,
    p_barcode,
  });
}

export async function rpcEnsureDefaultWarehouse(p_owner_id: string) {
  return (supabase as any).rpc('ensure_default_warehouse', { p_owner_id });
}

export async function rpcTransferWarehouseStock(args: {
  p_owner_id: string;
  p_product_id: string;
  p_from_warehouse_id: string;
  p_to_warehouse_id: string;
  p_quantity: number;
  p_notes?: string;
}) {
  return (supabase as any).rpc('transfer_warehouse_stock', args);
}

export async function rpcReceivePurchaseOrderLine(
  p_owner_id: string,
  p_line_id: string,
  p_quantity: number
) {
  return (supabase as any).rpc('receive_purchase_order_line', {
    p_owner_id,
    p_line_id,
    p_quantity,
  });
}

export async function rpcStartInventoryCycleCount(
  p_owner_id: string,
  p_warehouse_id?: string,
  p_name?: string
) {
  return (supabase as any).rpc('start_inventory_cycle_count', {
    p_owner_id,
    p_warehouse_id: p_warehouse_id ?? null,
    p_name: p_name ?? null,
  });
}

export async function rpcSubmitCycleCountLine(
  p_owner_id: string,
  p_line_id: string,
  p_counted_qty: number,
  p_apply_adjustment?: boolean
) {
  return (supabase as any).rpc('submit_cycle_count_line', {
    p_owner_id,
    p_line_id,
    p_counted_qty,
    p_apply_adjustment: p_apply_adjustment ?? false,
  });
}

export async function rpcCompleteInventoryCycleCount(p_owner_id: string, p_cycle_count_id: string) {
  return (supabase as any).rpc('complete_inventory_cycle_count', {
    p_owner_id,
    p_cycle_count_id,
  });
}

export function inventoryMovementsTable() {
  return supabase.from('inventory_movements');
}

export function warehousesTable() {
  return supabase.from('warehouses');
}

export function warehouseStockTable() {
  return supabase.from('warehouse_stock');
}

export function suppliersTable() {
  return supabase.from('suppliers');
}

export function purchaseOrdersTable() {
  return supabase.from('purchase_orders');
}

export function purchaseOrderLinesTable() {
  return supabase.from('purchase_order_lines');
}

export function cycleCountsTable() {
  return supabase.from('inventory_cycle_counts');
}

export function cycleCountLinesTable() {
  return supabase.from('inventory_cycle_count_lines');
}

export async function getAuthUserId() {
  return supabase.auth.getUser();
}
