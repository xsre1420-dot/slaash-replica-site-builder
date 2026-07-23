import { Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductQuantityProps {
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  max?: number;
}

const ProductQuantity = ({ quantity, onIncrement, onDecrement, max }: ProductQuantityProps) => (
  <div className="inline-flex items-center h-11 rounded-xl border border-border/40 bg-card overflow-hidden">
    <button
      type="button"
      onClick={onDecrement}
      disabled={quantity <= 1}
      aria-label="تقليل الكمية"
      className={cn(
        'sf-product-qty-btn flex h-11 w-11 items-center justify-center text-primary',
        'disabled:opacity-35 disabled:pointer-events-none'
      )}
    >
      <Minus className="h-4 w-4" strokeWidth={2.5} />
    </button>
    <span className="min-w-[2.75rem] px-2 text-center text-sm font-bold text-foreground tabular-nums">
      {quantity}
    </span>
    <button
      type="button"
      onClick={onIncrement}
      disabled={max != null && quantity >= max}
      aria-label="زيادة الكمية"
      className={cn(
        'sf-product-qty-btn flex h-11 w-11 items-center justify-center text-primary',
        'disabled:opacity-35 disabled:pointer-events-none'
      )}
    >
      <Plus className="h-4 w-4" strokeWidth={2.5} />
    </button>
  </div>
);

export default ProductQuantity;
