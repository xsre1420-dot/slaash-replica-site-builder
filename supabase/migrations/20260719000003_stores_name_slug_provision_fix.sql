-- Fix store provisioning for legacy stores schema (name + slug NOT NULL).

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

  SELECT s.id INTO v_store_id
  FROM public.stores s
  WHERE s.user_id = p_user_id OR s.owner_id = p_user_id
  LIMIT 1;

  IF v_store_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already_provisioned', true, 'store_id', v_store_id);
  END IF;

  v_username := COALESCE(NULLIF(trim(p_username), ''), 'store');
  v_store_name := COALESCE(NULLIF(trim(p_store_name), ''), 'متجري');

  v_slug := LOWER(REGEXP_REPLACE(v_username, '[^a-z0-9]', '-', 'g'));
  v_slug := TRIM(BOTH '-' FROM v_slug);
  IF LENGTH(v_slug) < 3 THEN
    v_slug := v_slug || '-store';
  END IF;

  WHILE EXISTS (
    SELECT 1 FROM public.stores WHERE LOWER(COALESCE(store_slug, slug)) = v_slug
    UNION ALL
    SELECT 1 FROM public.store_settings WHERE LOWER(store_slug) = v_slug
  ) LOOP
    v_counter := v_counter + 1;
    v_slug := TRIM(BOTH '-' FROM LOWER(REGEXP_REPLACE(v_username, '[^a-z0-9]', '-', 'g'))) || '-' || v_counter;
  END LOOP;

  v_store_id := gen_random_uuid();

  INSERT INTO public.stores (
    id, user_id, owner_id, name, slug, store_name, store_slug, theme_id
  )
  VALUES (
    v_store_id, p_user_id, p_user_id, v_store_name, v_slug, v_store_name, v_slug, 'default'
  );

  INSERT INTO public.store_settings (
    owner_id, store_name, store_slug,
    menu_background_color, menu_text_color, menu_accent_color,
    banner_images, primary_banner_index, delivery_prices, payment_methods
  ) VALUES (
    p_user_id, v_store_name, v_slug,
    '#ffffff', '#000000', '#3b82f6',
    ARRAY[]::text[], 0,
    '[{"governorate":"القاهرة","price":50},{"governorate":"الجيزة","price":50},{"governorate":"الإسكندرية","price":75}]'::jsonb,
    '["cash_on_delivery"]'::jsonb
  )
  ON CONFLICT (owner_id) DO UPDATE SET
    store_name = EXCLUDED.store_name,
    store_slug = EXCLUDED.store_slug,
    updated_at = NOW();

  INSERT INTO public.categories (owner_id, store_id, name, display_order)
  VALUES (p_user_id, v_store_id, 'الكل', 0);

  INSERT INTO public.categories (owner_id, store_id, name, display_order) VALUES
    (p_user_id, v_store_id, 'ملابس', 1),
    (p_user_id, v_store_id, 'إلكترونيات', 2),
    (p_user_id, v_store_id, 'إكسسوارات', 3);

  BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('success', true, 'store_id', v_store_id, 'store_slug', v_slug);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
