
import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import { CartItem, Product } from "@/types";

interface CartContextType {
  cartItems: CartItem[];
  storeOwnerId: string | null;
  setStoreOwner: (ownerId: string) => void;
  addToCart: (product: Product, selectedSize?: string, selectedColor?: string, quantity?: number) => void;
  removeFromCart: (productId: string, selectedSize?: string, selectedColor?: string) => void;
  updateQuantity: (productId: string, quantity: number, selectedSize?: string, selectedColor?: string) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const cartStorageKey = (ownerId: string) => `cart:${ownerId}`;

const loadStoredCart = (ownerId: string | null): CartItem[] => {
  if (!ownerId) return [];
  try {
    const raw = sessionStorage.getItem(cartStorageKey(ownerId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const persistCart = (ownerId: string | null, items: CartItem[]) => {
  if (!ownerId) return;
  try {
    sessionStorage.setItem(cartStorageKey(ownerId), JSON.stringify(items));
  } catch {
    /* ignore quota errors */
  }
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [storeOwnerId, setStoreOwnerId] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const setStoreOwner = useCallback((ownerId: string) => {
    setStoreOwnerId((prev) => {
      if (prev && prev !== ownerId) {
        persistCart(prev, []);
      }
      const stored = loadStoredCart(ownerId);
      setCartItems(stored);
      return ownerId;
    });
  }, []);

  useEffect(() => {
    persistCart(storeOwnerId, cartItems);
  }, [cartItems, storeOwnerId]);

  const addToCart = useCallback((product: Product, selectedSize?: string, selectedColor?: string, quantity = 1) => {
    if (quantity <= 0) return;

    setCartItems((prevItems) => {
      const existingItem = prevItems.find(
        (item) =>
          item.product.id === product.id &&
          item.selectedSize === selectedSize &&
          item.selectedColor === selectedColor
      );

      if (existingItem) {
        return prevItems.map((item) =>
          item.product.id === product.id &&
          item.selectedSize === selectedSize &&
          item.selectedColor === selectedColor
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }

      return [...prevItems, { product, quantity, selectedSize, selectedColor }];
    });
  }, []);

  const removeFromCart = useCallback((productId: string, selectedSize?: string, selectedColor?: string) => {
    setCartItems((prevItems) =>
      prevItems.filter(
        (item) =>
          !(
            item.product.id === productId &&
            item.selectedSize === selectedSize &&
            item.selectedColor === selectedColor
          )
      )
    );
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number, selectedSize?: string, selectedColor?: string) => {
    if (quantity <= 0) {
      setCartItems((prevItems) =>
        prevItems.filter(
          (item) =>
            !(
              item.product.id === productId &&
              item.selectedSize === selectedSize &&
              item.selectedColor === selectedColor
            )
        )
      );
      return;
    }

    setCartItems((prevItems) =>
      prevItems.map((item) =>
        item.product.id === productId &&
        item.selectedSize === selectedSize &&
        item.selectedColor === selectedColor
          ? { ...item, quantity }
          : item
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
    setStoreOwnerId((prev) => {
      if (prev) sessionStorage.removeItem(cartStorageKey(prev));
      return prev;
    });
  }, []);

  const cartTotal = useMemo(
    () => cartItems.reduce((total, item) => total + item.product.price * item.quantity, 0),
    [cartItems]
  );

  const cartCount = useMemo(
    () => cartItems.reduce((count, item) => count + item.quantity, 0),
    [cartItems]
  );

  const value = useMemo(
    () => ({
      cartItems,
      storeOwnerId,
      setStoreOwner,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      cartTotal,
      cartCount,
    }),
    [cartItems, storeOwnerId, setStoreOwner, addToCart, removeFromCart, updateQuantity, clearCart, cartTotal, cartCount]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
