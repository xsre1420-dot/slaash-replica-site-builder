/**
 * Delivery fee and shipment reads — no status mutations.
 */
import { supabase } from '@/integrations/supabase/client';
import { DeliveryStatus } from '@/utils/deliveryUtils';
import { callReadRpc } from '@/lib/readWrite/readClient';

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
  const { data, error } = await callReadRpc<number>('calculate_delivery_fee', {
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
  const { data, error } = await callReadRpc<number>('calculate_delivery_fee_by_slug', {
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
  const { data, error } = await callReadRpc<{
    success?: boolean;
    shipment?: ShipmentInfo | null;
    delivery_fee?: number;
    delivery_status?: string;
    events?: ShipmentTrackingEvent[];
  }>('get_order_shipment', {
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
