import { supabase } from '@/integrations/supabase/client';
import { cache, CacheKeys, CacheTTL, dedup } from '@/lib/cache';
import { invalidateStorefrontForOwner } from '@/services/storefrontProductService';

export interface FooterSuggestedProduct {
  id: string;
  name: string;
  price: number;
  image_url?: string | null;
  category?: string;
}

export interface FooterSuggestedRow {
  id: string;
  product_id: string;
  display_order: number;
  product: FooterSuggestedProduct;
}

const MAX_FOOTER_SUGGESTIONS = 8;

export async function fetchFooterSuggestedForStorefront(
  storeSlug?: string | null,
  ownerId?: string | null
): Promise<FooterSuggestedProduct[]> {
  const slug = storeSlug?.trim().toLowerCase();

  if (slug && /^[a-z0-9-]+$/.test(slug)) {
    const cacheKey = CacheKeys.footerSuggested(slug);
    const cached = cache.get<FooterSuggestedProduct[]>(cacheKey);
    if (cached) return cached;

    return dedup(cacheKey, async () => {
      try {
        const { data, error } = await (supabase as any).rpc('get_storefront_footer_products', {
          p_slug: slug,
        });

        if (!error && Array.isArray(data)) {
          const products = data as FooterSuggestedProduct[];
          cache.set(cacheKey, products, CacheTTL.STOREFRONT, CacheTTL.STOREFRONT_STALE);
          return products;
        }
      } catch {
        /* RPC may be missing on older DBs */
      }
      return [];
    });
  }

  if (!ownerId) return [];

  const { data: rows, error: rowsError } = await (supabase as any)
    .from('storefront_footer_products')
    .select('product_id, display_order')
    .eq('owner_id', ownerId)
    .order('display_order', { ascending: true })
    .limit(MAX_FOOTER_SUGGESTIONS);

  if (rowsError || !rows?.length) return [];

  const productIds = rows.map((r: { product_id: string }) => r.product_id);
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, price, image_url, category, is_active, archived_at')
    .eq('owner_id', ownerId)
    .in('id', productIds);

  if (productsError || !products) return [];

  const byId = new Map(products.map((p) => [p.id, p]));
  return rows
    .map((row: { product_id: string }) => byId.get(row.product_id))
    .filter((p): p is NonNullable<typeof p> => !!p && !p.archived_at && p.is_active !== false)
    .map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      image_url: p.image_url,
      category: p.category,
    }));
}

export async function listFooterSuggestedForOwner(ownerId: string): Promise<FooterSuggestedRow[]> {
  const { data: rows, error } = await (supabase as any)
    .from('storefront_footer_products')
    .select('id, product_id, display_order')
    .eq('owner_id', ownerId)
    .order('display_order', { ascending: true });

  if (error || !rows?.length) return [];

  const productIds = rows.map((r: { product_id: string }) => r.product_id);
  const { data: products } = await supabase
    .from('products')
    .select('id, name, price, image_url, category')
    .eq('owner_id', ownerId)
    .in('id', productIds);

  const byId = new Map((products ?? []).map((p) => [p.id, p]));

  return rows.map((row: { id: string; product_id: string; display_order: number }) => ({
    id: row.id,
    product_id: row.product_id,
    display_order: row.display_order,
    product: byId.get(row.product_id) ?? {
      id: row.product_id,
      name: 'منتج محذوف',
      price: 0,
      image_url: null,
      category: '',
    },
  }));
}

export async function addFooterSuggestedProduct(
  ownerId: string,
  productId: string,
  currentCount: number
): Promise<void> {
  if (currentCount >= MAX_FOOTER_SUGGESTIONS) {
    throw new Error(`يمكنك اختيار ${MAX_FOOTER_SUGGESTIONS} منتجات كحد أقصى`);
  }

  const { error } = await (supabase as any).from('storefront_footer_products').insert({
    owner_id: ownerId,
    product_id: productId,
    display_order: currentCount + 1,
  });

  if (error) throw error;
  void invalidateStorefrontForOwner(ownerId);
}

export async function removeFooterSuggestedProduct(rowId: string, ownerId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('storefront_footer_products')
    .delete()
    .eq('id', rowId)
    .eq('owner_id', ownerId);

  if (error) throw error;
  void invalidateStorefrontForOwner(ownerId);
}

export { MAX_FOOTER_SUGGESTIONS };
