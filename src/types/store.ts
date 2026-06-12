import { DeliveryPrice } from '@/utils/deliveryUtils';

export type { DeliveryPrice };

export interface StoreSettings {
  menuBackgroundColor: string;
  menuTextColor: string;
  menuAccentColor: string;
  storeFont: string;
  bannerImages: string[];
  primaryBannerIndex: number;
  deliveryPrices: DeliveryPrice[];
  paymentMethods: string[];
}

export interface StoreProfile {
  storeName: string;
  storeLogo: string;
  storeGovernorate: string;
  settings: StoreSettings;
}

export const defaultStoreSettings = (): StoreSettings => ({
  menuBackgroundColor: '#ffffff',
  menuTextColor: '#333333',
  menuAccentColor: '#6366f1',
  storeFont: 'Tajawal',
  bannerImages: [],
  primaryBannerIndex: 0,
  deliveryPrices: [],
  paymentMethods: ['cash_on_delivery'],
});
