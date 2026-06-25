-- v59: Fix load-test 404s — cardinality(jsonb) in grid JSON, get_store_meta overload ambiguity, sizes column drift

-- ---------------------------------------------------------------------------
-- 1) Helper — normalize product sizes (TEXT[] or JSONB) to JSONB for storefront
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._product_sizes_to_jsonb(p_sizes ANYELEMENT)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_sizes IS NULL THEN
    RETURN NULL;
  END IF;

  IF pg_typeof(p_sizes)::text = 'jsonb' THEN
    IF jsonb_typeof(p_sizes::jsonb) <> 'array' OR jsonb_array_length(p_sizes::jsonb) = 0 THEN
      RETURN NULL;
    END IF;
    RETURN p_sizes::jsonb;
  END IF;

  IF cardinality(p_sizes::text[]) = 0 THEN
    RETURN NULL;
  END IF;

  RETURN to_jsonb(p_sizes::text[]);
END;
$$;

CREATE OR REPLACE FUNCTION public._product_sizes_to_text_array(p_sizes ANYELEMENT)
RETURNS TEXT[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_sizes IS NULL THEN
    RETURN NULL;
  END IF;

  IF pg_typeof(p_sizes)::text = 'jsonb' THEN
    IF jsonb_typeof(p_sizes::jsonb) <> 'array' OR jsonb_array_length(p_sizes::jsonb) = 0 THEN
      RETURN NULL;
    END IF;
    RETURN ARRAY(SELECT jsonb_array_elements_text(p_sizes::jsonb));
  END IF;

  RETURN p_sizes::text[];
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) storefront_product_grid_json — fix sizes (was cardinality(jsonb) on some DBs)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.storefront_product_grid_json(p public.products)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_has_discount BOOLEAN;
BEGIN
  v_has_discount := COALESCE(p.discount_type, 'none') <> 'none'
    AND p.discount_value IS NOT NULL
    AND COALESCE(p.discount_value, 0) > 0;

  RETURN jsonb_strip_nulls(
    jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'description', left(COALESCE(p.description, ''), 80),
      'category', NULLIF(trim(p.category), ''),
      'price', p.price,
      'image_url', p.image_url,
      'stock_quantity', p.stock_quantity,
      'sizes', public._product_sizes_to_jsonb(p.sizes),
      'colors', CASE WHEN p.colors IS NULL OR p.colors = '[]'::jsonb THEN NULL ELSE p.colors END,
      'variants', public.storefront_compact_variants(p.variants),
      'discount_type', CASE WHEN v_has_discount THEN p.discount_type ELSE NULL END,
      'discount_value', CASE WHEN v_has_discount THEN p.discount_value ELSE NULL END,
      'discount_start_date', CASE WHEN v_has_discount THEN p.discount_start_date ELSE NULL END,
      'discount_end_date', CASE WHEN v_has_discount THEN p.discount_end_date ELSE NULL END,
      'original_price', CASE WHEN v_has_discount THEN COALESCE(p.original_price, p.price) ELSE NULL END,
      'created_at', p.created_at
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 3) get_store_meta — remove PostgREST overload ambiguity (PGRST203)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_store_meta(TEXT);

CREATE OR REPLACE FUNCTION public.get_store_meta(
  p_slug TEXT,
  p_include_policies BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_store JSONB;
  v_categories JSONB;
  v_cache_version BIGINT;
  v_policies JSONB;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9-]+$' THEN
    RETURN NULL;
  END IF;

  v_owner_id := public._resolve_store_owner_by_slug(p_slug);
  IF v_owner_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(ss.storefront_cache_version, 1)
  INTO v_cache_version
  FROM public.store_settings ss
  WHERE ss.owner_id = v_owner_id
  LIMIT 1;

  v_store := public.storefront_store_shell_json(v_owner_id, v_cache_version);

  IF v_store IS NULL THEN
    RETURN NULL;
  END IF;

  IF COALESCE(p_include_policies, false) THEN
    v_policies := public.get_store_policies(p_slug);
    IF v_policies IS NOT NULL THEN
      v_store := v_store || v_policies;
    END IF;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('id', c.id, 'name', c.name, 'display_order', c.display_order)
      ORDER BY c.display_order ASC
    ),
    '[]'::jsonb
  )
  INTO v_categories
  FROM public.categories c
  WHERE c.owner_id = v_owner_id;

  RETURN jsonb_build_object(
    'store', v_store,
    'categories', v_categories,
    'cache_version', COALESCE(v_cache_version, 1)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_store_meta(TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_meta(TEXT, BOOLEAN) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) get_store_products_by_slug — sizes column TEXT[] or JSONB
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_store_products_by_slug(TEXT);

CREATE OR REPLACE FUNCTION public.get_store_products_by_slug(p_slug TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  category TEXT,
  price NUMERIC,
  image_url TEXT,
  additional_images TEXT[],
  colors JSONB,
  sizes TEXT[],
  variants JSONB,
  discount_type TEXT,
  discount_value NUMERIC,
  original_price NUMERIC,
  stock_quantity INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9-]+$' THEN
    RETURN;
  END IF;

  v_owner_id := public._resolve_store_owner_by_slug(p_slug);
  IF v_owner_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.description,
    p.category,
    p.price,
    p.image_url,
    p.additional_images,
    p.colors,
    public._product_sizes_to_text_array(p.sizes),
    p.variants,
    p.discount_type,
    p.discount_value,
    p.original_price,
    p.stock_quantity
  FROM public.products p
  WHERE p.owner_id = v_owner_id
    AND p.archived_at IS NULL
    AND COALESCE(p.is_active, true) = true
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_store_products_by_slug(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_products_by_slug(TEXT) TO anon, authenticated;
