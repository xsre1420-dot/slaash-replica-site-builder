
import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";

interface CartButtonProps {
  cartCount: number;
  totalAmount: number;
}

const CartButton = ({ cartCount, totalAmount }: CartButtonProps) => {
  if (cartCount === 0) return null;
  
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-2 bg-gradient-to-t from-white via-white to-transparent">
      <Link to="/checkout">
        <div className="bg-black rounded-full shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="relative bg-gray-800 rounded-full p-3">
                <ShoppingCart className="w-6 h-6 text-white" />
                <span className="absolute -top-1 -right-1 bg-yellow-400 text-black rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                  {cartCount}
                </span>
              </div>
              <div className="text-left">
                <div className="text-xs text-gray-400">المبلغ الكلي</div>
                <div className="text-lg font-bold text-white" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  IQD {totalAmount.toLocaleString()}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-white font-bold text-base">
              <span style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>عرض السلة</span>
              <svg className="w-5 h-5 transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
