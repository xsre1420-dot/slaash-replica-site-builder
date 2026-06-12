import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Product, Category, ColorOption, ProductVariant } from '@/types';
import { applyActiveDiscount } from '@/utils/inventoryUtils';
import { cache, CacheTTL, dedup } from '@/lib/cache';

interface TenantStoreInfo {
  ownerId: string;
  storeName: string;
  storeLogo: string;
  storeSlug: string;
  menuBackgroundColor: string;
  menuTextColor: string;
  menuAccentColor: string;
  storeFont: string;
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

const buildStoreInfo = (store: any, normalizedSlug: string, ownerId: string): TenantStoreInfo => ({
  ownerId,
  storeName: store.store_name || '',
  storeLogo: store.store_logo || '',
  storeSlug: store.store_slug || normalizedSlug,
  menuBackgroundColor: store.menu_background_color || '#ffffff',
  menuTextColor: store.menu_text_color || '#333333',
  menuAccentColor: store.menu_accent_color || '#6366f1',
  storeFont: store.store_font || 'Tajawal',
  bannerImages: store.banner_images || [],
  primaryBannerIndex: store.primary_banner_index || 0,
  deliveryPrices: store.delivery_prices || [],
  whatsappNumber: store.whatsapp_number || '',
  facebookUrl: store.facebook_url || '',
  instagramUrl: store.instagram_url || '',
  returnPolicy: store.return_policy || '',
  privacyPolicy: store.privacy_policy || '',
  paymentMethods: store.payment_methods,
});

async function fetchStoreFromApi(normalizedSlug: string) {
  const { data: bundle, error: bundleErr } = await (supabase as any)
    .rpc('get_store_bundle', { p_slug: normalizedSlug });

  if (!bundleErr && bundle?.store) {
    const store = bundle.store;
    const ownerId = store.owner_id;
    if (!ownerId) throw new Error('المتجر غير صالح');

    return {
      storeInfo: buildStoreInfo(store, normalizedSlug, ownerId),
      products: ((bundle.products || []) as any[]).map(formatProduct),
      categories: ((bundle.categories || []) as any[]).map((c: any) => ({
        id: c.id,
        name: c.name,
        order: c.display_order || 0,
      })),
    };
  }

  const { data: storeData, error: storeErr } = await (supabase as any)
    .rpc('get_store_by_slug', { p_slug: normalizedSlug });

  if (storeErr || !storeData) throw new Error('المتجر غير موجود');

  const store = Array.isArray(storeData) ? storeData[0] : storeData;
  if (!store?.owner_id) throw new Error('المتجر غير صالح');

  const [prodsRes, catsRes] = await Promise.all([
    (supabase as any).rpc('get_store_products_by_slug', { p_slug: normalizedSlug }),
    (supabase as any).rpc('get_store_categories_by_slug', { p_slug: normalizedSlug }),
  ]);

  if (prodsRes.error || catsRes.error) throw new Error('فشل في تحميل بيانات المتجر');

  return {
    storeInfo: buildStoreInfo(store, normalizedSlug, store.owner_id),
    products: ((prodsRes.data || []) as any[]).map(formatProduct),
    categories: ((catsRes.data || []) as any[]).map((c: any) => ({
      id: c.id,
      name: c.name,
      order: c.display_order || 0,
    })),
  };
}

const formatProduct = (p: any): Product => applyActiveDiscount({
  id: p.id,
  name: p.name,
  description: p.description || '',
  category: p.category,
  price: Number(p.price),
  image: p.image_url || '',
  additionalImages: p.additional_images || [],
  stockQuantity: p.stock_quantity ?? undefined,
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
  discountType: p.discount_type || undefined,
  discountValue: p.discount_value != null ? Number(p.discount_value) : undefined,
  discountStartDate: p.discount_start_date || undefined,
  discountEndDate: p.discount_end_date || undefined,
  originalPrice: p.original_price != null ? Number(p.original_price) : undefined,
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

    const normalizedSlug = slug.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(normalizedSlug)) {
      setLoading(false);
      setError('رابط المتجر غير صالح');
      return;
    }

    const cacheKey = `tenant:${normalizedSlug}`;

    if (!force) {
      const cached = cache.get<{ storeInfo: TenantStoreInfo; products: Product[]; categories: Category[] }>(
        cacheKey,
        () => fetchStoreFromApi(normalizedSlug)
      );
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
      const data = await dedup(cacheKey, () => fetchStoreFromApi(normalizedSlug));

      cache.set(cacheKey, data, CacheTTL.LONG, CacheTTL.MEDIUM);
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
