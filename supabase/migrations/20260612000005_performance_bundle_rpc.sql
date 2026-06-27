-- Performance: single-round-trip storefront bundle RPC

CREATE OR REPLACE FUNCTION public.get_store_bundle(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_store JSONB;
  v_products JSONB;
  v_categories JSONB;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9-]+$' THEN
    RETURN NULL;
  END IF;

  SELECT to_jsonb(s.*) INTO v_store
  FROM store_settings s
  WHERE LOWER(s.store_slug) = LOWER(trim(p_slug))
  LIMIT 1;

  IF v_store IS NULL THEN
    RETURN NULL;
  END IF;

  v_owner_id := (v_store->>'owner_id')::UUID;
  IF v_owner_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(p.*) ORDER BY p.created_at DESC), '[]'::jsonb)
  INTO v_products
  FROM products p
  WHERE p.owner_id = v_owner_id AND COALESCE(p.is_active, true) = true;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('id', c.id, 'name', c.name, 'display_order', c.display_order)
    ORDER BY c.display_order ASC
  ), '[]'::jsonb)
  INTO v_categories
  FROM categories c
  WHERE c.owner_id = v_owner_id;

  RETURN jsonb_build_object(
    'store', v_store,
    'products', v_products,
    'categories', v_categories
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_store_bundle(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_bundle(TEXT) TO anon, authenticated;
