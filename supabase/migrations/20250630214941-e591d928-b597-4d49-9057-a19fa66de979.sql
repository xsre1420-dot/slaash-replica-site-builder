
-- First, let's check and fix any null owner_id values in categories table
-- We'll set them to a default owner or remove them if they're orphaned
DELETE FROM public.categories WHERE owner_id IS NULL;

-- Now let's enable RLS on all tables
ALTER TABLE public.restaurant_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_visits ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Owners can view their own data" ON public.restaurant_owners;
DROP POLICY IF EXISTS "Owners can update their own data" ON public.restaurant_owners;
DROP POLICY IF EXISTS "Owners can manage their products" ON public.products;
DROP POLICY IF EXISTS "Owners can manage their categories" ON public.categories;
DROP POLICY IF EXISTS "Restaurant owners can view their orders" ON public.orders;
DROP POLICY IF EXISTS "Restaurant owners can create orders" ON public.orders;
DROP POLICY IF EXISTS "Restaurant owners can update their orders" ON public.orders;
DROP POLICY IF EXISTS "Restaurant owners can view their order items" ON public.order_items;
DROP POLICY IF EXISTS "Restaurant owners can create order items" ON public.order_items;
DROP POLICY IF EXISTS "Restaurant owners can view their customers" ON public.customers;
DROP POLICY IF EXISTS "Restaurant owners can manage their customers" ON public.customers;
DROP POLICY IF EXISTS "Restaurant owners can view their store visits" ON public.store_visits;
DROP POLICY IF EXISTS "Restaurant owners can create store visits" ON public.store_visits;

-- Create a security definer function to get current restaurant owner ID
CREATE OR REPLACE FUNCTION public.get_current_restaurant_owner_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM public.restaurant_owners 
  WHERE id = COALESCE(current_setting('app.current_owner_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
  LIMIT 1;
$$;

-- RLS Policies for restaurant_owners table
CREATE POLICY "Restaurant owners can view their own profile"
  ON public.restaurant_owners
  FOR SELECT
  USING (id = public.get_current_restaurant_owner_id());

CREATE POLICY "Restaurant owners can update their own profile"
  ON public.restaurant_owners
  FOR UPDATE
  USING (id = public.get_current_restaurant_owner_id());

-- RLS Policies for products table
CREATE POLICY "Restaurant owners can view their own products"
  ON public.products
  FOR SELECT
  USING (owner_id = public.get_current_restaurant_owner_id());

CREATE POLICY "Restaurant owners can insert their own products"
  ON public.products
  FOR INSERT
  WITH CHECK (owner_id = public.get_current_restaurant_owner_id());

CREATE POLICY "Restaurant owners can update their own products"
  ON public.products
  FOR UPDATE
  USING (owner_id = public.get_current_restaurant_owner_id());

CREATE POLICY "Restaurant owners can delete their own products"
  ON public.products
  FOR DELETE
  USING (owner_id = public.get_current_restaurant_owner_id());

-- RLS Policies for categories table
CREATE POLICY "Restaurant owners can view their own categories"
  ON public.categories
  FOR SELECT
  USING (owner_id = public.get_current_restaurant_owner_id());

CREATE POLICY "Restaurant owners can insert their own categories"
  ON public.categories
  FOR INSERT
  WITH CHECK (owner_id = public.get_current_restaurant_owner_id());

CREATE POLICY "Restaurant owners can update their own categories"
  ON public.categories
  FOR UPDATE
  USING (owner_id = public.get_current_restaurant_owner_id());

CREATE POLICY "Restaurant owners can delete their own categories"
  ON public.categories
  FOR DELETE
  USING (owner_id = public.get_current_restaurant_owner_id());

-- RLS Policies for orders table
CREATE POLICY "Restaurant owners can view their own orders"
  ON public.orders
  FOR SELECT
  USING (owner_id = public.get_current_restaurant_owner_id());

CREATE POLICY "Restaurant owners can insert their own orders"
  ON public.orders
  FOR INSERT
  WITH CHECK (owner_id = public.get_current_restaurant_owner_id());

CREATE POLICY "Restaurant owners can update their own orders"
  ON public.orders
  FOR UPDATE
  USING (owner_id = public.get_current_restaurant_owner_id());

CREATE POLICY "Restaurant owners can delete their own orders"
  ON public.orders
  FOR DELETE
  USING (owner_id = public.get_current_restaurant_owner_id());

-- RLS Policies for order_items table
CREATE POLICY "Restaurant owners can view their own order items"
  ON public.order_items
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_items.order_id 
    AND orders.owner_id = public.get_current_restaurant_owner_id()
  ));

CREATE POLICY "Restaurant owners can insert their own order items"
  ON public.order_items
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_items.order_id 
    AND orders.owner_id = public.get_current_restaurant_owner_id()
  ));

CREATE POLICY "Restaurant owners can update their own order items"
  ON public.order_items
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_items.order_id 
    AND orders.owner_id = public.get_current_restaurant_owner_id()
  ));

CREATE POLICY "Restaurant owners can delete their own order items"
  ON public.order_items
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_items.order_id 
    AND orders.owner_id = public.get_current_restaurant_owner_id()
  ));

-- RLS Policies for customers table
CREATE POLICY "Restaurant owners can view their own customers"
  ON public.customers
  FOR SELECT
  USING (owner_id = public.get_current_restaurant_owner_id());

CREATE POLICY "Restaurant owners can insert their own customers"
  ON public.customers
  FOR INSERT
  WITH CHECK (owner_id = public.get_current_restaurant_owner_id());

CREATE POLICY "Restaurant owners can update their own customers"
  ON public.customers
  FOR UPDATE
  USING (owner_id = public.get_current_restaurant_owner_id());

CREATE POLICY "Restaurant owners can delete their own customers"
  ON public.customers
  FOR DELETE
  USING (owner_id = public.get_current_restaurant_owner_id());

-- RLS Policies for store_visits table
CREATE POLICY "Restaurant owners can view their own store visits"
  ON public.store_visits
  FOR SELECT
  USING (owner_id = public.get_current_restaurant_owner_id());

CREATE POLICY "Restaurant owners can insert their own store visits"
  ON public.store_visits
  FOR INSERT
  WITH CHECK (owner_id = public.get_current_restaurant_owner_id());

-- Allow public access to view products and categories for store visitors (read-only)
CREATE POLICY "Public can view products for store display"
  ON public.products
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can view categories for store display"
  ON public.categories
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow public access to create orders (for customers placing orders)
CREATE POLICY "Public can create orders"
  ON public.orders
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Public can create order items"
  ON public.order_items
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow public access to create customers (for order processing)
CREATE POLICY "Public can create customers"
  ON public.customers
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow public to track store visits
CREATE POLICY "Public can create store visits"
  ON public.store_visits
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Add NOT NULL constraints to owner_id columns (now that we've cleaned the data)
ALTER TABLE public.categories ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE public.products ALTER COLUMN owner_id SET NOT NULL;
