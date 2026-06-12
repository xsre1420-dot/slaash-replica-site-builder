import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Product, Category } from '@/types';
import { cache, CacheTTL, dedup } from '@/lib/cache';
import { cacheGet, cacheSet } from '@/utils/indexedDB';

const META_IDB_TTL = 10 * 60 * 1000; // 10 min for store meta

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
  paymentMethods: unknown;
}

interface TenantStoreData {
  storeInfo: TenantStoreInfo | null;
  /** @deprecated Use useStoreProductsPage for catalog — kept empty for backward compat */
  products: Product[];
  categories: Category[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const buildStoreInfo = (store: Record<string, unknown>, normalizedSlug: string, ownerId: string): TenantStoreInfo => ({
  ownerId,
  storeName: String(store.store_name || ''),
  storeLogo: String(store.store_logo || ''),
  storeSlug: String(store.store_slug || normalizedSlug),
  menuBackgroundColor: String(store.menu_background_color || '#ffffff'),
  menuTextColor: String(store.menu_text_color || '#333333'),
  menuAccentColor: String(store.menu_accent_color || '#6366f1'),
  storeFont: String(store.store_font || 'Tajawal'),
  bannerImages: (store.banner_images as string[]) || [],
  primaryBannerIndex: Number(store.primary_banner_index) || 0,
  deliveryPrices: (store.delivery_prices as { governorate: string; price: number }[]) || [],
  whatsappNumber: String(store.whatsapp_number || ''),
  facebookUrl: String(store.facebook_url || ''),
  instagramUrl: String(store.instagram_url || ''),
  returnPolicy: String(store.return_policy || ''),
  privacyPolicy: String(store.privacy_policy || ''),
  paymentMethods: store.payment_methods,
});

async function fetchStoreMeta(normalizedSlug: string) {
  const { data: meta, error: metaErr } = await (supabase as any).rpc('get_store_meta', {
    p_slug: normalizedSlug,
  });

  if (!metaErr && meta?.store) {
    const store = meta.store as Record<string, unknown>;
    const ownerId = String(store.owner_id || '');
    if (!ownerId) throw new Error('المتجر غير صالح');

    return {
      storeInfo: buildStoreInfo(store, normalizedSlug, ownerId),
      categories: ((meta.categories || []) as Record<string, unknown>[]).map((c) => ({
        id: String(c.id),
        name: String(c.name),
        order: Number(c.display_order) || 0,
      })),
    };
  }

  const { data: storeData, error: storeErr } = await (supabase as any).rpc('get_store_by_slug', {
    p_slug: normalizedSlug,
  });

  if (storeErr || !storeData) throw new Error('المتجر غير موجود');

  const store = (Array.isArray(storeData) ? storeData[0] : storeData) as Record<string, unknown>;
  if (!store?.owner_id) throw new Error('المتجر غير صالح');

  const catsRes = await (supabase as any).rpc('get_store_categories_by_slug', { p_slug: normalizedSlug });
  if (catsRes.error) throw new Error('فشل في تحميل بيانات المتجر');

  return {
    storeInfo: buildStoreInfo(store, normalizedSlug, String(store.owner_id)),
    categories: ((catsRes.data || []) as Record<string, unknown>[]).map((c) => ({
      id: String(c.id),
      name: String(c.name),
      order: Number(c.display_order) || 0,
    })),
  };
}

/**
 * Loads store metadata only (settings + categories).
 * Product catalog: use useStoreProductsPage for paginated reads.
 */
export const useTenantStore = (slug: string | undefined): TenantStoreData => {
  const [storeInfo, setStoreInfo] = useState<TenantStoreInfo | null>(null);
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

    const cacheKey = `tenant-meta:${normalizedSlug}`;
    const idbKey = `idb:${cacheKey}`;

    if (!force) {
      const idbCached = await cacheGet<{ storeInfo: TenantStoreInfo; categories: Category[] }>(
        idbKey,
        META_IDB_TTL
      );
      if (idbCached) {
        setStoreInfo(idbCached.storeInfo);
        setCategories(idbCached.categories);
        setLoading(false);
        return;
      }

      const cached = cache.get<{ storeInfo: TenantStoreInfo; categories: Category[] }>(
        cacheKey,
        () => fetchStoreMeta(normalizedSlug).then(async (data) => {
          await cacheSet(idbKey, data);
          return data;
        })
      );
      if (cached) {
        setStoreInfo(cached.storeInfo);
        setCategories(cached.categories);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const data = await dedup(cacheKey, () => fetchStoreMeta(normalizedSlug));
      cache.set(cacheKey, data, CacheTTL.LONG, CacheTTL.MEDIUM);
      await cacheSet(idbKey, data);
      setStoreInfo(data.storeInfo);
      setCategories(data.categories);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل في تحميل المتجر');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchStore();
  }, [fetchStore]);

  return {
    storeInfo,
    products: [],
    categories,
    loading,
    error,
    refetch: () => fetchStore(true),
  };
};
