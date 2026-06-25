-- v72: Distributed scaling architecture — health v72, scaling audit, extended worker monitor

-- ---------------------------------------------------------------------------
-- 1) platform_health_check v72
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_health_check()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_required INT := 72;
  v_version INT := 0;
  v_missing TEXT[] := ARRAY[]::TEXT[];
  v_fn TEXT;
  v_required_fns TEXT[] := ARRAY[
    'get_store_products_page',
    'get_storefront_page_bundle',
    'get_store_meta',
    '_resolve_store_owner_by_slug',
    'get_dashboard_statistics_batch',
    'get_store_statistics',
    'create_order_with_stock_deduction',
    'get_order_by_idempotency_key',
    'check_rpc_rate_limit',
    'list_merchant_orders',
    'track_store_visit_by_slug',
    'tenant_row_owned',
    'increment_product_stock',
    'storefront_product_json',
    'process_analytics_event_buffer',
    'process_order_side_effects_batch',
    'platform_run_data_lifecycle',
    'platform_distributed_scaling_audit',
    'platform_ensure_monthly_partitions',
    'get_background_jobs_status'
  ];
  v_message TEXT;
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

  v_message := CASE
    WHEN COALESCE(array_length(v_missing, 1), 0) > 0 THEN 'migration_required'
    WHEN v_version < v_required THEN 'schema_version_outdated'
    ELSE 'ok'
  END;

  RETURN jsonb_build_object(
    'ok', v_message = 'ok',
    'schema_version', v_version,
    'required_version', v_required,
    'missing', COALESCE(v_missing, ARRAY[]::TEXT[]),
    'checks', jsonb_build_object(
      'storefront', public._platform_fn_exists('get_storefront_page_bundle'),
      'checkout', public._platform_fn_exists('create_order_with_stock_deduction'),
      'background_workers', public._platform_fn_exists('get_background_jobs_status'),
      'data_lifecycle', public._platform_fn_exists('platform_run_data_lifecycle'),
      'distributed_scaling', public._platform_fn_exists('platform_distributed_scaling_audit'),
      'partitioning', public._platform_fn_exists('platform_ensure_monthly_partitions'),
      'side_effects_queue', public._platform_fn_exists('process_order_side_effects_batch')
    ),
    'message', v_message
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_health_check() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_health_check() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2) Extended background jobs monitor — import jobs + DLQ depth
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_background_jobs_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_analytics_pending INT := 0;
  v_analytics_oldest INT := 0;
  v_webhook_pending INT := 0;
  v_webhook_processing INT := 0;
  v_webhook_failed INT := 0;
  v_webhook_oldest INT := 0;
  v_side_effects_pending INT := 0;
  v_side_effects_oldest INT := 0;
  v_import_pending INT := 0;
  v_import_processing INT := 0;
  v_status TEXT := 'ok';
BEGIN
  SELECT COUNT(*)::INT,
         COALESCE(EXTRACT(EPOCH FROM (NOW() - MIN(created_at)))::INT, 0)
  INTO v_analytics_pending, v_analytics_oldest
  FROM public.analytics_event_outbox
  WHERE processed_at IS NULL;

  SELECT COUNT(*) FILTER (WHERE status = 'pending')::INT,
         COUNT(*) FILTER (WHERE status = 'processing')::INT,
         COUNT(*) FILTER (WHERE status = 'failed')::INT,
         COALESCE(
           EXTRACT(EPOCH FROM (NOW() - MIN(created_at) FILTER (WHERE status = 'pending')))::INT,
           0
         )
  INTO v_webhook_pending, v_webhook_processing, v_webhook_failed, v_webhook_oldest
  FROM public.order_webhook_outbox;

  SELECT COUNT(*)::INT,
         COALESCE(EXTRACT(EPOCH FROM (NOW() - MIN(created_at)))::INT, 0)
  INTO v_side_effects_pending, v_side_effects_oldest
  FROM public.order_side_effects_outbox
  WHERE processed_at IS NULL;

  IF public._platform_table_exists('import_jobs') THEN
    SELECT COUNT(*) FILTER (WHERE status IN ('pending', 'processing'))::INT,
           COUNT(*) FILTER (WHERE status = 'processing')::INT
    INTO v_import_pending, v_import_processing
    FROM public.import_jobs;
  END IF;

  IF v_analytics_pending >= 5000 OR v_webhook_pending >= 500 OR v_webhook_failed >= 100
     OR v_side_effects_pending >= 1000 THEN
    v_status := 'critical';
  ELSIF v_analytics_pending >= 500 OR v_webhook_pending >= 100
        OR v_side_effects_pending >= 200
        OR v_analytics_oldest > 600 OR v_webhook_oldest > 600 OR v_side_effects_oldest > 300 THEN
    v_status := 'degraded';
  ELSIF v_analytics_pending >= 100 OR v_webhook_pending >= 25 OR v_side_effects_pending >= 50
        OR v_analytics_oldest > 180 OR v_webhook_oldest > 180 OR v_side_effects_oldest > 120 THEN
    v_status := 'warn';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', v_status,
    'analytics', jsonb_build_object(
      'pending', v_analytics_pending,
      'oldest_pending_seconds', v_analytics_oldest,
      'processor', 'process_analytics_event_buffer'
    ),
    'order_webhooks', jsonb_build_object(
      'pending', v_webhook_pending,
      'processing', v_webhook_processing,
      'failed_dead_letter', v_webhook_failed,
      'oldest_pending_seconds', v_webhook_oldest,
      'processor', 'process-order-webhook-outbox + claim_order_webhook_outbox_batch'
    ),
    'order_side_effects', jsonb_build_object(
      'pending', v_side_effects_pending,
      'oldest_pending_seconds', v_side_effects_oldest,
      'processor', 'process_order_side_effects_batch'
    ),
    'import_jobs', jsonb_build_object(
      'pending_or_processing', v_import_pending,
      'processing', v_import_processing,
      'processor', 'process-import-jobs edge function'
    ),
    'unified_worker', 'process-background-queue edge function',
    'recommendations',
      CASE
        WHEN v_side_effects_pending > 0 AND v_side_effects_oldest > 120
          THEN jsonb_build_array('invoke process-background-queue or process_order_side_effects_batch')
        WHEN v_webhook_failed >= 50 THEN jsonb_build_array('review webhook DLQ — retry_order_webhook_events')
        WHEN v_webhook_pending > 0 AND v_webhook_oldest > 120
          THEN jsonb_build_array('invoke process-order-webhook-outbox edge function')
        WHEN v_analytics_pending > 0 AND v_analytics_oldest > 120
          THEN jsonb_build_array('run process_analytics_event_buffer')
        ELSE '[]'::jsonb
      END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_background_jobs_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_background_jobs_status() TO service_role;

