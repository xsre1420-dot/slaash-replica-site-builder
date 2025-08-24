-- Fix security issue: Customer Personal Information Exposed to Public

-- 1. Remove the overly permissive public customer creation policy
DROP POLICY IF EXISTS "Public can create customers" ON public.customers;

-- 2. Create a more secure public customer creation policy that requires valid owner context
-- This allows customers to be created during order placement, but only with valid owner_id
CREATE POLICY "Public can create customers with valid owner context" 
ON public.customers 
FOR INSERT 
WITH CHECK (
  -- Ensure the owner_id exists in restaurant_owners table
  EXISTS (
    SELECT 1 FROM public.restaurant_owners 
    WHERE id = customers.owner_id
  )
);

-- 3. Ensure there's no permissive public SELECT policy - remove if exists
DROP POLICY IF EXISTS "Public can view customers" ON public.customers;

-- 4. Create an explicit policy to deny public SELECT access to customer data
-- (This is defensive - should not be needed but ensures no public read access)
CREATE POLICY "Deny public SELECT access to customers" 
ON public.customers 
FOR SELECT 
USING (false);

-- 5. Ensure the existing owner-based policies take precedence
-- Update the restaurant owner policy to be more explicit about ownership
DROP POLICY IF EXISTS "Restaurant owners can view their own customers" ON public.customers;
CREATE POLICY "Restaurant owners can view their own customers" 
ON public.customers 
FOR SELECT 
USING (owner_id = get_current_restaurant_owner_id());

-- 6. Update the auth user policy to be more explicit
DROP POLICY IF EXISTS "Users can view their own customers" ON public.customers;
CREATE POLICY "Users can view their own customers" 
ON public.customers 
FOR SELECT 
USING (auth.uid() = owner_id);

-- 7. Ensure UPDATE policies are properly scoped
DROP POLICY IF EXISTS "Restaurant owners can update their own customers" ON public.customers;
CREATE POLICY "Restaurant owners can update their own customers" 
ON public.customers 
FOR UPDATE 
USING (owner_id = get_current_restaurant_owner_id());

DROP POLICY IF EXISTS "Users can update their own customers" ON public.customers;
CREATE POLICY "Users can update their own customers" 
ON public.customers 
FOR UPDATE 
USING (auth.uid() = owner_id);

-- 8. Ensure INSERT policies are properly scoped for authenticated users
DROP POLICY IF EXISTS "Restaurant owners can insert their own customers" ON public.customers;
CREATE POLICY "Restaurant owners can insert their own customers" 
ON public.customers 
FOR INSERT 
WITH CHECK (owner_id = get_current_restaurant_owner_id());

DROP POLICY IF EXISTS "Users can create their own customers" ON public.customers;
CREATE POLICY "Users can create their own customers" 
ON public.customers 
FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

-- 9. Ensure DELETE policies are properly scoped
DROP POLICY IF EXISTS "Restaurant owners can delete their own customers" ON public.customers;
CREATE POLICY "Restaurant owners can delete their own customers" 
ON public.customers 
FOR DELETE 
USING (owner_id = get_current_restaurant_owner_id());