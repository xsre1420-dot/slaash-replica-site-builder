import { ArrowRight, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";

interface CheckoutHeaderProps {
  cartCount: number;
}

const CheckoutHeader = ({ cartCount }: CheckoutHeaderProps) => (
  <div className="sticky top-0 z-40 bg-card/90 backdrop-blur-xl border-b border-border/50">
    <div className="flex justify-between items-center p-3 max-w-xl mx-auto">
      <div className="flex items-center gap-2 w-20">
        <div className="relative w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <ShoppingBag className="w-4 h-4 text-primary" />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center animate-scale-in shadow-sm">
              {cartCount}
            </span>
          )}
        </div>
      </div>
      <h1 className="text-base font-bold text-foreground">إتمام الطلب</h1>
      <div className="w-20 flex justify-end">
        <Link to="/preview" className="w-10 h-10 rounded-full bg-muted hover:bg-muted/70 flex items-center justify-center transition-colors">
          <ArrowRight className="w-5 h-5 text-foreground" />
        </Link>
      </div>
    </div>
  </div>
);

export default CheckoutHeader;
