-- Remaining audit improvements: visit unique rollup, public sitemap RPC, stats hybrid

-- ---------------------------------------------------------------------------
-- 1) Visit daily rollup: maintain unique_visitors per day
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_visits_daily_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stat_date DATE;
  v_unique INT;
BEGIN
  v_stat_date := (NEW.created_at AT TIME ZONE 'UTC')::DATE;

  SELECT COUNT(DISTINCT sv.visitor_ip)::INT INTO v_unique
  FROM public.store_visits sv
  WHERE sv.owner_id = NEW.owner_id
    AND (sv.created_at AT TIME ZONE 'UTC')::DATE = v_stat_date
    AND sv.visitor_ip IS NOT NULL
    AND trim(sv.visitor_ip) <> '';

  INSERT INTO public.store_daily_stats (owner_id, stat_date, visit_count, unique_visitors)
  VALUES (NEW.owner_id, v_stat_date, 1, GREATEST(v_unique, 1))
  ON CONFLICT (owner_id, stat_date) DO UPDATE SET
    visit_count = store_daily_stats.visit_count + 1,
    unique_visitors = GREATEST(v_unique, store_daily_stats.unique_visitors),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Backfill unique_visitors from historical visits
UPDATE public.store_daily_stats sds
SET unique_visitors = sub.cnt
FROM (
  SELECT
    sv.owner_id,
    (sv.created_at AT TIME ZONE 'UTC')::DATE AS stat_date,
    COUNT(DISTINCT sv.visitor_ip)::INT AS cnt
  FROM public.store_visits sv
  WHERE sv.visitor_ip IS NOT NULL AND trim(sv.visitor_ip) <> ''
  GROUP BY 1, 2
) sub
WHERE sds.owner_id = sub.owner_id
  AND sds.stat_date = sub.stat_date
  AND sds.unique_visitors IS DISTINCT FROM sub.cnt;

