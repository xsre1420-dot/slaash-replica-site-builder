-- v51: Analytics event buffer — decouple storefront tracking from synchronous rollups.
-- Hot path: 1 INSERT into analytics_event_outbox (was 3 writes: visit + keys + stats).
-- Background: process_analytics_event_buffer batches inserts + consolidated rollups.

-- ---------------------------------------------------------------------------
-- 1) Event outbox (append-only, tenant-scoped)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analytics_event_outbox (
  id BIGSERIAL PRIMARY KEY,
  owner_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('store_visit', 'product_view')),
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_analytics_event_outbox_pending
  ON public.analytics_event_outbox (created_at)
  WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_event_outbox_visit_dedupe
  ON public.analytics_event_outbox (owner_id, event_type, ((payload->>'visitor_ip')), ((payload->>'page_path')), created_at DESC)
  WHERE event_type = 'store_visit';

CREATE INDEX IF NOT EXISTS idx_analytics_event_outbox_product_dedupe
  ON public.analytics_event_outbox (owner_id, event_type, ((payload->>'product_id')), ((payload->>'visitor_ip')), created_at DESC)
  WHERE event_type = 'product_view';

ALTER TABLE public.analytics_event_outbox ENABLE ROW LEVEL SECURITY;

-- Merchants may read their own buffered events (debug); writes only via SECURITY DEFINER RPCs.
DROP POLICY IF EXISTS "Store owners can view their analytics events" ON public.analytics_event_outbox;
CREATE POLICY "Store owners can view their analytics events"
  ON public.analytics_event_outbox FOR SELECT
  USING (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2) Batch processor — background aggregation job
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_analytics_event_buffer(p_limit INT DEFAULT 200)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT := GREATEST(1, LEAST(COALESCE(p_limit, 200), 1000));
  v_ids BIGINT[];
  v_visit_rows INT := 0;
  v_product_rows INT := 0;
  v_trigger_disabled BOOLEAN := false;
BEGIN
  SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::BIGINT[])
  INTO v_ids
  FROM (
    SELECT id
    FROM public.analytics_event_outbox
    WHERE processed_at IS NULL
    ORDER BY created_at
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  ) locked;

  IF array_length(v_ids, 1) IS NULL OR array_length(v_ids, 1) = 0 THEN
    RETURN jsonb_build_object('processed', 0, 'store_visits', 0, 'product_views', 0);
  END IF;

  -- Batch insert store_visits without per-row rollup trigger.
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

    -- Consolidated daily rollups (one UPSERT per owner/day instead of per visit).
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

  -- Batch product view inserts (no rollup trigger on product_views).
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
    'product_views', v_product_rows
  );
