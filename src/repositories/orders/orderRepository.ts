import { supabase, callWriteRpc, callReadRpc, adaptRpcResult } from '@/repositories/base';

export async function rpcUpdateMerchantOrderStatus(args: {
  p_order_id: string;
  p_owner_id: string;
  p_status: string;
}) {
  return (supabase as any).rpc('update_merchant_order_status', args);
}

export async function rpcCreateOrderWithStockDeduction(
  args: Record<string, unknown>
) {
  return (supabase as any).rpc('create_order_with_stock_deduction', args);
}

export async function rpcAttachOrderMarketingAttribution(
  args: Record<string, unknown>
) {
  return callWriteRpc('attach_order_marketing_attribution', args);
}

export async function rpcListMerchantOrders(args: Record<string, unknown>) {
  return callReadRpc('list_merchant_orders', args);
}

export async function rpcCountMerchantOrdersByWorkflow(args: Record<string, unknown>) {
  return callReadRpc('count_merchant_orders_by_workflow', args);
}

export async function rpcGetOrderStatsBatch(args: Record<string, unknown>) {
  return adaptRpcResult(await callReadRpc('get_merchant_order_stats_batch', args));
}

export function ordersTable() {
  return supabase.from('orders');
}

export function orderItemsTable() {
  return supabase.from('order_items');
}
