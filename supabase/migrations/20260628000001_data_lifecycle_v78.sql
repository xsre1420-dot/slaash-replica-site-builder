-- v78: Data lifecycle phase 2 — product_views partitioning, growth audit, scale benchmarks, partition maintenance
-- Builds on v70/v71. Does NOT repeat read/write/index/connection/internals/hot-path work.

-- ---------------------------------------------------------------------------
-- 1) Extended lifecycle policies
-- ---------------------------------------------------------------------------
INSERT INTO public.platform_data_lifecycle_policies (table_name, data_tier, partition_strategy, hot_retention_days, archive_after_days, purge_after_days, notes)
VALUES
  ('product_views', 'hot', 'monthly_range', 90, NULL, 90, 'Partition by month; drop partitions older than 90d'),
  ('payment_webhook_events', 'hot', 'none', 90, NULL, 90, 'Idempotency log; purge processed after 90d'),
  ('payment_transactions', 'warm', 'none', NULL, NULL, NULL, 'Retained with operational orders; archive via parent order'),
  ('order_audit_log', 'warm', 'none', 365, 730, NULL, 'Compliance audit trail; optional future partition')
ON CONFLICT (table_name) DO UPDATE SET
  data_tier = EXCLUDED.data_tier,
  partition_strategy = EXCLUDED.partition_strategy,
  hot_retention_days = EXCLUDED.hot_retention_days,
  archive_after_days = EXCLUDED.archive_after_days,
  purge_after_days = EXCLUDED.purge_after_days,
  notes = EXCLUDED.notes;

