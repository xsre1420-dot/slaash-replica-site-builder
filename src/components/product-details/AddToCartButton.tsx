
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";

interface AddToCartButtonProps {
  onClick: () => void;
}

const AddToCartButton = ({ onClick }: AddToCartButtonProps) => {
  return (
    <Button 
      onClick={onClick} 
      className="bg-red-600 hover:bg-red-700 w-2/3 flex items-center justify-center gap-2 h-12 text-base"
    >
      <ShoppingCart className="h-5 w-5" />
      إضافة للسلة
    </Button>
  );
};

export default AddToCartButton;
