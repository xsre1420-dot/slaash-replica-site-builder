-- Phase 3.5: Inventory READ optimization — summary CTE, page bundle RPC, pending reviews RPC
-- Targets: merchant_inventory_summary, inventory page bundle, forecast/movements reads
-- Does NOT modify checkout stock deduction (Phase 3.6) or write paths.
-- Indexes for inventory hot paths were added in Phase 3.2 (idx_products_owner_catalog_kpi,
-- idx_po_lines_owner_incoming, idx_orders_owner_reservable).

-- ---------------------------------------------------------------------------
-- 1) Shared inventory summary core (single products scan + indexed aggregates)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._merchant_inventory_summary_core(p_owner_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH product_stats AS (
    SELECT
      COUNT(*)::bigint AS total_products,
      COUNT(*) FILTER (WHERE p.is_active = true AND p.archived_at IS NULL)::bigint AS published,
      COUNT(*) FILTER (WHERE p.is_active = false AND p.archived_at IS NULL)::bigint AS draft,
      COUNT(*) FILTER (WHERE p.archived_at IS NOT NULL)::bigint AS archived,
      COALESCE(SUM(GREATEST(COALESCE(p.stock_quantity, 0), 0)), 0)::bigint AS total_units,
      COALESCE(SUM(GREATEST(COALESCE(p.stock_quantity, 0), 0) * COALESCE(p.price, 0)), 0) AS retail_value,
      COALESCE(SUM(GREATEST(COALESCE(p.stock_quantity, 0), 0) * COALESCE(p.cost, 0)), 0) AS cost_value,
      COUNT(*) FILTER (WHERE p.sku IS NULL OR trim(p.sku) = '')::bigint AS missing_sku,
      COUNT(*) FILTER (WHERE p.barcode IS NULL OR trim(p.barcode) = '')::bigint AS missing_barcode,
      COUNT(*) FILTER (WHERE p.image_url IS NULL OR trim(p.image_url) = '')::bigint AS missing_image,
      COUNT(*) FILTER (
        WHERE p.is_active = true AND p.archived_at IS NULL
          AND COALESCE(p.stock_quantity, 0) > 0
          AND COALESCE(p.stock_quantity, 0) <= COALESCE(p.min_stock_level, 5)
      )::bigint AS low_stock,
      COUNT(*) FILTER (
        WHERE p.is_active = true AND p.archived_at IS NULL AND COALESCE(p.stock_quantity, 0) = 0
      )::bigint AS out_of_stock
    FROM public.products p
    WHERE p.owner_id = p_owner_id
  ),
  incoming AS (
    SELECT COALESCE(SUM(pol.quantity_ordered - pol.quantity_received), 0)::bigint AS incoming_units
    FROM public.purchase_order_lines pol
    INNER JOIN public.purchase_orders po
      ON po.id = pol.purchase_order_id
     AND po.status IN ('ordered', 'partial')
    WHERE pol.owner_id = p_owner_id
      AND pol.quantity_ordered > pol.quantity_received
  ),
  reserved AS (
    SELECT COALESCE(SUM(oi.quantity), 0)::bigint AS reserved_units
    FROM public.orders o
    INNER JOIN public.order_items oi
      ON oi.order_id = o.id
     AND oi.owner_id = o.owner_id
    WHERE o.owner_id = p_owner_id
      AND o.status NOT IN ('cancelled', 'completed', 'refunded')
  )
  SELECT jsonb_build_object(
    'success', true,
    'total_products', ps.total_products,
    'published', ps.published,
    'draft', ps.draft,
    'archived', ps.archived,
    'total_units', ps.total_units,
    'retail_value', ps.retail_value,
    'cost_value', ps.cost_value,
    'missing_sku', ps.missing_sku,
    'missing_barcode', ps.missing_barcode,
    'missing_image', ps.missing_image,
    'low_stock', ps.low_stock,
    'out_of_stock', ps.out_of_stock,
    'incoming_units', i.incoming_units,
    'reserved_units', r.reserved_units
  )
  FROM product_stats ps
  CROSS JOIN incoming i
  CROSS JOIN reserved r;
$$;

REVOKE ALL ON FUNCTION public._merchant_inventory_summary_core(UUID) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Auth wrapper — merchant_inventory_summary
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.merchant_inventory_summary(p_owner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  RETURN public._merchant_inventory_summary_core(p_owner_id);
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_inventory_summary(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_inventory_summary(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Pending reviews count — uses idx_product_reviews_owner_pending
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._merchant_pending_reviews_count(p_owner_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.product_reviews pr
  WHERE pr.owner_id = p_owner_id
    AND pr.is_approved = false;
$$;

REVOKE ALL ON FUNCTION public._merchant_pending_reviews_count(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.count_merchant_pending_reviews(p_owner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'count', public._merchant_pending_reviews_count(p_owner_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.count_merchant_pending_reviews(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_merchant_pending_reviews(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) Inventory page bundle — categories + summary + products page 0 + pending
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_merchant_inventory_page_bundle(
  p_owner_id UUID,
  p_limit INT DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT;
  v_summary JSONB;
  v_categories JSONB;
  v_products JSONB;
  v_pending INT;
  v_total BIGINT;
  v_has_more BOOLEAN := false;
  v_next_cursor TEXT;
  v_last_created TIMESTAMPTZ;
  v_last_id UUID;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_summary := public._merchant_inventory_summary_core(p_owner_id);
  v_total := COALESCE((v_summary->>'total_products')::bigint, 0);
  v_pending := public._merchant_pending_reviews_count(p_owner_id);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('id', c.id, 'name', c.name, 'display_order', c.display_order)
      ORDER BY c.display_order ASC NULLS LAST, c.name ASC
    ),
    '[]'::jsonb
  )
  INTO v_categories
  FROM public.categories c
  WHERE c.owner_id = p_owner_id;

  WITH filtered AS (
    SELECT p.*
    FROM public.products p
    WHERE p.owner_id = p_owner_id
  ),
  fetched AS (
    SELECT f.*
    FROM filtered f
    ORDER BY f.created_at DESC, f.id DESC
    LIMIT v_limit + 1
  ),
  page AS (
    SELECT * FROM fetched
    ORDER BY created_at DESC, id DESC
    LIMIT v_limit
  )
  SELECT
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', pg.id,
            'name', pg.name,
            'category', pg.category,
            'price', pg.price,
            'image_url', pg.image_url,
            'stock_quantity', pg.stock_quantity,
            'sizes', pg.sizes,
            'colors', pg.colors,
            'variants', pg.variants,
            'is_active', pg.is_active,
            'archived_at', pg.archived_at,
            'min_stock_level', pg.min_stock_level,
            'created_at', pg.created_at
          )
          ORDER BY pg.created_at DESC, pg.id DESC
        )
        FROM page pg
      ),
      '[]'::jsonb
    ),
    (SELECT COUNT(*) > v_limit FROM fetched),
    (SELECT pg.created_at FROM page pg ORDER BY pg.created_at ASC, pg.id ASC LIMIT 1),
    (SELECT pg.id FROM page pg ORDER BY pg.created_at ASC, pg.id ASC LIMIT 1)
  INTO v_products, v_has_more, v_last_created, v_last_id;

  IF v_has_more AND v_last_created IS NOT NULL AND v_last_id IS NOT NULL THEN
    v_next_cursor := v_last_created::text || '|' || v_last_id::text;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'summary', v_summary,
    'pending_reviews_count', v_pending,
    'categories', v_categories,
    'products', v_products,
    'total', v_total,
    'has_more', COALESCE(v_has_more, false),
    'next_cursor', v_next_cursor
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_merchant_inventory_page_bundle(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_merchant_inventory_page_bundle(UUID, INT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) Forecast — orders-first velocity subquery (uses idx_orders_owner_reservable family)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.merchant_inventory_forecast(p_owner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'items', COALESCE((
      SELECT jsonb_agg(row_to_json(f) ORDER BY f.days_until_stockout ASC NULLS LAST)
      FROM (
        SELECT
          p.id AS product_id,
          p.name,
          p.sku,
          GREATEST(COALESCE(p.stock_quantity, 0), 0) AS current_stock,
          COALESCE(p.min_stock_level, 5) AS min_stock_level,
          COALESCE(v.sold_30d, 0) AS sold_last_30_days,
          CASE
            WHEN COALESCE(v.sold_30d, 0) <= 0 THEN NULL
            ELSE ROUND(
              (GREATEST(COALESCE(p.stock_quantity, 0), 0)::numeric / (v.sold_30d::numeric / 30.0))::numeric,
              1
            )
          END AS days_until_stockout,
          CASE
            WHEN COALESCE(v.sold_30d, 0) <= 0 THEN NULL
            ELSE GREATEST(
              CEIL((v.sold_30d::numeric / 30.0) * 14)::int - GREATEST(COALESCE(p.stock_quantity, 0), 0),
              0
            )::int
          END AS suggested_reorder_qty
        FROM public.products p
        LEFT JOIN (
          SELECT oi.product_id, SUM(oi.quantity) AS sold_30d
          FROM public.orders o
          INNER JOIN public.order_items oi
            ON oi.order_id = o.id
           AND oi.owner_id = o.owner_id
          WHERE o.owner_id = p_owner_id
            AND o.created_at >= now() - interval '30 days'
            AND o.status NOT IN ('cancelled', 'refunded')
          GROUP BY oi.product_id
        ) v ON v.product_id = p.id
        WHERE p.owner_id = p_owner_id
          AND p.is_active = true
          AND p.archived_at IS NULL
      ) f
      WHERE f.sold_last_30_days > 0 OR f.current_stock <= f.min_stock_level
      LIMIT 50
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_inventory_forecast(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_inventory_forecast(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6) Movements list — tenant-safe product join
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_merchant_inventory_movements(
  p_owner_id UUID,
  p_from TIMESTAMPTZ DEFAULT (now() - interval '30 days'),
  p_to TIMESTAMPTZ DEFAULT now(),
  p_limit INT DEFAULT 100
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'movements', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC)
      FROM (
        SELECT
          im.id,
          im.product_id,
          p.name AS product_name,
          p.sku,
          im.quantity_delta,
          im.reason,
          im.order_id,
          im.warehouse_id,
          im.created_at
        FROM public.inventory_movements im
        INNER JOIN public.products p
          ON p.id = im.product_id
         AND p.owner_id = im.owner_id
        WHERE im.owner_id = p_owner_id
          AND im.created_at >= p_from
          AND im.created_at <= p_to
        ORDER BY im.created_at DESC
        LIMIT LEAST(GREATEST(p_limit, 1), 500)
      ) t
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_merchant_inventory_movements(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_merchant_inventory_movements(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7) Benchmark RPC — inventory read paths (service_role)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_benchmark_merchant_inventory(
  p_merchant_count INT DEFAULT 10,
  p_include_legacy BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owners UUID[];
  v_owner UUID;
  v_started TIMESTAMPTZ;
  v_ms NUMERIC;
  v_results JSONB := '[]'::jsonb;
  v_plan JSONB;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin', 'authenticator') THEN
    RAISE EXCEPTION 'service_role or postgres only';
  END IF;

  SELECT ARRAY_AGG(sub.owner_id ORDER BY sub.cnt DESC)
  INTO v_owners
  FROM (
    SELECT p.owner_id, COUNT(*)::bigint AS cnt
    FROM public.products p
    GROUP BY p.owner_id
    ORDER BY cnt DESC
    LIMIT LEAST(GREATEST(COALESCE(p_merchant_count, 10), 1), 500)
  ) sub;

  IF v_owners IS NULL OR array_length(v_owners, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'benchmark_at', now(),
      'phase', '3.5',
      'merchant_count', 0,
      'paths', '[]'::jsonb,
      'note', 'no merchants with products'
    );
  END IF;

  FOREACH v_owner IN ARRAY v_owners LOOP
    PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);

    v_started := clock_timestamp();
    PERFORM public._merchant_inventory_summary_core(v_owner);
    v_ms := EXTRACT(MILLISECOND FROM clock_timestamp() - v_started)
      + EXTRACT(SECOND FROM clock_timestamp() - v_started) * 1000;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'owner_id', v_owner,
      'rpc', 'inventory_summary_core',
      'ms', round(v_ms, 3)
    ));

    v_started := clock_timestamp();
    PERFORM public.get_merchant_inventory_page_bundle(v_owner, 50);
    v_ms := EXTRACT(MILLISECOND FROM clock_timestamp() - v_started)
      + EXTRACT(SECOND FROM clock_timestamp() - v_started) * 1000;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'owner_id', v_owner,
      'rpc', 'inventory_page_bundle',
      'ms', round(v_ms, 3)
    ));

    v_started := clock_timestamp();
    PERFORM public._merchant_pending_reviews_count(v_owner);
    v_ms := EXTRACT(MILLISECOND FROM clock_timestamp() - v_started)
      + EXTRACT(SECOND FROM clock_timestamp() - v_started) * 1000;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'owner_id', v_owner,
      'rpc', 'pending_reviews_count',
      'ms', round(v_ms, 3)
    ));

    v_started := clock_timestamp();
    PERFORM public.get_owner_products_page(v_owner, 50, 0, NULL, NULL, 'inventory', NULL);
    v_ms := EXTRACT(MILLISECOND FROM clock_timestamp() - v_started)
      + EXTRACT(SECOND FROM clock_timestamp() - v_started) * 1000;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'owner_id', v_owner,
      'rpc', 'owner_products_inventory',
      'ms', round(v_ms, 3)
    ));

    IF p_include_legacy THEN
      v_started := clock_timestamp();
      PERFORM public._merchant_inventory_summary_core(v_owner);
      PERFORM public.get_owner_products_page(v_owner, 50, 0, NULL, NULL, 'inventory', NULL);
      PERFORM public._merchant_pending_reviews_count(v_owner);
      PERFORM (
        SELECT COUNT(*) FROM public.categories c WHERE c.owner_id = v_owner
      );
      v_ms := EXTRACT(MILLISECOND FROM clock_timestamp() - v_started)
        + EXTRACT(SECOND FROM clock_timestamp() - v_started) * 1000;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'owner_id', v_owner,
        'rpc', 'legacy_parallel_simulation',
        'ms', round(v_ms, 3)
      ));
    END IF;
  END LOOP;

  BEGIN
    EXECUTE format(
      'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public._merchant_inventory_summary_core(%L::uuid)',
      v_owners[1]
    ) INTO v_plan;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'rpc', 'explain_inventory_summary_core',
      'owner_id', v_owners[1],
      'execution_ms', (v_plan->0->>'Execution Time')::numeric,
      'planning_ms', (v_plan->0->>'Planning Time')::numeric
    ));
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    EXECUTE format(
      'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.get_merchant_inventory_page_bundle(%L::uuid, 50)',
      v_owners[1]
    ) INTO v_plan;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'rpc', 'explain_inventory_page_bundle',
      'owner_id', v_owners[1],
      'execution_ms', (v_plan->0->>'Execution Time')::numeric,
      'planning_ms', (v_plan->0->>'Planning Time')::numeric
    ));
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'benchmark_at', now(),
    'phase', '3.5',
    'merchant_count', COALESCE(array_length(v_owners, 1), 0),
    'paths', v_results
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_benchmark_merchant_inventory(INT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_benchmark_merchant_inventory(INT, BOOLEAN) TO service_role;

-- Extend hot-path EXPLAIN suite
CREATE OR REPLACE FUNCTION public.platform_benchmark_hot_queries(
  p_slug text DEFAULT NULL,
  p_owner_id uuid DEFAULT NULL,
  p_warm_cache boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
  v_owner uuid;
  v_results jsonb := '[]'::jsonb;
  v_plan jsonb;
  v_exec_ms numeric;
  v_plan_ms numeric;
  rec record;
  v_allowed boolean;
  v_month_start timestamptz;
  v_month_end timestamptz;
BEGIN
  v_allowed :=
    current_setting('request.jwt.claim.role', true) = 'service_role'
    OR current_user IN ('postgres', 'supabase_admin', 'authenticator');

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'service_role or postgres only';
  END IF;

  SELECT ss.store_slug, ss.owner_id
  INTO v_slug, v_owner
  FROM public.store_settings ss
  WHERE ss.store_slug IS NOT NULL
  ORDER BY ss.updated_at DESC NULLS LAST
  LIMIT 1;

  v_slug := COALESCE(NULLIF(trim(p_slug), ''), v_slug);
  v_owner := COALESCE(p_owner_id, v_owner);
  v_month_start := date_trunc('month', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_month_end := (date_trunc('month', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 month') AT TIME ZONE 'UTC';

  IF p_warm_cache THEN
    BEGIN
      PERFORM pg_prewarm('products');
      PERFORM pg_prewarm('orders');
      PERFORM pg_prewarm('order_items');
      PERFORM pg_prewarm('store_daily_stats');
      PERFORM pg_prewarm('purchase_order_lines');
      PERFORM pg_prewarm('product_reviews');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  IF v_owner IS NOT NULL THEN
    PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  END IF;

  FOR rec IN
    SELECT * FROM (VALUES
      ('storefront_meta', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.get_store_meta(%L::text)',
        v_slug
      )),
      ('storefront_products_page', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.get_store_products_page(%L, 24, NULL, NULL, NULL)',
        v_slug
      )),
      ('storefront_page_bundle', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.get_storefront_page_bundle(%L, 24, '''', '''', '''')',
        v_slug
      )),
      ('owner_products_page', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.get_owner_products_page(%L::uuid, 50, 0, NULL, NULL, ''grid'', NULL)',
        v_owner
      )),
      ('owner_products_keyset', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.get_owner_products_page(%L::uuid, 50, 0, NULL, NULL, ''grid'', ''2020-01-01T00:00:00+00|00000000-0000-0000-0000-000000000001'')',
        v_owner
      )),
      ('owner_bootstrap', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.get_owner_bootstrap(%L::uuid)',
        v_owner
      )),
      ('orders_list', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.list_merchant_orders(%L::uuid, 0, 50, NULL, ''all'', ''all'', ''all'', ''all'', NULL, NULL, NULL, NULL, NULL)',
        v_owner
      )),
      ('workflow_counts', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.count_merchant_orders_by_workflow(%L::uuid, NULL, ''all'', ''all'', ''all'', NULL, NULL, NULL, NULL)',
        v_owner
      )),
      ('dashboard_batch', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public._get_dashboard_statistics_batch_core(%L::uuid)',
        v_owner
      )),
      ('merchant_inventory_summary', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public._merchant_inventory_summary_core(%L::uuid)',
        v_owner
      )),
      ('merchant_inventory_page_bundle', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.get_merchant_inventory_page_bundle(%L::uuid, 50)',
        v_owner
      )),
      ('merchant_pending_reviews', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public._merchant_pending_reviews_count(%L::uuid)',
        v_owner
      )),
      ('statistics_bundle_core', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public._get_store_statistics_core(%L::uuid, %L::timestamptz, %L::timestamptz, public._merchant_catalog_kpis(%L::uuid))',
        v_owner, v_month_start, v_month_end, v_owner
      )),
      ('statistics_bundle', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.get_statistics_page_bundle(%L::uuid, %L::timestamptz, %L::timestamptz, %L::timestamptz, %L::timestamptz)',
        v_owner, v_month_start, v_month_end, v_month_start - INTERVAL '1 month', v_month_start - INTERVAL '1 millisecond'
      )),
      ('order_items_statistics', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.get_order_items_for_statistics(%L::uuid, %L::timestamptz, %L::timestamptz, 5000)',
        v_owner, v_month_start, v_month_end
      )),
      ('inventory_audit', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.audit_merchant_inventory_integrity(%L::uuid)',
        v_owner
      )),
      ('products_owner_index', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT COUNT(*) FROM public.products WHERE owner_id = %L::uuid AND archived_at IS NULL',
        v_owner
      )),
      ('orders_owner_index', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT COUNT(*) FROM public.orders WHERE owner_id = %L::uuid',
        v_owner
      ))
    ) AS t(name, sql_text)
  LOOP
    BEGIN
      EXECUTE rec.sql_text INTO v_plan;
      v_exec_ms := (v_plan->0->>'Execution Time')::numeric;
      v_plan_ms := (v_plan->0->>'Planning Time')::numeric;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'name', rec.name,
        'plan', v_plan,
        'execution_ms', v_exec_ms,
        'planning_ms', v_plan_ms
      ));
    EXCEPTION WHEN OTHERS THEN
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'name', rec.name,
        'error', SQLERRM
      ));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'benchmark_at', now(),
    'slug', v_slug,
    'owner_id', v_owner,
    'query_count', jsonb_array_length(v_results),
    'queries', v_results
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_benchmark_hot_queries(text, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_benchmark_hot_queries(text, uuid, boolean) TO service_role;

ANALYZE public.products;
ANALYZE public.purchase_order_lines;
ANALYZE public.purchase_orders;
ANALYZE public.order_items;
ANALYZE public.orders;
ANALYZE public.product_reviews;
ANALYZE public.categories;
ANALYZE public.inventory_movements;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (117, 'phase 3.5: inventory read CTE summary, page bundle RPC, pending reviews RPC, forecast/movements rewrites')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
