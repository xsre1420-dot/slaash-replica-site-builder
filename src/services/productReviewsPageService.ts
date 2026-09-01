/**
 * Product reviews page bundle — product meta + reviews in one coordinated load.
 */
import { cache, CacheKeys, CacheTTL, dedup, clearInflight } from '@/lib/cache';
import { fetchProductById } from '@/services/productService';
import {
  fetchMerchantProductReviews,
  type MerchantProductReview,
} from '@/services/reviewService';

export type ProductReviewsPageBundle = {
  productId: string;
  productName: string;
  reviews: MerchantProductReview[];
};

export function peekProductReviewsPageBundle(
  ownerId: string,
  productId: string
): ProductReviewsPageBundle | null {
  if (!ownerId || !productId) return null;
  return cache.get<ProductReviewsPageBundle>(CacheKeys.productReviewsPage(ownerId, productId));
}

export function invalidateProductReviewsPageBundle(ownerId: string, productId?: string): void {
  if (productId) {
    const key = CacheKeys.productReviewsPage(ownerId, productId);
    cache.del(key);
    clearInflight(key);
    return;
  }
  cache.flushByPrefix(`product-reviews-page:${ownerId}:`);
}

/** Single deduped entry for /products/reviews/:id initial data. */
export async function loadProductReviewsPageBundle(
  ownerId: string,
  productId: string,
  options?: { force?: boolean }
): Promise<ProductReviewsPageBundle | null> {
  if (!ownerId || !productId) return null;

  const key = CacheKeys.productReviewsPage(ownerId, productId);

  if (!options?.force) {
    const peek = peekProductReviewsPageBundle(ownerId, productId);
    if (peek) return peek;
  } else {
    invalidateProductReviewsPageBundle(ownerId, productId);
  }

  return dedup(key, async () => {
    const [product, reviews] = await Promise.all([
      fetchProductById(productId),
      fetchMerchantProductReviews(productId, ownerId),
    ]);

    if (!product) return null;

    const bundle: ProductReviewsPageBundle = {
      productId,
      productName: product.name,
      reviews,
    };
    cache.set(key, bundle, CacheTTL.MEDIUM, CacheTTL.STALE);
    return bundle;
  });
}
