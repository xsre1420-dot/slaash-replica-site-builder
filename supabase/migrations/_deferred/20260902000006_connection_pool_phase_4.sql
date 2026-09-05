-- Phase 4: Connection pool saturation — bundle webhook worker start RPC (one connection per tick)
-- Does NOT change business logic; reduces sequential PostgREST round-trips on edge workers.

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

-- Extend connection resource audit with saturation snapshot
CREATE OR REPLACE FUNCTION public.platform_connection_saturation_audit()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_conn INT;
  v_active INT;
  v_idle INT;
  v_waiting INT;
  v_total INT;
  v_long_tx INT;
BEGIN
  IF current_setting('request.jwt.claim.role', true) <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin', 'authenticator') THEN
    RAISE EXCEPTION 'service_role or postgres only';
  END IF;

  SELECT setting::INT INTO v_max_conn FROM pg_settings WHERE name = 'max_connections';

  SELECT
    COUNT(*) FILTER (WHERE state = 'active')::INT,
    COUNT(*) FILTER (WHERE state = 'idle')::INT,
    COUNT(*) FILTER (WHERE wait_event_type IS NOT NULL)::INT,
    COUNT(*)::INT
  INTO v_active, v_idle, v_waiting, v_total
  FROM pg_stat_activity
  WHERE datname = current_database();

  SELECT COUNT(*)::INT INTO v_long_tx
  FROM pg_stat_activity
  WHERE datname = current_database()
    AND state = 'active'
    AND xact_start IS NOT NULL
    AND now() - xact_start > interval '30 seconds';

  RETURN jsonb_build_object(
    'audited_at', now(),
    'phase', '4',
    'max_connections', v_max_conn,
    'total_backends', v_total,
    'active', v_active,
    'idle', v_idle,
    'waiting', v_waiting,
    'saturation_pct', CASE WHEN v_max_conn > 0 THEN ROUND((v_total::numeric / v_max_conn) * 100, 1) ELSE 0 END,
    'long_transactions_over_30s', v_long_tx,
    'recommendations', public.platform_connection_pool_recommendations()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_connection_saturation_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_connection_saturation_audit() TO service_role;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (119, 'phase 4: webhook worker bundle RPC, connection saturation audit')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
