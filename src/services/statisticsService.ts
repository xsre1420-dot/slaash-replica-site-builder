
import { supabase } from "@/integrations/supabase/client";
import { DatabaseData } from "@/types/statistics";

export const getDateFilter = (dateRange: string): string => {
  const now = new Date();
  const days = parseInt(dateRange);
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return startDate.toISOString();
};

// Fetch with double the date range to support growth comparison
export const fetchStatisticsData = async (dateRange: string): Promise<DatabaseData> => {
  const days = parseInt(dateRange);
  const extendedDays = days * 2; // Double for growth calculation
  const now = new Date();
  const extendedStart = new Date(now.getTime() - extendedDays * 24 * 60 * 60 * 1000);
  const dateFilter = extendedStart.toISOString();

  try {
    const [ordersRes, itemsRes, customersRes, productsRes, visitsRes] = await Promise.all([
      supabase.from('orders').select('*').gte('created_at', dateFilter),
      supabase.from('order_items').select('*'),
      supabase.from('customers').select('*'),
      supabase.from('products').select('*'),
      supabase.from('store_visits').select('*').gte('created_at', dateFilter),
    ]);

    return {
      orders: ordersRes.data || [],
      orderItems: itemsRes.data || [],
      customers: customersRes.data || [],
      products: productsRes.data || [],
      visits: visitsRes.data || [],
    };
  } catch (error) {
    console.error('Error fetching statistics data:', error);
    return { orders: [], orderItems: [], customers: [], products: [], visits: [] };
  }
};
