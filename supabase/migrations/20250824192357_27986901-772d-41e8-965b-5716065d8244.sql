-- CRITICAL SECURITY FIX: Resolve authentication system conflicts and secure data access

-- 1. Fix the owner context function to use proper Supabase auth
CREATE OR REPLACE FUNCTION public.get_current_restaurant_owner_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Use auth.uid() instead of localStorage-based owner context
  SELECT auth.uid()
$$;

-- 2. Update all RLS policies to use auth.uid() directly for better security
-- This eliminates the localStorage dependency and secures owner context

-- Categories policies update
DROP POLICY IF EXISTS "Restaurant owners can view their own categories" ON public.categories;
DROP POLICY IF EXISTS "Restaurant owners can insert their own categories" ON public.categories;
DROP POLICY IF EXISTS "Restaurant owners can update their own categories" ON public.categories;
DROP POLICY IF EXISTS "Restaurant owners can delete their own categories" ON public.categories;

CREATE POLICY "Restaurant owners can view their own categories" 
ON public.categories FOR SELECT 
USING (owner_id = auth.uid());

CREATE POLICY "Restaurant owners can insert their own categories" 
ON public.categories FOR INSERT 
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Restaurant owners can update their own categories" 
ON public.categories FOR UPDATE 
USING (owner_id = auth.uid());

CREATE POLICY "Restaurant owners can delete their own categories" 
ON public.categories FOR DELETE 
USING (owner_id = auth.uid());

-- Products policies update  
DROP POLICY IF EXISTS "Restaurant owners can view their own products" ON public.products;
DROP POLICY IF EXISTS "Restaurant owners can insert their own products" ON public.products;
DROP POLICY IF EXISTS "Restaurant owners can update their own products" ON public.products;
DROP POLICY IF EXISTS "Restaurant owners can delete their own products" ON public.products;

CREATE POLICY "Restaurant owners can view their own products" 
ON public.products FOR SELECT 
USING (owner_id = auth.uid());

CREATE POLICY "Restaurant owners can insert their own products" 
ON public.products FOR INSERT 
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Restaurant owners can update their own products" 
ON public.products FOR UPDATE 
USING (owner_id = auth.uid());

CREATE POLICY "Restaurant owners can delete their own products" 
ON public.products FOR DELETE 
USING (owner_id = auth.uid());

-- Orders policies update
DROP POLICY IF EXISTS "Restaurant owners can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Restaurant owners can insert their own orders" ON public.orders;
DROP POLICY IF EXISTS "Restaurant owners can update their own orders" ON public.orders;
DROP POLICY IF EXISTS "Restaurant owners can delete their own orders" ON public.orders;

CREATE POLICY "Restaurant owners can view their own orders" 
ON public.orders FOR SELECT 
USING (owner_id = auth.uid());

CREATE POLICY "Restaurant owners can insert their own orders" 
ON public.orders FOR INSERT 
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Restaurant owners can update their own orders" 
ON public.orders FOR UPDATE 
USING (owner_id = auth.uid());

CREATE POLICY "Restaurant owners can delete their own orders" 
ON public.orders FOR DELETE 
USING (owner_id = auth.uid());

-- Customers policies update
DROP POLICY IF EXISTS "Restaurant owners can view their own customers" ON public.customers;
DROP POLICY IF EXISTS "Restaurant owners can insert their own customers" ON public.customers;  
DROP POLICY IF EXISTS "Restaurant owners can update their own customers" ON public.customers;
DROP POLICY IF EXISTS "Restaurant owners can delete their own customers" ON public.customers;

CREATE POLICY "Restaurant owners can view their own customers" 
ON public.customers FOR SELECT 
USING (owner_id = auth.uid());

CREATE POLICY "Restaurant owners can insert their own customers" 
ON public.customers FOR INSERT 
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Restaurant owners can update their own customers" 
ON public.customers FOR UPDATE 
USING (owner_id = auth.uid());

CREATE POLICY "Restaurant owners can delete their own customers" 
ON public.customers FOR DELETE 
USING (owner_id = auth.uid());

