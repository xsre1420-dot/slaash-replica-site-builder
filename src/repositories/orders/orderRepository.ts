import { supabase, callWriteRpc, callReadRpc, adaptRpcResult } from '@/repositories/base';
import {
  CHECKOUT_CREATE_RPC,
  type CreateOrderWithStockDeductionArgs,
} from '@/lib/checkout/checkoutContract';
import { CHECKOUT_CREATE_TIMEOUT_MS, CHECKOUT_RECOVERY_TIMEOUT_MS } from '@/lib/resilience/timeouts';

export async function rpcUpdateMerchantOrderStatus(args: {
  p_order_id: string;
  p_owner_id: string;
  p_status: string;
}) {
  return adaptRpcResult(await callWriteRpc('update_merchant_order_status', args));
}

export async function rpcCreateOrderWithStockDeduction(args: CreateOrderWithStockDeductionArgs) {
  return adaptRpcResult(
    await callWriteRpc(CHECKOUT_CREATE_RPC, args, {
      timeoutMs: CHECKOUT_CREATE_TIMEOUT_MS,
      trafficClass: 'critical',
      skipReplicaFallback: true,
    })
  );
}

export async function rpcRecoverOrderByIdempotencyKey(args: Record<string, unknown>) {
  return adaptRpcResult(
    await callReadRpc('get_order_by_idempotency_key', args, {
      timeoutMs: CHECKOUT_RECOVERY_TIMEOUT_MS,
      forcePrimary: true,
      trafficClass: 'critical',
      skipReplicaFallback: true,
    })
  );
}

export async function rpcAttachOrderMarketingAttribution(args: Record<string, unknown>) {
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
