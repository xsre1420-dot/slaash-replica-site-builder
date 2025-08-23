-- Fix security issue: Prevent password hash exposure in restaurant_owners table

-- 1. Create a secure view for restaurant owner profiles that excludes password_hash
CREATE OR REPLACE VIEW public.restaurant_owner_profiles AS
SELECT 
  id,
  username,
  restaurant_name,
  restaurant_logo,
  created_at,
  updated_at
FROM public.restaurant_owners;

-- 2. Enable RLS on the view
ALTER VIEW public.restaurant_owner_profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create secure RLS policies for the view (no password access)
CREATE POLICY "Restaurant owners can view their own secure profile" 
ON public.restaurant_owner_profiles 
FOR SELECT 
USING (id = get_current_restaurant_owner_id());

-- 4. Create a secure function to get current restaurant owner profile without password
CREATE OR REPLACE FUNCTION public.get_restaurant_owner_profile()
RETURNS TABLE(
  id uuid,
  username text,
  restaurant_name text,
  restaurant_logo text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
) 
LANGUAGE SQL 
SECURITY DEFINER 
STABLE
SET search_path = public
AS $$
  SELECT 
    ro.id,
    ro.username,
    ro.restaurant_name,
    ro.restaurant_logo,
    ro.created_at,
    ro.updated_at
  FROM public.restaurant_owners ro
  WHERE ro.id = get_current_restaurant_owner_id()
  LIMIT 1;
$$;

-- 5. Create a function for password verification (for login purposes)
CREATE OR REPLACE FUNCTION public.verify_restaurant_owner_password(
  input_username text,
  input_password_hash text
)
RETURNS TABLE(
  id uuid,
  username text,
  restaurant_name text,
  restaurant_logo text
) 
LANGUAGE SQL 
SECURITY DEFINER 
STABLE
SET search_path = public
AS $$
  SELECT 
    ro.id,
    ro.username,
    ro.restaurant_name,
    ro.restaurant_logo
  FROM public.restaurant_owners ro
  WHERE ro.username = input_username 
    AND ro.password_hash = input_password_hash
  LIMIT 1;
$$;

-- 6. Remove the existing SELECT policy that could expose passwords
DROP POLICY IF EXISTS "Restaurant owners can view their own profile" ON public.restaurant_owners;

-- 7. Create a new restrictive SELECT policy that denies all direct SELECT access
CREATE POLICY "Deny direct SELECT access to restaurant_owners" 
ON public.restaurant_owners 
FOR SELECT 
USING (false);

-- 8. Keep the UPDATE policy but ensure it cannot be used to view password_hash
-- The existing UPDATE policy is fine as it doesn't return the password_hash

-- 9. Update the search_path for existing functions to fix security warnings
CREATE OR REPLACE FUNCTION public.get_current_restaurant_owner_id()
RETURNS uuid
LANGUAGE SQL
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.restaurant_owners 
  WHERE id = COALESCE(current_setting('app.current_owner_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
  LIMIT 1;
$$;

-- 10. Fix the update trigger function search_path
CREATE OR REPLACE FUNCTION public.update_store_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 11. Fix the customer stats function search_path  
CREATE OR REPLACE FUNCTION public.update_customer_stats()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Update or insert customer record
  INSERT INTO public.customers (owner_id, phone, name, first_order_date, last_order_date, total_orders, total_spent)
  VALUES (NEW.owner_id, NEW.customer_phone, NEW.customer_name, NEW.created_at, NEW.created_at, 1, NEW.total_amount)
  ON CONFLICT (owner_id, phone) 
  DO UPDATE SET
    name = COALESCE(EXCLUDED.name, customers.name),
    last_order_date = EXCLUDED.last_order_date,
    total_orders = customers.total_orders + 1,
    total_spent = customers.total_spent + EXCLUDED.total_spent,
    updated_at = now();
  
  RETURN NEW;
END;
$$;

-- 12. Fix the user handling function search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, store_name)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email), 
    COALESCE(NEW.raw_user_meta_data->>'store_name', 'متجري')
  );
  RETURN NEW;
END;
$$;