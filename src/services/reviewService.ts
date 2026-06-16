import { supabase } from '@/integrations/supabase/client';

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
    const { data: rpcData, error: rpcError } = await (supabase as any).rpc(
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
      'id, reviewer_name, reviewer_email, rating, comment, is_approved, is_featured, helpful_count, created_at, owner_id'
    )
    .eq('product_id', productId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[reviews] fetch failed:', error.message);
    return [];
  }

  return (data ?? [])
    .filter((row) => !row.owner_id || row.owner_id === ownerId)
    .map(({ owner_id: _ownerId, ...review }) => review) as MerchantProductReview[];
}

export async function approveProductReview(
  reviewId: string,
  ownerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await (supabase as any).rpc('approve_product_review', {
      p_review_id: reviewId,
    });

    if (!error && data?.success) return { success: true };
  } catch {
    /* fall through */
  }

  const { error } = await supabase
    .from('product_reviews')
    .update({ is_approved: true, updated_at: new Date().toISOString() })
    .eq('id', reviewId)
    .eq('owner_id', ownerId);

  if (error) return { success: false, error: error.message };
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
  return { success: true };
}
