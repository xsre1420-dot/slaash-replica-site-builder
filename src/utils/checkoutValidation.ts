import { supabase } from '@/integrations/supabase/client';
import { CartItem, Product } from '@/types';
import { getAvailableQty } from './inventoryUtils';
import { AppliedCoupon, validateCoupon } from '@/services/couponService';
import { mapDbProduct } from '@/mappers/productMapper';

export async function fetchFreshProducts(
  ownerId: string,
  productIds: string[]
): Promise<Map<string, Product>> {
  const uniqueIds = [...new Set(productIds)];
  if (uniqueIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('products')
    .select(
      'id, name, description, category, price, image_url, additional_images, stock_quantity, sizes, colors, variants, discount_type, discount_value, discount_start_date, discount_end_date, original_price, is_active'
    )
    .eq('owner_id', ownerId)
    .in('id', uniqueIds)
    .or('is_active.eq.true,is_active.is.null');

  if (error) {
    throw new Error(error.message || 'FETCH_FAILED');
  }
  if (!data) return new Map();

  return new Map(
    data.map((row) => [
      String(row.id),
      mapDbProduct(row as Record<string, unknown>, { applyDiscount: true }),
    ])
  );
}

export interface CartValidationResult {
  valid: boolean;
  errors: string[];
  updatedItems: CartItem[];
  subtotal: number;
}

export function validateAndRefreshCart(
  items: CartItem[],
  freshProducts: Map<string, Product>
): CartValidationResult {
  const errors: string[] = [];
  const updatedItems: CartItem[] = [];
  let subtotal = 0;

  for (const item of items) {
    const fresh = freshProducts.get(item.product.id);
    if (!fresh) {
      errors.push(`المنتج "${item.product.name}" لم يعد متوفراً`);
      continue;
    }

    const available = getAvailableQty(fresh, item.selectedSize, item.selectedColor);
    if (available <= 0) {
      errors.push(`"${fresh.name}" غير متوفر في المخزون`);
      continue;
    }

    const qty = Math.min(item.quantity, available);
    if (qty < item.quantity) {
      errors.push(`تم تعديل كمية "${fresh.name}" إلى ${qty} (المتوفر: ${available})`);
    }

    updatedItems.push({
      ...item,
      product: fresh,
      quantity: qty,
    });
    subtotal += fresh.price * qty;
  }

  return {
    valid: errors.length === 0 && updatedItems.length > 0,
    errors,
    updatedItems,
    subtotal,
  };
}

export async function revalidateCoupon(
  ownerId: string,
  code: string,
  subtotal: number,
  storeSlug?: string
): Promise<AppliedCoupon | null> {
  try {
    return await validateCoupon(ownerId, code, subtotal, storeSlug);
  } catch {
    return null;
  }
}

export type { AppliedCoupon };

export function buildCartFingerprint(items: CartItem[]): string {
  const payload = items
    .map(
      (i) =>
        `${i.product.id}:${i.quantity}:${i.selectedSize || ''}:${i.selectedColor || ''}:${i.product.price}`
    )
    .sort()
    .join('|');
  return payload;
}
