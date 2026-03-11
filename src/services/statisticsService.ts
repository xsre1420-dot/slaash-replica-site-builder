
import { supabase } from "@/integrations/supabase/client";
import { DatabaseData } from "@/types/statistics";

const withTimeout = <T>(promise: Promise<T>, ms = 10000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Request timeout')), ms))
  ]);
};

export const fetchStatisticsData = async (dateRange: string): Promise<DatabaseData> => {
  const days = parseInt(dateRange) || 7;
  const extendedDays = days * 2;
  const extendedStart = new Date(Date.now() - extendedDays * 86400000);
  const dateFilter = extendedStart.toISOString();

  try {
    const [ordersRes, productsRes] = await withTimeout(
      Promise.all([
        supabase.from('orders').select('id,status,total,created_at,customer_name,customer_phone,delivery_fee').gte('created_at', dateFilter),
        supabase.from('products').select('id,name,price,stock_quantity'),
      ]),
      12000
    );

    // Only fetch these if the tables exist (cast to any for optional tables)
    let orderItems: any[] = [];
    let customers: any[] = [];
    let visits: any[] = [];

    try {
      const [itemsRes, customersRes, visitsRes] = await Promise.all([
        (supabase as any).from('order_items').select('*'),
        (supabase as any).from('customers').select('*'),
        (supabase as any).from('store_visits').select('id,created_at').gte('created_at', dateFilter),
      ]);
      orderItems = itemsRes.data || [];
      customers = customersRes.data || [];
      visits = visitsRes.data || [];
    } catch {}

    return {
      orders: ordersRes.data || [],
      orderItems,
      customers,
      products: productsRes.data || [],
      visits,
    };
  } catch (error) {
    return { orders: [], orderItems: [], customers: [], products: [], visits: [] };
  }
};
