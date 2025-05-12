import { createContext, useContext, useState, ReactNode } from "react";
import { CartItem, Product } from "@/types";
import { useToast } from "@/hooks/use-toast";

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const { toast } = useToast();

  const addToCart = (product: Product) => {
    setCartItems((prevItems) => {
      // Check if the item is already in the cart
      const existingItem = prevItems.find(
        (item) => item.product.id === product.id
      );

      if (existingItem) {
        // If it exists, increment the quantity without notification
        return prevItems.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        // If it's new, add it with quantity 1 without notification
        return [...prevItems, { product, quantity: 1 }];
      }
    });
  };

  const removeFromCart = (productId: string) => {
    const product = cartItems.find(item => item.product.id === productId);
    
    setCartItems((prevItems) => 
      prevItems.filter((item) => item.product.id !== productId)
    );

    if (product) {
      toast({
        title: "تمت الإزالة",
        description: `تم إزالة ${product.product.name} من السلة`,
        variant: "default",
        className: "bg-red-50 border-red-200 text-red-800",
      });
    }
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const product = cartItems.find(item => item.product.id === productId);

    setCartItems((prevItems) =>
      prevItems.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );

    if (product) {
      toast({
        title: "تم تحديث الكمية",
        description: `تم تحديث كمية ${product.product.name} إلى ${quantity}`,
        variant: "default",
        className: "bg-blue-50 border-blue-200 text-blue-800",
      });
    }
  };

  const clearCart = () => {
    setCartItems([]);
    toast({
      title: "تم تفريغ السلة",
      description: "تم إزالة جميع المنتجات من السلة",
      variant: "default",
      className: "bg-amber-50 border-amber-200 text-amber-800",
    });
  };

  // Calculate the total price of all items in the cart
  const cartTotal = cartItems.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0
  );

  // Calculate the total number of items in the cart
  const cartCount = cartItems.reduce(
    (count, item) => count + item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartTotal,
        cartCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
