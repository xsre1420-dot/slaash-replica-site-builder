import { useMemo } from 'react';
import { useStore } from '@/context/StoreContext';
import { useTenantStore } from '@/hooks/useTenantStore';
import { DeliveryPrice } from '@/utils/deliveryUtils';

export interface StoreDisplaySettings {
  bannerImages: string[];
  menuBackgroundColor: string;
  menuTextColor: string;
  menuAccentColor: string;
  storeFont: string;
  primaryBannerIndex: number;
  deliveryPrices: DeliveryPrice[];
  paymentMethods?: string[];
  whatsappNumber: string;
}

export interface StoreDisplayInfo {
  storeName: string;
  storeLogo: string;
  storeSettings: StoreDisplaySettings;
  ownerId?: string;
}

/**
 * Unifies tenant vs owner store display values (removes duplication in Store/Checkout).
 */
export const useStoreDisplay = (storeSlug?: string): StoreDisplayInfo & { isTenantMode: boolean; loading: boolean } => {
  const isTenantMode = !!storeSlug;
  const tenant = useTenantStore(storeSlug);
  const ownStore = useStore();

  return useMemo(() => {
    if (isTenantMode) {
      const info = tenant.storeInfo;
      return {
        isTenantMode: true,
        loading: tenant.loading,
        storeName: info?.storeName || '',
        storeLogo: info?.storeLogo || '',
        ownerId: info?.ownerId,
        storeSettings: {
          bannerImages: info?.bannerImages || [],
          menuBackgroundColor: info?.menuBackgroundColor || '#ffffff',
          menuTextColor: info?.menuTextColor || '#333333',
          menuAccentColor: info?.menuAccentColor || '#6366f1',
          storeFont: info?.storeFont || 'Tajawal',
          primaryBannerIndex: info?.primaryBannerIndex || 0,
          deliveryPrices: info?.deliveryPrices || [],
          paymentMethods: info?.paymentMethods,
          whatsappNumber: info?.whatsappNumber || '',
        },
      };
    }

    return {
      isTenantMode: false,
      loading: false,
      storeName: ownStore.storeName,
      storeLogo: ownStore.storeLogo,
      storeSettings: {
        ...ownStore.storeSettings,
        whatsappNumber: '',
      },
    };
  }, [isTenantMode, tenant.storeInfo, tenant.loading, ownStore]);
};