-- Order items policies update (through orders relationship)
DROP POLICY IF EXISTS "Restaurant owners can view their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Restaurant owners can insert their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Restaurant owners can update their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Restaurant owners can delete their own order items" ON public.order_items;

CREATE POLICY "Restaurant owners can view their own order items" 
ON public.order_items FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM orders 
  WHERE orders.id = order_items.order_id 
  AND orders.owner_id = auth.uid()
));

CREATE POLICY "Restaurant owners can insert their own order items" 
ON public.order_items FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM orders 
  WHERE orders.id = order_items.order_id 
  AND orders.owner_id = auth.uid()
));

CREATE POLICY "Restaurant owners can update their own order items" 
ON public.order_items FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM orders 
  WHERE orders.id = order_items.order_id 
  AND orders.owner_id = auth.uid()
));

CREATE POLICY "Restaurant owners can delete their own order items" 
ON public.order_items FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM orders 
  WHERE orders.id = order_items.order_id 
  AND orders.owner_id = auth.uid()
));

-- Store visits policies update
DROP POLICY IF EXISTS "Restaurant owners can view their own store visits" ON public.store_visits;
DROP POLICY IF EXISTS "Restaurant owners can insert their own store visits" ON public.store_visits;

CREATE POLICY "Restaurant owners can view their own store visits" 
ON public.store_visits FOR SELECT 
USING (owner_id = auth.uid());

CREATE POLICY "Restaurant owners can insert their own store visits" 
ON public.store_visits FOR INSERT 
WITH CHECK (owner_id = auth.uid());

-- Store settings policies - ensure proper access control
DROP POLICY IF EXISTS "Users can view their own store settings" ON public.store_settings;
DROP POLICY IF EXISTS "Users can create their own store settings" ON public.store_settings; 
DROP POLICY IF EXISTS "Users can update their own store settings" ON public.store_settings;

CREATE POLICY "Users can view their own store settings" 
ON public.store_settings FOR SELECT 
USING (owner_id = auth.uid());

CREATE POLICY "Users can create their own store settings" 
ON public.store_settings FOR INSERT 
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own store settings" 
ON public.store_settings FOR UPDATE 
USING (owner_id = auth.uid());

-- 3. SECURE PUBLIC ACCESS - Fix the business intelligence leak
-- Restrict products and categories to only show for specific store context

-- Remove broad public access to products  
DROP POLICY IF EXISTS "Public can view products for store display" ON public.products;

-- Create secure public access that requires owner context (for public store pages)
-- This will be handled in application code with proper filtering

-- 4. ADD VALIDATION FOR ORDER CREATION
-- Secure the order creation to prevent fake orders
DROP POLICY IF EXISTS "Public can create orders" ON public.orders;

-- Create more restrictive order creation policy  
CREATE POLICY "Restricted order creation" 
ON public.orders FOR INSERT 
WITH CHECK (
  -- Orders must have valid customer info
  customer_name IS NOT NULL 
  AND customer_phone IS NOT NULL 
  AND customer_address IS NOT NULL 
  AND total_amount > 0
  AND owner_id IS NOT NULL
);

-- Secure order items creation
DROP POLICY IF EXISTS "Public can create order items" ON public.order_items;

CREATE POLICY "Restricted order item creation" 
ON public.order_items FOR INSERT 
WITH CHECK (
  -- Must have valid order and product references
  order_id IS NOT NULL 
  AND product_id IS NOT NULL 
  AND quantity > 0 
  AND product_price > 0 
  AND subtotal > 0
);

-- 5. Disable the old restaurant_owners based access completely
-- Remove policies that use the broken get_current_restaurant_owner_id system
DROP POLICY IF EXISTS "Restaurant owners can view their own categories" ON public.categories;
DROP POLICY IF EXISTS "Restaurant owners can insert their own categories" ON public.categories;
DROP POLICY IF EXISTS "Restaurant owners can update their own categories" ON public.categories;
DROP POLICY IF EXISTS "Restaurant owners can delete their own categories" ON public.categories;

-- The policies were already recreated above with auth.uid()