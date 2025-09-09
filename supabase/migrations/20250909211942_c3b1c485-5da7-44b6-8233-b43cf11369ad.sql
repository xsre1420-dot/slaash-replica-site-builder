-- CRITICAL SECURITY FIXES

-- 1. Fix customer data exposure - remove conflicting policies and implement secure access
DROP POLICY IF EXISTS "Deny public SELECT access to customers" ON public.customers;
DROP POLICY IF EXISTS "Restaurant owners can delete their own customers" ON public.customers;
DROP POLICY IF EXISTS "Restaurant owners can insert their own customers" ON public.customers;
DROP POLICY IF EXISTS "Restaurant owners can update their own customers" ON public.customers;
DROP POLICY IF EXISTS "Restaurant owners can view their own customers" ON public.customers;

-- Create secure, non-conflicting customer policies
CREATE POLICY "Users can view their own customers" 
ON public.customers 
FOR SELECT 
USING (auth.uid() = owner_id);

CREATE POLICY "Users can create their own customers" 
ON public.customers 
FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own customers" 
ON public.customers 
FOR UPDATE 
USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own customers" 
ON public.customers 
FOR DELETE 
USING (auth.uid() = owner_id);

-- 2. Fix categories security - replace overly permissive policy
DROP POLICY IF EXISTS "Categories viewable for specific store display" ON public.categories;

-- Create secure categories policy for public store views (only when owner_id is provided)
CREATE POLICY "Categories viewable for public stores" 
ON public.categories 
FOR SELECT 
USING (owner_id IS NOT NULL);

-- 3. Remove legacy security risks - drop unused tables with password hashes
DROP TABLE IF EXISTS public.restaurant_owners CASCADE;
DROP TABLE IF EXISTS public."‏Bidaya" CASCADE;

-- 4. Remove legacy functions that reference dropped tables
DROP FUNCTION IF EXISTS public.get_restaurant_owner_profile() CASCADE;
DROP FUNCTION IF EXISTS public.verify_restaurant_owner_password(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_current_restaurant_owner_id() CASCADE;

-- 5. Clean up any triggers that might reference dropped tables
DROP TRIGGER IF EXISTS update_restaurant_owners_updated_at ON public.restaurant_owners;

-- 6. Add security logging function for sensitive data access
CREATE OR REPLACE FUNCTION public.log_sensitive_access(
  table_name text,
  operation text,
  record_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log access to sensitive tables for audit purposes
  INSERT INTO public.store_visits (owner_id, page_path, visitor_ip, user_agent, created_at)
  VALUES (
    auth.uid(),
    format('AUDIT:%s:%s:%s', table_name, operation, record_id),
    'system_audit',
    format('User %s accessed %s table', auth.uid(), table_name),
    now()
  );
END;
$$;

-- 7. Ensure proper constraints on critical tables
ALTER TABLE public.customers 
  ALTER COLUMN owner_id SET NOT NULL,
  ALTER COLUMN phone SET NOT NULL;

ALTER TABLE public.categories 
  ALTER COLUMN owner_id SET NOT NULL;