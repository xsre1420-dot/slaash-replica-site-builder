
import { Button } from "@/components/ui/button";
import { Plus, Minus } from "lucide-react";

interface ProductQuantityProps {
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
}

const ProductQuantity = ({ quantity, onIncrement, onDecrement }: ProductQuantityProps) => {
  return (
    <div className="flex items-center border rounded-full overflow-hidden">
      <Button 
        variant="ghost" 
        size="icon" 
        className="rounded-full h-10 w-10" 
        onClick={onIncrement}
      >
        <Plus className="h-5 w-5" />
      </Button>
      <span className="mx-4 text-lg font-medium">{quantity}</span>
      <Button 
        variant="ghost" 
        size="icon" 
        className="rounded-full h-10 w-10" 
        onClick={onDecrement}
        disabled={quantity <= 1}
      >
        <Minus className="h-5 w-5" />
      </Button>
    </div>
  );
};

export default ProductQuantity;
