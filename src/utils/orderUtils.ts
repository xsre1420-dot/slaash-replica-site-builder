
import { supabase } from '@/integrations/supabase/client';
import { Order, CartItem } from '@/types';

export const saveOrderToDatabase = async (order: Order, ownerId: string) => {
  try {
    // Insert the main order
    const { data: orderData, error: orderError } = await (supabase as any)
      .from('orders')
      .insert({
        id: order.id,
        owner_id: ownerId,
        customer_name: order.customerInfo.name,
        customer_phone: order.customerInfo.phone,
        customer_address: order.customerInfo.address,
        total: order.total,
        status: order.status,
        notes: order.customerInfo.notes,
        items: JSON.stringify(order.items),
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Insert order items
    const orderItems = order.items.map(item => ({
      order_id: order.id,
      product_id: item.product.id,
      product_name: item.product.name,
      product_price: item.product.price,
      quantity: item.quantity,
      subtotal: item.product.price * item.quantity
    }));

    const { error: itemsError } = await (supabase as any)
      .from('order_items')
      .insert(orderItems);

    if (itemsError) throw itemsError;

    console.log('Order saved to database successfully');
    return orderData;
  } catch (error) {
    console.error('Error saving order to database:', error);
    throw error;
  }
};

export const updateOrderStatusInDatabase = async (orderId: string, status: string) => {
  try {
    const { error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', orderId);

    if (error) throw error;
    
    console.log('Order status updated in database');
  } catch (error) {
    console.error('Error updating order status:', error);
    throw error;
  }
};
