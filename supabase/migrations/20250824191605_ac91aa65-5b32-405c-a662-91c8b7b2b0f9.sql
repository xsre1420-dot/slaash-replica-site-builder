-- Final security hardening: Ensure all sensitive data tables deny public access

-- 1. Add explicit deny policies for any remaining public access to sensitive tables

-- For store_settings table - deny public access
DROP POLICY IF EXISTS "Public can view store settings" ON public.store_settings;
CREATE POLICY "Deny public access to store settings" 
ON public.store_settings 
FOR ALL 
USING (false);

-- For orders table - deny public SELECT access (keep public INSERT for order placement)
DROP POLICY IF EXISTS "Public can view orders" ON public.orders;
CREATE POLICY "Deny public SELECT access to orders" 
ON public.orders 
FOR SELECT 
USING (false);

-- For customers table - ensure no public SELECT access exists
CREATE POLICY "Deny public SELECT access to customers" 
ON public.customers 
FOR SELECT 
USING (false);

-- For order_items table - deny public SELECT access  
CREATE POLICY "Deny public SELECT access to order_items" 
ON public.order_items 
FOR SELECT 
USING (false);

-- 2. Secure the store_visits table - only allow INSERT for analytics but deny SELECT
CREATE POLICY "Deny public SELECT access to store_visits" 
ON public.store_visits 
FOR SELECT 
USING (false);

CREATE POLICY "Deny public UPDATE/DELETE access to store_visits" 
ON public.store_visits 
FOR UPDATE 
USING (false);

CREATE POLICY "Deny public DELETE access to store_visits" 
ON public.store_visits 
FOR DELETE 
USING (false);