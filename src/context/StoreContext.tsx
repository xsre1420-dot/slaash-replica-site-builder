import { createContext, useState, useContext, ReactNode, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "./AuthContext";
import {
  defaultStoreSettings,
  fetchStoreSettings,
  invalidateStoreSettingsCache,
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
  const [storeName, setStoreName] = useState("");
  const [storeLogo, setStoreLogo] = useState("");
  const [storeGovernorate, setStoreGovernorate] = useState("");
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(defaultStoreSettings());

  useEffect(() => {
    if (user?.id) {
      loadStoreSettings();
    } else {
      setStoreName("");
      setStoreLogo("");
      setStoreGovernorate("");
      setStoreSettings(defaultStoreSettings());
    }
  }, [user?.id]);

  const loadStoreSettings = async () => {
    if (!user?.id) return;

    const profile = await fetchStoreSettings(user.id);
    if (profile) {
      setStoreName(profile.storeName);
      setStoreLogo(profile.storeLogo);
      setStoreGovernorate(profile.storeGovernorate);
      setStoreSettings(profile.settings);
    }
  };

  const updateStore = useCallback(async (logo: string, name: string, governorate?: string) => {
    setStoreLogo(logo);
    setStoreName(name);
    if (governorate !== undefined) setStoreGovernorate(governorate);

    if (user?.id) {
      invalidateStoreSettingsCache(user.id);
      await upsertStoreSettings(user.id, {
        store_name: name,
        store_logo: logo,
        store_governorate: governorate ?? storeGovernorate,
      });
    }
  }, [user?.id, storeGovernorate]);

  const updateStoreSettings = useCallback(async (settings: StoreSettings) => {
    setStoreSettings(settings);

    if (user?.id) {
      invalidateStoreSettingsCache(user.id);
      await upsertStoreSettings(user.id, {
        menu_background_color: settings.menuBackgroundColor,
        menu_text_color: settings.menuTextColor,
        menu_accent_color: settings.menuAccentColor,
        store_font: settings.storeFont,
        banner_images: settings.bannerImages,
        primary_banner_index: settings.primaryBannerIndex,
        delivery_prices: settings.deliveryPrices,
      });
    }
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
