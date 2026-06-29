/**
 * Delivery fee and shipment reads — no status mutations.
 */
import { DeliveryStatus } from '@/utils/deliveryUtils';
import {
  rpcCalculateDeliveryFee,
  rpcCalculateDeliveryFeeBySlug,
  rpcGetOrderShipment,
} from '@/repositories/delivery/deliveryRepository';

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
  const { data, error } = await rpcCalculateDeliveryFee(ownerId, governorate);
  if (error) return null;
  return Number(data) || 0;
};

export const fetchDeliveryFeeBySlug = async (
  storeSlug: string,
  governorate: string
): Promise<number | null> => {
  const { data, error } = await rpcCalculateDeliveryFeeBySlug(
    storeSlug.trim().toLowerCase(),
    governorate
  );
  if (error) return null;
  return Number(data) || 0;
};

export const fetchOrderShipment = async (
  orderId: string,
  ownerId: string
): Promise<OrderShipmentData | null> => {
  const { data, error } = await rpcGetOrderShipment(orderId, ownerId);

  if (error || !data?.success) return null;

  return {
    shipment: data.shipment as ShipmentInfo | null,
    deliveryFee: Number(data.delivery_fee) || 0,
    deliveryStatus: (data.delivery_status || 'pending') as DeliveryStatus,
    events: (data.events as ShipmentTrackingEvent[]) || [],
  };
};
