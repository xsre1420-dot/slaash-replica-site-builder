import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Order, CartItem } from "@/types";

const mapDbOrder = (row: any): Order => {
  const rawItems = row.order_items ?? [];
  const items: CartItem[] = Array.isArray(rawItems)
    ? rawItems.map((item: any): CartItem => {
        const variantMeta = item.variant_metadata || {};
        const product = item.product ?? {
          id: item.product_id || '',
          name: item.product_name || item.name || '',
          description: item.product?.description || '',
          category: item.product?.category || '',
          price: Number(item.product_price ?? item.price ?? 0),
          image: item.product?.image || item.image || '',
        };

        return {
          product,
          quantity: item.quantity || 1,
          selectedSize: variantMeta.selected_size || item.selectedSize,
          selectedColor: variantMeta.selected_color || item.selectedColor,
        };
      })
    : [];

  return {
    id: row.id,
    items,
    customerInfo: {
      name: row.customer_name,
      phone: row.customer_phone,
      address: row.customer_address || '',
      notes: row.notes || undefined,
      governorate: row.customer_governorate || undefined,
    },
    total: Number(row.total ?? row.total_amount || 0),
    date: row.created_at,
    status: row.status as Order['status'],
    couponCode: row.coupon_code || undefined,
    discountAmount: row.discount_amount != null ? Number(row.discount_amount) : undefined,
    paymentMethod: row.payment_method || undefined,
  };
};

export const useOrderData = (orderId: string | undefined) => {
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    if (!user?.id) {
      setOrder(null);
      setLoading(false);
      return;
    }

    const fetchOrder = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from('orders')
        .select('id, status, total_amount, created_at, customer_name, customer_phone, customer_address, customer_governorate, notes, coupon_code, discount_amount, payment_method, order_items(id, product_id, product_name, product_price, quantity, subtotal, variant_metadata)')
        .eq('id', orderId)
        .eq('owner_id', user.id)
        .maybeSingle();

      if (!error && data) {
        setOrder(mapDbOrder(data));
      } else {
        setOrder(null);
      }
      setLoading(false);
    };

    fetchOrder();
  }, [orderId, user?.id]);

  return { order, loading };
};

export { mapDbOrder };
