-- v75 / Phase 1.5: Enterprise PostgreSQL internals — hot-table storage, planner stats, extended audit, maintenance
-- Builds on v69 (internals), v70 (lifecycle). Safe-only: no GUC changes requiring superuser on Supabase.

-- ---------------------------------------------------------------------------
-- 1) HOT-friendly fillfactor — high-churn update columns
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.products SET (
  fillfactor = 90,
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_cost_delay = 10
);

ALTER TABLE IF EXISTS public.orders SET (
  fillfactor = 90,
  autovacuum_vacuum_scale_factor = 0.04,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_cost_delay = 10
);

ALTER TABLE IF EXISTS public.order_items SET (
  fillfactor = 95,
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.03
);

ALTER TABLE IF EXISTS public.marketing_coupons SET (
  fillfactor = 85,
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

ALTER TABLE IF EXISTS public.payment_transactions SET (
  fillfactor = 90,
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.03
);

ALTER TABLE IF EXISTS public.store_daily_stats SET (
  fillfactor = 85,
  autovacuum_vacuum_scale_factor = 0.03,
  autovacuum_analyze_scale_factor = 0.01
);

ALTER TABLE IF EXISTS public.customers SET (
  fillfactor = 90,
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

ALTER TABLE IF EXISTS public.store_settings SET (
  fillfactor = 90,
  autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE IF EXISTS public.order_webhook_outbox SET (fillfactor = 85);

-- ---------------------------------------------------------------------------
-- 2) Extended planner statistics — multi-column correlation
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_statistic_ext WHERE stxname = 'stx_orders_owner_payment') THEN
    CREATE STATISTICS stx_orders_owner_payment (dependencies)
    ON owner_id, payment_status FROM public.orders;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_statistic_ext WHERE stxname = 'stx_orders_owner_delivery') THEN
    CREATE STATISTICS stx_orders_owner_delivery (dependencies)
    ON owner_id, delivery_status FROM public.orders;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_statistic_ext WHERE stxname = 'stx_order_items_owner_product') THEN
    CREATE STATISTICS stx_order_items_owner_product (dependencies)
    ON owner_id, product_id FROM public.order_items;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_statistic_ext WHERE stxname = 'stx_store_daily_stats_owner_date') THEN
    CREATE STATISTICS stx_store_daily_stats_owner_date (dependencies)
    ON owner_id, stat_date FROM public.store_daily_stats;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'phase 1.5 extended statistics skipped: %', SQLERRM;
END $$;

ALTER TABLE public.orders ALTER COLUMN payment_status SET STATISTICS 400;
ALTER TABLE public.orders ALTER COLUMN delivery_status SET STATISTICS 400;
ALTER TABLE public.orders ALTER COLUMN created_at SET STATISTICS 500;
ALTER TABLE public.products ALTER COLUMN is_active SET STATISTICS 300;
ALTER TABLE public.products ALTER COLUMN archived_at SET STATISTICS 300;
ALTER TABLE public.store_daily_stats ALTER COLUMN stat_date SET STATISTICS 500;
ALTER TABLE public.customers ALTER COLUMN phone SET STATISTICS 500;

-- ---------------------------------------------------------------------------
-- 3) Enhanced internals audit — version, sizes, xid age, bgwriter, checkpoints
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_postgresql_internals_audit()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_db_stats RECORD;
  v_wal JSONB := NULL;
  v_bgwriter JSONB := NULL;
  v_cache_hit NUMERIC;
  v_total_dead BIGINT;
  v_healthy BOOLEAN;
  v_max_xid_age BIGINT;
