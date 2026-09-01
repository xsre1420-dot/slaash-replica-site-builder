/**
 * Product detail page — one coordinated load for product, reviews, and suggestions.
 */
import { Product } from '@/types';
import { cache, CacheKeys, CacheTTL, dedup, clearInflight } from '@/lib/cache';
import { fetchProductById, getProductById } from '@/services/productService';
import { loadProductDetailBundle } from '@/services/storefrontProductService';
import {
  fetchApprovedReviewsForOwner,
  fetchApprovedReviewsForStore,
  type StorefrontReview,
} from '@/services/storefrontReviewService';
import {
  fetchSuggestedProductsForOwner,
  fetchSuggestedProductsForStore,
  type SuggestedProductCard,
} from '@/services/suggestedProductsService';

export type ProductDetailReview = {
  id: string;
  name: string;
  avatar?: string;
  rating: number;
  comment: string;
  date: string;
  helpful: number;
  verified?: boolean;
  merchantReply?: string;
};

export type ProductDetailPageBundle = {
  product: Product | null;
  reviews: ProductDetailReview[];
  suggestedProducts: SuggestedProductCard[];
};

export type ProductDetailPageScope = {
  storeSlug?: string;
  ownerId?: string;
};

const scopeKey = ({ storeSlug, ownerId }: ProductDetailPageScope): string | null => {
  if (storeSlug?.trim()) return `s:${storeSlug.trim().toLowerCase()}`;
  if (ownerId?.trim()) return `o:${ownerId.trim()}`;
  return null;
};

const countGalleryUrls = (product: Pick<Product, 'image' | 'additionalImages'>): number => {
  const seen = new Set<string>();
  const main = product.image?.trim();
  if (main) seen.add(main);
  for (const url of product.additionalImages ?? []) {
    const trimmed = url?.trim();
    if (trimmed) seen.add(trimmed);
  }
  return seen.size;
};

export const mergeProductDetailStock = (cached: Product | null | undefined, fresh: Product): Product => {
  const freshGalleryCount = countGalleryUrls(fresh);
  const cachedGalleryCount = cached ? countGalleryUrls(cached) : 0;
  const useFreshGallery = freshGalleryCount >= cachedGalleryCount;

  return {
    ...(cached ?? fresh),
    ...fresh,
    shortDescription: fresh.shortDescription?.trim() || cached?.shortDescription,
    description: fresh.description?.trim() || cached?.description,
    tags: fresh.tags?.length ? fresh.tags : cached?.tags,
    sku: fresh.sku || cached?.sku,
    additionalImages: useFreshGallery
      ? fresh.additionalImages
      : cached?.additionalImages?.length
        ? cached.additionalImages
        : fresh.additionalImages,
    image: useFreshGallery
      ? fresh.image?.trim() || cached?.image || fresh.image
      : cached?.image?.trim() || fresh.image,
    stockQuantity: fresh.stockQuantity,
    variants: fresh.variants?.length ? fresh.variants : cached?.variants,
    sizes: fresh.sizes?.length ? fresh.sizes : cached?.sizes,
    colors: fresh.colors?.length ? fresh.colors : cached?.colors,
    price: fresh.price,
    originalPrice: fresh.originalPrice ?? cached?.originalPrice,
    discountType: fresh.discountType ?? cached?.discountType,
    discountValue: fresh.discountValue ?? cached?.discountValue,
    discountStartDate: fresh.discountStartDate ?? cached?.discountStartDate,
    discountEndDate: fresh.discountEndDate ?? cached?.discountEndDate,
    isActive: fresh.isActive,
    archivedAt: fresh.archivedAt,
  };
};

const mapReviews = (rows: StorefrontReview[]): ProductDetailReview[] =>
  rows.map((r) => ({
    id: r.id,
    name: r.reviewer_name,
    rating: r.rating,
    comment: r.comment,
    date: new Date(r.created_at).toLocaleDateString('ar-EG'),
    helpful: r.helpful_count ?? 0,
    avatar: '',
  }));

async function loadMerchantProductDetail(
  productId: string,
  initialProduct?: Product | null
): Promise<Product | null> {
  const fresh = await fetchProductById(productId);
  if (fresh) {
    return initialProduct?.id === productId
      ? mergeProductDetailStock(initialProduct, fresh)
      : fresh;
  }
  if (initialProduct?.id === productId) return initialProduct;
  return getProductById(productId) ?? null;
}

export function peekProductDetailPageBundle(
  productId: string,
  scope: ProductDetailPageScope
): ProductDetailPageBundle | null {
  const key = scopeKey(scope);
  if (!key || !productId) return null;
  return cache.get<ProductDetailPageBundle>(CacheKeys.productDetailPage(key, productId));
}

export function invalidateProductDetailPageBundle(
  scope: ProductDetailPageScope,
  productId?: string
): void {
  const key = scopeKey(scope);
  if (!key) return;
  if (productId) {
    const cacheKey = CacheKeys.productDetailPage(key, productId);
    cache.del(cacheKey);
    clearInflight(cacheKey);
    return;
  }
  cache.flushByPrefix(`product-detail-page:${key}:`);
}

/** Single deduped load: product + approved reviews + suggested products. */
export async function loadProductDetailPageBundle(
  productId: string,
  options: ProductDetailPageScope & {
    initialProduct?: Product | null;
    force?: boolean;
  }
): Promise<ProductDetailPageBundle> {
  const scope = scopeKey(options);
  if (!scope || !productId) {
    return { product: null, reviews: [], suggestedProducts: [] };
  }

  const cacheKey = CacheKeys.productDetailPage(scope, productId);

  if (!options.force) {
    const peek = peekProductDetailPageBundle(productId, options);
    if (peek) return peek;
  } else {
    invalidateProductDetailPageBundle(options, productId);
  }

  return dedup(cacheKey, async () => {
    const { storeSlug, ownerId, initialProduct } = options;

    const [product, reviewsRaw, suggestedProducts] = await Promise.all([
      storeSlug
        ? loadProductDetailBundle(storeSlug, productId, {
            initialProduct,
            backgroundRevalidate: true,
          })
        : ownerId
          ? loadMerchantProductDetail(productId, initialProduct)
          : Promise.resolve(null),
      storeSlug
        ? fetchApprovedReviewsForStore(storeSlug, productId)
        : ownerId
          ? fetchApprovedReviewsForOwner(productId, ownerId)
          : Promise.resolve([]),
      storeSlug
        ? fetchSuggestedProductsForStore(storeSlug, productId, 8)
        : ownerId
          ? fetchSuggestedProductsForOwner(productId, ownerId, 8)
          : Promise.resolve([]),
    ]);

    const bundle: ProductDetailPageBundle = {
      product,
      reviews: mapReviews(reviewsRaw),
      suggestedProducts,
    };

    cache.set(cacheKey, bundle, CacheTTL.MEDIUM, CacheTTL.STALE);
    return bundle;
  });
}

export function invalidateOwnerProductDetailPages(ownerId: string): void {
  invalidateProductDetailPageBundle({ ownerId });
}

export function invalidateStoreProductDetailPages(storeSlug: string): void {
  invalidateProductDetailPageBundle({ storeSlug });
}
