import { Order, CartItem } from '@/types';

export const mapDbOrder = (row: Record<string, unknown>): Order => {
  const rawItems = row.order_items ?? [];
  const items: CartItem[] = Array.isArray(rawItems)
    ? rawItems.map((item: Record<string, unknown>): CartItem => {
        const variantMeta = (item.variant_metadata as Record<string, unknown>) || {};
        const nestedProduct = item.product as Record<string, unknown> | undefined;

        const product = nestedProduct ?? {
          id: item.product_id || '',
          name: item.product_name || item.name || '',
          description: nestedProduct?.description || '',
          category: nestedProduct?.category || '',
          price: Number(item.product_price ?? item.price ?? 0),
          image: nestedProduct?.image || item.image || '',
        };

        return {
          product: product as CartItem['product'],
          quantity: Number(item.quantity) || 1,
          selectedSize: (variantMeta.selected_size as string) || (item.selectedSize as string),
          selectedColor: (variantMeta.selected_color as string) || (item.selectedColor as string),
        };
      })
    : [];

  return {
    id: String(row.id),
    items,
    customerInfo: {
      name: String(row.customer_name || ''),
      phone: String(row.customer_phone || ''),
      address: String(row.customer_address || ''),
      notes: (row.notes as string) || undefined,
      governorate: (row.customer_governorate as string) || undefined,
    },
    total: Number(row.total ?? row.total_amount ?? 0),
    date: String(row.created_at),
    status: row.status as Order['status'],
    couponCode: (row.coupon_code as string) || undefined,
    discountAmount: row.discount_amount != null ? Number(row.discount_amount) : undefined,
    paymentMethod: (row.payment_method as string) || undefined,
    paymentStatus: (row.payment_status as string) || undefined,
    deliveryFee: row.delivery_fee != null ? Number(row.delivery_fee) : undefined,
    deliveryStatus: (row.delivery_status as string) || undefined,
  };
};
