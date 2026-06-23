import { supabase } from '@/integrations/supabase/client';
import { DeliveryStatus } from '@/utils/deliveryUtils';

export interface ShipmentTrackingEvent {
  id: string;
  status: string;
  note?: string;
  location?: string;
  created_at: string;
}

export interface ShipmentInfo {
  id: string;
  order_id: string;
  tracking_number?: string;
  carrier?: string;
  status: DeliveryStatus;
  delivery_fee: number;
  failed_reason?: string;
  governorate?: string;
  estimated_delivery_at?: string;
  delivered_at?: string;
}

export interface OrderShipmentData {
  shipment: ShipmentInfo | null;
  deliveryFee: number;
  deliveryStatus: DeliveryStatus;
  events: ShipmentTrackingEvent[];
}

export const fetchDeliveryFee = async (
  ownerId: string,
  governorate: string
): Promise<number | null> => {
  const { data, error } = await (supabase as any).rpc('calculate_delivery_fee', {
    p_owner_id: ownerId,
    p_governorate: governorate,
  });
  if (error) return null;
  return Number(data) || 0;
};

export const fetchDeliveryFeeBySlug = async (
  storeSlug: string,
  governorate: string
): Promise<number | null> => {
  const { data, error } = await (supabase as any).rpc('calculate_delivery_fee_by_slug', {
    p_store_slug: storeSlug.trim().toLowerCase(),
    p_governorate: governorate,
  });
  if (error) return null;
  return Number(data) || 0;
};

export const fetchOrderShipment = async (
  orderId: string,
  ownerId: string
): Promise<OrderShipmentData | null> => {
  const { data, error } = await (supabase as any).rpc('get_order_shipment', {
    p_order_id: orderId,
    p_owner_id: ownerId,
  });

  if (error || !data?.success) return null;

  return {
    shipment: data.shipment as ShipmentInfo | null,
    deliveryFee: Number(data.delivery_fee) || 0,
    deliveryStatus: (data.delivery_status || 'pending') as DeliveryStatus,
    events: (data.events as ShipmentTrackingEvent[]) || [],
  };
};

export const updateShipmentStatus = async (
  shipmentId: string,
  ownerId: string,
  status: DeliveryStatus,
  options?: { note?: string; trackingNumber?: string; carrier?: string }
): Promise<{ success: boolean; error?: string }> => {
  const { data, error } = await (supabase as any).rpc('update_shipment_status', {
    p_shipment_id: shipmentId,
    p_owner_id: ownerId,
    p_status: status,
    p_note: options?.note || null,
    p_tracking_number: options?.trackingNumber || null,
    p_carrier: options?.carrier || null,
  });

  if (error) return { success: false, error: error.message };
  if (!data?.success) return { success: false, error: data?.error || 'Update failed' };
  return { success: true };
};

export const markDeliveryFailed = async (
  shipmentId: string,
  ownerId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> => {
  const { data, error } = await (supabase as any).rpc('mark_delivery_failed', {
    p_shipment_id: shipmentId,
    p_owner_id: ownerId,
    p_reason: reason || null,
  });

  if (error) return { success: false, error: error.message };
  if (!data?.success) return { success: false, error: data?.error || 'Failed' };
  return { success: true };
};

export const retryFailedDelivery = async (
  shipmentId: string,
  ownerId: string,
  note?: string
): Promise<{ success: boolean; error?: string }> => {
  const { data, error } = await (supabase as any).rpc('retry_failed_delivery', {
    p_shipment_id: shipmentId,
    p_owner_id: ownerId,
    p_note: note || null,
  });

  if (error) return { success: false, error: error.message };
  if (!data?.success) return { success: false, error: data?.error || 'Retry failed' };
  return { success: true };
};
