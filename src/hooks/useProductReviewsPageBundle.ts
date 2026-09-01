import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useStoreHydration } from '@/context/StoreBootstrapContext';
import type { MerchantProductReview } from '@/services/reviewService';
import {
  loadProductReviewsPageBundle,
  peekProductReviewsPageBundle,
  type ProductReviewsPageBundle,
} from '@/services/productReviewsPageService';

export type ProductReviewsPageState = {
  loading: boolean;
  bundle: ProductReviewsPageBundle | null;
  productName: string;
  reviews: MerchantProductReview[];
  refetch: () => Promise<ProductReviewsPageBundle | null>;
  setReviews: React.Dispatch<React.SetStateAction<MerchantProductReview[]>>;
};

export function useProductReviewsPageBundle(productId: string | undefined): ProductReviewsPageState {
  const { user } = useAuth();
  const { isReady, hydrationVersion } = useStoreHydration();
  const ownerId = user?.id;

  const [bundle, setBundle] = useState<ProductReviewsPageBundle | null>(() =>
    ownerId && productId ? peekProductReviewsPageBundle(ownerId, productId) : null
  );
  const [reviews, setReviews] = useState<MerchantProductReview[]>(() => bundle?.reviews ?? []);
  const [loading, setLoading] = useState(() => !bundle && !!ownerId && !!productId);

  useEffect(() => {
    if (bundle?.reviews) {
      setReviews(bundle.reviews);
    }
  }, [bundle]);

  useEffect(() => {
    if (!ownerId || !productId) {
      setLoading(false);
      return;
    }
    if (!isReady) {
      setLoading(true);
      return;
    }

    const cached = peekProductReviewsPageBundle(ownerId, productId);
    if (cached) {
      setBundle(cached);
      setReviews(cached.reviews);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void loadProductReviewsPageBundle(ownerId, productId).then((loaded) => {
      if (cancelled) return;
      setBundle(loaded);
      setReviews(loaded?.reviews ?? []);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [isReady, hydrationVersion, ownerId, productId]);

  const refetch = useCallback(async () => {
    if (!ownerId || !productId) return null;
    setLoading(true);
    try {
      const loaded = await loadProductReviewsPageBundle(ownerId, productId, { force: true });
      setBundle(loaded);
      setReviews(loaded?.reviews ?? []);
      return loaded;
    } finally {
      setLoading(false);
    }
  }, [ownerId, productId]);

  return useMemo(
    () => ({
      loading,
      bundle,
      productName: bundle?.productName ?? '',
      reviews,
      refetch,
      setReviews,
    }),
    [loading, bundle, reviews, refetch]
  );
}

export { invalidateProductReviewsPageBundle } from '@/services/productReviewsPageService';
