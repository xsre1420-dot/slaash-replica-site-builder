
import { supabase } from "@/integrations/supabase/client";
import { DatabaseData } from "@/types/statistics";

export const getDateFilter = (dateRange: string): string => {
  const now = new Date();
  const days = parseInt(dateRange);
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return startDate.toISOString();
};

export const fetchStatisticsData = async (dateRange: string): Promise<DatabaseData> => {
  const dateFilter = getDateFilter(dateRange);
  
  console.log('Fetching statistics for date range:', dateRange);
  
  try {
    // Fetch orders data with simplified query
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', dateFilter);

    if (ordersError) {
      console.error('Orders error:', ordersError);
    }

    // Fetch order items data
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('*');

    if (itemsError) {
      console.error('Order items error:', itemsError);
    }

    // Fetch customers data
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('*');

    if (customersError) {
      console.error('Customers error:', customersError);
    }

    // Fetch products data with simplified query
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*');

    if (productsError) {
      console.error('Products error:', productsError);
    }

    // Fetch store visits data
    const { data: visits, error: visitsError } = await supabase
      .from('store_visits')
      .select('*')
      .gte('created_at', dateFilter);

    if (visitsError) {
      console.error('Visits error:', visitsError);
    }

    console.log('Data fetched successfully:', {
      orders: orders?.length || 0,
      orderItems: orderItems?.length || 0,
      customers: customers?.length || 0,
      products: products?.length || 0,
      visits: visits?.length || 0
    });

    return {
      orders: orders || [],
      orderItems: orderItems || [],
      customers: customers || [],
      products: products || [],
      visits: visits || []
    };
  } catch (error) {
    console.error('Error fetching statistics data:', error);
    // Return empty data if there's an error
    return {
      orders: [],
      orderItems: [],
      customers: [],
      products: [],
      visits: []
    };
  }
};