BEGIN
  IF current_setting('request.jwt.claim.role', true) <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin', 'authenticator') THEN
    RAISE EXCEPTION 'service_role or postgres only';
  END IF;

  SELECT
    numbackends, xact_commit, xact_rollback, blks_read, blks_hit,
    tup_returned, tup_fetched, tup_inserted, tup_updated, tup_deleted,
    temp_files, temp_bytes, deadlocks, conflicts
  INTO v_db_stats
  FROM pg_stat_database
  WHERE datname = current_database();

  BEGIN
    SELECT jsonb_build_object(
      'wal_records', wal_records, 'wal_fpi', wal_fpi, 'wal_bytes', wal_bytes,
      'wal_buffers_full', wal_buffers_full
    ) INTO v_wal FROM pg_stat_wal;
  EXCEPTION WHEN OTHERS THEN
    v_wal := jsonb_build_object('available', false);
  END;

  BEGIN
    SELECT jsonb_build_object(
      'checkpoints_timed', checkpoints_timed,
      'checkpoints_req', checkpoints_req,
      'checkpoint_write_time_ms', checkpoint_write_time,
      'checkpoint_sync_time_ms', checkpoint_sync_time,
      'buffers_checkpoint', buffers_checkpoint,
      'buffers_clean', buffers_clean,
      'maxwritten_clean', maxwritten_clean,
      'buffers_backend', buffers_backend,
      'buffers_alloc', buffers_alloc
    ) INTO v_bgwriter FROM pg_stat_bgwriter;
  EXCEPTION WHEN OTHERS THEN
    v_bgwriter := jsonb_build_object('available', false);
  END;

  v_cache_hit := round(
    100.0 * v_db_stats.blks_hit / NULLIF(v_db_stats.blks_hit + v_db_stats.blks_read, 0), 2
  );

  SELECT COALESCE(SUM(n_dead_tup), 0)::BIGINT INTO v_total_dead
  FROM pg_stat_user_tables WHERE schemaname = 'public';

  SELECT COALESCE(MAX(age(c.relfrozenxid)), 0)::BIGINT INTO v_max_xid_age
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'm');

  v_healthy := COALESCE(
    v_cache_hit >= 95
    AND v_total_dead < 500000
    AND v_max_xid_age < 1500000000,
    false
  );

  SELECT jsonb_build_object(
    'success', true,
    'audited_at', now(),
    'phase', '1.5',
    'schema_version', (SELECT max(version) FROM public.platform_schema_version),
    'postgresql_version', version(),
    'database_size', jsonb_build_object(
      'bytes', pg_database_size(current_database()),
      'pretty', pg_size_pretty(pg_database_size(current_database()))
    ),
    'transaction_id', jsonb_build_object(
      'max_xid_age', v_max_xid_age,
      'freeze_warning', v_max_xid_age > 1000000000
    ),
    'database', jsonb_build_object(
      'cache_hit_ratio_pct', v_cache_hit,
      'buffer_blks_hit', v_db_stats.blks_hit,
      'buffer_blks_read', v_db_stats.blks_read,
      'temp_files', v_db_stats.temp_files,
      'temp_bytes', v_db_stats.temp_bytes,
      'deadlocks', v_db_stats.deadlocks,
      'conflicts', v_db_stats.conflicts,
      'tup_inserted', v_db_stats.tup_inserted,
      'tup_updated', v_db_stats.tup_updated,
      'tup_deleted', v_db_stats.tup_deleted
    ),
    'wal', COALESCE(v_wal, jsonb_build_object('available', false)),
    'bgwriter', COALESCE(v_bgwriter, jsonb_build_object('available', false)),
    'table_sizes_top', (
      SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.total_bytes DESC), '[]'::jsonb)
      FROM (
        SELECT c.relname AS table_name,
               pg_total_relation_size(c.oid) AS total_bytes,
               pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
               pg_size_pretty(pg_relation_size(c.oid)) AS heap_size,
               COALESCE(st.n_live_tup, 0)::BIGINT AS live_rows,
               COALESCE(st.n_dead_tup, 0)::BIGINT AS dead_rows
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_stat_user_tables st ON st.relid = c.oid
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        ORDER BY pg_total_relation_size(c.oid) DESC
        LIMIT 15
      ) t
    ),
    'index_sizes_top', (
      SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.index_bytes DESC), '[]'::jsonb)
      FROM (
        SELECT c.relname AS index_name,
               t.relname AS table_name,
               pg_relation_size(c.oid) AS index_bytes,
               pg_size_pretty(pg_relation_size(c.oid)) AS index_size,
               COALESCE(s.idx_scan, 0)::BIGINT AS scans
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_index i ON i.indexrelid = c.oid
        JOIN pg_class t ON t.oid = i.indrelid
        LEFT JOIN pg_stat_user_indexes s ON s.indexrelid = c.oid
        WHERE n.nspname = 'public' AND c.relkind = 'i'
        ORDER BY pg_relation_size(c.oid) DESC
        LIMIT 15
      ) t
    ),
    'io_ratios', (
      SELECT jsonb_build_object(
        'heap_hit_ratio_pct', round(100.0 * SUM(heap_blks_hit) / NULLIF(SUM(heap_blks_hit + heap_blks_read), 0), 2),
        'index_hit_ratio_pct', round(100.0 * SUM(idx_blks_hit) / NULLIF(SUM(idx_blks_hit + idx_blks_read), 0), 2),
        'toast_hit_ratio_pct', round(100.0 * SUM(toast_blks_hit) / NULLIF(SUM(toast_blks_hit + toast_blks_read), 0), 2)
      )
      FROM pg_statio_user_tables WHERE schemaname = 'public'
    ),
    'scan_ratios', (
      SELECT jsonb_build_object(
        'seq_scan_total', COALESCE(SUM(seq_scan), 0)::BIGINT,
        'idx_scan_total', COALESCE(SUM(idx_scan), 0)::BIGINT,
        'seq_scan_ratio_pct', round(100.0 * SUM(seq_scan) / NULLIF(SUM(seq_scan + idx_scan), 0), 2)
      )
      FROM pg_stat_user_tables WHERE schemaname = 'public'
    ),
    'dead_tuples_top', (
      SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.dead_tuples DESC), '[]'::jsonb)
      FROM (
        SELECT relname AS table_name, n_live_tup AS live_tuples, n_dead_tup AS dead_tuples,
               round(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_pct,
               last_vacuum, last_autovacuum, last_analyze, last_autoanalyze,
               autovacuum_count, autoanalyze_count
        FROM pg_stat_user_tables
        WHERE schemaname = 'public' AND (n_dead_tup > 100 OR n_live_tup > 1000)
        ORDER BY n_dead_tup DESC LIMIT 15
      ) t
    ),
    'table_bloat_candidates', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT relname AS table_name, n_dead_tup AS dead_tuples,
               round(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_pct,
               pg_size_pretty(pg_total_relation_size(relid)) AS total_size
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
          AND n_dead_tup > 500
          AND n_dead_tup::float / NULLIF(n_live_tup + n_dead_tup, 0) > 0.10
        ORDER BY n_dead_tup DESC LIMIT 10
      ) t
    ),
    'index_health', (
      SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.index_size_bytes DESC), '[]'::jsonb)
      FROM (
        SELECT indexrelname AS index_name, relname AS table_name,
               idx_scan AS scans, pg_relation_size(indexrelid) AS index_size_bytes,
               pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
        FROM pg_stat_user_indexes s
        JOIN pg_stat_user_tables t ON t.relid = s.relid
        WHERE s.schemaname = 'public'
        ORDER BY pg_relation_size(indexrelid) DESC LIMIT 20
      ) t
    ),
    'unused_indexes', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT indexrelname AS index_name, relname AS table_name, idx_scan AS scans,
               pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public' AND idx_scan = 0
          AND pg_relation_size(indexrelid) > 65536
          AND indexrelname NOT LIKE '%_pkey'
        ORDER BY pg_relation_size(indexrelid) DESC LIMIT 10
      ) t
    ),
    'autovacuum_settings', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT c.relname AS table_name,
          COALESCE((SELECT option_value::float FROM pg_options_to_table(c.reloptions)
            WHERE option_name = 'autovacuum_vacuum_scale_factor'),
            current_setting('autovacuum_vacuum_scale_factor')::float) AS vacuum_scale_factor,
          COALESCE((SELECT option_value::int FROM pg_options_to_table(c.reloptions)
            WHERE option_name = 'fillfactor'), 100) AS fillfactor
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
          AND c.relname IN (
            'products', 'orders', 'order_items', 'marketing_coupons', 'payment_transactions',
            'store_daily_stats', 'customers', 'analytics_event_outbox', 'order_side_effects_outbox',
            'order_webhook_outbox', 'rpc_rate_limits', 'store_visits', 'inventory_movements'
          )
        ORDER BY c.relname
      ) t
    ),
    'wait_events', (
      SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.event_count DESC), '[]'::jsonb)
      FROM (
        SELECT COALESCE(wait_event_type, 'none') AS wait_type,
               COALESCE(wait_event, 'none') AS wait_event,
               COUNT(*)::INT AS event_count
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND wait_event_type IS NOT NULL AND wait_event_type <> 'Client'
        GROUP BY 1, 2 ORDER BY COUNT(*) DESC LIMIT 12
      ) t
    ),
    'lock_waits', (
      SELECT COUNT(*)::INT FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock'
    ),
    'extended_statistics', (
      SELECT COALESCE(jsonb_agg(stxname ORDER BY stxname), '[]'::jsonb)
      FROM pg_statistic_ext WHERE stxnamespace = 'public'::regnamespace
    ),
    'healthy', v_healthy
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) Maintenance — expanded ANALYZE + outbox prune
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_run_internals_maintenance(
  p_prune_rate_limits BOOLEAN DEFAULT true,
  p_prune_analytics BOOLEAN DEFAULT true,
  p_prune_outboxes BOOLEAN DEFAULT true,
  p_analyze BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pruned_rates INT := 0;
  v_pruned_analytics INT := 0;
  v_pruned_webhooks INT := 0;
  v_pruned_side_effects INT := 0;
  v_analyzed TEXT[] := ARRAY[]::TEXT[];
  v_tbl TEXT;
BEGIN
  IF p_prune_rate_limits THEN
    v_pruned_rates := public.prune_rpc_rate_limits(7200);
  END IF;

  IF p_prune_analytics AND public._platform_fn_exists('prune_analytics_event_outbox') THEN
    v_pruned_analytics := public.prune_analytics_event_outbox(7);
  END IF;

  IF p_prune_outboxes THEN
    IF public._platform_fn_exists('prune_order_webhook_outbox') THEN
      v_pruned_webhooks := public.prune_order_webhook_outbox(30);
    END IF;
    IF public._platform_fn_exists('prune_order_side_effects_outbox') THEN
      v_pruned_side_effects := public.prune_order_side_effects_outbox(7);
    END IF;
  END IF;

  IF p_analyze THEN
    FOREACH v_tbl IN ARRAY ARRAY[
      'products', 'orders', 'order_items', 'store_visits', 'store_daily_stats',
      'store_settings', 'customers', 'inventory_movements', 'analytics_event_outbox',
      'order_side_effects_outbox', 'order_webhook_outbox', 'rpc_rate_limits',
      'store_visitor_daily_keys', 'marketing_coupons', 'payment_transactions',
      'marketing_settings', 'product_reviews', 'import_jobs', 'shipments'
    ] LOOP
      IF public._platform_table_exists(v_tbl) THEN
        EXECUTE format('ANALYZE public.%I', v_tbl);
        v_analyzed := array_append(v_analyzed, v_tbl);
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'phase', '1.5',
    'pruned_rate_limits', v_pruned_rates,
    'pruned_analytics_rows', v_pruned_analytics,
    'pruned_webhook_outbox', v_pruned_webhooks,
    'pruned_side_effects_outbox', v_pruned_side_effects,
    'analyzed_tables', to_jsonb(v_analyzed),
    'vacuum_note', 'VACUUM (ANALYZE) via pg_cron or CLI — not inside RPC transaction'
  );
