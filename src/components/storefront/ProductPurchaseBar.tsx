import { ShoppingCart, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProductPurchaseBarProps {
  price: number;
  quantity: number;
  isOutOfStock: boolean;
  isAdding: boolean;
  checkoutPath: string;
  onAddToCart: () => void;
  onBuyNow: () => void;
  className?: string;
}

/** Sticky mobile purchase bar — always visible on PDP */
const ProductPurchaseBar = ({
  price,
  quantity,
  isOutOfStock,
  isAdding,
  onAddToCart,
  onBuyNow,
  className,
}: ProductPurchaseBarProps) => {
  const lineTotal = price * quantity;

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-card/95 backdrop-blur-xl safe-area-bottom shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.15)]",
        className
      )}
    >
      <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
        <div className="text-right shrink-0 min-w-[88px]">
          <p className="text-[10px] text-muted-foreground">الإجمالي</p>
          <p className="text-base font-bold text-foreground">{lineTotal.toLocaleString()} د.ع</p>
        </div>

        <div className="flex-1 flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isOutOfStock || isAdding}
            onClick={onAddToCart}
            className="flex-1 h-12 rounded-xl font-semibold border-2"
          >
            <ShoppingCart className="w-4 h-4 ml-1" />
            {isOutOfStock ? "نفذ" : "السلة"}
          </Button>
          <Button
            type="button"
            disabled={isOutOfStock || isAdding}
            onClick={onBuyNow}
            className="flex-1 h-12 rounded-xl font-bold bg-primary hover:bg-primary/90"
          >
            <Zap className="w-4 h-4 ml-1" />
            اشتري الآن
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProductPurchaseBar;
