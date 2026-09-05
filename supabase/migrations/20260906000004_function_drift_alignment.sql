-- Function drift alignment: drop obsolete overloads, ship missing worker RPCs, tenant-safe analytics flush.
-- Does NOT deploy deferred phase waves (premium inventory, phase 3.4/3.5 bundles, phase 9 monitoring audit).

-- ---------------------------------------------------------------------------
-- 1) Drop obsolete checkout overloads — canonical 13-param only (20260906000002)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_order_with_stock_deduction(
  UUID, UUID, TEXT, TEXT, TEXT, DECIMAL, TEXT, TEXT, JSONB
);

DROP FUNCTION IF EXISTS public.create_order_with_stock_deduction(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, DECIMAL, TEXT, TEXT, JSONB, TEXT
);

DROP FUNCTION IF EXISTS public.create_order_with_stock_deduction(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, DECIMAL, TEXT, TEXT, JSONB, TEXT, TEXT
);

-- ---------------------------------------------------------------------------
-- 2) Drop obsolete inventory / statistics overloads
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.increment_product_stock(UUID, UUID, INT, TEXT);

DROP FUNCTION IF EXISTS public.get_store_statistics(UUID, INT);

-- ---------------------------------------------------------------------------
-- 3) Owner-scoped analytics buffer flush (merchant dashboard path)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_analytics_event_buffer(p_limit INT DEFAULT 200)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT := GREATEST(1, LEAST(COALESCE(p_limit, 200), 1000));
  v_scope_owner UUID;
  v_scope_raw TEXT := NULLIF(trim(current_setting('app.analytics_owner_scope', true)), '');
  v_ids BIGINT[];
  v_visit_rows INT := 0;
  v_product_rows INT := 0;
  v_trigger_disabled BOOLEAN := false;