END;
$$;

-- Drop old 3-arg overload signature if exists (add 4th param)
DROP FUNCTION IF EXISTS public.platform_run_internals_maintenance(BOOLEAN, BOOLEAN, BOOLEAN);

-- ---------------------------------------------------------------------------
-- 5) Lightweight audit wrapper — Phase 1.5 fields
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_internals_audit()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_health JSONB;
BEGIN
  v_health := public.platform_postgresql_internals_audit();

  RETURN jsonb_build_object(
    'success', true,
    'phase', COALESCE(v_health->>'phase', '1.5'),
    'schema_version', (SELECT max(version) FROM public.platform_schema_version),
    'postgresql_version', v_health->>'postgresql_version',
    'database_size', v_health->'database_size',
    'cache_hit_ratio_pct', v_health->'database'->'cache_hit_ratio_pct',
    'heap_hit_ratio_pct', v_health->'io_ratios'->'heap_hit_ratio_pct',
    'index_hit_ratio_pct', v_health->'io_ratios'->'index_hit_ratio_pct',
    'seq_scan_ratio_pct', v_health->'scan_ratios'->'seq_scan_ratio_pct',
    'max_xid_age', v_health->'transaction_id'->'max_xid_age',
    'temp_files', v_health->'database'->'temp_files',
    'extended_statistics', v_health->'extended_statistics',
    'autovacuum_tuned_tables', jsonb_array_length(COALESCE(v_health->'autovacuum_settings', '[]'::jsonb)),
    'dead_tuple_tables', jsonb_array_length(COALESCE(v_health->'dead_tuples_top', '[]'::jsonb)),
    'bloat_candidates', jsonb_array_length(COALESCE(v_health->'table_bloat_candidates', '[]'::jsonb)),
    'unused_index_count', jsonb_array_length(COALESCE(v_health->'unused_indexes', '[]'::jsonb)),
    'lock_waits', v_health->'lock_waits',
    'healthy', COALESCE((v_health->>'healthy')::boolean, false),
    'full_report', v_health
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 6) Internals benchmark — snapshot for before/after comparison
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_postgresql_internals_benchmark()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before JSONB;
  v_start TIMESTAMPTZ;
  v_ms NUMERIC;
