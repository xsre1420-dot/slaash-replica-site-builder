import { supabase } from '@/integrations/supabase/client';
import { CartItem, Product } from '@/types';
import { getAvailableQty, validateVariantSelection, normalizeProductStock } from './inventoryUtils';
import { AppliedCoupon, validateCoupon } from '@/services/couponService';
import { mapDbProduct } from '@/mappers/productMapper';
import {
  fetchCheckoutProductsByIds,
  fetchStorefrontProductsByIds,
  fetchOwnerActiveProductsByIds,
  resolveStoreSlugByOwnerId,
} from '@/services/storefrontProductService';
import { getServerUnitPrice } from '@/utils/inventoryUtils';
import { isStorefrontVisible } from '@/lib/productLifecycle';

export type FetchFreshProductsOptions = {
  applyDiscount?: boolean;
  /** Background cart sync only — never used on final checkout submit */
  cartFallback?: Map<string, Product>;
  /** When true, never merge stale cart prices (checkout submit) */
  strict?: boolean;
};

const variantStockSum = (variants?: Product['variants']) =>
  (variants ?? []).reduce((sum, v) => sum + (v.quantity || 0), 0);

/** Merge server row with cart metadata; stock always comes from server. */
export function mergeProductStock(server: Product, cartProduct: Product): Product {
  return normalizeProductStock({
    ...server,
    sizes: server.sizes?.length ? server.sizes : cartProduct.sizes,
    colors: server.colors?.length ? server.colors : cartProduct.colors,
  });
}

/** Update prices/stock from server without removing cart lines (background checkout sync). */
export function refreshCartFromServer(
  items: CartItem[],
  freshProducts: Map<string, Product>
): CartItem[] {
  return items.map((item) => {
    const fresh = freshProducts.get(item.product.id);
    if (!fresh) return item;
    return {
      ...item,
      product: mergeProductStock(fresh, item.product),
    };
  });
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
    map = await fetchCheckoutProductsByIds(slug, uniqueIds);
    if (map.size < uniqueIds.length) {
      const catalog = await fetchStorefrontProductsByIds(slug, uniqueIds);
      for (const [id, product] of catalog) {
        if (!map.has(id)) map.set(id, product);
      }
    }
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

  if (ownerId && uniqueIds.length > 0) {
    const authoritative = await fetchOwnerActiveProductsByIds(ownerId, uniqueIds);
    for (const [id, dbProduct] of authoritative) {
      const existing = map.get(id);
      map.set(id, existing ? mergeProductStock(dbProduct, existing) : dbProduct);
    }
  }

  if (!options.strict && options.cartFallback) {
    for (const id of uniqueIds) {
      if (map.has(id)) continue;
      const cartProduct = options.cartFallback.get(id);
      if (cartProduct) map.set(id, cartProduct);
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
    fresh = normalizeProductStock(fresh);

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
    if (qty <= 0) {
      errors.push(`"${fresh.name}" غير متوفر في المخزون (الكمية منتهية)`);
      continue;
    }
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
