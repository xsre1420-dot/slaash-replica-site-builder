import { CartItem } from '@/types';
import OptimizedImage from '@/components/OptimizedImage';
import { resolveOrderItemColor } from '@/utils/orderItemDisplayUtils';
interface OrderItemsProps {
  items: CartItem[];
}

const lineTotal = (item: CartItem) => {
  const price = Number(item.product?.price) || 0;
  const quantity = Number(item.quantity) || 0;
  return price * quantity;
};

const OrderItems = ({ items }: OrderItemsProps) => {
  const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0);

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const product = item.product ?? {
          id: `item-${index}`,
          name: 'منتج',
          price: 0,
          image: '/placeholder.svg',
        };
        const price = Number(product.price) || 0;
        const quantity = Number(item.quantity) || 0;
        const colorDisplay = resolveOrderItemColor(item);
        const thumbImage = colorDisplay?.image || product.image || '/placeholder.svg';

        return (
          <div
            key={`${product.id}-${index}`}
            className="flex gap-3 p-3 rounded-xl border border-border/50 bg-background/80"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-border bg-muted shrink-0">
              <OptimizedImage
                src={thumbImage}
                alt={product.name || 'منتج'}
                variant="thumbnail"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex-1 min-w-0 text-right">
              <p className="font-semibold text-foreground line-clamp-2">{product.name || 'منتج'}</p>
              <div className="flex flex-wrap gap-1.5 justify-end mt-1.5">
                {item.selectedSize && (
                  <span className="text-[11px] bg-muted px-2 py-0.5 rounded-md font-medium">
                    مقاس: {item.selectedSize}
                  </span>
                )}
                {colorDisplay && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] bg-muted pl-1 pr-2 py-0.5 rounded-md font-medium">
                    {colorDisplay.image ? (
                      <span className="w-6 h-6 rounded-md overflow-hidden border border-border/50 shrink-0">
                        <img
                          src={colorDisplay.image}
                          alt={colorDisplay.name || 'لون'}
                          className="w-full h-full object-cover"
                        />
                      </span>
                    ) : null}
                    {colorDisplay.name ? <span>لون: {colorDisplay.name}</span> : null}
                  </span>
                )}
              </div>              <div className="flex items-center justify-between mt-2 gap-2">
                <p className="font-bold text-foreground">
                  {lineTotal(item).toLocaleString()} د.ع
                </p>
                <p className="text-sm text-muted-foreground">
                  {price.toLocaleString()} × {quantity}
                </p>
              </div>
            </div>
          </div>
        );
      })}

      <div className="flex justify-between items-center pt-2 border-t border-border/50 text-sm">
        <span className="font-bold text-foreground">{subtotal.toLocaleString()} د.ع</span>
        <span className="text-muted-foreground">مجموع المنتجات</span>
      </div>
    </div>
  );
};

export default OrderItems;
