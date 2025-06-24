
import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";

interface CartButtonProps {
  cartCount: number;
}

const CartButton = ({ cartCount }: CartButtonProps) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <Link to="/checkout">
        <div className="bg-red-600 text-white p-4 flex items-center justify-center relative shadow-lg">
          <ShoppingCart className="w-6 h-6" />
          <span className="mr-2 font-semibold">السلة</span>
          {cartCount > 0 && (
            <span className="absolute top-1 right-4 bg-white text-red-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
              {cartCount}
            </span>
          )}
        </div>
      </Link>
    </div>
  );
};

export default CartButton;