-- ---------------------------------------------------------------------------
-- 3) platform_distributed_scaling_audit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_distributed_scaling_audit()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lifecycle JSONB;
  v_resources JSONB;
  v_workers JSONB;
  v_partitions INT := 0;
BEGIN
  IF public._platform_fn_exists('platform_data_lifecycle_audit') THEN
    v_lifecycle := public.platform_data_lifecycle_audit();
  END IF;

  IF public._platform_fn_exists('platform_database_resource_audit') THEN
    v_resources := public.platform_database_resource_audit();
  END IF;

  IF public._platform_fn_exists('get_background_jobs_status') THEN
    v_workers := public.get_background_jobs_status();
  END IF;

  SELECT COUNT(*)::INT INTO v_partitions
  FROM pg_inherits i
  JOIN pg_class p ON p.oid = i.inhparent
  JOIN pg_namespace n ON n.oid = p.relnamespace
  WHERE n.nspname = 'public';

  RETURN jsonb_build_object(
    'audited_at', NOW(),
    'schema_version', (SELECT max(version) FROM public.platform_schema_version),
    'architecture', jsonb_build_object(
      'stateless_frontend', true,
      'stateless_edge_functions', true,
      'postgres_outbox_workers', true,
      'monthly_partitions', v_partitions > 0,
      'read_replica_routing', 'client-side via VITE_SUPABASE_READ_REPLICA_URL',
      'shared_kv_cache', 'optional VITE_KV_REST_URL / UPSTASH_REDIS_REST_URL on edge',
      'cdn_storefront', 'VITE_STOREFRONT_EDGE_ENABLED + get-store-products edge'
    ),
    'single_points_of_failure', jsonb_build_array(
      'Supabase primary PostgreSQL (mitigated: pooler, read replica, archive, partitions)',
      'Supabase Realtime service (mitigated: hub consolidation, reconnect, heartbeat)',
      'Edge isolate memory cache (mitigated: optional KV, CDN, version keys)',
      'Single-region deployment (mitigated: client DR failover URL)'
    ),
    'cache_layers', jsonb_build_object(
      'browser', 'Cache API + in-memory + IndexedDB storefront tiers',
      'cdn', 'VITE_CDN_BASE_URL + edge Cache-Control',
      'edge', 'get-store-products in-memory + optional KV',
      'application', 'cache.ts LRU + optional kvAdapter L2',
      'database', 'store_daily_stats rollups + covering indexes'
    ),
    'read_routing', jsonb_build_object(
      'storefront', 'edge_cache → read_replica → primary',
      'dashboard_stats', 'read_replica or client cache (90s TTL)',
      'checkout_writes', 'primary only',
      'inventory_writes', 'primary only',
      'background_workers', 'primary via service_role'
    ),
    'worker_queues', COALESCE(v_workers, '{}'::jsonb),
    'connections', COALESCE(v_resources->'connections', '{}'::jsonb),
    'partitions', COALESCE(v_lifecycle->'partitions', '[]'::jsonb),
    'partition_count', v_partitions,
    'healthy',
      COALESCE((v_workers->>'status') IN ('ok', 'warn'), true)
      AND COALESCE((v_resources->'connections'->>'idle_in_transaction')::INT, 0) < 10
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_scaling_audit()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full JSONB;
BEGIN
  v_full := public.platform_distributed_scaling_audit();
  RETURN jsonb_build_object(
    'success', true,
    'schema_version', v_full->'schema_version',
    'partition_count', v_full->'partition_count',
    'worker_status', v_full->'worker_queues'->'status',
    'healthy', v_full->'healthy',
    'full_report', v_full
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_distributed_scaling_audit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_scaling_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_distributed_scaling_audit() TO service_role;
GRANT EXECUTE ON FUNCTION public.platform_scaling_audit() TO service_role;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (72, 'distributed_scaling: read routing audit, unified worker monitor, health v72')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
