
import { Button } from "@/components/ui/button";
import { Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductQuantityProps {
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
}

const ProductQuantity = ({ quantity, onIncrement, onDecrement }: ProductQuantityProps) => {
  return (
    <div className="inline-flex items-center rounded-xl overflow-hidden border border-border/30">
      <Button
        variant="ghost"
        size="icon"
        className="rounded-none h-10 w-10 hover:bg-primary/10 text-primary"
        onClick={onDecrement}
        disabled={quantity <= 1}
        aria-label="تقليل الكمية"
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <span className="mx-3 text-base font-semibold min-w-[2rem] text-center text-foreground tabular-nums">
        {quantity}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className={cn("rounded-none h-10 w-10 hover:bg-primary/10 text-primary")}
        onClick={onIncrement}
        aria-label="زيادة الكمية"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};

export default ProductQuantity;
