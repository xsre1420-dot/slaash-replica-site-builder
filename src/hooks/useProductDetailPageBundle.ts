import { useCallback, useEffect, useMemo, useState } from 'react';
import { Product } from '@/types';
import {
  loadProductDetailPageBundle,
  peekProductDetailPageBundle,
  type ProductDetailPageBundle,
  type ProductDetailReview,
} from '@/services/productDetailPageService';
import type { SuggestedProductCard } from '@/services/suggestedProductsService';

export type ProductLoadStatus = 'loading' | 'success' | 'not_found';

export type ProductDetailPageState = {
  status: ProductLoadStatus;
  product: Product | null;
  reviews: ProductDetailReview[];
  suggestedProducts: SuggestedProductCard[];
  refetch: () => Promise<ProductDetailPageBundle>;
};

export function useProductDetailPageBundle(options: {
  productId?: string;
  storeSlug?: string;
  ownerId?: string;
  initialProduct?: Product | null;
}): ProductDetailPageState {
  const { productId, storeSlug, ownerId, initialProduct } = options;

  const [bundle, setBundle] = useState<ProductDetailPageBundle | null>(() => {
    if (!productId) return null;
    return peekProductDetailPageBundle(productId, { storeSlug, ownerId });
  });
  const [status, setStatus] = useState<ProductLoadStatus>(() => {
    if (!productId) return 'not_found';
    const peek = peekProductDetailPageBundle(productId, { storeSlug, ownerId });
    if (peek) return peek.product ? 'success' : 'not_found';
    return 'loading';
  });

  useEffect(() => {
    if (!productId) {
      setBundle(null);
      setStatus('not_found');
      return;
    }

    const peek = peekProductDetailPageBundle(productId, { storeSlug, ownerId });
    if (peek) {
      setBundle(peek);
      setStatus(peek.product ? 'success' : 'not_found');
      return;
    }

    let cancelled = false;
    setStatus('loading');

    void loadProductDetailPageBundle(productId, {
      storeSlug,
      ownerId,
      initialProduct,
    }).then((loaded) => {
      if (cancelled) return;
      setBundle(loaded);
      setStatus(loaded.product ? 'success' : 'not_found');
    });

    return () => {
      cancelled = true;
    };
  }, [productId, storeSlug, ownerId, initialProduct]);

  useEffect(() => {
    if (!productId) return;

    const refetch = () => {
      void loadProductDetailPageBundle(productId, {
        storeSlug,
        ownerId,
        initialProduct,
        force: true,
      }).then((loaded) => {
        setBundle(loaded);
        setStatus(loaded.product ? 'success' : 'not_found');
      });
    };

    window.addEventListener('storefront:products-changed', refetch);
    return () => window.removeEventListener('storefront:products-changed', refetch);
  }, [productId, storeSlug, ownerId, initialProduct]);

  const refetch = useCallback(async () => {
    if (!productId) {
      return { product: null, reviews: [], suggestedProducts: [] };
    }
    const loaded = await loadProductDetailPageBundle(productId, {
      storeSlug,
      ownerId,
      initialProduct,
      force: true,
    });
    setBundle(loaded);
    setStatus(loaded.product ? 'success' : 'not_found');
    return loaded;
  }, [productId, storeSlug, ownerId, initialProduct]);

  return useMemo(
    () => ({
      status,
      product: bundle?.product ?? null,
      reviews: bundle?.reviews ?? [],
      suggestedProducts: bundle?.suggestedProducts ?? [],
      refetch,
    }),
    [status, bundle, refetch]
  );
}
