
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";

interface AddToCartButtonProps {
  onClick: () => void;
}

const AddToCartButton = ({ onClick }: AddToCartButtonProps) => {
  return (
    <Button 
      onClick={onClick} 
      className="w-full flex items-center justify-center gap-3 h-14 text-lg font-semibold text-white border-0"
      style={{ background: 'linear-gradient(135deg, #ff6b35, #f7931e, #ec4899)' }}
    >
      <ShoppingCart className="h-4 w-4 -mt-1" />
      إضافة
    </Button>
  );
};

export default AddToCartButton;
