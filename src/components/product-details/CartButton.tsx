
import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";

interface CartButtonProps {
  cartCount: number;
}

const CartButton = ({ cartCount }: CartButtonProps) => {
  return (
    <div className="fixed bottom-8 left-8">
      <Link to="/checkout">
        <button className="bg-red-600 hover:bg-red-700 text-white p-4 rounded-full shadow-lg relative transition-all duration-200">
          <ShoppingCart className="w-5 h-5" />
          {cartCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-white text-red-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
              {cartCount}
            </span>
          )}
        </button>
      </Link>
    </div>
  );
};

export default CartButton;
