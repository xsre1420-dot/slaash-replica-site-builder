-- v69: PostgreSQL internals optimization — autovacuum tuning, statistics, storage, audit & maintenance RPCs
-- Builds on v42 (hot tables), v63 (indexes), v66 (outboxes). Does NOT repeat prior query/index work.

-- ---------------------------------------------------------------------------
-- 1) Append / upsert-heavy tables — aggressive autovacuum (outboxes, rate limits)
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.analytics_event_outbox SET (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.01,
  autovacuum_vacuum_cost_delay = 5,
  autovacuum_vacuum_cost_limit = 2000
);

ALTER TABLE IF EXISTS public.order_side_effects_outbox SET (
  autovacuum_vacuum_scale_factor = 0.03,
  autovacuum_analyze_scale_factor = 0.01,
  autovacuum_vacuum_cost_delay = 5
);

ALTER TABLE IF EXISTS public.order_webhook_outbox SET (
  autovacuum_vacuum_scale_factor = 0.04,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_cost_delay = 10
);

ALTER TABLE IF EXISTS public.rpc_rate_limits SET (
  fillfactor = 80,
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_cost_delay = 2,
  autovacuum_vacuum_cost_limit = 3000
);

ALTER TABLE IF EXISTS public.store_visitor_daily_keys SET (
  autovacuum_vacuum_scale_factor = 0.03,
  autovacuum_analyze_scale_factor = 0.01
);

-- ---------------------------------------------------------------------------
-- 2) HOT-friendly storage — deferred outbox row updates (processed_at / effects_pending)
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.order_side_effects_outbox SET (fillfactor = 85);

COMMENT ON TABLE public.rpc_rate_limits IS
  'RPC rate limit counters. fillfactor=80 enables HOT updates on hit_count/window_start churn.';

-- ---------------------------------------------------------------------------
-- 3) Planner statistics — extended stats + higher targets on filter columns
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_statistic_ext
    WHERE stxname = 'stx_products_owner_category'
  ) THEN
    CREATE STATISTICS stx_products_owner_category (dependencies)
    ON owner_id, category FROM public.products;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_statistic_ext
    WHERE stxname = 'stx_orders_owner_status'
  ) THEN
    CREATE STATISTICS stx_orders_owner_status (dependencies)
    ON owner_id, status FROM public.orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_statistic_ext
    WHERE stxname = 'stx_products_owner_lifecycle'
  ) THEN
    CREATE STATISTICS stx_products_owner_lifecycle (dependencies)
    ON owner_id, archived_at, is_active FROM public.products;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'extended statistics skipped: %', SQLERRM;
END $$;

ALTER TABLE public.products ALTER COLUMN category SET STATISTICS 500;
ALTER TABLE public.products ALTER COLUMN owner_id SET STATISTICS 1000;
ALTER TABLE public.orders ALTER COLUMN status SET STATISTICS 500;
ALTER TABLE public.orders ALTER COLUMN owner_id SET STATISTICS 1000;
ALTER TABLE public.order_items ALTER COLUMN owner_id SET STATISTICS 500;

-- ---------------------------------------------------------------------------
-- 4) Prune stale rate-limit rows (prevents rpc_rate_limits heap bloat)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prune_rpc_rate_limits(p_max_age_seconds INT DEFAULT 7200)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INT;
BEGIN
  DELETE FROM public.rpc_rate_limits
  WHERE window_start < NOW() - make_interval(secs => GREATEST(COALESCE(p_max_age_seconds, 7200), 300));

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_rpc_rate_limits(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_rpc_rate_limits(INT) TO service_role;

-- ---------------------------------------------------------------------------
-- 5) platform_postgresql_internals_audit — full engine health snapshot
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
  v_cache_hit NUMERIC;
  v_total_dead BIGINT;
  v_healthy BOOLEAN;
