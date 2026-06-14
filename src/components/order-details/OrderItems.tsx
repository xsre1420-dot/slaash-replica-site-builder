import { CartItem } from '@/types';
import OptimizedImage from '@/components/OptimizedImage';

interface OrderItemsProps {
  items: CartItem[];
}

const OrderItems = ({ items }: OrderItemsProps) => {
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={`${item.product.id}-${index}`}
          className="flex gap-3 p-3 rounded-xl border border-border/50 bg-background/80"
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-border bg-muted shrink-0">
            <OptimizedImage
              src={item.product.image || '/placeholder.svg'}
              alt={item.product.name}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1 min-w-0 text-right">
            <p className="font-semibold text-foreground line-clamp-2">{item.product.name}</p>
            <div className="flex flex-wrap gap-1.5 justify-end mt-1.5">
              {item.selectedSize && (
                <span className="text-[11px] bg-muted px-2 py-0.5 rounded-md font-medium">
                  مقاس: {item.selectedSize}
                </span>
              )}
              {item.selectedColor && (
                <span className="text-[11px] bg-muted px-2 py-0.5 rounded-md font-medium">
                  لون: {item.selectedColor}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between mt-2 gap-2">
              <p className="font-bold text-foreground">
                {(item.product.price * item.quantity).toLocaleString()} د.ع
              </p>
              <p className="text-sm text-muted-foreground">
                {item.product.price.toLocaleString()} × {item.quantity}
              </p>
            </div>
          </div>
        </div>
      ))}

      <div className="flex justify-between items-center pt-2 border-t border-border/50 text-sm">
        <span className="font-bold text-foreground">{subtotal.toLocaleString()} د.ع</span>
        <span className="text-muted-foreground">مجموع المنتجات</span>
      </div>
    </div>
  );
};

export default OrderItems;
