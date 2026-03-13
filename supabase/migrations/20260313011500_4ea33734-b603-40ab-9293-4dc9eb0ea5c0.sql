
-- Auto-provision store on user signup
CREATE OR REPLACE FUNCTION public.provision_new_store()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_username TEXT;
  v_store_name TEXT;
  v_slug TEXT;
  v_counter INTEGER := 0;
BEGIN
  v_username := COALESCE(NEW.raw_user_meta_data->>'username', 'store');
  v_store_name := COALESCE(NEW.raw_user_meta_data->>'store_name', 'متجري');
  
  -- Generate slug from username
  v_slug := LOWER(REGEXP_REPLACE(v_username, '[^a-z0-9]', '-', 'g'));
  v_slug := TRIM(BOTH '-' FROM v_slug);
  IF LENGTH(v_slug) < 3 THEN
    v_slug := v_slug || '-store';
  END IF;
  
  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM public.store_settings WHERE LOWER(store_slug) = v_slug) LOOP
    v_counter := v_counter + 1;
    v_slug := TRIM(BOTH '-' FROM LOWER(REGEXP_REPLACE(v_username, '[^a-z0-9]', '-', 'g'))) || '-' || v_counter;
  END LOOP;

  -- Create store_settings with defaults
  INSERT INTO public.store_settings (
    owner_id, store_name, store_slug,
    menu_background_color, menu_text_color, menu_accent_color,
    banner_images, primary_banner_index, delivery_prices, payment_methods
  ) VALUES (
    NEW.id, v_store_name, v_slug,
    '#ffffff', '#000000', '#3b82f6',
    ARRAY[]::text[], 0,
    '[{"governorate":"القاهرة","price":50},{"governorate":"الجيزة","price":50},{"governorate":"الإسكندرية","price":75}]'::jsonb,
    '["cash_on_delivery"]'::jsonb
  );

  -- Create default categories
  INSERT INTO public.categories (owner_id, name, display_order) VALUES
    (NEW.id, 'الكل', 0),
    (NEW.id, 'ملابس', 1),
    (NEW.id, 'إلكترونيات', 2),
    (NEW.id, 'إكسسوارات', 3);

  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users (fires after insert, i.e. after signup)
DROP TRIGGER IF EXISTS on_auth_user_created_provision ON auth.users;
CREATE TRIGGER on_auth_user_created_provision
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.provision_new_store();
