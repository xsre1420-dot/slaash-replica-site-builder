
import { supabase } from "@/integrations/supabase/client";

// Secure query execution now handled automatically by Supabase RLS
// No need for manual owner context management
export const executeSecureQuery = async <T>(
  ownerId: string,
  queryFn: () => Promise<T>
): Promise<T> => {
  try {
    // Owner context is now automatically handled by auth.uid() in RLS policies
    // No need to store in localStorage or verify manually
    
    // Execute the query - RLS policies will automatically filter by authenticated user
    return await queryFn();
  } catch (error) {
    console.error('Secure query execution failed:', error);
    throw error;
  }
};

// Wrapper for common database operations with automatic security context
export class SecureDatabase {
  constructor(private ownerId: string) {
    // Owner ID is no longer needed - kept for compatibility
    // RLS policies automatically use auth.uid() for security
  }

  async query<T>(queryFn: () => Promise<T>): Promise<T> {
    // No need to pass ownerId - RLS handles security automatically
    return queryFn();
  }

  // Helper method to get products for the current owner
  async getProducts() {
    return this.query(async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    });
  }

  // Helper method to get orders for the current owner
  async getOrders() {
    return this.query(async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (name, price)
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    });
  }

  // Helper method to get customers for the current owner
  async getCustomers() {
    return this.query(async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    });
  }

  // Helper method to get categories for the current owner
  async getCategories() {
    return this.query(async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data;
    });
  }
}