BEGIN
  SELECT
    numbackends,
    xact_commit,
    xact_rollback,
    blks_read,
    blks_hit,
    tup_returned,
    tup_fetched,
    tup_inserted,
    tup_updated,
    tup_deleted,
    temp_files,
    temp_bytes,
    deadlocks
  INTO v_db_stats
  FROM pg_stat_database
  WHERE datname = current_database();

  BEGIN
    SELECT jsonb_build_object(
      'wal_records', wal_records,
      'wal_fpi', wal_fpi,
      'wal_bytes', wal_bytes,
      'wal_buffers_full', wal_buffers_full
    ) INTO v_wal
    FROM pg_stat_wal;
  EXCEPTION WHEN OTHERS THEN
    v_wal := jsonb_build_object('available', false);
  END;

  v_cache_hit := round(
    100.0 * v_db_stats.blks_hit / NULLIF(v_db_stats.blks_hit + v_db_stats.blks_read, 0), 2
  );

  SELECT COALESCE(SUM(n_dead_tup), 0)::BIGINT
  INTO v_total_dead
  FROM pg_stat_user_tables
  WHERE schemaname = 'public';

  v_healthy := COALESCE(v_cache_hit >= 95 AND v_total_dead < 500000, false);

  SELECT jsonb_build_object(
    'audited_at', now(),
    'schema_version', (SELECT max(version) FROM public.platform_schema_version),
    'database', jsonb_build_object(
      'cache_hit_ratio_pct', v_cache_hit,
      'buffer_blks_hit', v_db_stats.blks_hit,
      'buffer_blks_read', v_db_stats.blks_read,
      'temp_files', v_db_stats.temp_files,
      'temp_bytes', v_db_stats.temp_bytes,
      'deadlocks', v_db_stats.deadlocks,
      'tup_inserted', v_db_stats.tup_inserted,
      'tup_updated', v_db_stats.tup_updated,
      'tup_deleted', v_db_stats.tup_deleted
    ),
    'wal', COALESCE(v_wal, jsonb_build_object('available', false)),
    'io_ratios', (
      SELECT jsonb_build_object(
        'heap_hit_ratio_pct', round(
          100.0 * SUM(heap_blks_hit) / NULLIF(SUM(heap_blks_hit + heap_blks_read), 0), 2
        ),
        'index_hit_ratio_pct', round(
          100.0 * SUM(idx_blks_hit) / NULLIF(SUM(idx_blks_hit + idx_blks_read), 0), 2
        ),
        'toast_hit_ratio_pct', round(
          100.0 * SUM(toast_blks_hit) / NULLIF(SUM(toast_blks_hit + toast_blks_read), 0), 2
        )
      )
      FROM pg_statio_user_tables
      WHERE schemaname = 'public'
    ),
    'scan_ratios', (
      SELECT jsonb_build_object(
        'seq_scan_total', COALESCE(SUM(seq_scan), 0)::BIGINT,
        'idx_scan_total', COALESCE(SUM(idx_scan), 0)::BIGINT,
        'seq_scan_ratio_pct', round(
          100.0 * SUM(seq_scan) / NULLIF(SUM(seq_scan + idx_scan), 0), 2
        )
      )
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
    ),
    'dead_tuples_top', (
      SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.dead_tuples DESC), '[]'::jsonb)
      FROM (
        SELECT
          relname AS table_name,
          n_live_tup AS live_tuples,
          n_dead_tup AS dead_tuples,
          round(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_pct,
          last_vacuum,
          last_autovacuum,
          last_analyze,
          last_autoanalyze,
          autovacuum_count,
          autoanalyze_count
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
          AND (n_dead_tup > 100 OR n_live_tup > 1000)
        ORDER BY n_dead_tup DESC
        LIMIT 15
      ) t
    ),
    'table_bloat_candidates', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT
          relname AS table_name,
          n_dead_tup AS dead_tuples,
          round(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_pct,
          pg_size_pretty(pg_total_relation_size(relid)) AS total_size
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
          AND n_dead_tup > 500
          AND n_dead_tup::float / NULLIF(n_live_tup + n_dead_tup, 0) > 0.10
        ORDER BY n_dead_tup DESC
        LIMIT 10
      ) t
    ),
    'index_health', (
      SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.index_size_bytes DESC), '[]'::jsonb)
      FROM (
        SELECT
          indexrelname AS index_name,
          relname AS table_name,
          idx_scan AS scans,
          idx_tup_read AS tuples_read,
          idx_tup_fetch AS tuples_fetched,
          pg_relation_size(indexrelid) AS index_size_bytes,
          pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
        FROM pg_stat_user_indexes s
        JOIN pg_stat_user_tables t ON t.relid = s.relid
        WHERE s.schemaname = 'public'
        ORDER BY pg_relation_size(indexrelid) DESC
        LIMIT 20
      ) t
    ),
    'unused_indexes', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT
          indexrelname AS index_name,
          relname AS table_name,
          idx_scan AS scans,
          pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
          AND idx_scan = 0
          AND pg_relation_size(indexrelid) > 65536
          AND indexrelname NOT LIKE '%_pkey'
          AND indexrelname NOT LIKE '%_unique%'
        ORDER BY pg_relation_size(indexrelid) DESC
        LIMIT 10
      ) t
    ),
    'autovacuum_settings', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT
          c.relname AS table_name,
          COALESCE((
            SELECT option_value::float
            FROM pg_options_to_table(c.reloptions)
            WHERE option_name = 'autovacuum_vacuum_scale_factor'
          ), current_setting('autovacuum_vacuum_scale_factor')::float) AS vacuum_scale_factor,
          COALESCE((
            SELECT option_value::float
            FROM pg_options_to_table(c.reloptions)
            WHERE option_name = 'autovacuum_analyze_scale_factor'
          ), current_setting('autovacuum_analyze_scale_factor')::float) AS analyze_scale_factor,
          COALESCE((
            SELECT option_value::int
            FROM pg_options_to_table(c.reloptions)
            WHERE option_name = 'fillfactor'
          ), 100) AS fillfactor
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND c.relname IN (
            'store_visits', 'store_daily_stats', 'products', 'orders', 'order_items',
            'inventory_movements', 'analytics_event_outbox', 'order_side_effects_outbox',
            'order_webhook_outbox', 'rpc_rate_limits', 'store_visitor_daily_keys'
          )
        ORDER BY c.relname
      ) t
    ),
    'wait_events', (
      SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.event_count DESC), '[]'::jsonb)
      FROM (
        SELECT
          COALESCE(wait_event_type, 'none') AS wait_type,
          COALESCE(wait_event, 'none') AS wait_event,
          COUNT(*)::INT AS event_count
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND wait_event_type IS NOT NULL
          AND wait_event_type <> 'Client'
        GROUP BY 1, 2
        ORDER BY COUNT(*) DESC
        LIMIT 12
      ) t
    ),
    'lock_waits', (
      SELECT COUNT(*)::INT
      FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock'
    ),
    'extended_statistics', (
      SELECT COALESCE(jsonb_agg(stxname), '[]'::jsonb)
      FROM pg_statistic_ext
      WHERE stxnamespace = 'public'::regnamespace
    ),
    'healthy', v_healthy
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_postgresql_internals_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_postgresql_internals_audit() TO service_role;