BEGIN
  IF v_scope_raw IS NOT NULL THEN
    BEGIN
      v_scope_owner := v_scope_raw::UUID;
    EXCEPTION WHEN OTHERS THEN
      v_scope_owner := NULL;
    END;
  END IF;

  SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::BIGINT[])
  INTO v_ids
  FROM (
    SELECT id
    FROM public.analytics_event_outbox
    WHERE processed_at IS NULL
      AND (v_scope_owner IS NULL OR owner_id = v_scope_owner)
    ORDER BY created_at
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  ) locked;

  IF array_length(v_ids, 1) IS NULL OR array_length(v_ids, 1) = 0 THEN
    RETURN jsonb_build_object(
      'processed', 0,
      'store_visits', 0,
      'product_views', 0,
      'owner_scope', v_scope_owner
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.analytics_event_outbox o
    WHERE o.id = ANY (v_ids)
      AND o.event_type = 'store_visit'
  ) THEN
    ALTER TABLE public.store_visits DISABLE TRIGGER visits_daily_stats_trg;
    v_trigger_disabled := true;

    INSERT INTO public.store_visits (owner_id, visitor_ip, page_path, user_agent, created_at)
    SELECT
      o.owner_id,
      NULLIF(btrim(o.payload->>'visitor_ip'), ''),
      COALESCE(NULLIF(btrim(o.payload->>'page_path'), ''), '/'),
      LEFT(o.payload->>'user_agent', 512),
      o.created_at
    FROM public.analytics_event_outbox o
    WHERE o.id = ANY (v_ids)
      AND o.event_type = 'store_visit';

    GET DIAGNOSTICS v_visit_rows = ROW_COUNT;

    ALTER TABLE public.store_visits ENABLE TRIGGER visits_daily_stats_trg;
    v_trigger_disabled := false;

    WITH visit_events AS (
      SELECT
        o.owner_id,
        (o.created_at AT TIME ZONE 'UTC')::DATE AS stat_date,
        NULLIF(btrim(o.payload->>'visitor_ip'), '') AS visitor_ip
      FROM public.analytics_event_outbox o
      WHERE o.id = ANY (v_ids)
        AND o.event_type = 'store_visit'
    ),
    visit_counts AS (
      SELECT owner_id, stat_date, COUNT(*)::INT AS visit_count
      FROM visit_events
      GROUP BY owner_id, stat_date
    ),
    new_keys AS (
      INSERT INTO public.store_visitor_daily_keys (owner_id, stat_date, visitor_ip)
      SELECT DISTINCT ve.owner_id, ve.stat_date, ve.visitor_ip
      FROM visit_events ve
      WHERE ve.visitor_ip IS NOT NULL
        AND ve.visitor_ip <> ''
        AND ve.visitor_ip <> '0.0.0.0'
      ON CONFLICT DO NOTHING
      RETURNING owner_id, stat_date, visitor_ip
    ),
    unique_counts AS (
      SELECT owner_id, stat_date, COUNT(*)::INT AS unique_visitors
      FROM new_keys
      GROUP BY owner_id, stat_date
    )
    INSERT INTO public.store_daily_stats (owner_id, stat_date, visit_count, unique_visitors)
    SELECT
      vc.owner_id,
      vc.stat_date,
      vc.visit_count,
      COALESCE(uc.unique_visitors, 0)
    FROM visit_counts vc
    LEFT JOIN unique_counts uc
      ON uc.owner_id = vc.owner_id
      AND uc.stat_date = vc.stat_date
    ON CONFLICT (owner_id, stat_date) DO UPDATE SET
      visit_count = store_daily_stats.visit_count + EXCLUDED.visit_count,
      unique_visitors = store_daily_stats.unique_visitors + EXCLUDED.unique_visitors,
      updated_at = NOW();
  END IF;

  INSERT INTO public.product_views (
    product_id,
    owner_id,
    visitor_ip,
    store_slug,
    page_path,
    created_at
  )
  SELECT
    (o.payload->>'product_id')::UUID,
    o.owner_id,
    NULLIF(btrim(o.payload->>'visitor_ip'), ''),
    NULLIF(btrim(o.payload->>'store_slug'), ''),
    NULLIF(btrim(o.payload->>'page_path'), ''),
    o.created_at
  FROM public.analytics_event_outbox o
  WHERE o.id = ANY (v_ids)
    AND o.event_type = 'product_view'
    AND o.payload->>'product_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  GET DIAGNOSTICS v_product_rows = ROW_COUNT;

  UPDATE public.analytics_event_outbox
  SET processed_at = NOW()
  WHERE id = ANY (v_ids);

  RETURN jsonb_build_object(
    'processed', array_length(v_ids, 1),
    'store_visits', v_visit_rows,
    'product_views', v_product_rows,
    'owner_scope', v_scope_owner
  );
EXCEPTION
  WHEN OTHERS THEN
    IF v_trigger_disabled THEN
      ALTER TABLE public.store_visits ENABLE TRIGGER visits_daily_stats_trg;
    END IF;
    RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.flush_merchant_analytics_buffer(p_limit INT DEFAULT 200)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID := auth.uid();
  v_result JSONB;
