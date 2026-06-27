-- CRITICAL SECURITY FIXES

-- 1. Fix customer data exposure - remove conflicting policies and implement secure access
DROP POLICY IF EXISTS "Deny public SELECT access to customers" ON public.customers;
DROP POLICY IF EXISTS "Restaurant owners can delete their own customers" ON public.customers;
DROP POLICY IF EXISTS "Restaurant owners can insert their own customers" ON public.customers;
DROP POLICY IF EXISTS "Restaurant owners can update their own customers" ON public.customers;
DROP POLICY IF EXISTS "Restaurant owners can view their own customers" ON public.customers;

-- Create secure, non-conflicting customer policies
DROP POLICY IF EXISTS "Users can view their own customers" ON public.customers;
CREATE POLICY "Users can view their own customers" 
ON public.customers 
FOR SELECT 
USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can create their own customers" ON public.customers;
CREATE POLICY "Users can create their own customers" 
ON public.customers 
FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update their own customers" ON public.customers;
CREATE POLICY "Users can update their own customers" 
ON public.customers 
FOR UPDATE 
USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can delete their own customers" ON public.customers;
CREATE POLICY "Users can delete their own customers" 
ON public.customers 
FOR DELETE 
USING (auth.uid() = owner_id);

-- 2. Fix categories security - replace overly permissive policy
DROP POLICY IF EXISTS "Categories viewable for specific store display" ON public.categories;

-- Create secure categories policy for public store views (only when owner_id is provided)
DROP POLICY IF EXISTS "Categories viewable for public stores" ON public.categories;
CREATE POLICY "Categories viewable for public stores" 
ON public.categories 
FOR SELECT 
USING (owner_id IS NOT NULL);

-- 3. Legacy tables: keep existing remote data (do not drop restaurant_owners on production baselines)
-- DROP TABLE IF EXISTS public.restaurant_owners CASCADE;
DROP TABLE IF EXISTS public."‏Bidaya" CASCADE;

-- 4. Keep owner context helpers on legacy servers; only drop unused password helpers
DROP FUNCTION IF EXISTS public.get_restaurant_owner_profile() CASCADE;
DROP FUNCTION IF EXISTS public.verify_restaurant_owner_password(text, text) CASCADE;
-- DROP FUNCTION IF EXISTS public.get_current_restaurant_owner_id() CASCADE;

-- 5. Clean up any triggers that might reference dropped tables (skip if table retained)
-- DROP TRIGGER IF EXISTS update_restaurant_owners_updated_at ON public.restaurant_owners;

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

-- 7. Ensure proper constraints on critical tables (skip if legacy rows have NULLs)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE owner_id IS NULL OR phone IS NULL) THEN
    ALTER TABLE public.customers
      ALTER COLUMN owner_id SET NOT NULL,
      ALTER COLUMN phone SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE owner_id IS NULL) THEN
    ALTER TABLE public.categories ALTER COLUMN owner_id SET NOT NULL;
  END IF;
END $$;