BEGIN
  IF current_setting('request.jwt.claim.role', true) <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin', 'authenticator') THEN
    RAISE EXCEPTION 'service_role or postgres only';
  END IF;

  v_before := public.platform_postgresql_internals_audit();

  v_start := clock_timestamp();
  PERFORM public.platform_run_internals_maintenance(true, false, false, true);
  v_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start)::numeric;

  RETURN jsonb_build_object(
    'success', true,
    'benchmark_at', now(),
    'phase', '1.5',
    'maintenance_duration_ms', ROUND(v_ms, 2),
    'before', v_before,
    'after', public.platform_postgresql_internals_audit(),
    'recommendations', jsonb_build_object(
      'nightly_analyze', 'pg_cron platform-internals-maintenance 03:15 UTC',
      'rate_limit_prune', 'every 6h via platform-prune-rate-limits',
      'lifecycle', 'platform_run_data_lifecycle via background worker',
      'vacuum_bloat', 'VACUUM (ANALYZE) on tables with dead_pct > 15% during low traffic',
      'monitor', 'platform_internals_audit weekly; alert if cache_hit < 95% or max_xid_age > 1e9'
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_postgresql_internals_benchmark() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_postgresql_internals_benchmark() TO service_role;

-- ---------------------------------------------------------------------------
-- 7) pg_cron — weekly deep ANALYZE (daily lightweight prune remains from v69)
-- ---------------------------------------------------------------------------
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'platform-internals-weekly-analyze';

    PERFORM cron.schedule(
      'platform-internals-weekly-analyze',
      '30 2 * * 0',
      $cron$SELECT public.platform_run_internals_maintenance(true, true, true, true)$cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron weekly analyze schedule skipped: %', SQLERRM;
END $do$;

-- ---------------------------------------------------------------------------
-- 8) Refresh planner statistics
-- ---------------------------------------------------------------------------
ANALYZE public.products;
ANALYZE public.orders;
ANALYZE public.order_items;
ANALYZE public.marketing_coupons;
ANALYZE public.payment_transactions;
ANALYZE public.store_daily_stats;
ANALYZE public.customers;
ANALYZE public.store_settings;
ANALYZE public.inventory_movements;
ANALYZE public.analytics_event_outbox;
ANALYZE public.order_side_effects_outbox;
ANALYZE public.order_webhook_outbox;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (75, 'postgresql_internals phase 1.5: hot-table fillfactor, extended stats, enhanced audit/benchmark')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
