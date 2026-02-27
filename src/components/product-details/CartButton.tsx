
import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";

interface CartButtonProps {
  cartCount: number;
  totalAmount: number;
}

const CartButton = ({ cartCount, totalAmount }: CartButtonProps) => {
  if (cartCount === 0) return null;
  
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-2 bg-gradient-to-t from-background via-background to-transparent animate-fade-in">
      <Link to="/checkout" className="block max-w-md mx-auto">
        <div className="bg-primary rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingCart className="w-5 h-5 text-primary-foreground" />
                <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">
                  {cartCount}
                </span>
              </div>
              <div className="text-left">
                <div className="text-xs text-primary-foreground/60">المبلغ الكلي</div>
                <div className="text-base font-bold text-primary-foreground">
                  {totalAmount.toLocaleString()} د.ع
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-primary-foreground font-bold text-sm">
              <span>عرض السلة</span>
              <svg className="w-4 h-4 transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
};

export default CartButton;
