import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Plus, Minus, Trash2, ArrowLeft } from "lucide-react";
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
      <SheetContent side="left" className="w-[340px] sm:w-[400px] font-arabic bg-card p-0 flex flex-col">
        <SheetHeader className="p-5 pb-4 border-b border-border/50">
          <SheetTitle className="text-right text-foreground flex items-center justify-end gap-2">
            <span>سلة المشتريات</span>
            {cartCount > 0 && (
              <span className="bg-primary/10 text-primary text-xs font-bold rounded-full px-2 py-0.5">
                {cartCount}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          {cartItems.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground px-6">
              <div className="w-20 h-20 mb-4 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center ring-1 ring-primary/10">
                <ShoppingCart className="w-9 h-9 text-primary/50" />
              </div>
              <p className="text-base font-bold text-foreground">السلة فارغة</p>
              <p className="text-sm mt-1 text-center">أضف منتجات لتبدأ التسوق</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {cartItems.map((item, i) => (
                  <div key={`${item.product.id}-${item.selectedSize}-${item.selectedColor}-${i}`} className="flex gap-3 bg-muted/40 hover:bg-muted/60 transition-colors rounded-2xl p-3 group">
                    <img
                      src={item.product.image}
                      alt={item.product.name}
                      className="w-16 h-16 rounded-xl object-cover flex-shrink-0 ring-1 ring-border/40"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-foreground text-right truncate">{item.product.name}</h4>
                      {(item.selectedSize || item.selectedColor) && (
                        <p className="text-[10px] text-muted-foreground text-right mt-0.5">
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
                          className="text-destructive/80 hover:text-destructive p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="flex items-center gap-1 bg-card rounded-lg border border-border/60 px-1">
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1, item.selectedSize, item.selectedColor)}
                            className="p-1 text-foreground hover:text-primary"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-sm font-semibold w-6 text-center text-foreground">{item.quantity}</span>
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

              <div className="border-t border-border/60 p-5 space-y-3 bg-card">
                <div className="flex items-center justify-between text-muted-foreground text-sm">
                  <span className="font-semibold text-foreground">{cartTotal.toLocaleString()} د.ع</span>
                  <span>المجموع</span>
                </div>
                <Button
                  className="w-full bg-gradient-to-r from-primary to-primary/85 hover:from-primary/90 hover:to-primary/80 text-primary-foreground rounded-xl py-6 text-base font-bold shadow-md shadow-primary/20"
                  onClick={() => navigate("/checkout")}
                >
                  إتمام الطلب
                  <ArrowLeft className="w-4 h-4 mr-2" />
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
