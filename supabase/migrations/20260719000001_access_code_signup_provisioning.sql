-- Access-code login: skip heavy auth triggers on signup, provision store explicitly after redeem.

CREATE OR REPLACE FUNCTION public.is_access_code_signup(p_meta JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(p_meta->>'sales_assigned', '') = 'true'
    OR p_meta ? 'access_code_id';
$$;

CREATE OR REPLACE FUNCTION public.provision_merchant_store(
  p_user_id UUID,
  p_store_name TEXT DEFAULT NULL,
  p_username TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_username TEXT;
  v_store_name TEXT;
  v_slug TEXT;
  v_counter INTEGER := 0;
  v_store_id UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_user');
  END IF;

  IF EXISTS (SELECT 1 FROM public.stores s WHERE s.user_id = p_user_id) THEN
    RETURN jsonb_build_object('success', true, 'already_provisioned', true);
  END IF;

  v_username := COALESCE(NULLIF(trim(p_username), ''), 'store');
  v_store_name := COALESCE(NULLIF(trim(p_store_name), ''), 'متجري');

  v_slug := LOWER(REGEXP_REPLACE(v_username, '[^a-z0-9]', '-', 'g'));
  v_slug := TRIM(BOTH '-' FROM v_slug);
  IF LENGTH(v_slug) < 3 THEN
    v_slug := v_slug || '-store';
  END IF;

  WHILE EXISTS (
    SELECT 1 FROM public.stores WHERE LOWER(store_slug) = v_slug
    UNION ALL
    SELECT 1 FROM public.store_settings WHERE LOWER(store_slug) = v_slug
  ) LOOP
    v_counter := v_counter + 1;
    v_slug := TRIM(BOTH '-' FROM LOWER(REGEXP_REPLACE(v_username, '[^a-z0-9]', '-', 'g'))) || '-' || v_counter;
  END LOOP;

  v_store_id := gen_random_uuid();

  INSERT INTO public.stores (id, user_id, store_name, store_slug, theme_id)
  VALUES (v_store_id, p_user_id, v_store_name, v_slug, 'default');

  INSERT INTO public.store_settings (
    id, owner_id, store_name, store_slug,
    menu_background_color, menu_text_color, menu_accent_color,
    banner_images, primary_banner_index, delivery_prices, payment_methods
  ) VALUES (
    v_store_id, p_user_id, v_store_name, v_slug,
    '#ffffff', '#000000', '#3b82f6',
    ARRAY[]::text[], 0,
    '[{"governorate":"القاهرة","price":50},{"governorate":"الجيزة","price":50},{"governorate":"الإسكندرية","price":75}]'::jsonb,
    '["cash_on_delivery"]'::jsonb
  );

  INSERT INTO public.categories (owner_id, store_id, name, display_order)
  VALUES (p_user_id, v_store_id, 'الكل', 0);

  INSERT INTO public.categories (owner_id, store_id, name, display_order) VALUES
    (p_user_id, v_store_id, 'ملابس', 1),
    (p_user_id, v_store_id, 'إلكترونيات', 2),
    (p_user_id, v_store_id, 'إكسسوارات', 3);

  INSERT INTO public.products (
    owner_id, store_id, name, description, category, price, stock_quantity, is_active
  ) VALUES (
    p_user_id, v_store_id,
    'منتج تجريبي',
    'هذا منتج تجريبي — يمكنك تعديله أو حذفه من لوحة التحكم',
    'الكل',
    99,
    10,
    true
  );

  RETURN jsonb_build_object('success', true, 'store_id', v_store_id, 'store_slug', v_slug);
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id TEXT;
  v_interval INT;
  v_username TEXT;
  v_candidate TEXT;
  v_suffix INT := 0;
BEGIN
  v_username := lower(trim(COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'username', ''),
    split_part(NEW.email, '@', 1)
  )));
  v_username := regexp_replace(v_username, '[^a-z0-9_-]', '', 'g');

  IF char_length(v_username) < 3 THEN
    v_username := 'user' || substr(replace(NEW.id::text, '-', ''), 1, 8);
  END IF;

  v_candidate := v_username;
  WHILE EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(username) = lower(v_candidate) AND id <> NEW.id
  ) LOOP
    v_suffix := v_suffix + 1;
    v_candidate := v_username || v_suffix::text;
  END LOOP;

  INSERT INTO public.profiles (id, user_id, username, store_name)
  VALUES (
    NEW.id,
    NEW.id,
    v_candidate,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'store_name'), ''), 'متجري')
  )
  ON CONFLICT (id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    username = EXCLUDED.username,
    store_name = EXCLUDED.store_name;

  IF public.is_access_code_signup(NEW.raw_user_meta_data) THEN
    RETURN NEW;
  END IF;

  v_plan_id := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'selected_plan'), ''), 'free');
  IF NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE id = v_plan_id) THEN
    v_plan_id := 'free';
  END IF;

  SELECT billing_interval_months INTO v_interval
  FROM public.subscription_plans WHERE id = v_plan_id;

  INSERT INTO public.store_subscriptions (
    owner_id, plan_id, status, current_period_start, current_period_end
  ) VALUES (
    NEW.id,
    v_plan_id,
    'trialing',
    NOW(),
    NOW() + (COALESCE(v_interval, 1) || ' months')::INTERVAL
  )
  ON CONFLICT (owner_id) DO NOTHING;

  RETURN NEW;
