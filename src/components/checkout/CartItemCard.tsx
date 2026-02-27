import { Plus, Minus, Trash2 } from "lucide-react";
import { CartItem } from "@/types";
import { useState } from "react";

interface CartItemCardProps {
  item: CartItem;
  index: number;
  onRemove: (productId: string, size?: string, color?: string) => void;
  onUpdateQuantity: (productId: string, qty: number, size?: string, color?: string) => void;
}

const CartItemCard = ({ item, index, onRemove, onUpdateQuantity }: CartItemCardProps) => {
  const [removing, setRemoving] = useState(false);

  const handleRemove = () => {
    setRemoving(true);
    setTimeout(() => onRemove(item.product.id, item.selectedSize, item.selectedColor), 300);
  };

  return (
    <div
      className={`transition-all duration-300 ${removing ? "opacity-0 scale-95 -translate-x-4" : "opacity-100"}`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="flex gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
        <img
          src={item.product.image}
          alt={item.product.name}
          className="w-20 h-20 rounded-lg object-cover"
          loading="lazy"
        />
        <div className="flex-1 text-right min-w-0">
          <h3 className="font-bold text-foreground text-sm truncate">{item.product.name}</h3>

          {(item.selectedSize || item.selectedColor) && (
            <div className="flex gap-1.5 mt-1 justify-end flex-wrap">
              {item.selectedSize && (
                <span className="text-[10px] bg-background px-2 py-0.5 rounded-full text-muted-foreground border border-border/50">
                  {item.selectedSize}
                </span>
              )}
              {item.selectedColor && (
                <span className="text-[10px] bg-background px-2 py-0.5 rounded-full text-muted-foreground border border-border/50 flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full border border-border" style={{ backgroundColor: item.selectedColor }} />
                </span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleRemove}
                className="text-destructive/70 hover:text-destructive transition-colors p-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1 bg-background rounded-full px-1 py-0.5 border border-border/50">
                <button
                  onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1, item.selectedSize, item.selectedColor)}
                  className="rounded-full w-6 h-6 flex items-center justify-center bg-foreground text-background text-xs hover:opacity-80 transition-opacity"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-6 text-center text-foreground font-semibold text-sm">{item.quantity}</span>
                <button
                  onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1, item.selectedSize, item.selectedColor)}
                  className="rounded-full w-6 h-6 flex items-center justify-center bg-foreground text-background text-xs hover:opacity-80 transition-opacity"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-foreground text-sm">{(item.product.price * item.quantity).toLocaleString()} د.ع</p>
              {item.quantity > 1 && (
                <p className="text-[10px] text-muted-foreground">{item.product.price.toLocaleString()} × {item.quantity}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartItemCard;
