
import { createContext, useContext, useState, ReactNode } from "react";
import { CartItem, Product } from "@/types";
import { useToast } from "@/hooks/use-toast";

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: Product, selectedSize?: string, selectedColor?: string) => void;
  removeFromCart: (productId: string, selectedSize?: string, selectedColor?: string) => void;
  updateQuantity: (productId: string, quantity: number, selectedSize?: string, selectedColor?: string) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const { toast } = useToast();

  const addToCart = (product: Product, selectedSize?: string, selectedColor?: string) => {
    setCartItems((prevItems) => {
      // Check if the item with same product, size, and color is already in the cart
      const existingItem = prevItems.find(
        (item) => item.product.id === product.id && 
                  item.selectedSize === selectedSize && 
                  item.selectedColor === selectedColor
      );

      if (existingItem) {
        // If it exists, increment the quantity
        return prevItems.map((item) =>
          item.product.id === product.id && 
          item.selectedSize === selectedSize && 
          item.selectedColor === selectedColor
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        // If it's new, add it with quantity 1
        return [...prevItems, { product, quantity: 1, selectedSize, selectedColor }];
      }
    });

    // No notification needed for adding to cart
  };

  const removeFromCart = (productId: string, selectedSize?: string, selectedColor?: string) => {
    const product = cartItems.find(item => 
      item.product.id === productId && 
      item.selectedSize === selectedSize && 
      item.selectedColor === selectedColor
    );
    
    setCartItems((prevItems) => 
      prevItems.filter((item) => !(
        item.product.id === productId && 
        item.selectedSize === selectedSize && 
        item.selectedColor === selectedColor
      ))
    );

    // No notification needed for removing from cart
  };

  const updateQuantity = (productId: string, quantity: number, selectedSize?: string, selectedColor?: string) => {
    if (quantity <= 0) {
      removeFromCart(productId, selectedSize, selectedColor);
      return;
    }

    const product = cartItems.find(item => 
      item.product.id === productId && 
      item.selectedSize === selectedSize && 
      item.selectedColor === selectedColor
    );

    setCartItems((prevItems) =>
      prevItems.map((item) =>
        item.product.id === productId && 
        item.selectedSize === selectedSize && 
        item.selectedColor === selectedColor
          ? { ...item, quantity } 
          : item
      )
    );

    // No notification needed for updating quantity
  };

  const clearCart = () => {
    setCartItems([]);
    // No notification needed for clearing cart
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
