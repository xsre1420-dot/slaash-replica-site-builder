-- Fix function search path security warning
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;