-- ---------------------------------------------------------------------------
-- 2) product_views → monthly RANGE partitions
-- ---------------------------------------------------------------------------
DO $v78_product_views$
BEGIN
  IF public._platform_is_partitioned('product_views') THEN
    RETURN;
  END IF;

  IF NOT public._platform_table_exists('product_views') THEN
    RETURN;
  END IF;

  ALTER TABLE public.product_views RENAME TO product_views__pre_partition;
  PERFORM public._platform_rename_table_constraints('product_views__pre_partition');

  CREATE TABLE public.product_views (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    visitor_ip TEXT,
    user_agent TEXT,
    store_slug TEXT,
    page_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT product_views_pkey PRIMARY KEY (created_at, id)
  ) PARTITION BY RANGE (created_at);

  CREATE TABLE public.product_views_default PARTITION OF public.product_views DEFAULT;
  PERFORM public.platform_ensure_monthly_partitions('product_views', 24, 6);

  INSERT INTO public.product_views
  SELECT id, owner_id, product_id, visitor_ip, user_agent, store_slug, page_path, created_at
  FROM public.product_views__pre_partition;

  DROP TABLE public.product_views__pre_partition;

  CREATE INDEX IF NOT EXISTS idx_product_views_owner_created
    ON public.product_views (owner_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_product_views_owner_product_created
    ON public.product_views (owner_id, product_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_product_views_rate_limit
    ON public.product_views (owner_id, product_id, visitor_ip, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_product_views_created_brin
    ON public.product_views USING brin (created_at);

  ALTER TABLE public.product_views ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Store owners can view their product views" ON public.product_views;
  CREATE POLICY "Store owners can view their product views"
    ON public.product_views FOR SELECT TO authenticated USING (owner_id = auth.uid());

  ALTER TABLE public.product_views SET (
    autovacuum_vacuum_scale_factor = 0.02,
    autovacuum_analyze_scale_factor = 0.01
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'v78 product_views conversion: %', SQLERRM;
  IF to_regclass('public.product_views__pre_partition') IS NOT NULL
     AND to_regclass('public.product_views') IS NULL THEN
    ALTER TABLE public.product_views__pre_partition RENAME TO product_views;
  END IF;
END $v78_product_views$;

-- ---------------------------------------------------------------------------
-- 3) Prune helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prune_product_views(p_retention_days INT DEFAULT 90)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted BIGINT := 0;
  v_extra BIGINT := 0;
  v_days INT := GREATEST(COALESCE(p_retention_days, 90), 30);
  v_cutoff TIMESTAMPTZ := NOW() - (v_days || ' days')::INTERVAL;
  v_drop JSONB;
BEGIN
  IF public._platform_is_partitioned('product_views') THEN
    v_drop := public.platform_drop_partitions_before('product_views', v_cutoff);
    v_deleted := COALESCE((v_drop->>'dropped_count')::BIGINT, 0);
    DELETE FROM public.product_views WHERE created_at < v_cutoff;
    GET DIAGNOSTICS v_extra = ROW_COUNT;
    RETURN v_deleted + v_extra;
  END IF;

  DELETE FROM public.product_views WHERE created_at < v_cutoff;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

CREATE OR REPLACE FUNCTION public.prune_payment_webhook_events(p_keep_days INT DEFAULT 90)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INT;
  v_days INT := GREATEST(COALESCE(p_keep_days, 90), 30);
BEGIN
  DELETE FROM public.payment_webhook_events
  WHERE processed_at IS NOT NULL
    AND processed_at < NOW() - (v_days || ' days')::INTERVAL;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_product_views(INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prune_payment_webhook_events(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_product_views(INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.prune_payment_webhook_events(INT) TO service_role;

-- ---------------------------------------------------------------------------
-- 4) Partition maintenance — ANALYZE child partitions + parent
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_maintain_partition_statistics(
  p_parent_tables TEXT[] DEFAULT ARRAY['store_visits', 'inventory_movements', 'analytics_event_outbox', 'product_views']
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table TEXT;
  v_child RECORD;
  v_analyzed TEXT[] := ARRAY[]::TEXT[];
BEGIN
  FOREACH v_table IN ARRAY COALESCE(p_parent_tables, ARRAY[]::TEXT[])
  LOOP
    IF NOT public._platform_is_partitioned(v_table) THEN
      CONTINUE;
    END IF;

    EXECUTE format('ANALYZE public.%I', v_table);
    v_analyzed := array_append(v_analyzed, v_table);

    FOR v_child IN
      SELECT c.relname AS part_name
      FROM pg_class c
      JOIN pg_inherits i ON i.inhrelid = c.oid
      JOIN pg_class p ON p.oid = i.inhparent
      JOIN pg_namespace n ON n.oid = p.relnamespace
      WHERE n.nspname = 'public' AND p.relname = v_table
    LOOP
      EXECUTE format('ANALYZE public.%I', v_child.part_name);
      v_analyzed := array_append(v_analyzed, v_child.part_name);
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'analyzed', to_jsonb(v_analyzed),
    'count', COALESCE(array_length(v_analyzed, 1), 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_maintain_partition_statistics(TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_maintain_partition_statistics(TEXT[]) TO service_role;

-- ---------------------------------------------------------------------------
-- 5) Database growth audit — per-table counts, sizes, projections
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_database_growth_audit()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tables TEXT[] := ARRAY[
    'orders', 'order_items', 'store_visits', 'product_views', 'inventory_movements',
    'analytics_event_outbox', 'order_webhook_outbox', 'order_side_effects_outbox',
    'payment_webhook_events', 'payment_transactions', 'import_jobs', 'products',
    'customers', 'store_daily_stats', 'rpc_rate_limits', 'product_reviews',
    'orders_archive', 'order_items_archive', 'inventory_movements_archive'
  ];
  v_result JSONB := '[]'::JSONB;
  v_rec RECORD;
  v_rows BIGINT;
  v_total BIGINT;
  v_heap BIGINT;
  v_bpr NUMERIC;
  v_growth_day BIGINT;
  v_growth_month BIGINT;
  v_growth_year BIGINT;
  v_policy RECORD;
BEGIN
  FOR v_rec IN
    SELECT unnest(v_tables) AS table_name
  LOOP
    IF to_regclass(format('public.%I', v_rec.table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    SELECT
      COALESCE(st.n_live_tup, c.reltuples, 0)::BIGINT,
      pg_total_relation_size(c.oid),
      pg_relation_size(c.oid)
    INTO v_rows, v_total, v_heap
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_stat_user_tables st ON st.relid = c.oid
    WHERE n.nspname = 'public' AND c.relname = v_rec.table_name;

    v_bpr := CASE WHEN v_rows > 0 THEN v_total::NUMERIC / v_rows ELSE NULL END;

    SELECT * INTO v_policy
    FROM public.platform_data_lifecycle_policies lp
    WHERE lp.table_name = v_rec.table_name;

    v_growth_day := CASE v_rec.table_name
      WHEN 'store_visits' THEN 50000
      WHEN 'product_views' THEN 30000
      WHEN 'analytics_event_outbox' THEN 80000
      WHEN 'inventory_movements' THEN 5000
      WHEN 'orders' THEN 3000
      WHEN 'order_items' THEN 9000
      WHEN 'order_webhook_outbox' THEN 2000
      WHEN 'order_side_effects_outbox' THEN 4000
      WHEN 'payment_webhook_events' THEN 500
      WHEN 'import_jobs' THEN 100
      ELSE 100
    END;

    v_growth_month := v_growth_day * 30;
    v_growth_year := v_growth_day * 365;

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'table_name', v_rec.table_name,
      'live_rows', v_rows,
      'total_bytes', v_total,
      'total_size', pg_size_pretty(v_total),
      'heap_size', pg_size_pretty(v_heap),
      'bytes_per_row', ROUND(v_bpr, 2),
      'is_partitioned', public._platform_is_partitioned(v_rec.table_name),
      'data_tier', v_policy.data_tier,
      'partition_strategy', v_policy.partition_strategy,
      'hot_retention_days', v_policy.hot_retention_days,
      'purge_after_days', v_policy.purge_after_days,
      'estimated_growth_per_day', v_growth_day,
      'estimated_growth_per_month', v_growth_month,
      'estimated_growth_per_year', v_growth_year,
      'projected_size_1m_rows', pg_size_pretty(GREATEST(COALESCE(v_bpr, 256), 128) * 1000000),
      'projected_size_10m_rows', pg_size_pretty(GREATEST(COALESCE(v_bpr, 256), 128) * 10000000),
      'projected_size_100m_rows', pg_size_pretty(GREATEST(COALESCE(v_bpr, 256), 128) * 100000000),
      'bottleneck_risk', CASE
        WHEN v_rec.table_name IN ('store_visits', 'analytics_event_outbox', 'product_views') THEN 'critical'
        WHEN v_rec.table_name IN ('inventory_movements', 'orders', 'order_items') THEN 'high'
        WHEN v_rec.table_name IN ('order_webhook_outbox', 'order_side_effects_outbox') THEN 'medium'
        ELSE 'low'
      END
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'audited_at', NOW(),
    'schema_version', (SELECT max(version) FROM public.platform_schema_version),
    'platform_scale_assumption', '1000 active merchants @ moderate traffic',
    'tables', v_result,
    'bottleneck_tables', (
      SELECT COALESCE(jsonb_agg(t ORDER BY t->>'bottleneck_risk'), '[]'::jsonb)
      FROM jsonb_array_elements(v_result) t
      WHERE t->>'bottleneck_risk' IN ('critical', 'high')
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_database_growth_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_database_growth_audit() TO service_role;

-- ---------------------------------------------------------------------------
-- 6) Scale simulation — EXPLAIN probes at configurable date windows
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_partition_scale_benchmark(
  p_scenarios BIGINT[] DEFAULT ARRAY[1000000, 10000000, 50000000, 100000000]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scenario BIGINT;
  v_results JSONB := '[]'::JSONB;
  v_plan JSONB;
  v_plan_text TEXT;
  v_partitions INT;
  v_pruning BOOLEAN;
  v_days INT;
BEGIN
  SELECT COUNT(*)::INT INTO v_partitions
  FROM pg_inherits i
  JOIN pg_class p ON p.oid = i.inhparent
  JOIN pg_namespace n ON n.oid = p.relnamespace
  WHERE n.nspname = 'public' AND p.relname = 'store_visits';

  FOREACH v_scenario IN ARRAY COALESCE(p_scenarios, ARRAY[1000000::BIGINT])
  LOOP
    v_days := GREATEST(LEAST((v_scenario / 50000)::INT, 365), 7);

    EXECUTE format(
      'EXPLAIN (FORMAT JSON) SELECT COUNT(*) FROM public.store_visits WHERE created_at >= NOW() - %L::INTERVAL',
      (v_days || ' days')
    ) INTO v_plan;

    v_plan_text := v_plan::TEXT;
    v_pruning := v_plan_text ILIKE '%Partition Prune%' OR v_plan_text ILIKE '%Subplans Removed%';

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'simulated_rows', v_scenario,
      'query_window_days', v_days,
      'partition_count', v_partitions,
      'partition_pruning', v_pruning,
      'read_plan', v_plan,
      'estimated_partitions_scanned', CASE WHEN v_pruning THEN LEAST(v_partitions, GREATEST(v_days / 30, 1)) ELSE v_partitions END
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'benchmarked_at', NOW(),
    'table', 'store_visits',
    'scenarios', v_results,
    'write_path', jsonb_build_object(
      'note', 'Inserts route to current-month partition automatically',
      'partitioned', public._platform_is_partitioned('store_visits')
    ),
    'planner_quality', CASE WHEN v_pruning THEN 'good' ELSE 'review' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_partition_scale_benchmark(BIGINT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_partition_scale_benchmark(BIGINT[]) TO service_role;

-- ---------------------------------------------------------------------------
-- 7) Historical order lookup (archive fallback — new RPC, no existing contract change)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_merchant_order_with_archive_fallback(
  p_order_id UUID,
  p_owner_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row JSONB;
BEGIN
  IF p_order_id IS NULL OR p_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT to_jsonb(o) INTO v_row
  FROM public.orders o
  WHERE o.id = p_order_id AND o.owner_id = p_owner_id;

  IF v_row IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'source', 'hot', 'order', v_row);
  END IF;

  SELECT to_jsonb(o) INTO v_row
  FROM public.orders_archive o
  WHERE o.id = p_order_id AND o.owner_id = p_owner_id;

  IF v_row IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'source', 'archive',
      'order', v_row,
      'items', COALESCE((
        SELECT jsonb_agg(to_jsonb(oi))
        FROM public.order_items_archive oi
        WHERE oi.order_id = p_order_id AND oi.owner_id = p_owner_id
      ), '[]'::jsonb)
    );
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'not_found');
END;
$$;

REVOKE ALL ON FUNCTION public.get_merchant_order_with_archive_fallback(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_merchant_order_with_archive_fallback(UUID, UUID) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8) Extend lifecycle orchestrator
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_run_data_lifecycle()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB := '{}'::JSONB;
BEGIN
  IF public._platform_is_partitioned('store_visits') THEN
    v_result := v_result || jsonb_build_object(
      'store_visits_partitions', public.platform_ensure_monthly_partitions('store_visits', 3, 6)
    );
  END IF;

  IF public._platform_is_partitioned('product_views') THEN
    v_result := v_result || jsonb_build_object(
      'product_views_partitions', public.platform_ensure_monthly_partitions('product_views', 3, 6)
    );
  END IF;

  IF public._platform_is_partitioned('inventory_movements') THEN
    v_result := v_result || jsonb_build_object(
      'inventory_partitions', public.platform_ensure_monthly_partitions('inventory_movements', 3, 6)
    );
  END IF;

  IF public._platform_is_partitioned('analytics_event_outbox') THEN
    v_result := v_result || jsonb_build_object(
      'analytics_partitions', public.platform_ensure_monthly_partitions('analytics_event_outbox', 3, 3)
    );
  END IF;

  v_result := v_result || jsonb_build_object(
    'prune_store_visits', public.prune_store_visits(90),
    'prune_product_views', public.prune_product_views(90),
    'prune_analytics_outbox', public.prune_analytics_event_outbox(7),
    'prune_rate_limits', public.prune_rpc_rate_limits(7200),
    'prune_webhook_outbox', public.prune_order_webhook_outbox(30),
    'prune_side_effects_outbox', public.prune_order_side_effects_outbox(7),
    'prune_import_jobs', public.prune_import_jobs(30),
    'prune_payment_webhooks', public.prune_payment_webhook_events(90),
    'archive_orders', public.archive_orders_batch(548, 200),
    'archive_inventory', public.archive_inventory_movements_batch(730, 1000),
    'partition_statistics', public.platform_maintain_partition_statistics()
  );

  IF public._platform_fn_exists('platform_run_internals_maintenance') THEN
    v_result := v_result || jsonb_build_object(
      'internals_maintenance', public.platform_run_internals_maintenance(true, false, false)
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'ran_at', NOW()) || v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- 9) Extend lifecycle audit wrapper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_lifecycle_audit()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full JSONB;
  v_growth JSONB;
BEGIN
  v_full := public.platform_data_lifecycle_audit();
  v_growth := public.platform_database_growth_audit();

  RETURN jsonb_build_object(
    'success', true,
    'schema_version', v_full->'schema_version',
    'partitioned_tables', (
      SELECT COUNT(*)::INT
      FROM jsonb_array_elements(COALESCE(v_growth->'tables', '[]'::jsonb)) elem
      WHERE (elem->>'is_partitioned')::boolean = true
    ),
    'partition_count', jsonb_array_length(COALESCE(v_full->'partitions', '[]'::jsonb)),
    'partition_pruning', v_full->'partition_pruning'->'partition_pruning',
    'archive_orders', v_full->'archive_counts'->'orders_archive',
    'bottleneck_count', jsonb_array_length(COALESCE(v_growth->'bottleneck_tables', '[]'::jsonb)),
    'growth_audit', v_growth,
    'healthy', v_full->'healthy',
    'full_report', v_full
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 10) pg_cron — product_views partitions
-- ---------------------------------------------------------------------------
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'platform-ensure-partitions';

    PERFORM cron.schedule(
      'platform-ensure-partitions',
      '0 2 1 * *',
      $job$SELECT public.platform_ensure_monthly_partitions('store_visits', 3, 6);
SELECT public.platform_ensure_monthly_partitions('product_views', 3, 6);
SELECT public.platform_ensure_monthly_partitions('inventory_movements', 3, 6);
SELECT public.platform_ensure_monthly_partitions('analytics_event_outbox', 3, 3);$job$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron v78 partition schedule skipped: %', SQLERRM;
END $cron$;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (78, 'data_lifecycle_v2: product_views partition, growth audit, scale benchmark, partition maintenance')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
