-- CRITICAL SECURITY FIXES - Selective approach

-- 1. Remove problematic conflicting customer policies (keep existing good ones)
DROP POLICY IF EXISTS "Deny public SELECT access to customers" ON public.customers;
DROP POLICY IF EXISTS "Restaurant owners can delete their own customers" ON public.customers;
DROP POLICY IF EXISTS "Restaurant owners can insert their own customers" ON public.customers;
DROP POLICY IF EXISTS "Restaurant owners can update their own customers" ON public.customers;
DROP POLICY IF EXISTS "Restaurant owners can view their own customers" ON public.customers;

-- 2. Fix categories security - remove overly permissive policy
DROP POLICY IF EXISTS "Categories viewable for specific store display" ON public.categories;

-- Create secure categories policy for public store views
CREATE POLICY "Categories viewable for public stores" 
ON public.categories 
FOR SELECT 
USING (owner_id IS NOT NULL);

-- 3. Remove legacy security risks
DROP TABLE IF EXISTS public.restaurant_owners CASCADE;
DROP TABLE IF EXISTS public."‏Bidaya" CASCADE;

-- 4. Remove legacy functions
DROP FUNCTION IF EXISTS public.get_restaurant_owner_profile() CASCADE;
DROP FUNCTION IF EXISTS public.verify_restaurant_owner_password(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_current_restaurant_owner_id() CASCADE;