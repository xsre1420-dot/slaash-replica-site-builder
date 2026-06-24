-- Scale to 1000+ concurrent storefront users: indexes, visit dedupe, bundle RPC, health v21

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Visit rate-limit COUNT (owner + IP + hour window)
CREATE INDEX IF NOT EXISTS idx_store_visits_owner_ip_created
  ON public.store_visits (owner_id, visitor_ip, created_at DESC);

-- Same-path dedupe within 5 minutes (reduces write amplification under viral traffic)
CREATE INDEX IF NOT EXISTS idx_store_visits_owner_ip_path_created
  ON public.store_visits (owner_id, visitor_ip, page_path, created_at DESC);

-- Storefront ILIKE search on product names
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON public.products USING gin (name gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Optimized visit tracking: DB-level path dedupe + indexed rate limit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.track_store_visit_by_slug(
  p_store_slug TEXT,
  p_page_path TEXT DEFAULT '/',
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
  v_ip TEXT;
  v_path TEXT;
BEGIN
  IF p_store_slug IS NULL OR trim(p_store_slug) = '' OR p_store_slug !~ '^[a-z0-9-]+$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_slug');
  END IF;

  SELECT ss.owner_id INTO v_owner
  FROM store_settings ss
  WHERE lower(trim(ss.store_slug)) = lower(trim(p_store_slug))
  LIMIT 1;

  IF v_owner IS NULL THEN
    SELECT s.user_id INTO v_owner
    FROM stores s
    WHERE lower(trim(s.store_slug)) = lower(trim(p_store_slug))
    LIMIT 1;
  END IF;

  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'store_not_found');
  END IF;

  v_ip := COALESCE(
    NULLIF(split_part(COALESCE(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1), ''),
    NULLIF(current_setting('request.headers', true)::json->>'x-real-ip', ''),
    '0.0.0.0'
  );

  v_path := COALESCE(NULLIF(trim(p_page_path), ''), '/');

  -- Skip duplicate page view within 5 minutes (same store + IP + path)
  IF EXISTS (
    SELECT 1
    FROM public.store_visits sv
    WHERE sv.owner_id = v_owner
      AND sv.visitor_ip = v_ip
      AND sv.page_path = v_path
      AND sv.created_at > NOW() - INTERVAL '5 minutes'
    LIMIT 1
  ) THEN
    RETURN jsonb_build_object('success', true, 'deduped', true);
  END IF;

  IF NOT public.is_valid_store_visit(v_owner, v_ip) THEN
    RETURN jsonb_build_object('success', false, 'error', 'rate_limited');
  END IF;

  INSERT INTO public.store_visits (owner_id, visitor_ip, page_path, user_agent)
  VALUES (v_owner, v_ip, v_path, p_user_agent);

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.track_store_visit_by_slug(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_store_visit_by_slug(TEXT, TEXT, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Single-RPC storefront bootstrap (meta + first product page) — halves round-trips
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_storefront_page_bundle(
  p_slug TEXT,
  p_limit INT DEFAULT 24,
  p_cursor TEXT DEFAULT '',
  p_category TEXT DEFAULT '',
  p_search TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta JSONB;
  v_page JSONB;
BEGIN
  IF p_slug IS NULL OR trim(p_slug) = '' OR p_slug !~ '^[a-z0-9-]+$' THEN
    RETURN NULL;
  END IF;

  v_meta := public.get_store_meta(p_slug);
  IF v_meta IS NULL OR v_meta->'store' IS NULL THEN
    RETURN NULL;
  END IF;

  v_page := public.get_store_products_page(
    p_slug,
    LEAST(GREATEST(COALESCE(p_limit, 24), 1), 48),
    NULLIF(trim(p_cursor), ''),
    NULLIF(trim(p_category), ''),
    NULLIF(trim(p_search), '')
  );

  RETURN v_meta || jsonb_build_object(
    'products', COALESCE(v_page->'products', '[]'::jsonb),
    'next_cursor', v_page->'next_cursor',
    'has_more', COALESCE((v_page->>'has_more')::boolean, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_storefront_page_bundle(TEXT, INT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_page_bundle(TEXT, INT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- platform_health_check v21
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_health_check()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_required INT := 21;
  v_version INT := 0;
  v_missing TEXT[] := ARRAY[]::TEXT[];
  v_fn TEXT;
  v_required_fns TEXT[] := ARRAY[
    'get_store_products_page',
    'get_store_products_by_slug',
    'get_store_product_by_id',
    'get_checkout_products_by_ids',
    'get_owner_checkout_products_by_ids',
    'get_store_meta',
    'get_storefront_page_bundle',
    'get_owner_products_page',
    'create_order_with_stock_deduction',
    'checkout_resolve_duplicate_order',
    'get_order_by_idempotency_key',
    'resolve_checkout_owner',
    'publish_owner_product',
    'get_merchant_product_reviews',
    'submit_product_review_for_store',
    'product_checkout_available_qty',
    'get_store_statistics',
    'get_dashboard_statistics_batch',
    'get_order_items_for_statistics',
    'get_owner_bootstrap',
    'attach_order_marketing_attribution',
    'list_merchant_orders',
    'count_merchant_orders_by_workflow',
    'list_public_store_slugs',
    'get_storefront_footer_products',
    'submit_access_lead',
    'admin_list_leads',
    'admin_get_lead',
    'increment_product_stock',
    'track_store_visit_by_slug'
  ];
  v_required_cols TEXT[] := ARRAY[
    'products.archived_at',
    'products.is_active',
    'products.variants',
    'products.stock_quantity',
    'products.store_id',
    'orders.idempotency_key',
    'orders.payment_status',
    'orders.delivery_status',
    'orders.store_id',
    'orders.marketing_attribution',
    'store_settings.store_slug',
    'order_items.owner_id',
    'customers.store_id',
    'leads.selected_plan_id',
    'leads.selected_plan_name',
    'leads.governorate',
    'leads.instagram_url',
    'leads.expected_monthly_orders'
  ];
  v_col TEXT;
  v_table TEXT;
  v_column TEXT;
BEGIN
  SELECT COALESCE(
    (SELECT psv.version FROM public.platform_schema_version psv ORDER BY psv.version DESC LIMIT 1),
    0
  ) INTO v_version;

  FOREACH v_fn IN ARRAY v_required_fns LOOP
    IF NOT public._platform_fn_exists(v_fn) THEN
      v_missing := array_append(v_missing, v_fn);
    END IF;
  END LOOP;

  FOREACH v_col IN ARRAY v_required_cols LOOP
    v_table := split_part(v_col, '.', 1);
    v_column := split_part(v_col, '.', 2);
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = v_table AND column_name = v_column
    ) THEN
      v_missing := array_append(v_missing, v_col);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'schema_version', v_version,
    'required_version', v_required,
    'missing', COALESCE(v_missing, ARRAY[]::TEXT[]),
    'checks', jsonb_build_object(
      'storefront', public._platform_fn_exists('get_store_products_page'),
      'storefront_bundle', public._platform_fn_exists('get_storefront_page_bundle'),
      'checkout', public._platform_fn_exists('create_order_with_stock_deduction'),
      'checkout_recovery', public._platform_fn_exists('get_order_by_idempotency_key'),
      'dashboard_batch', public._platform_fn_exists('get_dashboard_statistics_batch'),
      'merchant_orders', public._platform_fn_exists('list_merchant_orders'),
      'statistics', public._platform_fn_exists('get_store_statistics'),
      'sitemap', public._platform_fn_exists('list_public_store_slugs'),
      'visit_tracking', public._platform_fn_exists('track_store_visit_by_slug')
    ),
    'message', CASE
      WHEN COALESCE(array_length(v_missing, 1), 0) > 0 THEN 'migration_required'
      WHEN v_version < v_required THEN 'schema_version_outdated'
      ELSE 'ok'
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_health_check() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_health_check() TO authenticated, service_role;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (21, 'scale_1000_users: visit indexes/dedupe, storefront bundle RPC, product name trgm')
ON CONFLICT (version) DO NOTHING;
