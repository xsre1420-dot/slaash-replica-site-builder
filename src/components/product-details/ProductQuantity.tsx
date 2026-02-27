
import { Button } from "@/components/ui/button";
import { Plus, Minus } from "lucide-react";

interface ProductQuantityProps {
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
}

const ProductQuantity = ({ quantity, onIncrement, onDecrement }: ProductQuantityProps) => {
  return (
    <div className="flex items-center border-2 border-border rounded-xl overflow-hidden bg-muted/50">
      <Button 
        variant="ghost" 
        size="icon" 
        className="rounded-none h-10 w-10 hover:bg-muted text-foreground" 
        onClick={onIncrement}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
      <span className="mx-4 text-lg font-bold min-w-[2rem] text-center text-foreground">{quantity}</span>
      <Button 
        variant="ghost" 
        size="icon" 
        className="rounded-none h-10 w-10 hover:bg-muted text-foreground" 
        onClick={onDecrement}
        disabled={quantity <= 1}
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};

export default ProductQuantity;
