import { supabase } from '@/integrations/supabase/client';
import { CartItem, Product, ColorOption, ProductVariant } from '@/types';
import { getAvailableQty, applyActiveDiscount } from './inventoryUtils';
import { AppliedCoupon } from '@/components/checkout/CouponInput';

const mapDbProduct = (row: Record<string, unknown>): Product => {
  const colors = row.colors as ColorOption[] | undefined;
  const variants = row.variants as ProductVariant[] | undefined;

  const product: Product = {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description || ''),
    category: String(row.category || ''),
    price: Number(row.price),
    image: String(row.image_url || ''),
    additionalImages: (row.additional_images as string[]) || undefined,
    stockQuantity: row.stock_quantity != null ? Number(row.stock_quantity) : undefined,
    sizes: Array.isArray(row.sizes) ? (row.sizes as string[]) : undefined,
    colors: Array.isArray(colors) ? colors : undefined,
    variants: Array.isArray(variants) ? variants : undefined,
    discountType: row.discount_type as Product['discountType'],
    discountValue: row.discount_value != null ? Number(row.discount_value) : undefined,
    discountStartDate: row.discount_start_date as string | undefined,
    discountEndDate: row.discount_end_date as string | undefined,
    originalPrice: row.original_price != null ? Number(row.original_price) : undefined,
  };

  return applyActiveDiscount(product);
};

export async function fetchFreshProducts(
  ownerId: string,
  productIds: string[]
): Promise<Map<string, Product>> {
  const uniqueIds = [...new Set(productIds)];
  if (uniqueIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('products')
    .select(
      'id, name, description, category, price, image_url, additional_images, stock_quantity, sizes, colors, variants, discount_type, discount_value, discount_start_date, discount_end_date, original_price'
    )
    .eq('owner_id', ownerId)
    .in('id', uniqueIds)

  if (error || !data) return new Map();

  return new Map(data.map((row) => [String(row.id), mapDbProduct(row as Record<string, unknown>)]));
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
    let data: Record<string, unknown> | null = null;
    let rpcError: { message: string } | null = null;

    if (storeSlug) {
      const res = await (supabase as any).rpc('validate_store_coupon_by_slug', {
        p_slug: storeSlug.trim().toLowerCase(),
        p_code: code,
        p_subtotal: subtotal,
      });
      data = res.data;
      rpcError = res.error;
    } else {
      const res = await (supabase as any).rpc('validate_store_coupon', {
        p_owner_id: ownerId,
        p_code: code,
        p_subtotal: subtotal,
      });
      data = res.data;
      rpcError = res.error;
    }

    if (rpcError || !data?.valid) return null;

    return {
      code: String(data.code || code),
      discountAmount: Number(data.discount_amount) || 0,
    };
  } catch {
    return null;
  }
}

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
