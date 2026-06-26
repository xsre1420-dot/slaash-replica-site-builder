import { supabase } from '@/integrations/supabase/client';
import { cache, CacheKeys, CacheTTL } from '@/lib/cache';
import { resolveStoreSlugByOwnerId } from '@/services/storefrontProductService';

export interface StoreMarketingConfig {
  ownerId: string;
  marketingEnabled: boolean;
  metaPixelId: string | null;
  googleAnalyticsId: string | null;
}

const VALID_PIXEL_ID = /^[0-9]+$/;
const VALID_GA_ID = /^(G-[A-Z0-9]+|UA-[0-9]+-[0-9]+)$/i;

function normalizeConfig(raw: Record<string, unknown> | null): StoreMarketingConfig | null {
  if (!raw?.owner_id) return null;

  const metaRaw = String(raw.meta_pixel_id || '').trim();
  const gaRaw = String(raw.google_analytics_id || '').trim();

  return {
    ownerId: String(raw.owner_id),
    marketingEnabled: Boolean(raw.marketing_enabled),
    metaPixelId: metaRaw && VALID_PIXEL_ID.test(metaRaw) ? metaRaw : null,
    googleAnalyticsId: gaRaw && VALID_GA_ID.test(gaRaw) ? gaRaw : null,
  };
}

export async function fetchStoreMarketingBySlug(slug: string): Promise<StoreMarketingConfig | null> {
  const normalized = slug.trim().toLowerCase();
  const cacheKey = CacheKeys.tenantMeta(`marketing:${normalized}`);
  const cached = cache.get<StoreMarketingConfig>(cacheKey);
  if (cached) return cached;

  const { data, error } = await (supabase as any).rpc('get_store_marketing_public', {
    p_slug: normalized,
  });

  if (error || !data) return null;
  const config = normalizeConfig(data as Record<string, unknown>);
  if (config) {
    cache.set(cacheKey, config, CacheTTL.MEDIUM, CacheTTL.SHORT);
  }
  return config;
}

export async function fetchStoreMarketingByOwner(ownerId: string): Promise<StoreMarketingConfig | null> {
  const cacheKey = `marketing:owner:${ownerId}`;
  const cached = cache.get<StoreMarketingConfig>(cacheKey);
  if (cached) return cached;

  const { data, error } = await (supabase as any).rpc('get_store_marketing_for_owner', {
    p_owner_id: ownerId,
  });

  if (error || !data) return null;
  const config = normalizeConfig(data as Record<string, unknown>);
  if (config) {
    cache.set(cacheKey, config, CacheTTL.MEDIUM, CacheTTL.SHORT);
  }
  return config;
}

export async function fetchStoreMarketingConfig(opts: {
  storeSlug?: string | null;
  ownerId?: string | null;
}): Promise<StoreMarketingConfig | null> {
  if (opts.storeSlug?.trim()) {
    return fetchStoreMarketingBySlug(opts.storeSlug);
  }
  if (opts.ownerId) {
    return fetchStoreMarketingByOwner(opts.ownerId);
  }
  return null;
}

export function invalidateStoreMarketingCache(storeSlug?: string, ownerId?: string): void {
  if (storeSlug?.trim()) {
    cache.del(CacheKeys.tenantMeta(`marketing:${storeSlug.trim().toLowerCase()}`));
  }
  if (ownerId) {
    cache.del(`marketing:owner:${ownerId}`);
  }
}

export interface MerchantMarketingSettings {
  meta_pixel_id: string;
  google_analytics_id: string;
  marketing_enabled: boolean;
  email_marketing_enabled: boolean;
  sms_marketing_enabled: boolean;
  store_slug: string | null;
}

export async function fetchMerchantMarketingSettings(
  ownerId: string
): Promise<MerchantMarketingSettings | null> {
  const [marketingRes, storeRes] = await Promise.all([
    supabase
      .from('marketing_settings')
      .select(
        'meta_pixel_id, google_analytics_id, marketing_enabled, email_marketing_enabled, sms_marketing_enabled'
      )
      .eq('owner_id', ownerId)
      .maybeSingle(),
    supabase.from('store_settings').select('store_slug').eq('owner_id', ownerId).maybeSingle(),
  ]);

  if (marketingRes.error && storeRes.error) return null;

  const data = marketingRes.data;
  return {
    meta_pixel_id: data?.meta_pixel_id || '',
    google_analytics_id: data?.google_analytics_id || '',
    marketing_enabled: data?.marketing_enabled || false,
    email_marketing_enabled: data?.email_marketing_enabled || false,
    sms_marketing_enabled: data?.sms_marketing_enabled || false,
    store_slug: storeRes.data?.store_slug?.trim().toLowerCase() || null,
  };
}

export async function upsertMerchantMarketingSettings(
  ownerId: string,
  settings: Omit<MerchantMarketingSettings, 'store_slug'> & { facebook_access_token?: string }
): Promise<{ success: boolean; error?: string; storeSlug?: string | null }> {
  const payload: Record<string, unknown> = {
    owner_id: ownerId,
    meta_pixel_id: settings.meta_pixel_id,
    google_analytics_id: settings.google_analytics_id,
    marketing_enabled: settings.marketing_enabled,
    email_marketing_enabled: settings.email_marketing_enabled,
    sms_marketing_enabled: settings.sms_marketing_enabled,
  };
  if (settings.facebook_access_token?.trim()) {
    payload.facebook_access_token = settings.facebook_access_token.trim();
  }

  const { data, error } = await (supabase as any).rpc('upsert_merchant_marketing_settings', {
    p_owner_id: ownerId,
    p_patch: payload,
  });
  if (error) return { success: false, error: error.message };
  if (data?.success === false) return { success: false, error: String(data?.error ?? 'upsert_failed') };

  if (data?.noop !== true) {
    const slug = await resolveStoreSlugByOwnerId(ownerId);
    invalidateStoreMarketingCache(slug ?? undefined, ownerId);
    return { success: true, storeSlug: slug };
  }
  return { success: true, storeSlug: await resolveStoreSlugByOwnerId(ownerId) };
}

export interface DiscountProductRow {
  id: string;
  name: string;
  price: number;
  image_url: string;
  category: string;
  discount_type?: 'none' | 'percentage' | 'amount';
  discount_value?: number;
  discount_start_date?: string;
  discount_end_date?: string;
  original_price?: number;
}

export async function fetchDiscountProducts(ownerId: string): Promise<DiscountProductRow[]> {
  const { data, error } = await supabase
    .from('products')
    .select(
      'id, name, price, image_url, category, discount_type, discount_value, discount_start_date, discount_end_date, original_price'
    )
    .eq('owner_id', ownerId)
    .order('name', { ascending: true });

  if (error || !data) return [];
  return data as DiscountProductRow[];
}

export async function updateProductDiscount(
  ownerId: string,
  productId: string,
  updateData: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await (supabase as any).rpc('patch_merchant_product', {
    p_product_id: productId,
    p_owner_id: ownerId,
    p_patch: updateData,
  });

  if (error) return { success: false, error: error.message };
  if (data?.success === false) return { success: false, error: String(data?.error ?? 'patch_failed') };
  return { success: true };
}
