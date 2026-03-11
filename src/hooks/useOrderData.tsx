import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Order, CartItem } from "@/types";

const mapDbOrder = (row: any): Order => ({
  id: row.id,
  items: (row.items as any[]).map((item: any): CartItem => ({
    product: {
      id: item.product?.id || item.productId || '',
      name: item.product?.name || item.name || '',
      description: item.product?.description || '',
      category: item.product?.category || '',
      price: Number(item.product?.price || item.price || 0),
      image: item.product?.image || item.image || '',
    },
    quantity: item.quantity || 1,
    selectedSize: item.selectedSize,
    selectedColor: item.selectedColor,
  })),
  customerInfo: {
    name: row.customer_name,
    phone: row.customer_phone,
    address: row.customer_address || '',
    notes: row.notes || undefined,
    governorate: row.customer_governorate || undefined,
  },
  total: Number(row.total),
  date: row.created_at,
  status: row.status as Order['status'],
});

export const useOrderData = (orderId: string | undefined) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    const fetchOrder = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

      if (!error && data) {
        setOrder(mapDbOrder(data));
      }
      setLoading(false);
    };

    fetchOrder();
  }, [orderId]);

  return { order, loading };
};

export { mapDbOrder };
