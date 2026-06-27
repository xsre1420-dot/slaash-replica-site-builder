-- v77: Hot path optimization — checkout preflight bundle, slim checkout products, benchmark RPC

-- ---------------------------------------------------------------------------
-- 1) Checkout product JSON — storefront shape (no cost); smaller than to_jsonb(p)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.checkout_product_json(p public.products)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN public.storefront_product_json(p);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_checkout_products_by_ids(
  p_slug TEXT,
  p_product_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9-]+$' OR p_product_ids IS NULL OR array_length(p_product_ids, 1) IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  v_owner_id := public._resolve_store_owner_by_slug(p_slug);
  IF v_owner_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(public.checkout_product_json(p) ORDER BY p.id)
    FROM public.products p
    WHERE p.owner_id = v_owner_id
      AND p.id = ANY(p_product_ids)
      AND COALESCE(p.is_active, true) = true
      AND p.archived_at IS NULL
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_owner_checkout_products_by_ids(
  p_owner_id UUID,
  p_product_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN '[]'::jsonb;
  END IF;

  IF p_product_ids IS NULL OR array_length(p_product_ids, 1) IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(public.checkout_product_json(p) ORDER BY p.id)
    FROM public.products p
    WHERE p.owner_id = p_owner_id
      AND p.id = ANY(p_product_ids)
      AND COALESCE(p.is_active, true) = true
      AND p.archived_at IS NULL
  ), '[]'::jsonb);
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) Checkout preflight — products + delivery + coupon in one round-trip
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_checkout_preflight_bundle(
  p_slug TEXT,
  p_product_ids UUID[],
  p_governorate TEXT DEFAULT NULL,
  p_coupon_code TEXT DEFAULT NULL,
  p_subtotal NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_products JSONB;
  v_delivery NUMERIC;
  v_coupon JSONB;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9-]+$' OR p_product_ids IS NULL OR array_length(p_product_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('products', '[]'::jsonb, 'delivery_fee', 0);
  END IF;

  v_owner_id := public._resolve_store_owner_by_slug(p_slug);
  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('products', '[]'::jsonb, 'delivery_fee', 0);
  END IF;

  SELECT COALESCE((
    SELECT jsonb_agg(public.checkout_product_json(p) ORDER BY p.id)
    FROM public.products p
    WHERE p.owner_id = v_owner_id
      AND p.id = ANY(p_product_ids)
      AND COALESCE(p.is_active, true) = true
      AND p.archived_at IS NULL
  ), '[]'::jsonb)
  INTO v_products;

  v_delivery := 0;
  IF NULLIF(trim(p_governorate), '') IS NOT NULL THEN
    v_delivery := COALESCE(public.calculate_delivery_fee_by_slug(p_slug, trim(p_governorate)), 0);
  END IF;

  v_coupon := NULL;
  IF NULLIF(trim(p_coupon_code), '') IS NOT NULL AND COALESCE(p_subtotal, 0) > 0 THEN
    v_coupon := public.validate_store_coupon_by_slug(p_slug, trim(p_coupon_code), p_subtotal);
  END IF;

  RETURN jsonb_strip_nulls(
    jsonb_build_object(
      'products', v_products,
      'delivery_fee', v_delivery,
      'coupon', v_coupon
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 3) Hot path benchmark — latency probes for storefront + checkout paths
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_hot_path_benchmark(
  p_slug TEXT DEFAULT NULL,
  p_product_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug TEXT;
  v_started TIMESTAMPTZ;
  v_bundle JSONB;
  v_page JSONB;
  v_preflight JSONB;
  v_product_ids UUID[];
  v_ms_bundle NUMERIC;
  v_ms_page NUMERIC;
  v_ms_preflight NUMERIC;
  v_ms_product NUMERIC;
  v_product JSONB;
BEGIN
  v_slug := NULLIF(lower(trim(COALESCE(p_slug, ''))), '');
  IF v_slug IS NULL OR v_slug !~ '^[a-z0-9-]+$' THEN
    SELECT l.store_slug INTO v_slug
    FROM public.list_public_store_slugs(1, 0) AS l
    LIMIT 1;
  END IF;

  IF v_slug IS NULL THEN
    RETURN jsonb_build_object('error', 'no_slug', 'measured_at', NOW());
  END IF;

  v_started := clock_timestamp();
  v_bundle := public.get_storefront_page_bundle(v_slug, 24, '', '', '');
  v_ms_bundle := EXTRACT(MILLISECOND FROM clock_timestamp() - v_started)::numeric
    + EXTRACT(SECOND FROM clock_timestamp() - v_started)::numeric * 1000;

  v_started := clock_timestamp();
  v_page := public.get_store_products_page(v_slug, 24, NULL, NULL, NULL);
  v_ms_page := EXTRACT(MILLISECOND FROM clock_timestamp() - v_started)::numeric
    + EXTRACT(SECOND FROM clock_timestamp() - v_started)::numeric * 1000;

  SELECT COALESCE(
    ARRAY(
      SELECT (elem->>'id')::uuid
      FROM jsonb_array_elements(COALESCE(v_bundle->'products', '[]'::jsonb)) elem
      LIMIT 3
    ),
    ARRAY[]::uuid[]
  )
  INTO v_product_ids;

  v_ms_preflight := NULL;
  IF cardinality(v_product_ids) > 0 THEN
    v_started := clock_timestamp();
    v_preflight := public.get_checkout_preflight_bundle(
      v_slug,
      v_product_ids,
      NULL,
      NULL,
      NULL
    );
    v_ms_preflight := EXTRACT(MILLISECOND FROM clock_timestamp() - v_started)::numeric
      + EXTRACT(SECOND FROM clock_timestamp() - v_started)::numeric * 1000;
  END IF;

  v_ms_product := NULL;
  IF p_product_id IS NOT NULL THEN
    v_started := clock_timestamp();
    v_product := public.get_store_product_by_id(v_slug, p_product_id);
    v_ms_product := EXTRACT(MILLISECOND FROM clock_timestamp() - v_started)::numeric
      + EXTRACT(SECOND FROM clock_timestamp() - v_started)::numeric * 1000;
  ELSIF cardinality(v_product_ids) > 0 THEN
    v_started := clock_timestamp();
    v_product := public.get_store_product_by_id(v_slug, v_product_ids[1]);
    v_ms_product := EXTRACT(MILLISECOND FROM clock_timestamp() - v_started)::numeric
      + EXTRACT(SECOND FROM clock_timestamp() - v_started)::numeric * 1000;
  END IF;

  RETURN jsonb_strip_nulls(
    jsonb_build_object(
      'slug', v_slug,
      'measured_at', NOW(),
      'storefront_bundle_ms', round(v_ms_bundle, 2),
      'storefront_bundle_bytes', octet_length(COALESCE(v_bundle, '{}'::jsonb)::text),
      'storefront_page_ms', round(v_ms_page, 2),
      'storefront_page_bytes', octet_length(COALESCE(v_page, '{}'::jsonb)::text),
      'checkout_preflight_ms', CASE WHEN v_ms_preflight IS NOT NULL THEN round(v_ms_preflight, 2) ELSE NULL END,
      'checkout_preflight_bytes', CASE WHEN v_preflight IS NOT NULL THEN octet_length(v_preflight::text) ELSE NULL END,
      'product_detail_ms', CASE WHEN v_ms_product IS NOT NULL THEN round(v_ms_product, 2) ELSE NULL END,
      'product_detail_bytes', CASE WHEN v_product IS NOT NULL THEN octet_length(v_product::text) ELSE NULL END,
      'rpc_calls_saved_checkout_preflight', 2
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.checkout_product_json(public.products) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_checkout_preflight_bundle(TEXT, UUID[], TEXT, TEXT, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_hot_path_benchmark(TEXT, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_checkout_preflight_bundle(TEXT, UUID[], TEXT, TEXT, NUMERIC) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_hot_path_benchmark(TEXT, UUID) TO authenticated, service_role;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (77, 'hot_path: checkout preflight bundle, slim checkout JSON, benchmark RPC')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
