
import { Button } from "@/components/ui/button";
import { Plus, Minus } from "lucide-react";

interface ProductQuantityProps {
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
}

const ProductQuantity = ({ quantity, onIncrement, onDecrement }: ProductQuantityProps) => {
  return (
    <div className="flex items-center border rounded-full overflow-hidden bg-gray-50">
      <Button 
        variant="ghost" 
        size="icon" 
        className="rounded-full h-10 w-10 hover:bg-red-50" 
        onClick={onIncrement}
      >
        <Plus className="h-3 w-3" />
      </Button>
      <span className="mx-6 text-xl font-semibold min-w-[2rem] text-center">{quantity}</span>
      <Button 
        variant="ghost" 
        size="icon" 
        className="rounded-full h-10 w-10 hover:bg-red-50" 
        onClick={onDecrement}
        disabled={quantity <= 1}
      >
        <Minus className="h-3 w-3" />
      </Button>
    </div>
  );
};

export default ProductQuantity;
