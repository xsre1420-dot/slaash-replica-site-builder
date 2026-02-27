
import { CartItem } from "@/types";

interface OrderItemsProps {
  items: CartItem[];
}

const OrderItems = ({ items }: OrderItemsProps) => {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-3 text-right">المنتجات</h3>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={`${item.product.id}-${index}`}
            className="flex justify-between items-center border-b border-border pb-3"
          >
            <div className="flex items-center">
              <div>
                <span className="block font-medium">{item.product.price.toLocaleString()} x {item.quantity}</span>
                <span className="text-muted-foreground text-sm">
                  المجموع: {(item.product.price * item.quantity).toLocaleString()} د.ع
                </span>
              </div>
            </div>
            <div className="flex items-center gap-5">
              <div className="text-right">
                <span className="block font-semibold">{item.product.name}</span>
                <span className="text-muted-foreground text-sm line-clamp-1">
                  {item.product.description}
                </span>
                {/* Display selected options */}
                {(item.selectedSize || item.selectedColor) && (
                  <div className="flex gap-2 mt-1">
                    {item.selectedSize && (
                      <span className="text-xs bg-muted px-2 py-1 rounded-full">
                        القياس: {item.selectedSize}
                      </span>
                    )}
                    {item.selectedColor && (
                      <span className="text-xs bg-muted px-2 py-1 rounded-full">
                        اللون: {item.selectedColor}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="w-16 h-16 rounded-lg overflow-hidden border border-border shadow-sm bg-card flex items-center justify-center">
                <img
                  src={item.product.image}
                  alt={item.product.name}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OrderItems;
