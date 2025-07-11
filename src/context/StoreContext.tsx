
import { createContext, useState, useContext, ReactNode, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

interface DeliveryPrice {
  governorate: string;
  price: number;
}

interface StoreSettings {
  menuBackgroundColor: string;
  menuTextColor: string;
  menuAccentColor: string;
  bannerImages: string[];
  primaryBannerIndex: number;
  deliveryPrices: DeliveryPrice[];
}

interface StoreContextType {
  storeName: string;
  storeLogo: string;
  storeGovernorate: string;
  storeSettings: StoreSettings;
  updateStore: (logo: string, name: string, governorate?: string) => Promise<void>;
  updateStoreSettings: (settings: StoreSettings) => Promise<void>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [storeName, setStoreName] = useState("");
  const [storeLogo, setStoreLogo] = useState("");
  const [storeGovernorate, setStoreGovernorate] = useState("");
  const [storeSettings, setStoreSettings] = useState<StoreSettings>({
    menuBackgroundColor: "#ffffff",
    menuTextColor: "#333333",
    menuAccentColor: "#6366f1",
    bannerImages: [],
    primaryBannerIndex: 0,
    deliveryPrices: []
  });

  // Load settings from database when user changes
  useEffect(() => {
    if (user?.id) {
      loadStoreSettings();
    }
  }, [user?.id]);

  const loadStoreSettings = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('store_settings')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading store settings:', error);
        return;
      }

      if (data) {
        setStoreName(data.store_name || "");
        setStoreLogo(data.store_logo || "");
        setStoreGovernorate(data.store_governorate || "");
        setStoreSettings({
          menuBackgroundColor: data.menu_background_color || "#ffffff",
          menuTextColor: data.menu_text_color || "#333333",
          menuAccentColor: data.menu_accent_color || "#6366f1",
          bannerImages: data.banner_images || [],
          primaryBannerIndex: data.primary_banner_index || 0,
          deliveryPrices: (data.delivery_prices as unknown as DeliveryPrice[]) || []
        });
      }
    } catch (error) {
      console.error('Failed to load store settings:', error);
    }
  };

  const updateStore = async (logo: string, name: string, governorate?: string) => {
    setStoreLogo(logo);
    setStoreName(name);
    if (governorate) setStoreGovernorate(governorate);
    
    // Save to database
    if (user?.id) {
      await saveStoreSettings({
        store_name: name,
        store_logo: logo,
        store_governorate: governorate || storeGovernorate
      });
    }
  };

  const updateStoreSettings = async (settings: StoreSettings) => {
    setStoreSettings(settings);
    
    // Save to database
    if (user?.id) {
      await saveStoreSettings({
        menu_background_color: settings.menuBackgroundColor,
        menu_text_color: settings.menuTextColor,
        menu_accent_color: settings.menuAccentColor,
        banner_images: settings.bannerImages,
        primary_banner_index: settings.primaryBannerIndex,
        delivery_prices: settings.deliveryPrices as any
      });
    }
  };

  const saveStoreSettings = async (updates: any) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('store_settings')
        .upsert({
          owner_id: user.id,
          ...updates
        });

      if (error) {
        console.error('Error saving store settings:', error);
      }
    } catch (error) {
      console.error('Failed to save store settings:', error);
    }
  };

  return (
    <StoreContext.Provider value={{ 
      storeName, 
      storeLogo, 
      storeGovernorate,
      storeSettings, 
      updateStore, 
      updateStoreSettings 
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
};
