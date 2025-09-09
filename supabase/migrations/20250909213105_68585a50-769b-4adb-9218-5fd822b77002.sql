-- Fix remaining function search path issue

CREATE OR REPLACE FUNCTION public.audit_sensitive_operations()
RETURNS TRIGGER AS $$
BEGIN
  -- Log sensitive operations for security monitoring
  INSERT INTO public.store_visits (owner_id, visitor_ip, page_path, user_agent)
  SELECT 
    CASE 
      WHEN TG_TABLE_NAME = 'orders' THEN NEW.owner_id
      WHEN TG_TABLE_NAME = 'customers' THEN NEW.owner_id
      ELSE auth.uid()
    END,
    'audit-system',
    TG_TABLE_NAME || '_' || TG_OP,
    'security-audit'
  WHERE auth.uid() IS NOT NULL;
  
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;