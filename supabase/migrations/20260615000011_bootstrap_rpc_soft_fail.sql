-- Soft-fail owner bootstrap when session is missing (avoid RPC exceptions on race)

CREATE OR REPLACE FUNCTION public.get_owner_bootstrap(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_store_id UUID;
  v_result JSON;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_store_id FROM public.stores WHERE user_id = p_user_id LIMIT 1;

  SELECT json_build_object(
    'store', (
      SELECT json_build_object(
        'id', s.id,
        'user_id', s.user_id,
        'store_name', s.store_name,
        'store_slug', s.store_slug,
        'theme_id', COALESCE(s.theme_id, 'default')
      )
      FROM public.stores s WHERE s.user_id = p_user_id LIMIT 1
    ),
    'settings', (
      SELECT row_to_json(ss.*)
      FROM public.store_settings ss
      WHERE ss.owner_id = p_user_id
      LIMIT 1
    ),
    'categories', COALESCE((
      SELECT json_agg(json_build_object('id', c.id, 'name', c.name, 'order', c.display_order) ORDER BY c.display_order)
      FROM public.categories c
      WHERE c.store_id = v_store_id OR c.owner_id = p_user_id
    ), '[]'::json),
    'products', COALESCE((
      SELECT json_agg(row_to_json(p.*) ORDER BY p.created_at DESC)
      FROM (
        SELECT id, name, description, category, price, cost, image_url, stock_quantity, is_active, store_id, created_at
        FROM public.products
        WHERE store_id = v_store_id OR owner_id = p_user_id
        ORDER BY created_at DESC
        LIMIT 50
      ) p
    ), '[]'::json),
    'orders_count', (
      SELECT COUNT(*)::int FROM public.orders
      WHERE store_id = v_store_id OR owner_id = p_user_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;
