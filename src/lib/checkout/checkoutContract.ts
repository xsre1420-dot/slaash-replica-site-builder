/**
 * Canonical checkout RPC contract — single production overload with p_store_slug.
 */
import type { CartItem } from '@/types';
import { findProductColorOption } from '@/utils/orderItemDisplayUtils';

export const CHECKOUT_CREATE_RPC = 'create_order_with_stock_deduction' as const;

export type CheckoutRpcItem = {
  product_id: string;
  quantity: number;
  selected_size: string | null;
  selected_color: string | null;
  color_name: string | null;
  color_image: string | null;
};

export type CreateOrderWithStockDeductionArgs = {
  p_order_id: string;
  p_owner_id: string;
  p_idempotency_key: string;
  p_customer_name: string;
  p_customer_phone: string;
  p_customer_address: string;
  p_total_amount: number;
  p_customer_governorate: string | null;
  p_notes: string | null;
  p_items: CheckoutRpcItem[];
  p_payment_method: string;
  p_coupon_code: string | null;
  /** Required for storefront (anon) checkout tenant resolution; null for merchant self-checkout. */
  p_store_slug: string | null;
};

export type CreateOrderRpcSuccess = {
  success: true;
  order_id: string;
  total_amount?: number;
  discount_amount?: number;
  delivery_fee?: number;
  side_effects_deferred?: boolean;
  idempotent?: boolean;
};

export type CreateOrderRpcFailure = {
  success: false;
  error: string;
  product_id?: string;
  product_name?: string;
  available?: number;
  requested?: number;
  expected_total?: number;
};

export function normalizeCheckoutRpcItems(items: CartItem[]): CheckoutRpcItem[] {
  return items.map((item) => {
    const colorOpt = findProductColorOption(item.product.colors, item.selectedColor);
    return {
      product_id: item.product.id,
      quantity: item.quantity,
      selected_size: item.selectedSize?.trim() || null,
      selected_color: item.selectedColor?.trim() || null,
      color_name: item.selectedColorName ?? colorOpt?.name ?? null,
      color_image: item.selectedColorImage ?? colorOpt?.image ?? null,
    };
  });
}

export function normalizeStoreSlugForCheckout(storeSlug?: string | null): string | null {
  const trimmed = storeSlug?.trim().toLowerCase();
  return trimmed || null;
}
