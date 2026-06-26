import { supabase } from '@/integrations/supabase/client';
import { cache, CacheKeys, CacheTTL } from '@/lib/cache';
import { isSchemaColumnError } from '@/lib/productUpdateUtils';
import { defaultStoreSettings, StoreProfile, StoreSettings } from '@/types/store';
import { DeliveryPrice } from '@/utils/deliveryUtils';
import { logger } from '@/lib/observability';

const STORE_SETTINGS_SELECT =
  'store_name, store_logo, store_governorate, menu_background_color, menu_text_color, menu_accent_color, store_font, banner_images, primary_banner_index, delivery_prices, payment_methods, store_slug, return_policy, privacy_policy, terms_conditions, whatsapp_number, whatsapp_welcome_message, whatsapp_order_confirmation';

const STORE_SETTINGS_SELECT_MINIMAL =
  'store_name, store_logo, store_governorate, menu_background_color, menu_text_color, menu_accent_color, store_font, banner_images, primary_banner_index, delivery_prices, payment_methods, store_slug, return_policy, privacy_policy, whatsapp_number';

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

export const fetchStoreSettings = async (ownerId: string, force = false): Promise<StoreProfile | null> => {
  const cacheKey = CacheKeys.storeSettings(ownerId);
  if (!force) {
    const cached = cache.get<Record<string, unknown>>(cacheKey);
    if (cached) return mapStoreSettingsRow(cached);
  }

  const { data, error } = await supabase
    .from('store_settings')
    .select(STORE_SETTINGS_SELECT)
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (error && isSchemaColumnError(error.message)) {
    const retry = await supabase
      .from('store_settings')
      .select(STORE_SETTINGS_SELECT_MINIMAL)
      .eq('owner_id', ownerId)
      .maybeSingle();
    if (!retry.error && retry.data) {
      cache.set(cacheKey, retry.data, CacheTTL.LONG, CacheTTL.STALE);
      return mapStoreSettingsRow(retry.data as Record<string, unknown>);
    }
  }

  if (error && error.code !== 'PGRST116') {
    console.error('Error loading store settings:', error);
    return null;
  }

  if (!data) return null;

  cache.set(cacheKey, data, CacheTTL.LONG, CacheTTL.STALE);
  return mapStoreSettingsRow(data as Record<string, unknown>);
};

export interface StoreRecord {
  id: string;
  userId: string;
  storeName: string;
  storeSlug: string | null;
  themeId: string;
}

export const fetchStoreByUserId = async (userId: string): Promise<StoreRecord | null> => {
  const cacheKey = CacheKeys.store(userId);
  const cached = cache.get<StoreRecord>(cacheKey);
  if (cached) return cached;

  try {
    const { data, error } = await (supabase as any).rpc('get_store_for_user', { p_user_id: userId });
    if (!error && data?.id) {
      const record: StoreRecord = {
        id: data.id,
        userId: data.user_id,
        storeName: data.store_name || '',
        storeSlug: data.store_slug || null,
        themeId: data.theme_id || 'default',
      };
      cache.set(cacheKey, record, CacheTTL.LONG, CacheTTL.STALE);
      return record;
    }
  } catch {
    // RPC may not exist until migration applied — fall through
  }

  const { data: storeRow } = await supabase
    .from('stores')
    .select('id, user_id, store_name, store_slug, theme_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (storeRow) {
    const record: StoreRecord = {
      id: storeRow.id,
      userId: storeRow.user_id,
      storeName: storeRow.store_name || '',
      storeSlug: storeRow.store_slug || null,
      themeId: storeRow.theme_id || 'default',
    };
    cache.set(cacheKey, record, CacheTTL.LONG, CacheTTL.STALE);
    return record;
  }

  const { data: settings } = await supabase
    .from('store_settings')
    .select('id, owner_id, store_name, store_slug')
    .eq('owner_id', userId)
    .maybeSingle();

  if (!settings) return null;

  const record: StoreRecord = {
    id: settings.id,
    userId: settings.owner_id,
    storeName: settings.store_name || '',
    storeSlug: settings.store_slug || null,
    themeId: 'default',
  };
  cache.set(cacheKey, record, CacheTTL.LONG, CacheTTL.STALE);
  return record;
};

export interface BootstrapResult {
  storeId: string;
  productsLoaded: number;
  categoriesLoaded: number;
}

