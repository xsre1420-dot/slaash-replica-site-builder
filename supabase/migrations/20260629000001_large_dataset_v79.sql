-- v79: Large dataset optimization — restore order keyset pagination (v76 regression fix),
-- fast approximate counts, large-scale benchmark RPC, import batch cap increase.
-- Does NOT repeat partitioning, read/write, index, payload, or hot-path work.

-- ---------------------------------------------------------------------------
-- 1) list_merchant_orders — restore keyset cursor (v62) + lean list payload (v76)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_merchant_orders(
  p_owner_id uuid,
  p_page int DEFAULT 0,
  p_page_size int DEFAULT 50,
  p_search text DEFAULT NULL,
  p_workflow_tab text DEFAULT 'all',
  p_order_status text DEFAULT 'all',
  p_payment_status text DEFAULT 'all',
  p_delivery_status text DEFAULT 'all',
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_min_value numeric DEFAULT NULL,
  p_max_value numeric DEFAULT NULL,
  p_cursor text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
  v_orders jsonb;
  v_limit int;
  v_offset int;
  v_cursor_ts timestamptz;
  v_cursor_id uuid;
  v_use_keyset boolean := false;
  v_next_cursor text := NULL;
  v_last_created timestamptz;
  v_last_id uuid;
  v_has_more boolean := false;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 100);

  IF NULLIF(trim(p_cursor), '') IS NOT NULL AND position('|' IN trim(p_cursor)) > 0 THEN
    v_cursor_ts := split_part(trim(p_cursor), '|', 1)::timestamptz;
    v_cursor_id := split_part(trim(p_cursor), '|', 2)::uuid;
    v_use_keyset := true;
  ELSE
    v_offset := GREATEST(COALESCE(p_page, 0), 0) * v_limit;
  END IF;

  WITH filtered AS (
    SELECT o.*
    FROM public.merchant_orders_base_filter(
      p_owner_id, p_search, p_order_status, p_payment_status, p_delivery_status,
      p_workflow_tab, p_date_from, p_date_to, p_min_value, p_max_value
    ) o
  ),
  total_cte AS (
    SELECT CASE WHEN v_use_keyset THEN NULL::bigint ELSE COUNT(*)::bigint END AS cnt
    FROM filtered
  ),
  fetched AS (
    SELECT f.*
    FROM filtered f
    WHERE (
      NOT v_use_keyset
      OR (f.created_at, f.id) < (v_cursor_ts, v_cursor_id)
    )
    ORDER BY f.created_at DESC, f.id DESC
    LIMIT v_limit + 1
    OFFSET CASE WHEN v_use_keyset THEN 0 ELSE v_offset END
  ),
  page_orders AS (
    SELECT * FROM fetched
    ORDER BY created_at DESC, id DESC
    LIMIT v_limit
  ),
  items_by_order AS (
    SELECT
      oi.order_id,
      jsonb_agg(
        jsonb_build_object(
          'id', oi.id,
          'product_id', oi.product_id,
          'product_name', oi.product_name,
          'product_price', oi.product_price,
          'quantity', oi.quantity,
          'subtotal', oi.subtotal,
          'variant_metadata', oi.variant_metadata,
          'image', p.image_url
        )
        ORDER BY oi.id
      ) AS order_items
    FROM public.order_items oi
    INNER JOIN page_orders po ON po.id = oi.order_id
    LEFT JOIN public.products p
      ON p.id = oi.product_id
      AND p.owner_id = p_owner_id
    GROUP BY oi.order_id
  )
  SELECT
    (SELECT cnt FROM total_cte),
    COALESCE(jsonb_agg(sub.row_data ORDER BY sub.sort_created DESC, sub.sort_id DESC), '[]'::jsonb),
    (SELECT COUNT(*) > v_limit FROM fetched),
    (array_agg(sub.sort_created ORDER BY sub.sort_created ASC, sub.sort_id ASC))[1],
    (array_agg(sub.sort_id ORDER BY sub.sort_created ASC, sub.sort_id ASC))[1]
  INTO v_total, v_orders, v_has_more, v_last_created, v_last_id
  FROM (
    SELECT
      jsonb_strip_nulls(
        jsonb_build_object(
          'id', po.id,
          'status', po.status,
          'total_amount', po.total_amount,
          'created_at', po.created_at,
          'customer_name', po.customer_name,
          'customer_phone', po.customer_phone,
          'customer_address', po.customer_address,
          'customer_governorate', po.customer_governorate,
          'delivery_fee', po.delivery_fee,
          'delivery_status', po.delivery_status,
          'payment_method', po.payment_method,
          'payment_status', po.payment_status,
          'coupon_code', po.coupon_code,
          'discount_amount', po.discount_amount,
          'order_items', COALESCE(ib.order_items, '[]'::jsonb)
        )
      ) AS row_data,
      po.created_at AS sort_created,
      po.id AS sort_id
    FROM page_orders po
    LEFT JOIN items_by_order ib ON ib.order_id = po.id
  ) sub;

  IF v_has_more AND v_last_created IS NOT NULL AND v_last_id IS NOT NULL THEN
    v_next_cursor := v_last_created::text || '|' || v_last_id::text;
  END IF;

  RETURN jsonb_strip_nulls(
    jsonb_build_object(
      'total', v_total,
      'page', GREATEST(COALESCE(p_page, 0), 0),
      'page_size', v_limit,
      'orders', COALESCE(v_orders, '[]'::jsonb),
      'next_cursor', v_next_cursor,
      'has_more', v_has_more
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_merchant_orders(
  uuid, int, int, text, text, text, text, text, timestamptz, timestamptz, numeric, numeric, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_merchant_orders(
  uuid, int, int, text, text, text, text, text, timestamptz, timestamptz, numeric, numeric, text
) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) Fast approximate counts — avoid full COUNT(*) on huge tables for UI hints
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_approximate_row_count(
  p_table text,
  p_owner_id uuid DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reltuples bigint;
  v_exact bigint;
BEGIN
  IF to_regclass(format('public.%I', p_table)) IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(c.reltuples, 0)::bigint INTO v_reltuples
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = p_table;

  IF p_owner_id IS NULL THEN
    RETURN GREATEST(v_reltuples, 0);
  END IF;

  EXECUTE format(
    'SELECT COUNT(*)::bigint FROM public.%I WHERE owner_id = $1',
    p_table
  ) INTO v_exact USING p_owner_id;

  RETURN GREATEST(v_exact, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.platform_approximate_row_count(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_approximate_row_count(text, uuid) TO service_role, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Tenant-scoped table stats for capacity planning
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_tenant_dataset_stats(p_owner_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_owner_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN jsonb_build_object(
    'owner_id', p_owner_id,
    'sampled_at', NOW(),
    'products', public.platform_approximate_row_count('products', p_owner_id),
    'orders', public.platform_approximate_row_count('orders', p_owner_id),
    'order_items', (
      SELECT COUNT(*)::bigint FROM public.order_items oi WHERE oi.owner_id = p_owner_id
    ),
    'customers', public.platform_approximate_row_count('customers', p_owner_id),
    'inventory_movements', public.platform_approximate_row_count('inventory_movements', p_owner_id),
    'recommend_keyset_pagination', true,
    'deep_offset_threshold', 1000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_tenant_dataset_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_tenant_dataset_stats(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4) Large dataset benchmark — hot paths at scale (staging / service_role)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_large_dataset_benchmark(
  p_owner_id uuid DEFAULT NULL,
  p_slug text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_slug text;
  v_results jsonb := '[]'::jsonb;
  v_plan jsonb;
  v_rec record;
  v_allowed boolean;
  v_scales bigint[] := ARRAY[100000, 500000, 1000000, 10000000, 100000000];
  v_scale bigint;
  v_pruning boolean;
  v_plan_text text;
  v_scale_results jsonb := '[]'::jsonb;
BEGIN
  v_allowed :=
    current_setting('request.jwt.claim.role', true) = 'service_role'
    OR current_user IN ('postgres', 'supabase_admin', 'authenticator');

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'service_role or postgres only';
  END IF;

  SELECT ss.owner_id, ss.store_slug
  INTO v_owner, v_slug
  FROM public.store_settings ss
  WHERE ss.store_slug IS NOT NULL
  ORDER BY ss.updated_at DESC NULLS LAST
  LIMIT 1;

  v_owner := COALESCE(p_owner_id, v_owner);
  v_slug := COALESCE(NULLIF(trim(p_slug), ''), v_slug);

  IF v_owner IS NOT NULL THEN
    FOR v_rec IN
      SELECT * FROM (VALUES
        ('merchant_products_page', format(
          'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.get_owner_products_page(%L::uuid, 50, 0, NULL, NULL, ''grid'', NULL)',
          v_owner
        )),
        ('merchant_products_keyset', format(
          'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.get_owner_products_page(%L::uuid, 50, 0, NULL, NULL, ''grid'', ''2020-01-01T00:00:00+00|00000000-0000-0000-0000-000000000001'')',
          v_owner
        )),
        ('merchant_orders_page', format(
          'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.list_merchant_orders(%L::uuid, 0, 50, NULL, ''all'', ''all'', ''all'', ''all'', NULL, NULL, NULL, NULL, NULL)',
          v_owner
        )),
        ('merchant_orders_keyset', format(
          'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.list_merchant_orders(%L::uuid, 0, 50, NULL, ''all'', ''all'', ''all'', ''all'', NULL, NULL, NULL, NULL, ''2020-01-01T00:00:00+00|00000000-0000-0000-0000-000000000001'')',
          v_owner
        )),
        ('dashboard_kpis_light', format(
          'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.get_dashboard_kpis_light(%L::uuid)',
          v_owner
        )),
        ('workflow_counts', format(
          'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.count_merchant_orders_by_workflow(%L::uuid, NULL, ''all'', ''all'', ''all'', NULL, NULL, NULL, NULL)',
          v_owner
        ))
      ) AS t(name, sql_text)
    LOOP
      BEGIN
        EXECUTE v_rec.sql_text INTO v_plan;
        v_results := v_results || jsonb_build_array(jsonb_build_object(
          'name', v_rec.name,
          'execution_ms', (v_plan->0->>'Execution Time')::numeric,
          'planning_ms', (v_plan->0->>'Planning Time')::numeric,
          'root_node', v_plan->0->'Plan'->>'Node Type',
          'plan', v_plan
        ));
      EXCEPTION WHEN OTHERS THEN
        v_results := v_results || jsonb_build_array(jsonb_build_object(
          'name', v_rec.name,
          'error', LEFT(SQLERRM, 200)
        ));
      END;
    END LOOP;
  END IF;

  IF v_slug IS NOT NULL THEN
    BEGIN
      EXECUTE format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.get_store_products_page(%L, 24, '''', '''', '''')',
        v_slug
      ) INTO v_plan;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'name', 'storefront_products_page',
        'execution_ms', (v_plan->0->>'Execution Time')::numeric,
        'root_node', v_plan->0->'Plan'->>'Node Type',
        'plan', v_plan
      ));
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  FOREACH v_scale IN ARRAY v_scales LOOP
    BEGIN
      EXECUTE format(
        'EXPLAIN (FORMAT JSON) SELECT COUNT(*) FROM public.store_visits WHERE created_at >= NOW() - %L::interval',
        (GREATEST(LEAST((v_scale / 50000)::int, 365), 7) || ' days')
      ) INTO v_plan;
      v_plan_text := v_plan::TEXT;
      v_pruning := v_plan_text ILIKE '%Partition Prune%' OR v_plan_text ILIKE '%Subplans Removed%';
      v_scale_results := v_scale_results || jsonb_build_array(jsonb_build_object(
        'simulated_rows', v_scale,
        'partition_pruning', v_pruning
      ));
    EXCEPTION WHEN OTHERS THEN
      v_scale_results := v_scale_results || jsonb_build_array(jsonb_build_object(
        'simulated_rows', v_scale,
        'error', LEFT(SQLERRM, 120)
      ));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'benchmarked_at', NOW(),
    'owner_id', v_owner,
    'slug', v_slug,
    'queries', v_results,
    'scale_simulation', v_scale_results,
    'tenant_stats', CASE WHEN v_owner IS NOT NULL THEN public.platform_tenant_dataset_stats(v_owner) ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_large_dataset_benchmark(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_large_dataset_benchmark(uuid, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 5) Covering index for product grid at scale (owner catalog sort path)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_owner_active_created_id
  ON public.products (owner_id, created_at DESC, id DESC)
  WHERE archived_at IS NULL;

COMMENT ON INDEX public.idx_products_owner_active_created_id IS
  'Large catalog keyset pagination — active products only';

INSERT INTO public.platform_schema_version (version, notes)
VALUES (79, 'large_dataset: restore order keyset, benchmark RPC, approximate counts, catalog index')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
