
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";

interface AddToCartButtonProps {
  onClick: () => void;
}

const AddToCartButton = ({ onClick }: AddToCartButtonProps) => {
  return (
    <Button 
      onClick={onClick} 
      className="bg-red-600 hover:bg-red-700 w-full flex items-center justify-center gap-3 h-14 text-lg font-semibold"
    >
      <ShoppingCart className="h-4 w-4" />
      إضافة للسلة
    </Button>
  );
};

export default AddToCartButton;
