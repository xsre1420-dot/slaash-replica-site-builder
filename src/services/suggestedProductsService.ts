import { supabase } from '@/integrations/supabase/client';
import { assertMerchantOwner } from '@/lib/tenantGuard';

export type SuggestedProductCard = {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  category: string;
  short_description?: string | null;
  rating?: number | null;
};

export type MerchantSuggestedLink = {
  id: string;
  suggested_product_id: string;
  display_order?: number;
  product: SuggestedProductCard;
};

const PRODUCT_CARD_SELECT = 'id, name, price, image_url, category, short_description';

async function fetchProductCards(
  ownerId: string,
  productIds: string[]
): Promise<SuggestedProductCard[]> {
  if (productIds.length === 0) return [];

  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_CARD_SELECT)
    .in('id', productIds)
    .eq('owner_id', ownerId);

  if (error || !data) return [];
  return data as SuggestedProductCard[];
}

/** Storefront carousel — slug-scoped RPC. */
export async function fetchSuggestedProductsForStore(
  storeSlug: string,
  productId: string,
  limit = 4
): Promise<SuggestedProductCard[]> {
  const { data, error } = await (supabase as any).rpc('get_suggested_products_for_store', {
    p_slug: storeSlug.trim().toLowerCase(),
    p_product_id: productId,
  });

  if (error || !Array.isArray(data)) return [];
  return (data as SuggestedProductCard[]).slice(0, limit);
}

/** Merchant / preview — join suggested_products + products. */
export async function fetchSuggestedProductsForOwner(
  productId: string,
  ownerId: string,
  limit = 10
): Promise<SuggestedProductCard[]> {
  await assertMerchantOwner(ownerId);

  const { data: links, error } = await supabase
    .from('suggested_products')
    .select('suggested_product_id')
    .eq('product_id', productId)
    .eq('owner_id', ownerId)
    .limit(limit);

  if (error || !links?.length) return [];

  const ids = links.map((row) => row.suggested_product_id);
  const products = await fetchProductCards(ownerId, ids);
  return products.slice(0, limit);
}

export async function listMerchantSuggestedLinks(
  productId: string,
  ownerId: string
): Promise<MerchantSuggestedLink[]> {
  await assertMerchantOwner(ownerId);

  const { data: links, error } = await supabase
    .from('suggested_products')
    .select('id, suggested_product_id, display_order')
    .eq('product_id', productId)
    .eq('owner_id', ownerId)
    .limit(20);

  if (error || !links?.length) return [];

  const ids = links.map((l) => l.suggested_product_id);
  const products = await fetchProductCards(ownerId, ids);
  const byId = new Map(products.map((p) => [p.id, p]));

  return links.map((link) => ({
    ...link,
    product: byId.get(link.suggested_product_id) ?? {
      id: link.suggested_product_id,
      name: 'منتج محذوف',
      price: 0,
      image_url: '',
      category: '',
    },
  }));
}

export async function listAvailableProductsForSuggestions(
  ownerId: string,
  excludeProductId: string
): Promise<SuggestedProductCard[]> {
  await assertMerchantOwner(ownerId);

  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_CARD_SELECT)
    .eq('owner_id', ownerId)
    .neq('id', excludeProductId);

  if (error) return [];
  return (data ?? []) as SuggestedProductCard[];
}

export async function addSuggestedProductLink(
  productId: string,
  suggestedProductId: string,
  ownerId: string
): Promise<{ success: boolean; data?: MerchantSuggestedLink; error?: string }> {
  await assertMerchantOwner(ownerId);

  const { data, error } = await supabase
    .from('suggested_products')
    .insert({
      product_id: productId,
      suggested_product_id: suggestedProductId,
      owner_id: ownerId,
    })
    .select('id, suggested_product_id, display_order')
    .single();

  if (error) return { success: false, error: error.message };

  const [product] = await fetchProductCards(ownerId, [suggestedProductId]);
  if (!product) return { success: false, error: 'المنتج غير موجود' };

  return {
    success: true,
    data: { ...(data as MerchantSuggestedLink), product },
  };
}

export async function removeSuggestedProductLink(
  suggestionId: string,
  ownerId: string
): Promise<{ success: boolean; error?: string }> {
  await assertMerchantOwner(ownerId);

  const { error } = await supabase
    .from('suggested_products')
    .delete()
    .eq('id', suggestionId)
    .eq('owner_id', ownerId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function listCategoryNamesForOwner(ownerId: string): Promise<string[]> {
  await assertMerchantOwner(ownerId);

  const { data, error } = await supabase.from('categories').select('name').eq('owner_id', ownerId);
  if (error) return [];
  return (data ?? []).map((row) => row.name);
}
