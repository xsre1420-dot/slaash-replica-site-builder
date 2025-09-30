
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";

interface AddToCartButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

const AddToCartButton = ({ onClick, disabled = false }: AddToCartButtonProps) => {
  return (
    <Button 
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-3 h-14 text-lg font-semibold text-white border-0 rounded-full shadow-lg disabled:opacity-50 disabled:cursor-not-allowed bg-black hover:bg-gray-900"
      style={{ 
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      <ShoppingCart className="h-4 w-4 -mt-1" />
      إضافة إلى السلة
    </Button>
  );
};

export default AddToCartButton;
