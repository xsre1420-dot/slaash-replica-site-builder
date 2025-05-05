
import { createContext, useState, useContext, ReactNode } from "react";

interface StoreContextType {
  storeName: string;
  storeLogo: string;
  updateStore: (logo: string, name: string) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [storeName, setStoreName] = useState("نمو");
  const [storeLogo, setStoreLogo] = useState("/lovable-uploads/c85f9015-cfa6-476e-9165-72dfbfb5c4b0.png");

  const updateStore = (logo: string, name: string) => {
    setStoreLogo(logo);
    setStoreName(name);
  };

  return (
    <StoreContext.Provider value={{ storeName, storeLogo, updateStore }}>
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
