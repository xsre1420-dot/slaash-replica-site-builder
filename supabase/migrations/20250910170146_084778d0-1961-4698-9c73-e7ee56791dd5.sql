-- Fix search path security warning for the log_security_event function
CREATE OR REPLACE FUNCTION public.log_security_event()
RETURNS TRIGGER AS $$
BEGIN
  -- Log security-sensitive operations
  INSERT INTO public.store_visits (owner_id, visitor_ip, page_path, user_agent)
  VALUES (
    CASE 
      WHEN TG_TABLE_NAME = 'categories' THEN COALESCE(NEW.owner_id, OLD.owner_id)
      WHEN TG_TABLE_NAME = 'products' THEN COALESCE(NEW.owner_id, OLD.owner_id)
      ELSE auth.uid()
    END,
    'system-audit',
    TG_TABLE_NAME || '_' || TG_OP || '_security_log',
    'security-monitoring'
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;