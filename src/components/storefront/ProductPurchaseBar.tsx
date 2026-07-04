import { ShoppingCart, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Product } from '@/types';
import ProductPriceDisplay from '@/components/storefront/ProductPriceDisplay';

interface ProductPurchaseBarProps {
  product: Product;
  quantity: number;
  isOutOfStock: boolean;
  isAdding: boolean;
  onAddToCart: () => void;
  onBuyNow: () => void;
  className?: string;
}

/** Sticky mobile purchase bar — theme-aware */
const ProductPurchaseBar = ({
  product,
  quantity,
  isOutOfStock,
  isAdding,
  onAddToCart,
  onBuyNow,
  className,
}: ProductPurchaseBarProps) => (
  <div
    className={cn(
      'fixed bottom-0 inset-x-0 z-50 border-t border-border/15 bg-card/95 backdrop-blur-xl safe-area-bottom shadow-[0_-8px_32px_-8px_hsl(var(--primary)/0.2)]',
      className
    )}
  >
    <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
      <div className="shrink-0">
        <ProductPriceDisplay product={product} size="sm" align="end" showBadge={false} />
        {quantity > 1 && (
          <p className="text-[10px] text-muted-foreground text-right mt-0.5 tabular-nums">× {quantity}</p>
        )}
      </div>

      <div className="flex-1 flex gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={isOutOfStock || isAdding}
          onClick={onAddToCart}
          className="flex-1 h-11 rounded-xl font-semibold border border-primary/25 text-primary hover:bg-primary/5 active:scale-[0.98] transition-transform"
        >
          <ShoppingCart className="w-4 h-4 ml-1" />
          {isOutOfStock ? 'نفذ' : 'السلة'}
        </Button>
        <Button
          type="button"
          disabled={isOutOfStock || isAdding}
          onClick={onBuyNow}
          className="flex-1 h-11 rounded-xl font-bold bg-primary text-primary-foreground shadow-md shadow-primary/20 active:scale-[0.98] transition-transform"
        >
          <Zap className="w-4 h-4 ml-1" />
          اشتري الآن
        </Button>
      </div>
    </div>
  </div>
);

export default ProductPurchaseBar;
