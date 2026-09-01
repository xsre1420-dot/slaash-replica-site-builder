import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cache, CacheKeys, CacheTTL } from '@/lib/cache';
import {
  loadSettingsPageBundle,
  loadSettingsDomainBundle,
  peekSettingsPageBundle,
  settingsFormFromBundle,
  invalidateSettingsPageBundle,
} from '@/services/settingsPageService';

const mockProfile = {
  storeName: 'My Shop',
  storeLogo: 'https://cdn/logo.png',
  storeGovernorate: 'Baghdad',
  settings: {
    menuBackgroundColor: '#fff',
    menuTextColor: '#333',
    menuAccentColor: '#6366f1',
    storeFont: 'Tajawal',
    bannerImages: ['https://cdn/banner.jpg'],
    primaryBannerIndex: 0,
    deliveryPrices: [{ governorate: 'Baghdad', price: 5000 }],
    paymentMethods: ['cash_on_delivery'],
  },
};

const mockSettingsRow = {
  store_name: 'My Shop',
  store_logo: 'https://cdn/logo.png',
  store_governorate: 'Baghdad',
  menu_background_color: '#fff',
  menu_text_color: '#333',
  menu_accent_color: '#6366f1',
  store_font: 'Tajawal',
  banner_images: ['https://cdn/banner.jpg'],
  primary_banner_index: 0,
  delivery_prices: [{ governorate: 'Baghdad', price: 5000 }],
  payment_methods: ['cash_on_delivery'],
  store_slug: 'my-shop',
  return_policy: 'Returns allowed',
  privacy_policy: 'Privacy text',
  terms_conditions: 'Terms text',
  whatsapp_number: '+9647000000000',
  whatsapp_welcome_message: 'Welcome',
  whatsapp_order_confirmation: 'Confirmed',
};

vi.mock('@/services/storeService', () => ({
  fetchStoreSettings: vi.fn(async (ownerId: string) => {
    cache.set(CacheKeys.storeSettings(ownerId), mockSettingsRow, CacheTTL.LONG, CacheTTL.STALE);
    return mockProfile;
  }),
  mapMerchantComplianceSettings: vi.fn((data: Record<string, unknown>) => ({
    storeSlug: String(data.store_slug || ''),
    returnPolicy: String(data.return_policy || ''),
    privacyPolicy: String(data.privacy_policy || ''),
    termsConditions: String(data.terms_conditions || ''),
    whatsappNumber: String(data.whatsapp_number || ''),
    whatsappWelcomeMessage: String(data.whatsapp_welcome_message || ''),
    whatsappOrderConfirmation: String(data.whatsapp_order_confirmation || ''),
    paymentCashOnDelivery: true,
    paymentCreditCard: false,
    paymentEwallet: false,
  })),
  fetchCustomDomainSettings: vi.fn(async () => ({
    custom_domain: 'shop.example.com',
    domain_verified: false,
  })),
}));

describe('settingsPageService', () => {
  beforeEach(() => {
    cache.flushAll();
    vi.clearAllMocks();
  });

  it('peekSettingsPageBundle returns null when cache is cold', () => {
    expect(peekSettingsPageBundle('owner-1')).toBeNull();
  });

  it('loadSettingsPageBundle dedupes concurrent loads and caches bundle', async () => {
    const [a, b] = await Promise.all([
      loadSettingsPageBundle('owner-1'),
      loadSettingsPageBundle('owner-1'),
    ]);

    expect(a?.profile.storeName).toBe('My Shop');
    expect(a?.compliance.storeSlug).toBe('my-shop');
    expect(b?.compliance.returnPolicy).toBe('Returns allowed');
    expect(peekSettingsPageBundle('owner-1')?.compliance.storeSlug).toBe('my-shop');
  });

  it('settingsFormFromBundle maps profile and compliance into form snapshot', async () => {
    const bundle = await loadSettingsPageBundle('owner-2');
    expect(bundle).not.toBeNull();
    const form = settingsFormFromBundle(bundle!);
    expect(form.storeName).toBe('My Shop');
    expect(form.storeSlug).toBe('my-shop');
    expect(form.returnPolicy).toBe('Returns allowed');
    expect(form.deliveryPrices).toHaveLength(1);
  });

  it('loadSettingsDomainBundle is lazy and cached separately', async () => {
    const domain = await loadSettingsDomainBundle('owner-1');
    expect(domain?.custom_domain).toBe('shop.example.com');
    expect(cache.get(CacheKeys.settingsDomain('owner-1'))?.custom_domain).toBe('shop.example.com');
  });

  it('invalidateSettingsPageBundle clears page and domain caches', async () => {
    await loadSettingsPageBundle('owner-3');
    await loadSettingsDomainBundle('owner-3');
    invalidateSettingsPageBundle('owner-3');
    expect(peekSettingsPageBundle('owner-3')).toBeNull();
    expect(cache.get(CacheKeys.settingsDomain('owner-3'))).toBeNull();
  });
});
