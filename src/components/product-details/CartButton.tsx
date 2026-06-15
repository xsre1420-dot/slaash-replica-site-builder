
import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { getCheckoutPath } from "@/lib/storefrontPaths";

interface CartButtonProps {
  cartCount: number;
  totalAmount: number;
  checkoutPath?: string;
  storeSlug?: string | null;
}

const CartButton = ({ cartCount, totalAmount, checkoutPath, storeSlug }: CartButtonProps) => {
  if (cartCount === 0) return null;

  const resolvedCheckout = checkoutPath || getCheckoutPath(storeSlug);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4 pt-2 bg-gradient-to-t from-background via-background/95 to-transparent safe-area-bottom pointer-events-none">
      <Link to={resolvedCheckout} className="block max-w-lg mx-auto pointer-events-auto">
        <div className="bg-primary rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-full bg-primary-foreground/15 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-primary-foreground" />
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold ring-2 ring-primary">
                  {cartCount}
                </span>
              </div>
              <div className="text-left">
                <div className="text-[10px] text-primary-foreground/70">المبلغ الكلي</div>
                <div className="text-base font-bold text-primary-foreground">
                  {totalAmount.toLocaleString()} د.ع
                </div>
              </div>
            </div>
            <span className="text-sm font-bold text-primary-foreground">إتمام الطلب ←</span>
          </div>
        </div>
      </Link>
    </div>
  );
};

export default CartButton;
