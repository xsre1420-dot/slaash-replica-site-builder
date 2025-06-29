
import { Button } from "@/components/ui/button";
import { Plus, Minus } from "lucide-react";

interface ProductQuantityProps {
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
}

const ProductQuantity = ({ quantity, onIncrement, onDecrement }: ProductQuantityProps) => {
  return (
    <div className="flex items-center border-2 border-gray-200 rounded-full overflow-hidden bg-gray-50">
      <Button 
        variant="ghost" 
        size="icon" 
        className="rounded-full h-10 w-10 hover:bg-gray-100 text-gray-600" 
        onClick={onIncrement}
      >
        <Plus className="h-3 w-3" />
      </Button>
      <span className="mx-6 text-xl font-semibold min-w-[2rem] text-center text-gray-700">{quantity}</span>
      <Button 
        variant="ghost" 
        size="icon" 
        className="rounded-full h-10 w-10 hover:bg-gray-100 text-gray-600" 
        onClick={onDecrement}
        disabled={quantity <= 1}
      >
        <Minus className="h-3 w-3" />
      </Button>
    </div>
  );
};

export default ProductQuantity;
