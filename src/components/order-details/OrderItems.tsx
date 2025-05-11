
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
            className="flex justify-between items-center border-b pb-3"
          >
            <div className="flex items-center">
              <div>
                <span className="block font-medium">{item.product.price.toLocaleString()} د.ع × {item.quantity}</span>
                <span className="text-gray-500 text-sm">
                  المجموع: {(item.product.price * item.quantity).toLocaleString()} د.ع
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="block font-semibold">{item.product.name}</span>
                <span className="text-gray-600 text-sm line-clamp-1">
                  {item.product.description}
                </span>
              </div>
              <img
                src={item.product.image}
                alt={item.product.name}
                className="w-16 h-16 rounded-lg object-cover border border-gray-200 shadow-sm"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OrderItems;
