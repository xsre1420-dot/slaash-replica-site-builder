import { supabase } from '@/integrations/supabase/client';
import { CartItem, Product } from '@/types';
import { getAvailableQty, validateVariantSelection } from './inventoryUtils';
import { AppliedCoupon, validateCoupon } from '@/services/couponService';
import { mapDbProduct } from '@/mappers/productMapper';
import {
  fetchStorefrontProductsByIds,
  fetchOwnerActiveProductsByIds,
  resolveStoreSlugByOwnerId,
} from '@/services/storefrontProductService';
import { getServerUnitPrice } from '@/utils/inventoryUtils';
import { isStorefrontVisible } from '@/lib/productLifecycle';

export type FetchFreshProductsOptions = {
  applyDiscount?: boolean;
  cartFallback?: Map<string, Product>;
};

/** Prefer server stock; fall back to cart snapshot only when the server omitted fields. */
function mergeProductStock(server: Product, cartProduct: Product): Product {
  const stockQuantity =
    server.stockQuantity != null ? server.stockQuantity : cartProduct.stockQuantity;

  const serverHasVariants = server.variants != null;
  const variants = serverHasVariants
    ? server.variants
    : cartProduct.variants ?? server.variants;

  return {
    ...server,
    stockQuantity,
    variants,
    sizes: server.sizes?.length ? server.sizes : cartProduct.sizes,
    colors: server.colors?.length ? server.colors : cartProduct.colors,
  };
}

export async function fetchFreshProducts(
  ownerId: string,
  productIds: string[],
  storeSlug?: string,
  options: FetchFreshProductsOptions = {}
): Promise<Map<string, Product>> {
  const applyDiscount = options.applyDiscount !== false;
  const uniqueIds = [...new Set(productIds)];
  if (uniqueIds.length === 0) return new Map();

  let slug = storeSlug?.trim() || null;
  if (!slug && ownerId) {
    slug = await resolveStoreSlugByOwnerId(ownerId);
  }

  let map = new Map<string, Product>();

  if (slug) {
    map = await fetchStorefrontProductsByIds(slug, uniqueIds);
  }

  const missingAfterSlug = uniqueIds.filter((id) => !map.has(id));

  if (ownerId && missingAfterSlug.length > 0) {
    const direct = await fetchOwnerActiveProductsByIds(ownerId, missingAfterSlug);
    for (const [id, product] of direct) {
      map.set(id, product);
    }
  }

  if (!slug && ownerId) {
    const direct = await fetchOwnerActiveProductsByIds(ownerId, uniqueIds);
    for (const [id, product] of direct) {
      map.set(id, product);
    }
  }

  if (!slug && map.size === 0 && ownerId) {
    const { data, error } = await supabase
      .from('products')
      .select(
        'id, name, description, category, price, image_url, additional_images, stock_quantity, sizes, colors, variants, discount_type, discount_value, discount_start_date, discount_end_date, original_price, is_active, archived_at'
      )
      .eq('owner_id', ownerId)
      .in('id', uniqueIds)
      .or('is_active.eq.true,is_active.is.null');

    if (!error && data) {
      map = new Map(
        data
          .map((row) => mapDbProduct(row as Record<string, unknown>, { applyDiscount }))
          .filter((p) => !p.archivedAt)
          .map((p) => [p.id, p] as const)
      );
    }
  }

  if (options.cartFallback) {
    for (const id of uniqueIds) {
      if (map.has(id) && options.cartFallback.has(id)) {
        map.set(id, mergeProductStock(map.get(id)!, options.cartFallback.get(id)!));
      }
    }
  }

  return map;
}

/** Mirrors server checkout stock rules (migration 20260616000001+). */
export function validateCheckoutItemStock(
  item: CartItem,
  product: Product
): { ok: true } | { ok: false; error: string } {
  const variantCheck = validateVariantSelection(product, item.selectedSize, item.selectedColor);
  if (!variantCheck.valid) {
    return { ok: false, error: `${product.name}: ${variantCheck.message}` };
  }

  const available = getAvailableQty(product, item.selectedSize, item.selectedColor);

  if (available <= 0) {
    return {
      ok: false,
      error: `"${product.name}" غير متوفر في المخزون`,
    };
  }

  return { ok: true };
}

export function isFatalCheckoutError(message: string): boolean {
  return (
    message.includes('غير متوفر') ||
    message.includes('لم يعد متوفر') ||
    message.includes('اختر') ||
    message.includes('المقاس') ||
    message.includes('اللون')
  );
}

export function computeServerCheckoutSubtotal(
  items: CartItem[],
  freshProducts: Map<string, Product>
): number {
  let subtotal = 0;
  for (const item of items) {
    const fresh = freshProducts.get(item.product.id);
    if (!fresh) continue;
    subtotal += getServerUnitPrice(fresh) * item.quantity;
  }
  return subtotal;
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
    let fresh = freshProducts.get(item.product.id);

    if (!fresh) {
      errors.push(`المنتج "${item.product.name}" لم يعد متوفراً`);
      continue;
    }

    fresh = mergeProductStock(fresh, item.product);

    if (!isStorefrontVisible(fresh)) {
      errors.push(`المنتج "${fresh.name}" لم يعد متوفراً`);
      continue;
    }

    const stockCheck = validateCheckoutItemStock(item, fresh);
    if (!stockCheck.ok) {
      errors.push(stockCheck.error);
      continue;
    }

    const available = getAvailableQty(fresh, item.selectedSize, item.selectedColor);
    const qty = Math.min(item.quantity, available);
    if (qty < item.quantity) {
      errors.push(`تم تعديل كمية "${fresh.name}" إلى ${qty} (المتوفر: ${available})`);
    }

    updatedItems.push({
      ...item,
      product: fresh,
      quantity: qty,
    });
    subtotal += getServerUnitPrice(fresh) * qty;
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
