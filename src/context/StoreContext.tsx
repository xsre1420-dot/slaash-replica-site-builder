
import { createContext, useState, useContext, ReactNode, useEffect } from "react";

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
  updateStore: (logo: string, name: string, governorate?: string) => void;
  updateStoreSettings: (settings: StoreSettings) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider = ({ children }: { children: ReactNode }) => {
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

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('storeSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setStoreSettings(prev => ({ ...prev, ...parsed }));
        
        // Also load store name, logo and governorate if they exist in settings
        if (parsed.storeName) setStoreName(parsed.storeName);
        if (parsed.storeLogo) setStoreLogo(parsed.storeLogo);
        if (parsed.storeGovernorate) setStoreGovernorate(parsed.storeGovernorate);
      } catch (error) {
        console.error('Failed to parse saved settings:', error);
      }
    }
  }, []);

  const updateStore = (logo: string, name: string, governorate?: string) => {
    setStoreLogo(logo);
    setStoreName(name);
    if (governorate) setStoreGovernorate(governorate);
    
    // Save to localStorage
    const currentSettings = JSON.parse(localStorage.getItem('storeSettings') || '{}');
    localStorage.setItem('storeSettings', JSON.stringify({
      ...currentSettings,
      storeName: name,
      storeLogo: logo,
      storeGovernorate: governorate || storeGovernorate
    }));
  };

  const updateStoreSettings = (settings: StoreSettings) => {
    setStoreSettings(settings);
    
    // Save to localStorage
    localStorage.setItem('storeSettings', JSON.stringify({
      ...settings,
      storeName,
      storeLogo,
      storeGovernorate
    }));
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
