/**
 * Settings page bundle — one coordinated load for initial settings render.
 */
import { cache, CacheKeys, CacheTTL, dedup, clearInflight } from '@/lib/cache';
import type { StoreProfile } from '@/types/store';
import {
  fetchStoreSettings,
  mapMerchantComplianceSettings,
  fetchCustomDomainSettings,
  type MerchantComplianceSettings,
  type CustomDomainSettings,
} from '@/services/storeService';

export type SettingsPageBundle = {
  profile: StoreProfile;
  compliance: MerchantComplianceSettings;
};

export type SettingsFormSnapshot = {
  storeName: string;
  storeLogo: string;
  storeGovernorate: string;
  storeSlug: string;
  menuBackgroundColor: string;
  menuTextColor: string;
  menuAccentColor: string;
  storeFont: string;
  bannerImages: string[];
  primaryBannerIndex: number;
  deliveryPrices: StoreProfile['settings']['deliveryPrices'];
  returnPolicy: string;
  termsConditions: string;
  privacyPolicy: string;
  whatsappNumber: string;
  whatsappWelcomeMessage: string;
  whatsappOrderConfirmation: string;
};

export function settingsFormFromBundle(bundle: SettingsPageBundle): SettingsFormSnapshot {
  const { profile, compliance } = bundle;
  return {
    storeName: profile.storeName,
    storeLogo: profile.storeLogo,
    storeGovernorate: profile.storeGovernorate,
    storeSlug: compliance.storeSlug,
    menuBackgroundColor: profile.settings.menuBackgroundColor,
    menuTextColor: profile.settings.menuTextColor,
    menuAccentColor: profile.settings.menuAccentColor,
    storeFont: profile.settings.storeFont || 'Tajawal',
    bannerImages: profile.settings.bannerImages,
    primaryBannerIndex: profile.settings.primaryBannerIndex,
    deliveryPrices: profile.settings.deliveryPrices || [],
    returnPolicy: compliance.returnPolicy,
    termsConditions: compliance.termsConditions,
    privacyPolicy: compliance.privacyPolicy,
    whatsappNumber: compliance.whatsappNumber,
    whatsappWelcomeMessage: compliance.whatsappWelcomeMessage,
    whatsappOrderConfirmation: compliance.whatsappOrderConfirmation,
  };
}

/** Sync read when settings bundle already warmed cache. */
export function peekSettingsPageBundle(ownerId: string): SettingsPageBundle | null {
  return cache.get<SettingsPageBundle>(CacheKeys.settingsPage(ownerId));
}

export function invalidateSettingsPageBundle(ownerId: string): void {
  cache.del(CacheKeys.settingsPage(ownerId));
  cache.del(CacheKeys.settingsDomain(ownerId));
  clearInflight(CacheKeys.settingsPage(ownerId));
  clearInflight(CacheKeys.settingsDomain(ownerId));
}

/** Single deduped entry for Settings initial data — one store_settings fetch. */
export async function loadSettingsPageBundle(
  ownerId: string,
  options?: { force?: boolean }
): Promise<SettingsPageBundle | null> {
  const key = CacheKeys.settingsPage(ownerId);

  if (!options?.force) {
    const peek = peekSettingsPageBundle(ownerId);
    if (peek) return peek;
  } else {
    invalidateSettingsPageBundle(ownerId);
  }

  return dedup(key, async () => {
    const profile = await fetchStoreSettings(ownerId, options?.force);
    if (!profile) return null;

    const row = cache.get<Record<string, unknown>>(CacheKeys.storeSettings(ownerId));
    const compliance = row
      ? mapMerchantComplianceSettings(row)
      : {
          storeSlug: '',
          returnPolicy: '',
          privacyPolicy: '',
          termsConditions: '',
          whatsappNumber: '',
          whatsappWelcomeMessage: '',
          whatsappOrderConfirmation: '',
          paymentCashOnDelivery: true,
          paymentCreditCard: false,
          paymentEwallet: false,
        };

    const bundle: SettingsPageBundle = { profile, compliance };
    cache.set(key, bundle, CacheTTL.LONG, CacheTTL.STALE);
    return bundle;
  });
}

/** Lazy domain tab data — loaded only when the domain tab opens. */
export async function loadSettingsDomainBundle(
  ownerId: string,
  options?: { force?: boolean }
): Promise<CustomDomainSettings | null> {
  const key = CacheKeys.settingsDomain(ownerId);

  if (!options?.force) {
    const cached = cache.get<CustomDomainSettings>(key);
    if (cached) return cached;
  } else {
    cache.del(key);
    clearInflight(key);
  }

  return dedup(key, async () => {
    const data = await fetchCustomDomainSettings(ownerId);
    if (data) {
      cache.set(key, data, CacheTTL.LONG, CacheTTL.STALE);
    }
    return data;
  });
}
