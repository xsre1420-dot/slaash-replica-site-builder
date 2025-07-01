
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
  storeSettings: StoreSettings;
  updateStore: (logo: string, name: string) => void;
  updateStoreSettings: (settings: StoreSettings) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [storeName, setStoreName] = useState("نمو");
  const [storeLogo, setStoreLogo] = useState("/lovable-uploads/c85f9015-cfa6-476e-9165-72dfbfb5c4b0.png");
  const [storeSettings, setStoreSettings] = useState<StoreSettings>({
    menuBackgroundColor: "#ffffff",
    menuTextColor: "#333333",
    menuAccentColor: "#008080",
    bannerImages: [],
    primaryBannerIndex: 0,
    deliveryPrices: [{ governorate: "بغداد", price: 2000 }]
  });

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('storeSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setStoreSettings(prev => ({ ...prev, ...parsed }));
        
        // Also load store name and logo if they exist in settings
        if (parsed.storeName) setStoreName(parsed.storeName);
        if (parsed.storeLogo) setStoreLogo(parsed.storeLogo);
      } catch (error) {
        console.error('Failed to parse saved settings:', error);
      }
    }
  }, []);

  const updateStore = (logo: string, name: string) => {
    setStoreLogo(logo);
    setStoreName(name);
    
    // Save to localStorage
    const currentSettings = JSON.parse(localStorage.getItem('storeSettings') || '{}');
    localStorage.setItem('storeSettings', JSON.stringify({
      ...currentSettings,
      storeName: name,
      storeLogo: logo
    }));
  };

  const updateStoreSettings = (settings: StoreSettings) => {
    setStoreSettings(settings);
    
    // Save to localStorage
    localStorage.setItem('storeSettings', JSON.stringify({
      ...settings,
      storeName,
      storeLogo
    }));
  };

  return (
    <StoreContext.Provider value={{ 
      storeName, 
      storeLogo, 
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
