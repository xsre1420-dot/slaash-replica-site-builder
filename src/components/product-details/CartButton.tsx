
import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";

interface CartButtonProps {
  cartCount: number;
}

const CartButton = ({ cartCount }: CartButtonProps) => {
  return (
    <div className="fixed bottom-8 left-8">
      <Link to="/checkout">
        <div className="relative">
          <div className="bg-white rounded-full p-2 shadow-lg">
            <button className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-full transition-all duration-200">
              <ShoppingCart className="w-5 h-5" />
            </button>
          </div>
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shadow-lg">
              {cartCount}
            </span>
          )}
        </div>
      </Link>
    </div>
  );
};

export default CartButton;
