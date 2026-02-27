
import { Button } from "@/components/ui/button";
import { ShoppingCart, Check } from "lucide-react";
import { useState, useEffect } from "react";

interface AddToCartButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isOutOfStock?: boolean;
}

const AddToCartButton = ({ onClick, disabled = false, isOutOfStock = false }: AddToCartButtonProps) => {
  const [added, setAdded] = useState(false);

  const handleClick = () => {
    if (isOutOfStock) return;
    onClick();
    setAdded(true);
  };

  useEffect(() => {
    if (added) {
      const t = setTimeout(() => setAdded(false), 1500);
      return () => clearTimeout(t);
    }
  }, [added]);

  return (
    <Button 
      onClick={handleClick}
      disabled={disabled || isOutOfStock}
      className={`w-full flex items-center justify-center gap-3 h-14 text-lg font-semibold border-0 rounded-2xl shadow-lg transition-all duration-300 ${
        isOutOfStock 
          ? 'bg-muted text-muted-foreground' 
          : added 
            ? 'bg-green-600 hover:bg-green-700 text-white scale-[0.98]' 
            : 'bg-foreground hover:bg-foreground/90 text-background'
      }`}
    >
      {isOutOfStock ? (
        <>نفذ المخزون</>
      ) : added ? (
        <>
          <Check className="h-5 w-5" />
          تمت الإضافة!
        </>
      ) : (
        <>
          <ShoppingCart className="h-5 w-5" />
          إضافة إلى السلة
        </>
      )}
    </Button>
  );
};

export default AddToCartButton;
