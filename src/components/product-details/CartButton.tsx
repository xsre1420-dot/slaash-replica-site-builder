
import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";

interface CartButtonProps {
  cartCount: number;
}

const CartButton = ({ cartCount }: CartButtonProps) => {
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Link to="/checkout">
        <div className="relative">
          <div className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg"
               style={{ 
                 background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                 boxShadow: '0 8px 25px rgba(99, 102, 241, 0.3)'
               }}>
            <ShoppingCart className="w-6 h-6 text-white" />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold text-indigo-600">
                {cartCount}
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
};

export default CartButton;
