import { callReadRpc } from '@/lib/readWrite/readClient';
import { callWriteRpc } from '@/lib/readWrite/writeClient';
import { supabase } from '@/integrations/supabase/client';
import { cache, CacheTTL } from '@/lib/cache';

export type MerchantProductReview = {
  id: string;
  reviewer_name: string;
  reviewer_email?: string | null;
  rating: number;
  comment: string;
  is_approved: boolean;
  is_featured: boolean;
  helpful_count: number;
  created_at: string;
};

export async function fetchMerchantProductReviews(
  productId: string,
  ownerId: string
): Promise<MerchantProductReview[]> {
  if (!productId || !ownerId) return [];

  try {
    const { data: rpcData, error: rpcError } = await callReadRpc<MerchantProductReview[]>(
      'get_merchant_product_reviews',
      { p_product_id: productId }
    );

    if (!rpcError && Array.isArray(rpcData)) {
      return rpcData as MerchantProductReview[];
    }
  } catch {
    /* RPC may not exist until migration is applied */
  }

  const { data: ownedProduct, error: productError } = await supabase
    .from('products')
    .select('id')
    .eq('id', productId)
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (productError || !ownedProduct) return [];

  const { data, error } = await supabase
    .from('product_reviews')
    .select(
      'id, reviewer_name, reviewer_email, rating, comment, is_approved, is_featured, helpful_count, created_at'
    )
    .eq('product_id', productId)
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[reviews] fetch failed:', error.message);
    return [];
  }

  return (data ?? []) as MerchantProductReview[];
}

export async function approveProductReview(
  reviewId: string,
  ownerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await callWriteRpc<{ success?: boolean }>('approve_product_review', {
      p_review_id: reviewId,
    });

    if (!error && data?.success) {
      cache.del(`reviews:pending-count:${ownerId}`);
      return { success: true };
    }
  } catch {
    /* fall through */
  }

  const { error } = await supabase
    .from('product_reviews')
    .update({ is_approved: true, updated_at: new Date().toISOString() })
    .eq('id', reviewId)
    .eq('owner_id', ownerId);

  if (error) return { success: false, error: error.message };
  cache.del(`reviews:pending-count:${ownerId}`);
  return { success: true };
}

export async function deleteProductReview(
  reviewId: string,
  ownerId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('product_reviews')
    .delete()
    .eq('id', reviewId)
    .eq('owner_id', ownerId);

  if (error) return { success: false, error: error.message };
  cache.del(`reviews:pending-count:${ownerId}`);
  return { success: true };
}

/** Count merchant reviews awaiting approval across all products */
export async function countPendingReviewsForOwner(ownerId: string): Promise<number> {
  if (!ownerId) return 0;

  const cacheKey = `reviews:pending-count:${ownerId}`;
  const cached = cache.get<number>(cacheKey);
  if (cached != null) return cached;

  const { count, error } = await supabase
    .from('product_reviews')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', ownerId)
    .eq('is_approved', false);

  if (error) {
    console.warn('[reviews] pending count failed:', error.message);
    return 0;
  }

  const value = count ?? 0;
  cache.set(cacheKey, value, CacheTTL.SHORT, CacheTTL.STALE);
  return value;
}

/** First product with a pending review — for dashboard deep-link */
export async function getFirstPendingReviewTarget(
  ownerId: string
): Promise<{ productId: string; productName: string } | null> {
  if (!ownerId) return null;

  const { data, error } = await supabase
    .from('product_reviews')
    .select('product_id, products!inner(name)')
    .eq('owner_id', ownerId)
    .eq('is_approved', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.product_id) {
    if (error) console.warn('[reviews] pending target failed:', error.message);
    return null;
  }

  const product = data.products as { name?: string } | null;
  return {
    productId: data.product_id,
    productName: product?.name ?? 'منتج',
  };
}
