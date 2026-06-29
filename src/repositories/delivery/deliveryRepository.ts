import { supabase, callReadRpc } from '@/repositories/base';

export async function rpcCalculateDeliveryFee(p_owner_id: string, p_governorate: string) {
  return callReadRpc<number>('calculate_delivery_fee', { p_owner_id, p_governorate });
}

export async function rpcCalculateDeliveryFeeBySlug(p_store_slug: string, p_governorate: string) {
  return callReadRpc<number>('calculate_delivery_fee_by_slug', {
    p_store_slug,
    p_governorate,
  });
}

export async function rpcGetOrderShipment(p_order_id: string, p_owner_id: string) {
  return callReadRpc('get_order_shipment', { p_order_id, p_owner_id });
}

export async function rpcUpdateShipmentStatus(args: Record<string, unknown>) {
  return (supabase as any).rpc('update_shipment_status', args);
}

export async function rpcMarkDeliveryFailed(args: Record<string, unknown>) {
  return (supabase as any).rpc('mark_delivery_failed', args);
}

export async function rpcRetryFailedDelivery(args: Record<string, unknown>) {
  return (supabase as any).rpc('retry_failed_delivery', args);
}