-- ---------------------------------------------------------------------------
-- 2) Public sitemap: slug list without exposing store_settings to anon SELECT
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_public_store_slugs(
  p_limit INT DEFAULT 5000,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  store_slug TEXT,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT;
  v_offset INT;
BEGIN
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 5000), 1), 10000);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);

  RETURN QUERY
  WITH slugs AS (
    SELECT
      lower(trim(ss.store_slug)) AS slug,
      ss.updated_at AS touched_at
    FROM public.store_settings ss
    WHERE ss.store_slug IS NOT NULL
      AND trim(ss.store_slug) ~ '^[a-z0-9-]+$'
    UNION
    SELECT
      lower(trim(st.store_slug)) AS slug,
      COALESCE(st.updated_at, st.created_at, NOW()) AS touched_at
    FROM public.stores st
    WHERE st.store_slug IS NOT NULL
      AND trim(st.store_slug) ~ '^[a-z0-9-]+$'
  ),
  deduped AS (
    SELECT slug, MAX(touched_at) AS updated_at
    FROM slugs
    GROUP BY slug
  )
  SELECT d.slug, d.updated_at
  FROM deduped d
  ORDER BY d.slug
  LIMIT v_limit OFFSET v_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.list_public_store_slugs(INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_store_slugs(INT, INT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Statistics RPC: hybrid unique_visitors from rollup
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_store_statistics(
  p_owner_id UUID,
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_start_date DATE;
  v_end_date DATE;
  v_rollup_orders INT;
  v_rollup_completed INT;
  v_rollup_revenue NUMERIC;
  v_rollup_visits INT;
  v_rollup_unique INT;
  v_live_orders INT;
  v_live_completed INT;
  v_live_revenue NUMERIC;
  v_live_visits INT;
  v_live_unique INT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN NULL;
  END IF;

  IF p_start IS NULL OR p_end IS NULL OR p_end < p_start THEN
    RETURN NULL;
  END IF;

  v_start_date := (p_start AT TIME ZONE 'UTC')::DATE;
  v_end_date := (p_end AT TIME ZONE 'UTC')::DATE;

  SELECT
    COALESCE(SUM(order_count - cancelled_order_count), 0)::INT,
    COALESCE(SUM(completed_order_count), 0)::INT,
    COALESCE(SUM(completed_revenue), 0),
    COALESCE(SUM(visit_count), 0)::INT,
    COALESCE(SUM(unique_visitors), 0)::INT
  INTO v_rollup_orders, v_rollup_completed, v_rollup_revenue, v_rollup_visits, v_rollup_unique
  FROM public.store_daily_stats
  WHERE owner_id = p_owner_id
    AND stat_date >= v_start_date
    AND stat_date <= v_end_date;

  SELECT COUNT(*)::INT INTO v_live_orders
  FROM orders
  WHERE owner_id = p_owner_id
    AND created_at >= p_start AND created_at <= p_end
    AND status <> 'cancelled';

  SELECT COUNT(*)::INT INTO v_live_completed
  FROM orders
  WHERE owner_id = p_owner_id
    AND created_at >= p_start AND created_at <= p_end
    AND status = 'completed';

  SELECT COALESCE(SUM(total_amount), 0) INTO v_live_revenue
  FROM orders
  WHERE owner_id = p_owner_id
    AND status = 'completed'
    AND created_at >= p_start AND created_at <= p_end;

  SELECT COUNT(*)::INT INTO v_live_visits
  FROM store_visits
  WHERE owner_id = p_owner_id
    AND created_at >= p_start AND created_at <= p_end;

  SELECT COUNT(DISTINCT visitor_ip)::INT INTO v_live_unique
  FROM store_visits
  WHERE owner_id = p_owner_id
    AND created_at >= p_start AND created_at <= p_end
    AND visitor_ip IS NOT NULL AND trim(visitor_ip) <> '';

  SELECT jsonb_build_object(
    'order_count', CASE WHEN v_rollup_orders > 0 THEN v_rollup_orders ELSE v_live_orders END,
    'completed_order_count', CASE WHEN v_rollup_completed > 0 THEN v_rollup_completed ELSE v_live_completed END,
    'pending_count', (
      SELECT COUNT(*)::INT FROM orders
      WHERE owner_id = p_owner_id AND status = 'pending'
        AND created_at >= p_start AND created_at <= p_end
    ),
    'completed_revenue', CASE WHEN v_rollup_revenue > 0 THEN v_rollup_revenue ELSE v_live_revenue END,
    'refund_total', (
      SELECT COALESCE(SUM(r.amount), 0)
      FROM order_refunds r
      JOIN orders o ON o.id = r.order_id
      WHERE r.owner_id = p_owner_id AND r.status = 'completed'
        AND o.status = 'completed'
        AND o.created_at >= p_start AND o.created_at <= p_end
    ),
    'visit_count', CASE WHEN v_rollup_visits > 0 THEN v_rollup_visits ELSE v_live_visits END,
    'unique_visitors', CASE WHEN v_rollup_unique > 0 THEN v_rollup_unique ELSE v_live_unique END,
    'low_stock_count', (
      SELECT COUNT(*)::INT FROM products
      WHERE owner_id = p_owner_id AND COALESCE(is_active, true) = true
        AND archived_at IS NULL
        AND COALESCE(stock_quantity, 0) <= COALESCE(min_stock_level, 5)
    ),
    'product_count', (
      SELECT COUNT(*)::INT FROM products
      WHERE owner_id = p_owner_id
        AND COALESCE(is_active, true) = true
        AND archived_at IS NULL
    ),
    'new_customers', (
      SELECT COUNT(*)::INT FROM customers
      WHERE owner_id = p_owner_id
        AND first_order_date >= p_start AND first_order_date <= p_end
    ),
    'returning_customers', (
      SELECT COUNT(*)::INT FROM customers c
      WHERE c.owner_id = p_owner_id
        AND c.first_order_date < p_start
        AND c.last_order_date >= p_start AND c.last_order_date <= p_end
    ),
    'top_viewed_products', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.view_count DESC)
      FROM (
        SELECT pv.product_id, COALESCE(p.name, 'منتج') AS product_name, COUNT(*)::INT AS view_count
        FROM product_views pv
        LEFT JOIN products p ON p.id = pv.product_id AND p.owner_id = pv.owner_id
        WHERE pv.owner_id = p_owner_id AND pv.created_at >= p_start AND pv.created_at <= p_end
        GROUP BY pv.product_id, p.name
        ORDER BY view_count DESC LIMIT 10
      ) t
    ), '[]'::jsonb),
    'campaign_attribution', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.orders DESC)
      FROM (
        SELECT
          COALESCE(NULLIF(trim(o.marketing_attribution->>'utm_source'), ''), '(direct)') AS source,
          COALESCE(NULLIF(trim(o.marketing_attribution->>'utm_medium'), ''), '(none)') AS medium,
          COALESCE(NULLIF(trim(o.marketing_attribution->>'utm_campaign'), ''), '(none)') AS campaign,
          COUNT(*)::INT AS orders,
          COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.total_amount ELSE 0 END), 0)::NUMERIC AS revenue
        FROM orders o
        WHERE o.owner_id = p_owner_id AND o.created_at >= p_start AND o.created_at <= p_end
          AND o.status <> 'cancelled' AND o.marketing_attribution IS NOT NULL
          AND o.marketing_attribution <> 'null'::jsonb
        GROUP BY 1, 2, 3 ORDER BY orders DESC LIMIT 20
      ) t
    ), '[]'::jsonb),
    'stats_source', 'daily_rollup_hybrid'
  ) INTO v_result;

  RETURN v_result;
END;
$$;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (18, 'remaining: visit unique rollup, sitemap RPC, stats unique_visitors hybrid')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