END;
$$;

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
  v_store_id UUID;
BEGIN
  IF public.is_access_code_signup(NEW.raw_user_meta_data) THEN
    RETURN NEW;
  END IF;

  v_username := COALESCE(NEW.raw_user_meta_data->>'username', 'store');
  v_store_name := COALESCE(NEW.raw_user_meta_data->>'store_name', 'متجري');

  v_slug := LOWER(REGEXP_REPLACE(v_username, '[^a-z0-9]', '-', 'g'));
  v_slug := TRIM(BOTH '-' FROM v_slug);
  IF LENGTH(v_slug) < 3 THEN
    v_slug := v_slug || '-store';
  END IF;

  WHILE EXISTS (
    SELECT 1 FROM public.stores WHERE LOWER(store_slug) = v_slug
    UNION ALL
    SELECT 1 FROM public.store_settings WHERE LOWER(store_slug) = v_slug
  ) LOOP
    v_counter := v_counter + 1;
    v_slug := TRIM(BOTH '-' FROM LOWER(REGEXP_REPLACE(v_username, '[^a-z0-9]', '-', 'g'))) || '-' || v_counter;
  END LOOP;

  v_store_id := gen_random_uuid();

  INSERT INTO public.stores (id, user_id, store_name, store_slug, theme_id)
  VALUES (v_store_id, NEW.id, v_store_name, v_slug, 'default');

  INSERT INTO public.store_settings (
    id, owner_id, store_name, store_slug,
    menu_background_color, menu_text_color, menu_accent_color,
    banner_images, primary_banner_index, delivery_prices, payment_methods
  ) VALUES (
    v_store_id, NEW.id, v_store_name, v_slug,
    '#ffffff', '#000000', '#3b82f6',
    ARRAY[]::text[], 0,
    '[{"governorate":"القاهرة","price":50},{"governorate":"الجيزة","price":50},{"governorate":"الإسكندرية","price":75}]'::jsonb,
    '["cash_on_delivery"]'::jsonb
  );

  INSERT INTO public.categories (owner_id, store_id, name, display_order)
  VALUES (NEW.id, v_store_id, 'الكل', 0);

  INSERT INTO public.categories (owner_id, store_id, name, display_order) VALUES
    (NEW.id, v_store_id, 'ملابس', 1),
    (NEW.id, v_store_id, 'إلكترونيات', 2),
    (NEW.id, v_store_id, 'إكسسوارات', 3);

  INSERT INTO public.products (
    owner_id, store_id, name, description, category, price, stock_quantity, is_active
  ) VALUES (
    NEW.id, v_store_id,
    'منتج تجريبي',
    'هذا منتج تجريبي — يمكنك تعديله أو حذفه من لوحة التحكم',
    'الكل',
    99,
    10,
    true
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_merchant_store(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_merchant_store(UUID, TEXT, TEXT) TO service_role;
