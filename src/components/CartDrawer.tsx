import { memo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ShoppingCart, Plus, Minus, Trash2, ArrowLeft, ShieldCheck } from "lucide-react";
import { useCartActions, useCartState } from "@/context/CartContext";
import { useNavigate } from "react-router-dom";
import { getCheckoutPath } from "@/lib/storefrontPaths";
import OptimizedImage from "@/components/OptimizedImage";

interface CartDrawerProps {
  children?: React.ReactNode;
  checkoutPath?: string;
  storeSlug?: string | null;
}

const CartDrawer = memo(function CartDrawer({ children, checkoutPath, storeSlug }: CartDrawerProps) {
  const { cartItems, cartTotal, cartCount } = useCartState();
  const { updateQuantity, removeFromCart } = useCartActions();
  const navigate = useNavigate();
  const resolvedCheckout = checkoutPath || getCheckoutPath(storeSlug);

  return (
    <Sheet>
      <SheetTrigger asChild>
        {children || (
          <button className="relative p-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <ShoppingCart className="w-6 h-6" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                {cartCount}
              </span>
            )}
          </button>
        )}
      </SheetTrigger>
      <SheetContent side="left" className="w-[340px] sm:w-[400px] font-arabic bg-card p-0 flex flex-col border-r border-border/40">
        <SheetHeader className="p-5 pb-4 border-b border-border/40">
          <SheetTitle className="text-right text-foreground flex items-center justify-end gap-2 font-bold">
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
              <div className="w-20 h-20 mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <ShoppingCart className="w-9 h-9 text-primary/50" />
              </div>
              <p className="text-base font-bold text-foreground">السلة فارغة</p>
              <p className="text-sm mt-1 text-center leading-relaxed">تصفح المنتجات وأضف ما يعجبك — الدفع عند الاستلام متاح</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {cartItems.map((item, i) => (
                  <div key={`${item.product.id}-${item.selectedSize}-${item.selectedColor}-${i}`} className="flex gap-3 sf-surface hover:bg-muted/60 transition-colors rounded-xl p-3">
                    <OptimizedImage
                      src={item.product.image}
                      alt={item.product.name}
                      variant="thumbnail"
                      className="w-16 h-16 rounded-xl flex-shrink-0 ring-1 ring-border/40"
                      width={64}
                      height={64}
                      loading="lazy"
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
                          className="text-destructive/80 hover:text-destructive p-2 rounded-lg hover:bg-destructive/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                          aria-label="حذف من السلة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-1 bg-card rounded-xl border border-border/60 px-1">
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1, item.selectedSize, item.selectedColor)}
                            className="p-2 text-foreground hover:text-primary min-h-[44px] min-w-[44px] flex items-center justify-center"
                            aria-label="زيادة الكمية"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <span className="text-sm font-semibold w-6 text-center text-foreground">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1, item.selectedSize, item.selectedColor)}
                            className="p-2 text-foreground hover:text-primary min-h-[44px] min-w-[44px] flex items-center justify-center"
                            aria-label="تقليل الكمية"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="sf-divider p-5 space-y-3 bg-card safe-area-bottom">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-lg text-foreground tabular-nums">{cartTotal.toLocaleString()} د.ع</span>
                  <span className="text-sm text-muted-foreground">المجموع</span>
                </div>
                <p className="text-[10px] text-muted-foreground flex items-center justify-end gap-1">
                  <ShieldCheck className="w-3 h-3 text-primary" />
                  دفع آمن — لا يتم خصم المبلغ حتى تأكيد الطلب
                </p>
                <button
                  type="button"
                  className="sf-btn-primary w-full h-12 text-base"
                  onClick={() => navigate(resolvedCheckout)}
                >
                  إتمام الطلب
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
});

export default CartDrawer;
