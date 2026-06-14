/** Tenant-aware storefront route helpers */

export function getStoreHomePath(storeSlug?: string | null): string {
  return storeSlug?.trim() ? `/store/${storeSlug.trim()}` : '/preview';
}

export function getProductPath(productId: string, storeSlug?: string | null): string {
  return storeSlug?.trim()
    ? `/store/${storeSlug.trim()}/product/${productId}`
    : `/product-details/${productId}`;
}

export function getCheckoutPath(storeSlug?: string | null): string {
  return storeSlug?.trim() ? `/store/${storeSlug.trim()}/checkout` : '/checkout';
}
