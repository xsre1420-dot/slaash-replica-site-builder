-- Platform scale audit v23: incremental visit rollup, indexes, RPC rate limits, anon hardening

-- ---------------------------------------------------------------------------
-- 1) Server-side RPC rate limiting (shared across clients / edge isolates)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rpc_rate_limits (
  rate_key TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hit_count INT NOT NULL DEFAULT 0
);

ALTER TABLE public.rpc_rate_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rpc_rate_limits_deny ON public.rpc_rate_limits;
CREATE POLICY rpc_rate_limits_deny ON public.rpc_rate_limits FOR ALL USING (false);

CREATE OR REPLACE FUNCTION public.check_rpc_rate_limit(
  p_key TEXT,
  p_max INT DEFAULT 60,
  p_window_seconds INT DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_count INT;
BEGIN
  IF p_key IS NULL OR trim(p_key) = '' THEN
    RETURN false;
  END IF;

  INSERT INTO public.rpc_rate_limits (rate_key, window_start, hit_count)
  VALUES (p_key, v_now, 1)
  ON CONFLICT (rate_key) DO UPDATE SET
    hit_count = CASE
      WHEN rpc_rate_limits.window_start < v_now - make_interval(secs => GREATEST(p_window_seconds, 1))
        THEN 1
      ELSE rpc_rate_limits.hit_count + 1
    END,
    window_start = CASE
      WHEN rpc_rate_limits.window_start < v_now - make_interval(secs => GREATEST(p_window_seconds, 1))
        THEN v_now
      ELSE rpc_rate_limits.window_start
    END
  RETURNING hit_count INTO v_count;

  RETURN v_count <= GREATEST(p_max, 1);
END;
$$;

REVOKE ALL ON FUNCTION public.check_rpc_rate_limit(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rpc_rate_limit(TEXT, INT, INT) TO service_role;

-- ---------------------------------------------------------------------------
-- 2) Incremental visit daily stats (O(1) per insert vs full-day DISTINCT scan)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_visits_daily_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stat_date DATE;
  v_is_new_ip BOOLEAN := false;
BEGIN
  v_stat_date := (NEW.created_at AT TIME ZONE 'UTC')::DATE;

  IF NEW.visitor_ip IS NOT NULL AND trim(NEW.visitor_ip) <> '' THEN
    SELECT NOT EXISTS (
      SELECT 1
      FROM public.store_visits sv
      WHERE sv.owner_id = NEW.owner_id
        AND sv.visitor_ip = NEW.visitor_ip
        AND (sv.created_at AT TIME ZONE 'UTC')::DATE = v_stat_date
        AND sv.id <> NEW.id
      LIMIT 1
    ) INTO v_is_new_ip;
  END IF;

  INSERT INTO public.store_daily_stats (owner_id, stat_date, visit_count, unique_visitors)
  VALUES (NEW.owner_id, v_stat_date, 1, CASE WHEN v_is_new_ip THEN 1 ELSE 0 END)
  ON CONFLICT (owner_id, stat_date) DO UPDATE SET
    visit_count = store_daily_stats.visit_count + 1,
    unique_visitors = store_daily_stats.unique_visitors + CASE WHEN v_is_new_ip THEN 1 ELSE 0 END,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3) Performance indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_owner_category_created
  ON public.products (owner_id, category, created_at DESC, id DESC)
  WHERE archived_at IS NULL AND COALESCE(is_active, true) = true;

CREATE INDEX IF NOT EXISTS idx_products_description_trgm
  ON public.products USING gin (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customers_owner_first_order
  ON public.customers (owner_id, first_order_date);

CREATE INDEX IF NOT EXISTS idx_customers_owner_last_order
  ON public.customers (owner_id, last_order_date);

CREATE INDEX IF NOT EXISTS idx_product_views_owner_product_created
  ON public.product_views (owner_id, product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_products_store_active_created
  ON public.products (store_id, created_at DESC)
  WHERE store_id IS NOT NULL AND archived_at IS NULL AND COALESCE(is_active, true) = true;

CREATE INDEX IF NOT EXISTS idx_orders_store_created
  ON public.orders (store_id, created_at DESC)
  WHERE store_id IS NOT NULL;

-- Replace non-partial products index when safe (same name — drop first)
DROP INDEX IF EXISTS idx_products_owner_active_created;
CREATE INDEX IF NOT EXISTS idx_products_owner_active_created
  ON public.products (owner_id, created_at DESC, id DESC)
  WHERE archived_at IS NULL AND COALESCE(is_active, true) = true;

-- ---------------------------------------------------------------------------
-- 4) Revoke anon EXECUTE on merchant/admin RPCs (defense in depth)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_owner_bootstrap(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_dashboard_statistics_batch(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_order_items_for_statistics(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INT) FROM PUBLIC, anon;

DO $$
BEGIN
  IF public._platform_fn_exists('get_owner_products_page') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.get_owner_products_page FROM PUBLIC, anon';
  END IF;
  IF public._platform_fn_exists('list_merchant_orders') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.list_merchant_orders FROM PUBLIC, anon';
  END IF;
  IF public._platform_fn_exists('count_merchant_orders_by_workflow') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.count_merchant_orders_by_workflow FROM PUBLIC, anon';
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_statistics_batch(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_items_for_statistics(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_bootstrap(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) platform_health_check v23
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_health_check()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_required INT := 23;
  v_version INT := 0;
  v_missing TEXT[] := ARRAY[]::TEXT[];
  v_fn TEXT;
  v_required_fns TEXT[] := ARRAY[
    'get_store_products_page',
    'get_storefront_page_bundle',
    'get_dashboard_statistics_batch',
    'create_order_with_stock_deduction',
    'check_rpc_rate_limit',
    'list_merchant_orders',
    'list_public_store_slugs',
    'track_store_visit_by_slug'
  ];
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

  RETURN jsonb_build_object(
    'schema_version', v_version,
    'required_version', v_required,
    'missing', COALESCE(v_missing, ARRAY[]::TEXT[]),
    'checks', jsonb_build_object(
      'storefront', public._platform_fn_exists('get_store_products_page'),
      'storefront_bundle', public._platform_fn_exists('get_storefront_page_bundle'),
      'dashboard_batch', public._platform_fn_exists('get_dashboard_statistics_batch'),
      'rate_limits', public._platform_fn_exists('check_rpc_rate_limit'),
      'checkout', public._platform_fn_exists('create_order_with_stock_deduction')
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
VALUES (23, 'platform_scale_audit: visit rollup O(1), indexes, RPC rate limits, anon revoke')
ON CONFLICT (version) DO NOTHING;
