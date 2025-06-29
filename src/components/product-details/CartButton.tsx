
import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";

interface CartButtonProps {
  cartCount: number;
}

const CartButton = ({ cartCount }: CartButtonProps) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <Link to="/checkout">
        <div className="h-16 flex items-center justify-center relative rounded-t-3xl"
             style={{ background: 'linear-gradient(135deg, #ff6b35, #f7931e, #ec4899)' }}>
          {/* Circular icon in the center */}
          <div className="absolute -top-6 rounded-full p-4 border-4 border-white shadow-lg"
               style={{ background: 'linear-gradient(135deg, #ff6b35, #f7931e, #ec4899)' }}>
            <ShoppingCart className="w-6 h-6 text-white" />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold"
                    style={{ color: '#ff6b35' }}>
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
