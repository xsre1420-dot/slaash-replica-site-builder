import { createContext, useState, useContext, ReactNode, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { useStoreHydration } from "./StoreBootstrapContext";
import { cache, CacheKeys } from "@/lib/cache";
import {
  defaultStoreSettings,
  fetchStoreSettings,
  mapStoreSettingsRow,
  upsertStoreSettings,
  type StoreSettings,
} from "@/services/storeService";

interface StoreContextType {
  storeName: string;
  storeLogo: string;
  storeGovernorate: string;
  storeSettings: StoreSettings;
  updateStore: (logo: string, name: string, governorate?: string) => Promise<void>;
  updateStoreSettings: (settings: StoreSettings) => Promise<void>;
}

const StoreContext = createContext<StoreContextType | null>(null);

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { isReady, hydrationVersion } = useStoreHydration();
  const isPublicStorefront = /^\/store\/[a-z0-9-]+(\/|$)/.test(pathname);
  const isProductFormRoute =
    pathname.startsWith('/add-product') || pathname.startsWith('/edit-product');
  const isStatisticsRoute = pathname.startsWith('/statistics');
  const isProductsRoute = pathname.startsWith('/products');
  const isSettingsRoute = pathname.startsWith('/settings');
  const isOrdersRoute = pathname.startsWith('/orders');
  const isPreviewRoute = pathname === '/preview';
  const isProductDetailsRoute = pathname.startsWith('/product-details');
  const [storeName, setStoreName] = useState("");
  const [storeLogo, setStoreLogo] = useState("");
  const [storeGovernorate, setStoreGovernorate] = useState("");
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(defaultStoreSettings());

  const applyStoreProfile = useCallback((profile: ReturnType<typeof mapStoreSettingsRow>) => {
    setStoreName(profile.storeName);
    setStoreLogo(profile.storeLogo);
    setStoreGovernorate(profile.storeGovernorate);
    setStoreSettings(profile.settings);
  }, []);

  const loadStoreSettings = useCallback(async () => {
    if (!user?.id) return;

    const profile = await fetchStoreSettings(user.id);
    if (profile) applyStoreProfile(profile);
  }, [user?.id, applyStoreProfile]);

  useEffect(() => {
    if (user?.id && isReady && !isPublicStorefront) {
      if (isProductFormRoute || isStatisticsRoute || isProductsRoute || isSettingsRoute || isOrdersRoute || isPreviewRoute || isProductDetailsRoute) {
        const cached = cache.get<Record<string, unknown>>(CacheKeys.storeSettings(user.id));
        if (cached) applyStoreProfile(mapStoreSettingsRow(cached));
      } else {
        void loadStoreSettings();
      }
    } else if (!user?.id) {
      setStoreName("");
      setStoreLogo("");
      setStoreGovernorate("");
      setStoreSettings(defaultStoreSettings());
    }
  }, [user?.id, isReady, hydrationVersion, isPublicStorefront, isProductFormRoute, isStatisticsRoute, isProductsRoute, isSettingsRoute, isOrdersRoute, isPreviewRoute, isProductDetailsRoute, applyStoreProfile, loadStoreSettings]);

  const updateStore = useCallback(async (logo: string, name: string, governorate?: string) => {
    if (!user?.id) return;

    const result = await upsertStoreSettings(user.id, {
      store_name: name,
      store_logo: logo,
      store_governorate: governorate ?? storeGovernorate,
    });

    if (!result.success) {
      throw new Error(result.error || 'فشل في حفظ معلومات المتجر');
    }

    setStoreLogo(logo);
    setStoreName(name);
    if (governorate !== undefined) setStoreGovernorate(governorate);
  }, [user?.id, storeGovernorate]);

  const updateStoreSettings = useCallback(async (settings: StoreSettings) => {
    if (!user?.id) return;

    const result = await upsertStoreSettings(user.id, {
      menu_background_color: settings.menuBackgroundColor,
      menu_text_color: settings.menuTextColor,
      menu_accent_color: settings.menuAccentColor,
      store_font: settings.storeFont,
      banner_images: settings.bannerImages,
      primary_banner_index: settings.primaryBannerIndex,
      delivery_prices: settings.deliveryPrices,
    });

    if (!result.success) {
      throw new Error(result.error || 'فشل في حفظ إعدادات المتجر');
    }

    setStoreSettings(settings);
  }, [user?.id]);

  const value = useMemo(() => ({
    storeName,
    storeLogo,
    storeGovernorate,
    storeSettings,
    updateStore,
    updateStoreSettings,
  }), [storeName, storeLogo, storeGovernorate, storeSettings, updateStore, updateStoreSettings]);

  return (
    <StoreContext.Provider value={value}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (context === null) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
};
