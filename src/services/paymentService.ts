import { supabase } from '@/integrations/supabase/client';
import { mapPaymentError } from '@/utils/paymentUtils';

export interface OrderPaymentSummary {
  orderId: string;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  refundedTotal: number;
  remainingRefundable: number;
  transactions: Array<Record<string, unknown>>;
  refunds: Array<Record<string, unknown>>;
  chargebacks: Array<Record<string, unknown>>;
}

export const fetchOrderPaymentSummary = async (
  orderId: string,
  ownerId: string
): Promise<OrderPaymentSummary | null> => {
  const { data, error } = await (supabase as any).rpc('get_order_payment_summary', {
    p_order_id: orderId,
    p_owner_id: ownerId,
  });

  if (error || !data?.success) return null;

  return {
    orderId: String(data.order_id),
    totalAmount: Number(data.total_amount),
    paymentMethod: String(data.payment_method || 'cash_on_delivery'),
    paymentStatus: String(data.payment_status || 'pending_collection'),
    orderStatus: String(data.order_status),
    refundedTotal: Number(data.refunded_total) || 0,
    remainingRefundable: Number(data.remaining_refundable) || 0,
    transactions: (data.transactions as Array<Record<string, unknown>>) || [],
    refunds: (data.refunds as Array<Record<string, unknown>>) || [],
    chargebacks: (data.chargebacks as Array<Record<string, unknown>>) || [],
  };
};

export const recordOrderRefund = async (
  orderId: string,
  ownerId: string,
  amount: number,
  reason?: string
): Promise<{ success: boolean; error?: string; refundId?: string }> => {
  const idempotencyKey =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-refund`;

  const { data, error } = await (supabase as any).rpc('record_order_refund', {
    p_order_id: orderId,
    p_owner_id: ownerId,
    p_amount: amount,
    p_reason: reason || null,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    return { success: false, error: mapPaymentError(error.message) };
  }

  if (!data?.success) {
    return { success: false, error: mapPaymentError(data?.error || 'Refund failed') };
  }

  return { success: true, refundId: data.refund_id };
};

export const recordOrderChargeback = async (
  orderId: string,
  ownerId: string,
  amount: number,
  reason?: string
): Promise<{ success: boolean; error?: string }> => {
  const { data, error } = await (supabase as any).rpc('record_order_chargeback', {
    p_order_id: orderId,
    p_owner_id: ownerId,
    p_amount: amount,
    p_reason: reason || null,
    p_provider_dispute_id: null,
  });

  if (error) {
    return { success: false, error: mapPaymentError(error.message) };
  }

  if (!data?.success) {
    return { success: false, error: mapPaymentError(data?.error || 'Chargeback failed') };
  }

  return { success: true };
};
