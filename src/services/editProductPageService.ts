/**
 * Edit Product page bundle — product + categories in one coordinated load.
 */
import { Category, Product } from '@/types';
import { cache, CacheKeys, CacheTTL, dedup, clearInflight } from '@/lib/cache';
import { fetchProductById, getCategories, getCategoriesSync } from '@/services/productService';

export type EditProductPageBundle = {
  product: Product;
  categories: Category[];
};

export function peekEditProductPageBundle(
  ownerId: string,
  productId: string
): EditProductPageBundle | null {
  if (!ownerId || !productId) return null;
  return cache.get<EditProductPageBundle>(CacheKeys.editProductPage(ownerId, productId));
}

export function invalidateEditProductPageBundle(ownerId: string, productId?: string): void {
  if (productId) {
    const key = CacheKeys.editProductPage(ownerId, productId);
    cache.del(key);
    clearInflight(key);
    return;
  }
  cache.flushByPrefix(`edit-product-page:${ownerId}:`);
}

/** Single deduped entry for /edit-product/:id initial data. */
export async function loadEditProductPageBundle(
  ownerId: string,
  productId: string,
  options?: { force?: boolean }
): Promise<EditProductPageBundle | null> {
  if (!ownerId || !productId) return null;

  const key = CacheKeys.editProductPage(ownerId, productId);

  if (!options?.force) {
    const peek = peekEditProductPageBundle(ownerId, productId);
    if (peek) return peek;
  } else {
    invalidateEditProductPageBundle(ownerId, productId);
  }

  return dedup(key, async () => {
    const categoriesFromCache = getCategoriesSync();
    const [product, categories] = await Promise.all([
      fetchProductById(productId),
      categoriesFromCache.length > 0
        ? Promise.resolve(categoriesFromCache)
        : getCategories(options?.force ?? false),
    ]);

    if (!product) return null;

    const bundle: EditProductPageBundle = { product, categories };
    cache.set(key, bundle, CacheTTL.MEDIUM, CacheTTL.STALE);
    return bundle;
  });
}

/** After category CRUD from the form dialog — refresh categories only. */
export async function refreshEditProductPageCategories(
  ownerId: string,
  productId: string
): Promise<Category[]> {
  invalidateEditProductPageBundle(ownerId, productId);
  cache.del(CacheKeys.categories(ownerId));
  return getCategories(true);
}