EXCEPTION
  WHEN OTHERS THEN
    IF v_trigger_disabled THEN
      ALTER TABLE public.store_visits ENABLE TRIGGER visits_daily_stats_trg;
    END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.process_analytics_event_buffer(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_analytics_event_buffer(INT) FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Visit tracking — buffer-first (1 write), 30-minute dedupe aligned with client
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.track_store_visit_by_slug(
  p_store_slug TEXT,
  p_page_path TEXT DEFAULT '/',
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
  v_ip TEXT;
  v_path TEXT;
  v_pending INT;
BEGIN
  IF p_store_slug IS NULL OR trim(p_store_slug) = '' OR p_store_slug !~ '^[a-z0-9-]+$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_slug');
  END IF;

  v_owner := public._resolve_store_owner_by_slug(p_store_slug);
  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'store_not_found');
  END IF;

  v_ip := COALESCE(
    NULLIF(split_part(COALESCE(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1), ''),
    NULLIF(current_setting('request.headers', true)::json->>'x-real-ip', ''),
    '0.0.0.0'
  );

  v_path := COALESCE(NULLIF(trim(p_page_path), ''), '/');

  -- 30-minute dedupe (aligned with client sessionStorage)
  IF EXISTS (
    SELECT 1
    FROM public.analytics_event_outbox o
    WHERE o.owner_id = v_owner
      AND o.event_type = 'store_visit'
      AND o.payload->>'visitor_ip' = v_ip
      AND o.payload->>'page_path' = v_path
      AND o.created_at > NOW() - INTERVAL '30 minutes'
    LIMIT 1
  ) OR EXISTS (
    SELECT 1
    FROM public.store_visits sv
    WHERE sv.owner_id = v_owner
      AND sv.visitor_ip = v_ip
      AND sv.page_path = v_path
      AND sv.created_at > NOW() - INTERVAL '30 minutes'
    LIMIT 1
  ) THEN
    RETURN jsonb_build_object('success', true, 'deduped', true);
  END IF;

  IF NOT public.is_valid_store_visit(v_owner, v_ip) THEN
    RETURN jsonb_build_object('success', true, 'rate_limited', true);
  END IF;

  INSERT INTO public.analytics_event_outbox (owner_id, event_type, payload)
  VALUES (
    v_owner,
    'store_visit',
    jsonb_build_object(
      'visitor_ip', v_ip,
      'page_path', v_path,
      'user_agent', LEFT(p_user_agent, 512),
      'store_slug', lower(trim(p_store_slug))
    )
  );

  SELECT COUNT(*)::INT INTO v_pending
  FROM public.analytics_event_outbox
  WHERE processed_at IS NULL;

  IF v_pending >= 75 THEN
    PERFORM public.process_analytics_event_buffer(200);
  END IF;

  RETURN jsonb_build_object('success', true, 'buffered', true);
END;
$$;

REVOKE ALL ON FUNCTION public.track_store_visit_by_slug(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_store_visit_by_slug(TEXT, TEXT, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Product view tracking — buffer-first (1 write, deferred batch insert)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.track_product_view_by_slug(
  p_slug TEXT,
  p_product_id UUID,
  p_page_path TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_ip TEXT;
  v_pending INT;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9-]+$' OR p_product_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
  END IF;

  SELECT ss.owner_id INTO v_owner_id
  FROM store_settings ss
  WHERE LOWER(ss.store_slug) = LOWER(trim(p_slug))
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    SELECT st.user_id INTO v_owner_id
    FROM stores st
    WHERE LOWER(st.store_slug) = LOWER(trim(p_slug))
    LIMIT 1;
  END IF;

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'store_not_found');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = p_product_id
      AND p.owner_id = v_owner_id
      AND COALESCE(p.is_active, true) = true
      AND p.archived_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'product_not_found');
  END IF;

  v_ip := COALESCE(
    NULLIF(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1), ''),
    '0.0.0.0'
  );

  -- 30-minute dedupe (aligned with client sessionStorage)
  IF EXISTS (
    SELECT 1
    FROM public.analytics_event_outbox o
    WHERE o.owner_id = v_owner_id
      AND o.event_type = 'product_view'
      AND o.payload->>'product_id' = p_product_id::TEXT
      AND o.payload->>'visitor_ip' = v_ip
      AND o.created_at > NOW() - INTERVAL '30 minutes'
    LIMIT 1
  ) OR EXISTS (
    SELECT 1
    FROM public.product_views pv
    WHERE pv.owner_id = v_owner_id
      AND pv.product_id = p_product_id
      AND pv.visitor_ip = v_ip
      AND pv.created_at > NOW() - INTERVAL '30 minutes'
    LIMIT 1
  ) THEN
    RETURN jsonb_build_object('success', true, 'deduped', true);
  END IF;

  IF NOT public.is_valid_product_view(v_owner_id, p_product_id, v_ip) THEN
    RETURN jsonb_build_object('success', false, 'error', 'rate_limited');
  END IF;

  INSERT INTO public.analytics_event_outbox (owner_id, event_type, payload)
  VALUES (
    v_owner_id,
    'product_view',
    jsonb_build_object(
      'product_id', p_product_id::TEXT,
      'visitor_ip', v_ip,
      'store_slug', lower(trim(p_slug)),
      'page_path', NULLIF(trim(p_page_path), '')
    )
  );

  SELECT COUNT(*)::INT INTO v_pending
  FROM public.analytics_event_outbox
  WHERE processed_at IS NULL;

  IF v_pending >= 75 THEN
    PERFORM public.process_analytics_event_buffer(200);
  END IF;

  RETURN jsonb_build_object('success', true, 'buffered', true);
END;
$$;

REVOKE ALL ON FUNCTION public.track_product_view_by_slug(TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_product_view_by_slug(TEXT, UUID, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5) Retention — prune processed outbox rows older than 7 days
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prune_analytics_event_outbox(p_keep_days INT DEFAULT 7)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INT;
BEGIN
  DELETE FROM public.analytics_event_outbox
  WHERE processed_at IS NOT NULL
    AND processed_at < NOW() - (GREATEST(COALESCE(p_keep_days, 7), 1) || ' days')::INTERVAL;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_analytics_event_outbox(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prune_analytics_event_outbox(INT) FROM anon, authenticated;
