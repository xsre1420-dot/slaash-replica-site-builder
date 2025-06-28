
import { createContext, useState, useContext, ReactNode } from "react";

interface StoreSettings {
  menuBackgroundColor: string;
  menuTextColor: string;
  menuAccentColor: string;
  bannerImages: string[];
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
    bannerImages: []
  });

  const updateStore = (logo: string, name: string) => {
    setStoreLogo(logo);
    setStoreName(name);
  };

  const updateStoreSettings = (settings: StoreSettings) => {
    setStoreSettings(settings);
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
