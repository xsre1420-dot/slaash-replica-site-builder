
import { Button } from "@/components/ui/button";
import { Plus, Minus } from "lucide-react";

interface ProductQuantityProps {
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
}

const ProductQuantity = ({ quantity, onIncrement, onDecrement }: ProductQuantityProps) => {
  return (
    <div className="flex items-center border-2 border-orange-200 rounded-full overflow-hidden bg-gradient-to-r from-orange-50 to-pink-50">
      <Button 
        variant="ghost" 
        size="icon" 
        className="rounded-full h-10 w-10 hover:bg-orange-100 text-orange-600" 
        onClick={onIncrement}
      >
        <Plus className="h-3 w-3" />
      </Button>
      <span className="mx-6 text-xl font-semibold min-w-[2rem] text-center text-orange-700">{quantity}</span>
      <Button 
        variant="ghost" 
        size="icon" 
        className="rounded-full h-10 w-10 hover:bg-orange-100 text-orange-600" 
        onClick={onDecrement}
        disabled={quantity <= 1}
      >
        <Minus className="h-3 w-3" />
      </Button>
    </div>
  );
};

export default ProductQuantity;
