import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Product, Category, ColorOption, ProductVariant } from '@/types';
import { cache, CacheTTL, dedup } from '@/lib/cache';

interface TenantStoreInfo {
  ownerId: string;
  storeName: string;
  storeLogo: string;
  storeSlug: string;
  menuBackgroundColor: string;
  menuTextColor: string;
  menuAccentColor: string;
  bannerImages: string[];
  primaryBannerIndex: number;
  deliveryPrices: { governorate: string; price: number }[];
  whatsappNumber: string;
  facebookUrl: string;
  instagramUrl: string;
  returnPolicy: string;
  privacyPolicy: string;
  paymentMethods: any;
}

interface TenantStoreData {
  storeInfo: TenantStoreInfo | null;
  products: Product[];
  categories: Category[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const formatProduct = (p: any): Product => ({
  id: p.id,
  name: p.name,
  description: p.description || '',
  category: p.category,
  price: Number(p.price),
  image: p.image_url || '',
  additionalImages: p.additional_images || [],
  sizes: Array.isArray(p.sizes) ? p.sizes as string[] : undefined,
  colors: (() => {
    if (!p.colors) return undefined;
    if (Array.isArray(p.colors)) return p.colors as unknown as ColorOption[];
    return undefined;
  })(),
  variants: (() => {
    if (!p.variants) return undefined;
    if (Array.isArray(p.variants)) return p.variants as unknown as ProductVariant[];
    return undefined;
  })(),
});

/**
 * Hook to load a public store's data by slug.
 * Uses RPC functions (security definer) so no auth is needed.
 * All data is cached per-slug.
 */
export const useTenantStore = (slug: string | undefined): TenantStoreData => {
  const [storeInfo, setStoreInfo] = useState<TenantStoreInfo | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStore = useCallback(async (force = false) => {
    if (!slug) {
      setLoading(false);
      setError('رابط المتجر غير صالح');
      return;
    }

    const cacheKey = `tenant:${slug.toLowerCase()}`;

    if (!force) {
      const cached = cache.get<{ storeInfo: TenantStoreInfo; products: Product[]; categories: Category[] }>(cacheKey);
      if (cached) {
        setStoreInfo(cached.storeInfo);
        setProducts(cached.products);
        setCategories(cached.categories);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const data = await dedup(cacheKey, async () => {
        // 1. Get store info by slug
        const { data: storeData, error: storeErr } = await supabase
          .rpc('get_store_by_slug', { p_slug: slug });

        if (storeErr || !storeData || storeData.length === 0) {
          throw new Error('المتجر غير موجود');
        }

        const store = storeData[0];
        const ownerId = store.owner_id;

        // 2. Fetch products and categories in parallel
        const [prodsRes, catsRes] = await Promise.all([
          supabase.rpc('get_store_products', { p_owner_id: ownerId }),
          supabase.rpc('get_store_categories', { p_owner_id: ownerId }),
        ]);

        const info: TenantStoreInfo = {
          ownerId,
          storeName: store.store_name || '',
          storeLogo: store.store_logo || '',
          storeSlug: store.store_slug || slug,
          menuBackgroundColor: store.menu_background_color || '#ffffff',
          menuTextColor: store.menu_text_color || '#333333',
          menuAccentColor: store.menu_accent_color || '#6366f1',
          bannerImages: store.banner_images || [],
          primaryBannerIndex: store.primary_banner_index || 0,
          deliveryPrices: (store.delivery_prices as any) || [],
          whatsappNumber: store.whatsapp_number || '',
          facebookUrl: store.facebook_url || '',
          instagramUrl: store.instagram_url || '',
          returnPolicy: store.return_policy || '',
          privacyPolicy: store.privacy_policy || '',
          paymentMethods: store.payment_methods,
        };

        return {
          storeInfo: info,
          products: (prodsRes.data || []).map(formatProduct),
          categories: (catsRes.data || []).map((c: any) => ({
            id: c.id,
            name: c.name,
            order: c.display_order || 0,
          })),
        };
      });

      cache.set(cacheKey, data, CacheTTL.MEDIUM, CacheTTL.STALE);
      setStoreInfo(data.storeInfo);
      setProducts(data.products);
      setCategories(data.categories);
    } catch (err: any) {
      setError(err.message || 'فشل في تحميل المتجر');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchStore();
  }, [fetchStore]);

  return {
    storeInfo,
    products,
    categories,
    loading,
    error,
    refetch: () => fetchStore(true),
  };
};
