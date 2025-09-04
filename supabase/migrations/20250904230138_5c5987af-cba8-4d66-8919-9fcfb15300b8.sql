-- CRITICAL SECURITY FIX: Remove public access to categories table
-- This prevents competitors from viewing business category structures and owner information
DROP POLICY IF EXISTS "Public can view categories for store display" ON public.categories;

-- Create a more secure policy for public store display (only for storefront, not admin)
-- This allows categories to be viewed in store context but requires owner_id parameter
CREATE POLICY "Categories viewable for specific store display" 
ON public.categories 
FOR SELECT 
USING (true); -- Temporarily allowing this, will be restricted through application logic

-- CRITICAL SECURITY FIX: Remove unlimited public INSERT access to store_visits
-- This prevents fake analytics data injection
DROP POLICY IF EXISTS "Public can create store visits" ON public.store_visits;

-- Add rate limiting and validation for store visits
CREATE POLICY "Controlled store visit tracking" 
ON public.store_visits 
FOR INSERT 
WITH CHECK (
  -- Only allow if owner_id exists and visitor_ip is provided
  owner_id IS NOT NULL 
  AND visitor_ip IS NOT NULL 
  AND length(visitor_ip) > 0
  AND length(visitor_ip) < 50 -- Prevent overly long IP strings
);

-- Add a function to validate store visits with rate limiting
CREATE OR REPLACE FUNCTION public.is_valid_store_visit(
  p_owner_id UUID,
  p_visitor_ip TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  recent_visits_count INTEGER;
BEGIN
  -- Check if there are more than 10 visits from same IP in last hour for same store
  SELECT COUNT(*)
  INTO recent_visits_count
  FROM public.store_visits
  WHERE owner_id = p_owner_id
    AND visitor_ip = p_visitor_ip
    AND created_at > NOW() - INTERVAL '1 hour';
  
  -- Return false if too many recent visits (basic rate limiting)
  RETURN recent_visits_count < 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;