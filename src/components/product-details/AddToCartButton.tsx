
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";

interface AddToCartButtonProps {
  onClick: () => void;
}

const AddToCartButton = ({ onClick }: AddToCartButtonProps) => {
  return (
    <Button 
      onClick={onClick} 
      className="bg-red-600 hover:bg-red-700 w-full flex items-center justify-center gap-2 h-14 text-lg font-semibold"
    >
      <ShoppingCart className="h-6 w-6" />
      إضافة للسلة
    </Button>
  );
};

export default AddToCartButton;
