-- Fix function search path security issue

-- Update existing functions to have proper search_path
CREATE OR REPLACE FUNCTION public.update_store_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_customer_stats()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, store_name)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email), 
    COALESCE(NEW.raw_user_meta_data->>'store_name', 'متجري')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_valid_store_visit(p_owner_id uuid, p_visitor_ip text)
RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;