/** Phase 6: Combined bootstrap RPC with parallel fallback */
export const bootstrapOwnerStore = async (userId: string): Promise<BootstrapResult | null> => {
  try {
    const { data, error } = await (supabase as any).rpc('get_owner_bootstrap', { p_user_id: userId });
    if (!error && data?.store?.id) {
      const storeId = data.store.id as string;
      const storeRecord: StoreRecord = {
        id: storeId,
        userId: data.store.user_id,
        storeName: data.store.store_name || '',
        storeSlug: data.store.store_slug || null,
        themeId: data.store.theme_id || 'default',
      };
      cache.set(CacheKeys.store(userId), storeRecord, CacheTTL.LONG, CacheTTL.STALE);

      if (data.settings) {
        cache.set(CacheKeys.storeSettings(userId), data.settings, CacheTTL.LONG, CacheTTL.STALE);
      }

      const categories = ((data.categories || []) as Record<string, unknown>[]).map((c) => ({
        id: String(c.id),
        name: String(c.name),
        order: Number(c.order ?? c.display_order ?? 0),
      }));
      cache.set(CacheKeys.categories(userId), categories, CacheTTL.MEDIUM, CacheTTL.STALE);

      const productCount = Number(data.product_count ?? 0);

      return {
        storeId,
        productsLoaded: productCount,
        categoriesLoaded: categories.length,
      };
    }
  } catch (e) {
    logger.warn('bootstrapOwnerStore RPC failed, using fallback', { userId, error: e });
  }

  const store = await fetchStoreByUserId(userId);
  return store ? { storeId: store.id, productsLoaded: 0, categoriesLoaded: 0 } : null;
};

export { defaultStoreSettings, type StoreSettings };

export type MerchantComplianceSettings = {
  storeSlug: string;
  returnPolicy: string;
  privacyPolicy: string;
  termsConditions: string;
  whatsappNumber: string;
  whatsappWelcomeMessage: string;
  whatsappOrderConfirmation: string;
  paymentCashOnDelivery: boolean;
  paymentCreditCard: boolean;
  paymentEwallet: boolean;
};

export const mapMerchantComplianceSettings = (
  data: Record<string, unknown>
): MerchantComplianceSettings => {
  const methods = Array.isArray(data.payment_methods) ? (data.payment_methods as string[]) : [];
  return {
    storeSlug: String(data.store_slug || ''),
    returnPolicy: String(data.return_policy || ''),
    privacyPolicy: String(data.privacy_policy || ''),
    termsConditions: String(data.terms_conditions || ''),
    whatsappNumber: String(data.whatsapp_number || ''),
    whatsappWelcomeMessage: String(data.whatsapp_welcome_message || ''),
    whatsappOrderConfirmation: String(data.whatsapp_order_confirmation || ''),
    paymentCashOnDelivery: methods.length === 0 || methods.includes('cash_on_delivery'),
    paymentCreditCard: methods.includes('credit_card'),
    paymentEwallet: methods.includes('digital_wallet'),
  };
};

/** Policies, slug, WhatsApp, and payment methods — single service path for Settings page. */
export const fetchMerchantComplianceSettings = async (
  ownerId: string
): Promise<MerchantComplianceSettings | null> => {
  const cacheKey = CacheKeys.storeSettings(ownerId);
  const cached = cache.get<Record<string, unknown>>(cacheKey);
  if (cached) return mapMerchantComplianceSettings(cached);

  const { data, error } = await supabase
    .from('store_settings')
    .select(STORE_SETTINGS_SELECT)
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('Error loading merchant compliance settings:', error);
    return null;
  }
  if (!data) return null;

  cache.set(cacheKey, data, CacheTTL.LONG, CacheTTL.STALE);
  return mapMerchantComplianceSettings(data as Record<string, unknown>);
};

export type CustomDomainSettings = {
  custom_domain: string | null;
  domain_verified: boolean;
};

export const fetchCustomDomainSettings = async (
  ownerId: string
): Promise<CustomDomainSettings | null> => {
  const { data, error } = await supabase
    .from('store_settings')
    .select('custom_domain, domain_verified')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    custom_domain: data.custom_domain ?? null,
    domain_verified: Boolean(data.domain_verified),
  };
};

export type PublicStoreSlug = { store_slug?: string; updated_at?: string };

export const listPublicStoreSlugs = async (
  limit = 5000,
  offset = 0
): Promise<PublicStoreSlug[]> => {
  const { data, error } = await (supabase as any).rpc('list_public_store_slugs', {
    p_limit: limit,
    p_offset: offset,
  });
  if (error) {
    console.warn('[storeService] list_public_store_slugs failed:', error.message);
    return [];
  }
  return (data as PublicStoreSlug[]) ?? [];
};