BEGIN
  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  PERFORM set_config('app.analytics_owner_scope', v_owner::text, true);
  v_result := public.process_analytics_event_buffer(GREATEST(1, LEAST(COALESCE(p_limit, 200), 500)));
  PERFORM set_config('app.analytics_owner_scope', '', true);

  RETURN jsonb_build_object('success', true, 'owner_id', v_owner) || COALESCE(v_result, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.flush_merchant_analytics_buffer(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flush_merchant_analytics_buffer(INT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) Webhook worker bundle RPC (reduces edge round-trips; service_role only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_webhook_outbox_worker_start(
  p_limit INT DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT := GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
  v_side JSONB;
  v_claim JSONB;
BEGIN
  IF current_setting('request.jwt.claim.role', true) <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin', 'authenticator') THEN
    RAISE EXCEPTION 'service_role or postgres only';
  END IF;

  PERFORM set_config('statement_timeout', '60000', true);
  PERFORM set_config('lock_timeout', '10000', true);

  v_side := public.process_order_side_effects_batch(v_limit);
  v_claim := public.claim_order_webhook_outbox_batch(v_limit);

  RETURN jsonb_build_object(
    'success', true,
    'ran_at', now(),
    'side_effects', v_side,
    'claim', v_claim,
    'jobs', COALESCE(v_claim->'jobs', '[]'::jsonb),
    'delivered_without_url', COALESCE((v_claim->>'delivered_without_url')::int, 0)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', LEFT(SQLERRM, 300));
END;
$$;

REVOKE ALL ON FUNCTION public.process_webhook_outbox_worker_start(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_webhook_outbox_worker_start(INT) TO service_role;

-- ---------------------------------------------------------------------------
-- 5) Canonical RPC registry (documentation + drift detection)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_rpc_registry (
  rpc_name TEXT NOT NULL,
  arg_signature TEXT NOT NULL DEFAULT '',
  domain TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'deprecated', 'deferred', 'superseded')),
  canonical_migration TEXT,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (rpc_name, arg_signature)
);

INSERT INTO public.platform_rpc_registry (rpc_name, arg_signature, domain, status, canonical_migration, notes)
VALUES
  ('create_order_with_stock_deduction', '13-param with p_store_slug', 'checkout', 'active', '20260906000002', 'Single canonical checkout RPC'),
  ('checkout_lock_product_snapshots', 'p_owner_id uuid, p_items jsonb', 'checkout', 'active', '20260906000002', 'Snapshot lock for checkout validation'),
  ('increment_product_stock', '5-param with p_min_stock_level', 'inventory', 'active', '20260906000003', 'Simple stock model — no warehouse tables'),
  ('merchant_inventory_summary', 'p_owner_id uuid', 'inventory', 'active', '20260906000003', 'Simple inventory KPIs'),
  ('batch_restock_products', 'p_owner_id uuid, p_items jsonb', 'inventory', 'active', '20260906000003', 'Batch restock without warehouses'),
  ('list_merchant_inventory_movements', 'p_owner_id uuid + date range', 'inventory', 'active', '20260906000003', 'Movement history from inventory_movements'),
  ('get_merchant_inventory_page_bundle', 'p_owner_id uuid, p_limit int', 'inventory', 'deferred', '20260902000004', 'Phase 3.5 read bundle — app falls back to product queries'),
  ('ensure_default_warehouse', 'p_owner_id uuid', 'inventory', 'deferred', '20260728000001', 'Premium warehouse layer only'),
  ('get_store_statistics', 'p_owner_id uuid, p_start timestamptz, p_end timestamptz', 'dashboard', 'active', '20260625000065', 'Range-based statistics; days overload dropped'),
  ('get_statistics_page_bundle', 'owner + 4 date bounds', 'dashboard', 'active', '20260625000028', 'Optimized bundle — phase 3.4 rewrite deferred'),
  ('flush_merchant_analytics_buffer', 'p_limit int', 'analytics', 'active', '20260906000004', 'Owner-scoped analytics drain for merchant sessions'),
  ('process_analytics_event_buffer', 'p_limit int', 'analytics', 'active', '20260906000004', 'Global or owner-scoped via app.analytics_owner_scope'),
  ('process_webhook_outbox_worker_start', 'p_limit int', 'background', 'active', '20260906000004', 'Side effects + webhook claim bundle'),
  ('platform_monitoring_observability_audit', '()', 'monitoring', 'deferred', '20260902000011', 'Phase 9 — app probes and skips when absent')
ON CONFLICT (rpc_name, arg_signature) DO UPDATE SET
  domain = EXCLUDED.domain,
  status = EXCLUDED.status,
  canonical_migration = EXCLUDED.canonical_migration,
  notes = EXCLUDED.notes,
  updated_at = NOW();

INSERT INTO public.platform_migration_registry (version, status, wave, file_name, notes)
VALUES (
  '20260902000006',
  'superseded',
  'phase-4-connection-pool',
  '20260902000006_connection_pool_phase_4.sql',
  'process_webhook_outbox_worker_start shipped in 20260906000004 without full phase-4 wave.'
)
ON CONFLICT (version) DO UPDATE SET status = EXCLUDED.status, notes = EXCLUDED.notes, updated_at = now();

INSERT INTO public.platform_schema_version (version, notes)
VALUES (109, 'function drift: drop obsolete overloads, analytics flush, webhook worker bundle')
ON CONFLICT (version) DO UPDATE SET notes = EXCLUDED.notes, applied_at = NOW();
