/**
 * Shipment status mutations — primary DB only.
 */
import { supabase } from '@/integrations/supabase/client';
import { DeliveryStatus } from '@/utils/deliveryUtils';

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