-- ---------------------------------------------------------------------------
-- 6) platform_run_internals_maintenance — safe ANALYZE + prune (no VACUUM in tx)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_run_internals_maintenance(
  p_prune_rate_limits BOOLEAN DEFAULT true,
  p_prune_analytics BOOLEAN DEFAULT true,
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
  v_analyzed TEXT[] := ARRAY[]::TEXT[];
  v_tbl TEXT;
BEGIN
  IF p_prune_rate_limits THEN
    v_pruned_rates := public.prune_rpc_rate_limits(7200);
  END IF;

  IF p_prune_analytics AND public._platform_fn_exists('prune_analytics_event_outbox') THEN
    v_pruned_analytics := public.prune_analytics_event_outbox(7);
  END IF;

  IF p_analyze THEN
    FOREACH v_tbl IN ARRAY ARRAY[
      'products', 'orders', 'order_items', 'store_visits', 'store_daily_stats',
      'store_settings', 'customers', 'inventory_movements', 'analytics_event_outbox',
      'order_side_effects_outbox', 'order_webhook_outbox', 'rpc_rate_limits',
      'suggested_products', 'store_visitor_daily_keys'
    ] LOOP
      IF public._platform_table_exists(v_tbl) THEN
        EXECUTE format('ANALYZE public.%I', v_tbl);
        v_analyzed := array_append(v_analyzed, v_tbl);
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'pruned_rate_limits', v_pruned_rates,
    'pruned_analytics_rows', v_pruned_analytics,
    'analyzed_tables', to_jsonb(v_analyzed),
    'vacuum_note', 'Run VACUUM (ANALYZE) via pg_cron or supabase CLI — cannot execute inside RPC transaction'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_run_internals_maintenance(BOOLEAN, BOOLEAN, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_run_internals_maintenance(BOOLEAN, BOOLEAN, BOOLEAN) TO service_role;

-- ---------------------------------------------------------------------------
-- 7) platform_internals_audit — lightweight verification wrapper
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
    'schema_version', (SELECT max(version) FROM public.platform_schema_version),
    'cache_hit_ratio_pct', v_health->'database'->'cache_hit_ratio_pct',
    'heap_hit_ratio_pct', v_health->'io_ratios'->'heap_hit_ratio_pct',
    'index_hit_ratio_pct', v_health->'io_ratios'->'index_hit_ratio_pct',
    'seq_scan_ratio_pct', v_health->'scan_ratios'->'seq_scan_ratio_pct',
    'extended_statistics', v_health->'extended_statistics',
    'autovacuum_tuned_tables', jsonb_array_length(COALESCE(v_health->'autovacuum_settings', '[]'::jsonb)),
    'dead_tuple_tables', jsonb_array_length(COALESCE(v_health->'dead_tuples_top', '[]'::jsonb)),
    'unused_index_count', jsonb_array_length(COALESCE(v_health->'unused_indexes', '[]'::jsonb)),
    'lock_waits', v_health->'lock_waits',
    'healthy', COALESCE((v_health->>'healthy')::boolean, false),
    'full_report', v_health
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_internals_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_internals_audit() TO service_role;

-- ---------------------------------------------------------------------------
-- 8) Refresh planner stats (ANALYZE runs inside migration transaction)
-- ---------------------------------------------------------------------------
ANALYZE public.products;
ANALYZE public.orders;
ANALYZE public.order_items;
ANALYZE public.store_visits;
ANALYZE public.store_daily_stats;
ANALYZE public.analytics_event_outbox;
ANALYZE public.order_side_effects_outbox;
ANALYZE public.order_webhook_outbox;
ANALYZE public.rpc_rate_limits;
ANALYZE public.store_visitor_daily_keys;
ANALYZE public.inventory_movements;
ANALYZE public.customers;
ANALYZE public.store_settings;

-- ---------------------------------------------------------------------------
-- 9) Optional pg_cron — nightly maintenance + weekly rate-limit prune
-- ---------------------------------------------------------------------------
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname IN ('platform-internals-maintenance', 'platform-prune-rate-limits');

    PERFORM cron.schedule(
      'platform-internals-maintenance',
      '15 3 * * *',
      $cron$SELECT public.platform_run_internals_maintenance(true, true, true)$cron$
    );

    PERFORM cron.schedule(
      'platform-prune-rate-limits',
      '0 */6 * * *',
      $cron$SELECT public.prune_rpc_rate_limits(7200)$cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron internals schedule skipped: %', SQLERRM;
END $do$;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (
  69,
  'postgresql_internals: autovacuum tuning, extended stats, audit/maintenance RPCs, rate-limit prune'
)
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
