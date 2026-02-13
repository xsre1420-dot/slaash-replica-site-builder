import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Plus, Minus, Trash2 } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useNavigate } from "react-router-dom";

interface CartDrawerProps {
  children?: React.ReactNode;
}

export default function CartDrawer({ children }: CartDrawerProps) {
  const { cartItems, cartTotal, cartCount, updateQuantity, removeFromCart } = useCart();
  const navigate = useNavigate();

  return (
    <Sheet>
      <SheetTrigger asChild>
        {children || (
          <button className="relative p-2">
            <ShoppingCart className="w-6 h-6" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                {cartCount}
              </span>
            )}
          </button>
        )}
      </SheetTrigger>
      <SheetContent side="left" className="w-[340px] sm:w-[400px] font-arabic bg-card">
        <SheetHeader>
          <SheetTitle className="text-right text-foreground">سلة المشتريات ({cartCount})</SheetTitle>
        </SheetHeader>

        <div className="mt-6 flex flex-col h-[calc(100vh-200px)]">
          {cartItems.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <ShoppingCart className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg font-medium">السلة فارغة</p>
              <p className="text-sm mt-1">أضف منتجات للبدء</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {cartItems.map((item, i) => (
                  <div key={`${item.product.id}-${item.selectedSize}-${item.selectedColor}-${i}`} className="flex gap-3 bg-muted/50 rounded-xl p-3">
                    <img
                      src={item.product.image}
                      alt={item.product.name}
                      className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-foreground text-right truncate">{item.product.name}</h4>
                      {(item.selectedSize || item.selectedColor) && (
                        <p className="text-xs text-muted-foreground text-right mt-0.5">
                          {item.selectedSize && `${item.selectedSize}`}
                          {item.selectedSize && item.selectedColor && " • "}
                          {item.selectedColor && `${item.selectedColor}`}
                        </p>
                      )}
                      <p className="text-sm font-bold text-primary text-right mt-1">
                        {(item.product.price * item.quantity).toLocaleString()} د.ع
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <button
                          onClick={() => removeFromCart(item.product.id, item.selectedSize, item.selectedColor)}
                          className="text-destructive hover:text-destructive/80 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="flex items-center gap-2 bg-card rounded-lg border border-border px-1">
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1, item.selectedSize, item.selectedColor)}
                            className="p-1 text-foreground hover:text-primary"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-sm font-medium w-6 text-center text-foreground">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1, item.selectedSize, item.selectedColor)}
                            className="p-1 text-foreground hover:text-primary"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="border-t border-border pt-4 mt-4 space-y-3">
                <div className="flex items-center justify-between text-foreground">
                  <span className="text-lg font-bold">{cartTotal.toLocaleString()} د.ع</span>
                  <span className="font-medium">المجموع</span>
                </div>
                <Button
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl py-3 text-base font-semibold"
                  onClick={() => navigate("/checkout")}
                >
                  إتمام الطلب
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
