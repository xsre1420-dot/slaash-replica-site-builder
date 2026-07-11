import { Plus, Minus, Trash2 } from "lucide-react";
import { CartItem } from "@/types";
import { memo, useState } from "react";
import OptimizedImage from "@/components/OptimizedImage";

interface CartItemCardProps {
  item: CartItem;
  index: number;
  maxQuantity?: number;
  onRemove: (productId: string, size?: string, color?: string) => void;
  onUpdateQuantity: (productId: string, qty: number, size?: string, color?: string) => void;
}

const CartItemCard = memo(({ item, index, maxQuantity, onRemove, onUpdateQuantity }: CartItemCardProps) => {
  const atMax = maxQuantity !== undefined && item.quantity >= maxQuantity;
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
      <div className="flex gap-3 p-3 rounded-xl bg-[#F9FAFB]">
        <OptimizedImage
          src={item.product.image}
          alt={item.product.name}
          variant="thumbnail"
          className="w-16 h-16 rounded-xl shrink-0"
          width={64}
          height={64}
          loading="lazy"
        />
        <div className="flex-1 text-right min-w-0">
          <h3 className="font-bold text-foreground text-sm truncate leading-snug">{item.product.name}</h3>

          {(item.selectedSize || item.selectedColor) && (
            <div className="flex gap-1.5 mt-1.5 justify-end flex-wrap">
              {item.selectedSize && (
                <span className="text-[10px] bg-white px-2 py-0.5 rounded-full text-gray-500">
                  {item.selectedSize}
                </span>
              )}
              {item.selectedColor && (
                <span className="text-[10px] bg-white px-2 py-0.5 rounded-full text-gray-500 flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full ring-1 ring-border/30" style={{ backgroundColor: item.selectedColor }} />
                </span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleRemove}
                className="text-destructive/70 hover:text-destructive transition-colors p-1.5 rounded-lg hover:bg-destructive/10"
                aria-label="حذف من السلة"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <div className="flex items-center gap-0.5 bg-white rounded-full px-0.5 py-0.5">
                <button
                  onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1, item.selectedSize, item.selectedColor)}
                  className="rounded-full w-7 h-7 flex items-center justify-center bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-sm"
                  aria-label="تقليل الكمية"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-5 text-center text-foreground font-bold text-xs tabular-nums">{item.quantity}</span>
                <button
                  onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1, item.selectedSize, item.selectedColor)}
                  disabled={atMax}
                  className="rounded-full w-7 h-7 flex items-center justify-center bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-sm disabled:opacity-40"
                  aria-label="زيادة الكمية"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-foreground text-sm tabular-nums">{(item.product.price * item.quantity).toLocaleString()} د.ع</p>
              {item.quantity > 1 && (
                <p className="text-[10px] text-muted-foreground tabular-nums">{item.product.price.toLocaleString()} × {item.quantity}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

CartItemCard.displayName = 'CartItemCard';

export default CartItemCard;
