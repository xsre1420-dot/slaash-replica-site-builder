import { ArrowRight, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";

interface CheckoutHeaderProps {
  cartCount: number;
}

const CheckoutHeader = ({ cartCount }: CheckoutHeaderProps) => (
  <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
    <div className="flex justify-between items-center p-4 max-w-xl mx-auto">
      <div className="flex items-center gap-2">
        <ShoppingBag className="w-5 h-5 text-primary" />
        {cartCount > 0 && (
          <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-scale-in">
            {cartCount}
          </span>
        )}
      </div>
      <h1 className="text-lg font-bold text-foreground">إتمام الطلب</h1>
      <Link to="/preview" className="p-1 rounded-full hover:bg-muted transition-colors">
        <ArrowRight className="w-5 h-5 text-foreground" />
      </Link>
    </div>
  </div>
);

export default CheckoutHeader;
