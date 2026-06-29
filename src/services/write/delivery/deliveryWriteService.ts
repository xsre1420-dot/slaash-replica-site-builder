/**
 * Shipment status mutations — primary DB only.
 */
import {
  rpcUpdateShipmentStatus,
  rpcMarkDeliveryFailed,
  rpcRetryFailedDelivery,
} from '@/repositories/delivery/deliveryRepository';
import { DeliveryStatus } from '@/utils/deliveryUtils';

export const updateShipmentStatus = async (
  shipmentId: string,
  ownerId: string,
  status: DeliveryStatus,
  options?: { note?: string; trackingNumber?: string; carrier?: string }
): Promise<{ success: boolean; error?: string }> => {
  const { data, error } = await rpcUpdateShipmentStatus({
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
  const { data, error } = await rpcMarkDeliveryFailed({
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
  const { data, error } = await rpcRetryFailedDelivery({
    p_shipment_id: shipmentId,
    p_owner_id: ownerId,
    p_note: note || null,
  });

  if (error) return { success: false, error: error.message };
  if (!data?.success) return { success: false, error: data?.error || 'Retry failed' };
  return { success: true };
};
