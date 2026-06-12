import { supabase } from '@/integrations/supabase/client';
import { cache, CacheKeys, CacheTTL } from '@/lib/cache';
import { defaultStoreSettings, StoreProfile, StoreSettings } from '@/types/store';
import { DeliveryPrice } from '@/utils/deliveryUtils';

const STORE_SETTINGS_SELECT =
  'store_name, store_logo, store_governorate, menu_background_color, menu_text_color, menu_accent_color, store_font, banner_images, primary_banner_index, delivery_prices, payment_methods';

export const mapStoreSettingsRow = (data: Record<string, unknown>): StoreProfile => ({
  storeName: String(data.store_name || ''),
  storeLogo: String(data.store_logo || ''),
  storeGovernorate: String(data.store_governorate || ''),
  settings: {
    menuBackgroundColor: String(data.menu_background_color || '#ffffff'),
    menuTextColor: String(data.menu_text_color || '#333333'),
    menuAccentColor: String(data.menu_accent_color || '#6366f1'),
    storeFont: String(data.store_font || 'Tajawal'),
    bannerImages: (data.banner_images as string[]) || [],
    primaryBannerIndex: Number(data.primary_banner_index) || 0,
    deliveryPrices: (data.delivery_prices as DeliveryPrice[]) || [],
    paymentMethods: Array.isArray(data.payment_methods)
      ? (data.payment_methods as string[])
      : ['cash_on_delivery'],
  },
});

export const fetchStoreSettings = async (ownerId: string): Promise<StoreProfile | null> => {
  const cacheKey = CacheKeys.storeSettings(ownerId);
  const cached = cache.get<Record<string, unknown>>(cacheKey);
  if (cached) return mapStoreSettingsRow(cached);

  const { data, error } = await supabase
    .from('store_settings')
    .select(STORE_SETTINGS_SELECT)
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('Error loading store settings:', error);
    return null;
  }

  if (!data) return null;

  cache.set(cacheKey, data, CacheTTL.LONG, CacheTTL.STALE);
  return mapStoreSettingsRow(data as Record<string, unknown>);
};

export const upsertStoreSettings = async (
  ownerId: string,
  updates: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase
    .from('store_settings')
    .upsert({ owner_id: ownerId, ...updates }, { onConflict: 'owner_id' });

  if (error) {
    console.error('Error saving store settings:', error);
    return { success: false, error: error.message };
  }

  cache.del(CacheKeys.storeSettings(ownerId));
  return { success: true };
};

export const invalidateStoreSettingsCache = (ownerId: string) => {
  cache.del(CacheKeys.storeSettings(ownerId));
};

export { defaultStoreSettings, type StoreSettings };
