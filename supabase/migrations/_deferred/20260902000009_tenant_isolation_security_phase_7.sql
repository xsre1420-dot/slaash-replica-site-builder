-- v113: Phase 7 — tenant isolation & security hardening

-- ---------------------------------------------------------------------------
-- 1) Rate limit RPC — service_role only (closes anon/authenticated grant regression)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.check_rpc_rate_limit(TEXT, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_rpc_rate_limit(TEXT, INT, INT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rpc_rate_limit(TEXT, INT, INT) TO service_role;

-- ---------------------------------------------------------------------------
-- 2) Merchant store slug verification (edge cache purge + defense in depth)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_merchant_store_slug(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_slug TEXT := lower(trim(COALESCE(p_slug, '')));
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  IF v_slug = '' OR v_slug !~ '^[a-z0-9-]+$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_slug');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.store_settings ss
    WHERE lower(ss.store_slug) = v_slug
      AND ss.owner_id = v_uid
  ) OR EXISTS (
    SELECT 1
    FROM public.stores st
    WHERE lower(st.store_slug) = v_slug
      AND st.user_id = v_uid
  ) THEN
    RETURN jsonb_build_object('ok', true, 'owner_id', v_uid);
  END IF;

  RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
END;
$$;

REVOKE ALL ON FUNCTION public.verify_merchant_store_slug(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_merchant_store_slug(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Analytics buffer — tenant-scoped merchant flush (no cross-tenant processing)
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

  IF EXISTS (
    SELECT 1
    FROM public.analytics_event_outbox o
    WHERE o.id = ANY (v_ids)
      AND o.event_type = 'product_view'
  ) THEN
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
  END IF;

  UPDATE public.analytics_event_outbox
  SET processed_at = NOW()
  WHERE id = ANY (v_ids);

  RETURN jsonb_build_object(
    'processed', COALESCE(array_length(v_ids, 1), 0),
    'store_visits', v_visit_rows,
    'product_views', v_product_rows,
    'owner_scope', v_scope_owner
  );
EXCEPTION WHEN OTHERS THEN
  IF v_trigger_disabled THEN
    ALTER TABLE public.store_visits ENABLE TRIGGER visits_daily_stats_trg;
  END IF;
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.process_analytics_event_buffer(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_analytics_event_buffer(INT) TO service_role;

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
-- 4) Tenant isolation security audit RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_tenant_isolation_security_audit()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tables_without_rls INT;
  v_total_public_tables INT;
BEGIN
  SELECT COUNT(*)::INT
  INTO v_total_public_tables
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname NOT LIKE 'pg_%';

  SELECT COUNT(*)::INT
  INTO v_tables_without_rls
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relrowsecurity = false
    AND c.relname NOT IN ('platform_schema_version', 'spatial_ref_sys');

  RETURN jsonb_build_object(
    'audited_at', NOW(),
    'schema_version', (SELECT max(version) FROM public.platform_schema_version),
    'phase', 7,
    'rls', jsonb_build_object(
      'public_tables', v_total_public_tables,
      'without_rls', v_tables_without_rls,
      'coverage_ok', v_tables_without_rls <= 2
    ),
    'rpc_grants', jsonb_build_object(
      'check_rpc_rate_limit_service_only', NOT has_function_privilege('anon', 'public.check_rpc_rate_limit(text,integer,integer)', 'EXECUTE'),
      'verify_merchant_store_slug_authenticated', has_function_privilege('authenticated', 'public.verify_merchant_store_slug(text)', 'EXECUTE'),
      'checkout_resolve_internal_only', NOT has_function_privilege('authenticated', 'public.checkout_resolve_duplicate_order(uuid,text,uuid)', 'EXECUTE')
    ),
    'tenant_controls', jsonb_build_array(
      'tenant_row_owned_rls',
      'merchant_rpc_auth_uid_checks',
      'slug_bound_storefront_rpcs',
      'checkout_idempotency_unique_index',
      'webhook_outbox_dedup_index',
      'storage_folder_owner_match',
      'analytics_flush_owner_scope'
    ),
    'healthy', v_tables_without_rls <= 2
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_tenant_isolation_security_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_tenant_isolation_security_audit() TO service_role;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (
  122,
  'Phase 7: tenant isolation — rate limit RPC lockdown, scoped analytics flush, merchant slug verify, security audit'
)
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
