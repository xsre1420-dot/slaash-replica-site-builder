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
    } else {
      // Reset to defaults when user logs out
      setStoreName("");
      setStoreLogo("");
      setStoreGovernorate("");
      setStoreSettings({
        menuBackgroundColor: "#ffffff",
        menuTextColor: "#333333",
        menuAccentColor: "#6366f1",
        bannerImages: [],
        primaryBannerIndex: 0,
        deliveryPrices: []
      });
    }
  }, [user?.id]);

  const loadStoreSettings = async () => {
    if (!user?.id) return;

    try {
      console.log('Loading store settings for user:', user.id);
      const { data, error } = await supabase
        .from('store_settings')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading store settings:', error);
        return;
      }

      console.log('Store settings loaded:', data);
      
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
      } else {
        console.log('No store settings found, creating default ones');
        // Create default settings if none exist
        await saveStoreSettings({
          store_name: "",
          store_logo: "",
          store_governorate: "",
          menu_background_color: "#ffffff",
          menu_text_color: "#333333",
          menu_accent_color: "#6366f1",
          banner_images: [],
          primary_banner_index: 0,
          delivery_prices: []
        });
      }
    } catch (error) {
      console.error('Failed to load store settings:', error);
    }
  };

  const updateStore = async (logo: string, name: string, governorate?: string) => {
    console.log('Updating store:', { logo, name, governorate });
    setStoreLogo(logo);
    setStoreName(name);
    if (governorate !== undefined) setStoreGovernorate(governorate);
    
    // Save to database immediately
    if (user?.id) {
      try {
        await saveStoreSettings({
          store_name: name,
          store_logo: logo,
          store_governorate: governorate || storeGovernorate
        });
      } catch (error) {
        console.error('Failed to save store data:', error);
      }
    }
  };

  const updateStoreSettings = async (settings: StoreSettings) => {
    console.log('Updating store settings:', settings);
    setStoreSettings(settings);
    
    // Save to database immediately
    if (user?.id) {
      try {
        await saveStoreSettings({
          menu_background_color: settings.menuBackgroundColor,
          menu_text_color: settings.menuTextColor,
          menu_accent_color: settings.menuAccentColor,
          banner_images: settings.bannerImages,
          primary_banner_index: settings.primaryBannerIndex,
          delivery_prices: settings.deliveryPrices as any
        });
      } catch (error) {
        console.error('Failed to save store settings:', error);
      }
    }
  };

  const saveStoreSettings = async (updates: any) => {
    if (!user?.id) return;

    try {
      console.log('Saving store settings:', updates);
      
      // First try to update existing record
      const { data: existingSettings, error: selectError } = await supabase
        .from('store_settings')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (selectError) {
        console.error('Error checking existing settings:', selectError);
        return;
      }

      if (existingSettings) {
        // Update existing record
        const { error } = await supabase
          .from('store_settings')
          .update(updates)
          .eq('owner_id', user.id);

        if (error) {
          console.error('Error updating store settings:', error);
        } else {
          console.log('Store settings updated successfully');
        }
      } else {
        // Insert new record
        const { error } = await supabase
          .from('store_settings')
          .insert({
            owner_id: user.id,
            ...updates
          });

        if (error) {
          console.error('Error inserting store settings:', error);
        } else {
          console.log('Store settings inserted successfully');
        }
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