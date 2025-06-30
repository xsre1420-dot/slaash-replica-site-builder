
import { supabase } from "@/integrations/supabase/client";

// Helper function to ensure owner context is set before making queries
export const executeSecureQuery = async <T>(
  ownerId: string,
  queryFn: () => Promise<T>
): Promise<T> => {
  try {
    // Set the owner context before executing the query
    await supabase.rpc('set_config', {
      setting_name: 'app.current_owner_id',
      new_value: ownerId,
      is_local: false
    });
    
    // Execute the query
    return await queryFn();
  } catch (error) {
    console.error('Secure query execution failed:', error);
    throw error;
  }
};

// Wrapper for common database operations with security context
export class SecureDatabase {
  constructor(private ownerId: string) {}

  async query<T>(queryFn: () => Promise<T>): Promise<T> {
    return executeSecureQuery(this.ownerId, queryFn);
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
