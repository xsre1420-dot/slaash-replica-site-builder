
import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";

interface CartButtonProps {
  cartCount: number;
}

const CartButton = ({ cartCount }: CartButtonProps) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <Link to="/checkout">
        <div className="bg-primary h-16 flex items-center justify-center relative rounded-t-3xl">
          {/* Circular icon in the center */}
          <div className="absolute -top-6 bg-primary rounded-full p-4 border-4 border-white shadow-lg">
            <ShoppingCart className="w-6 h-6 text-white" />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-white text-primary rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
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
