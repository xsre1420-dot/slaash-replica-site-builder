import { supabase } from '@/integrations/supabase/client';
import { getAuthenticatedUserId } from '@/lib/authSession';
import { assertMerchantOwner } from '@/lib/tenantGuard';

export type StorefrontReview = {
  id: string;
  reviewer_name: string;
  rating: number;
  comment: string;
  created_at: string;
  helpful_count?: number;
};

export type SubmitReviewInput = {
  productId: string;
  reviewerName: string;
  rating: number;
  comment: string;
};

/** Public storefront — slug-bound approved reviews. */
export async function fetchApprovedReviewsForStore(
  storeSlug: string,
  productId: string
): Promise<StorefrontReview[]> {
  const { data, error } = await (supabase as any).rpc('get_approved_product_reviews', {
    p_slug: storeSlug.trim().toLowerCase(),
    p_product_id: productId,
  });
  if (error || !Array.isArray(data)) return [];
  return data as StorefrontReview[];
}

/** Merchant preview — approved reviews for owned product. */
export async function fetchApprovedReviewsForOwner(
  productId: string,
  ownerId: string
): Promise<StorefrontReview[]> {
  await assertMerchantOwner(ownerId);

  const { data, error } = await supabase
    .from('product_reviews')
    .select('id, reviewer_name, rating, comment, created_at, helpful_count')
    .eq('product_id', productId)
    .eq('owner_id', ownerId)
    .eq('is_approved', true)
    .order('created_at', { ascending: false });

  if (error) return [];
  return (data ?? []) as StorefrontReview[];
}

/** Customer review on public storefront (pending merchant approval). */
export async function submitStorefrontReview(
  storeSlug: string,
  input: SubmitReviewInput
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await (supabase as any).rpc('submit_product_review_for_store', {
    p_slug: storeSlug.trim().toLowerCase(),
    p_product_id: input.productId,
    p_reviewer_name: input.reviewerName.trim(),
    p_rating: input.rating,
    p_comment: input.comment.trim(),
  });

  if (error || !data?.success) {
    return { success: false, error: error?.message ?? 'فشل إرسال التقييم' };
  }
  return { success: true };
}

/** Merchant dashboard — insert review (unapproved). */
export async function submitMerchantReview(
  ownerId: string,
  input: SubmitReviewInput
): Promise<{ success: boolean; error?: string }> {
  const authId = await getAuthenticatedUserId();
  if (!authId || authId !== ownerId) {
    return { success: false, error: 'يجب تسجيل الدخول' };
  }

  const { error } = await supabase.from('product_reviews').insert({
    product_id: input.productId,
    owner_id: ownerId,
    reviewer_name: input.reviewerName.trim(),
    reviewer_email: null,
    rating: input.rating,
    comment: input.comment.trim(),
    is_approved: false,
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}
