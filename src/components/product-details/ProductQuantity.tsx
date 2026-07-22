import { Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductQuantityProps {
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  max?: number;
}

const ProductQuantity = ({ quantity, onIncrement, onDecrement, max }: ProductQuantityProps) => (
  <div className="inline-flex items-center h-12 rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
    <button
      type="button"
      onClick={onDecrement}
      disabled={quantity <= 1}
      aria-label="تقليل الكمية"
      className={cn(
        'flex h-12 w-12 items-center justify-center text-primary transition-colors',
        'hover:bg-primary/10 disabled:opacity-40 disabled:pointer-events-none'
      )}
    >
      <Minus className="h-4 w-4" strokeWidth={2.5} />
    </button>
    <span className="min-w-[3rem] px-2 text-center text-base font-bold text-foreground tabular-nums">
      {quantity}
    </span>
    <button
      type="button"
      onClick={onIncrement}
      disabled={max != null && quantity >= max}
      aria-label="زيادة الكمية"
      className={cn(
        'flex h-12 w-12 items-center justify-center text-primary transition-colors',
        'hover:bg-primary/10 disabled:opacity-40 disabled:pointer-events-none'
      )}
    >
      <Plus className="h-4 w-4" strokeWidth={2.5} />
    </button>
  </div>
);

export default ProductQuantity;
