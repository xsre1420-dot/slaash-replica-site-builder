
import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from "react";
import { CartItem, Product } from "@/types";
import { getAvailableQty } from "@/utils/inventoryUtils";
import { toast } from "sonner";

interface CartContextType {
  cartItems: CartItem[];
  storeOwnerId: string | null;
  setStoreOwner: (ownerId: string) => void;
  addToCart: (product: Product, selectedSize?: string, selectedColor?: string, quantity?: number) => void;
  removeFromCart: (productId: string, selectedSize?: string, selectedColor?: string) => void;
  updateQuantity: (productId: string, quantity: number, selectedSize?: string, selectedColor?: string) => void;
  replaceCartItems: (items: CartItem[]) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;
  getMaxQuantity: (product: Product, selectedSize?: string, selectedColor?: string) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const cartStorageKey = (ownerId: string) => `cart:${ownerId}`;
const CART_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const loadStoredCart = (ownerId: string | null): CartItem[] => {
  if (!ownerId) return [];
  try {
    const raw = sessionStorage.getItem(cartStorageKey(ownerId));
    if (raw) return JSON.parse(raw);

    const backupRaw = localStorage.getItem(`${cartStorageKey(ownerId)}:backup`);
    if (backupRaw) {
      const parsed = JSON.parse(backupRaw);
      if (parsed.expiresAt > Date.now()) return parsed.items || [];
      localStorage.removeItem(`${cartStorageKey(ownerId)}:backup`);
    }
    return [];
  } catch {
    return [];
  }
};

const persistCart = (ownerId: string | null, items: CartItem[]) => {
  if (!ownerId) return;
  try {
    const serialized = JSON.stringify(items);
    sessionStorage.setItem(cartStorageKey(ownerId), serialized);
    localStorage.setItem(
      `${cartStorageKey(ownerId)}:backup`,
      JSON.stringify({ items, expiresAt: Date.now() + CART_TTL_MS })
    );
  } catch {
    /* ignore quota errors */
  }
};

const getCartQtyForVariant = (
  items: CartItem[],
  productId: string,
  size?: string,
  color?: string
): number => {
  const item = items.find(
    (i) =>
      i.product.id === productId &&
      i.selectedSize === size &&
      i.selectedColor === color
  );
  return item?.quantity ?? 0;
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [storeOwnerId, setStoreOwnerId] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const storeOwnerIdRef = useRef<string | null>(null);
  const cartItemsRef = useRef<CartItem[]>([]);

  useEffect(() => {
    storeOwnerIdRef.current = storeOwnerId;
  }, [storeOwnerId]);

  useEffect(() => {
    cartItemsRef.current = cartItems;
  }, [cartItems]);

  const setStoreOwner = useCallback((ownerId: string) => {
    const prev = storeOwnerIdRef.current;
    if (prev === ownerId) return;

    if (prev) {
      persistCart(prev, cartItemsRef.current);
    }

    const stored = loadStoredCart(ownerId);
    setStoreOwnerId(ownerId);
    setCartItems(stored);
  }, []);

  useEffect(() => {
    persistCart(storeOwnerId, cartItems);
  }, [cartItems, storeOwnerId]);

  const getMaxQuantity = useCallback(
    (product: Product, selectedSize?: string, selectedColor?: string) =>
      getAvailableQty(product, selectedSize, selectedColor),
    []
  );

  const addToCart = useCallback((product: Product, selectedSize?: string, selectedColor?: string, quantity = 1) => {
    if (quantity <= 0) return;

    setCartItems((prevItems) => {
      const available = getAvailableQty(product, selectedSize, selectedColor);
      if (available <= 0) {
        toast.error("المنتج غير متوفر في المخزون");
        return prevItems;
      }

      const existingQty = getCartQtyForVariant(prevItems, product.id, selectedSize, selectedColor);
      const newQty = existingQty + quantity;

      if (newQty > available) {
        toast.error(`الكمية المتاحة ${available} فقط`);
        return prevItems;
      }

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
            ? { ...item, quantity: newQty, product }
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

    setCartItems((prevItems) => {
      const item = prevItems.find(
        (i) =>
          i.product.id === productId &&
          i.selectedSize === selectedSize &&
          i.selectedColor === selectedColor
      );
      if (!item) return prevItems;

      const available = getAvailableQty(item.product, selectedSize, selectedColor);
      const capped = Math.min(quantity, available);

      if (capped < quantity) {
        toast.error(`الكمية المتاحة ${available} فقط`);
      }

      return prevItems.map((i) =>
        i.product.id === productId &&
        i.selectedSize === selectedSize &&
        i.selectedColor === selectedColor
          ? { ...i, quantity: capped }
          : i
      );
    });
  }, []);

  const replaceCartItems = useCallback((items: CartItem[]) => {
    setCartItems(items);
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
    setStoreOwnerId((prev) => {
      if (prev) {
        sessionStorage.removeItem(cartStorageKey(prev));
        localStorage.removeItem(`${cartStorageKey(prev)}:backup`);
      }
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
      replaceCartItems,
      clearCart,
      cartTotal,
      cartCount,
      getMaxQuantity,
    }),
    [cartItems, storeOwnerId, setStoreOwner, addToCart, removeFromCart, updateQuantity, replaceCartItems, clearCart, cartTotal, cartCount, getMaxQuantity]
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
