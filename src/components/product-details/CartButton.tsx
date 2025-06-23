
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
          <div className="bg-red-600 rounded-full p-4 shadow-lg border-4 border-white">
            <ShoppingCart className="w-6 h-6 text-white" />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-white text-red-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold border-2 border-red-600">
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
