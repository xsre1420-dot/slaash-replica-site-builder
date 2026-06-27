-- v70: Partitioning & data lifecycle — monthly RANGE partitions, archive tables, automated purge/archive
-- Builds on v42/v51/v58/v69 prune functions. Does NOT repeat read/write/index/connection/internals work.

-- ---------------------------------------------------------------------------
-- 1) Lifecycle policy registry
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_data_lifecycle_policies (
  table_name TEXT PRIMARY KEY,
  data_tier TEXT NOT NULL CHECK (data_tier IN ('hot', 'warm', 'cold', 'archive')),
  partition_strategy TEXT NOT NULL DEFAULT 'none'
    CHECK (partition_strategy IN ('none', 'monthly_range', 'archive_only')),
  hot_retention_days INT,
  archive_after_days INT,
  purge_after_days INT,
  notes TEXT
);

INSERT INTO public.platform_data_lifecycle_policies (table_name, data_tier, partition_strategy, hot_retention_days, archive_after_days, purge_after_days, notes)
VALUES
  ('store_visits', 'hot', 'monthly_range', 90, NULL, 90, 'Partition by month; drop partitions older than 90d'),
  ('inventory_movements', 'warm', 'monthly_range', 365, 730, NULL, 'Partition by month; archive after 2y'),
  ('analytics_event_outbox', 'hot', 'monthly_range', 7, NULL, 7, 'Processed rows purged; monthly partitions'),
  ('orders', 'hot', 'archive_only', 548, 548, NULL, 'Terminal orders archived after ~18 months'),
  ('order_items', 'hot', 'archive_only', 548, 548, NULL, 'Archived with parent order'),
  ('order_webhook_outbox', 'hot', 'none', 30, NULL, 30, 'Delivered/failed rows purged after 30d'),
  ('order_side_effects_outbox', 'hot', 'none', 7, NULL, 7, 'Processed rows purged after 7d'),
  ('import_jobs', 'hot', 'none', 30, NULL, 30, 'Completed/failed jobs purged after 30d'),
  ('rpc_rate_limits', 'hot', 'none', NULL, NULL, NULL, 'Pruned every 6h via v69'),
  ('store_daily_stats', 'warm', 'none', NULL, NULL, NULL, 'Long-term rollup — keep indefinitely')
ON CONFLICT (table_name) DO UPDATE SET
  data_tier = EXCLUDED.data_tier,
  partition_strategy = EXCLUDED.partition_strategy,
  hot_retention_days = EXCLUDED.hot_retention_days,
  archive_after_days = EXCLUDED.archive_after_days,
  purge_after_days = EXCLUDED.purge_after_days,
  notes = EXCLUDED.notes;

ALTER TABLE public.platform_data_lifecycle_policies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_data_lifecycle_policies_deny ON public.platform_data_lifecycle_policies;
CREATE POLICY platform_data_lifecycle_policies_deny ON public.platform_data_lifecycle_policies
  FOR ALL USING (false);

REVOKE ALL ON TABLE public.platform_data_lifecycle_policies FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.platform_data_lifecycle_policies TO service_role;

-- ---------------------------------------------------------------------------
-- 2) Archive tables (orders — co-partitioned by archive, not live partition)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders_archive (
  LIKE public.orders INCLUDING DEFAULTS
);

ALTER TABLE public.orders_archive
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_archive_pkey'
  ) THEN
    ALTER TABLE public.orders_archive ADD PRIMARY KEY (id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'orders_archive pk: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_archive_owner_created
  ON public.orders_archive (owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.order_items_archive (
  LIKE public.order_items INCLUDING DEFAULTS
);

ALTER TABLE public.order_items_archive
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_archive_pkey'
  ) THEN
    ALTER TABLE public.order_items_archive ADD PRIMARY KEY (id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'order_items_archive pk: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_order_items_archive_order
  ON public.order_items_archive (order_id);

CREATE TABLE IF NOT EXISTS public.inventory_movements_archive (
  LIKE public.inventory_movements INCLUDING DEFAULTS
);

ALTER TABLE public.inventory_movements_archive
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_movements_archive_pkey'
  ) THEN
    ALTER TABLE public.inventory_movements_archive ADD PRIMARY KEY (id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'inventory_movements_archive pk: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_inventory_movements_archive_owner_created
  ON public.inventory_movements_archive (owner_id, created_at DESC);

ALTER TABLE public.orders_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orders_archive_owner ON public.orders_archive;
CREATE POLICY orders_archive_owner ON public.orders_archive
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

DROP POLICY IF EXISTS order_items_archive_owner ON public.order_items_archive;
CREATE POLICY order_items_archive_owner ON public.order_items_archive
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

DROP POLICY IF EXISTS inventory_movements_archive_owner ON public.inventory_movements_archive;
CREATE POLICY inventory_movements_archive_owner ON public.inventory_movements_archive
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3) Partition helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._platform_is_partitioned(p_table TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_partitioned_table pt ON pt.partrelid = c.oid
    WHERE n.nspname = 'public' AND c.relname = p_table
  );
$$;

CREATE OR REPLACE FUNCTION public.platform_ensure_monthly_partitions(
  p_parent_table TEXT,
  p_past_months INT DEFAULT 12,
  p_future_months INT DEFAULT 3
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created TEXT[] := ARRAY[]::TEXT[];
  v_month DATE;
  v_start DATE;
  v_end DATE;
  v_part_name TEXT;
  v_from TIMESTAMPTZ;
  v_to TIMESTAMPTZ;
  v_i INT;
BEGIN
  IF NOT public._platform_is_partitioned(p_parent_table) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_partitioned', 'table', p_parent_table);
  END IF;

  v_start := date_trunc('month', CURRENT_DATE - (GREATEST(COALESCE(p_past_months, 12), 1) || ' months')::INTERVAL)::DATE;
  v_end := date_trunc('month', CURRENT_DATE + (GREATEST(COALESCE(p_future_months, 3), 1) || ' months')::INTERVAL)::DATE;
  v_month := v_start;

  WHILE v_month <= v_end LOOP
    v_part_name := format('%s_y%sm%s', p_parent_table, to_char(v_month, 'YYYY'), to_char(v_month, 'MM'));
    v_from := v_month::TIMESTAMPTZ;
    v_to := (v_month + INTERVAL '1 month')::TIMESTAMPTZ;

    IF to_regclass(format('public.%I', v_part_name)) IS NULL THEN
      EXECUTE format(
        'CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES FROM (%L) TO (%L)',
        v_part_name, p_parent_table, v_from, v_to
      );
      v_created := array_append(v_created, v_part_name);
    END IF;

    v_month := (v_month + INTERVAL '1 month')::DATE;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'table', p_parent_table,
    'created_partitions', to_jsonb(v_created),
    'created_count', COALESCE(array_length(v_created, 1), 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_drop_partitions_before(
  p_parent_table TEXT,
  p_before TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
  v_dropped TEXT[] := ARRAY[]::TEXT[];
  v_bound TEXT;
  v_upper TIMESTAMPTZ;
BEGIN
  IF NOT public._platform_is_partitioned(p_parent_table) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_partitioned');
  END IF;

  FOR v_rec IN
    SELECT c.relname AS part_name, pg_get_expr(c.relpartbound, c.oid, true) AS part_bound
    FROM pg_class c
    JOIN pg_inherits i ON i.inhrelid = c.oid
    JOIN pg_class p ON p.oid = i.inhparent
    JOIN pg_namespace n ON n.oid = p.relnamespace
    WHERE n.nspname = 'public'
      AND p.relname = p_parent_table
      AND c.relname <> p_parent_table || '_default'
  LOOP
    v_bound := v_rec.part_bound;
    IF v_bound IS NULL OR v_bound = 'DEFAULT' THEN
      CONTINUE;
    END IF;

    BEGIN
      v_upper := NULL;
      IF v_bound ~ 'TO \(' THEN
        v_upper := substring(v_bound from 'TO \(''([^'']+)''\)')::TIMESTAMPTZ;
      END IF;

      IF v_upper IS NOT NULL AND v_upper <= p_before THEN
        EXECUTE format('DROP TABLE IF EXISTS public.%I', v_rec.part_name);
        v_dropped := array_append(v_dropped, v_rec.part_name);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'table', p_parent_table,
    'dropped_partitions', to_jsonb(v_dropped),
    'dropped_count', COALESCE(array_length(v_dropped, 1), 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_ensure_monthly_partitions(TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_drop_partitions_before(TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_ensure_monthly_partitions(TEXT, INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.platform_drop_partitions_before(TEXT, TIMESTAMPTZ) TO service_role;

-- ---------------------------------------------------------------------------
-- 4) Convert store_visits → monthly RANGE partitions
-- ---------------------------------------------------------------------------
DO $convert_visits$
BEGIN
  IF public._platform_is_partitioned('store_visits') THEN
    RAISE NOTICE 'store_visits already partitioned — skipping conversion';
    RETURN;
  END IF;

  IF NOT public._platform_table_exists('store_visits') THEN
    RETURN;
  END IF;

  ALTER TABLE public.store_visits RENAME TO store_visits__pre_partition;

  CREATE TABLE public.store_visits (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    visitor_ip TEXT,
    user_agent TEXT,
    page_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT store_visits_pkey PRIMARY KEY (created_at, id)
  ) PARTITION BY RANGE (created_at);

  CREATE TABLE public.store_visits_default PARTITION OF public.store_visits DEFAULT;

  PERFORM public.platform_ensure_monthly_partitions('store_visits', 24, 6);

  INSERT INTO public.store_visits
  SELECT id, owner_id, visitor_ip, user_agent, page_path, created_at
  FROM public.store_visits__pre_partition;

  DROP TABLE public.store_visits__pre_partition;

  CREATE INDEX IF NOT EXISTS idx_store_visits_owner_created
    ON public.store_visits (owner_id, created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_store_visits_owner_ip_created
    ON public.store_visits (owner_id, visitor_ip, created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_store_visits_owner_ip_path_created
    ON public.store_visits (owner_id, visitor_ip, page_path, created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_store_visits_created_brin
    ON public.store_visits USING brin (created_at);

  ALTER TABLE public.store_visits ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Store owners can view their store visits" ON public.store_visits;
  CREATE POLICY "Store owners can view their store visits"
    ON public.store_visits FOR SELECT TO authenticated
    USING (owner_id = auth.uid());

  DROP POLICY IF EXISTS "Deny public SELECT access to store_visits" ON public.store_visits;
  CREATE POLICY "Deny public SELECT access to store_visits"
    ON public.store_visits FOR SELECT TO anon USING (false);

  DROP TRIGGER IF EXISTS visits_daily_stats_trg ON public.store_visits;
  CREATE TRIGGER visits_daily_stats_trg
    AFTER INSERT ON public.store_visits
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_visits_daily_stats();

  ALTER TABLE public.store_visits SET (
    autovacuum_vacuum_scale_factor = 0.02,
    autovacuum_analyze_scale_factor = 0.01,
    autovacuum_vacuum_cost_delay = 10
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'store_visits partition conversion skipped/failed: %', SQLERRM;
  IF to_regclass('public.store_visits__pre_partition') IS NOT NULL
     AND to_regclass('public.store_visits') IS NULL THEN
    ALTER TABLE public.store_visits__pre_partition RENAME TO store_visits;
  END IF;
END $convert_visits$;

-- ---------------------------------------------------------------------------
-- 5) Convert inventory_movements → monthly RANGE partitions
-- ---------------------------------------------------------------------------
DO $convert_inv$
BEGIN
  IF public._platform_is_partitioned('inventory_movements') THEN
    RAISE NOTICE 'inventory_movements already partitioned';
    RETURN;
  END IF;

  IF NOT public._platform_table_exists('inventory_movements') THEN
    RETURN;
  END IF;

  ALTER TABLE public.inventory_movements RENAME TO inventory_movements__pre_partition;

  CREATE TABLE public.inventory_movements (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL,
    quantity_delta INT NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT inventory_movements_pkey PRIMARY KEY (created_at, id)
  ) PARTITION BY RANGE (created_at);

  CREATE TABLE public.inventory_movements_default PARTITION OF public.inventory_movements DEFAULT;

  PERFORM public.platform_ensure_monthly_partitions('inventory_movements', 24, 6);

  INSERT INTO public.inventory_movements
  SELECT id, order_id, product_id, owner_id, quantity_delta, reason, created_at
  FROM public.inventory_movements__pre_partition;

  DROP TABLE public.inventory_movements__pre_partition;

  CREATE INDEX IF NOT EXISTS idx_inventory_movements_owner_created
    ON public.inventory_movements (owner_id, created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_created
    ON public.inventory_movements (product_id, created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_inventory_movements_order
    ON public.inventory_movements (order_id)
    WHERE order_id IS NOT NULL;

  ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Owners view inventory movements" ON public.inventory_movements;
  CREATE POLICY "Owners view inventory movements"
    ON public.inventory_movements FOR SELECT TO authenticated
    USING (owner_id = auth.uid());

  ALTER TABLE public.inventory_movements SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.02
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'inventory_movements partition conversion failed: %', SQLERRM;
  IF to_regclass('public.inventory_movements__pre_partition') IS NOT NULL
     AND to_regclass('public.inventory_movements') IS NULL THEN
    ALTER TABLE public.inventory_movements__pre_partition RENAME TO inventory_movements;
  END IF;
END $convert_inv$;

-- ---------------------------------------------------------------------------
-- 6) Convert analytics_event_outbox → monthly RANGE partitions
-- ---------------------------------------------------------------------------
DO $convert_analytics$
BEGIN
  IF public._platform_is_partitioned('analytics_event_outbox') THEN
    RAISE NOTICE 'analytics_event_outbox already partitioned';
    RETURN;
  END IF;

  IF NOT public._platform_table_exists('analytics_event_outbox') THEN
    RETURN;
  END IF;

  ALTER TABLE public.analytics_event_outbox RENAME TO analytics_event_outbox__pre_partition;

  CREATE TABLE public.analytics_event_outbox (
    id BIGSERIAL,
    owner_id UUID NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('store_visit', 'product_view')),
    payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    CONSTRAINT analytics_event_outbox_pkey PRIMARY KEY (created_at, id)
  ) PARTITION BY RANGE (created_at);

  CREATE TABLE public.analytics_event_outbox_default PARTITION OF public.analytics_event_outbox DEFAULT;

  PERFORM public.platform_ensure_monthly_partitions('analytics_event_outbox', 6, 3);

  INSERT INTO public.analytics_event_outbox (id, owner_id, event_type, payload, created_at, processed_at)
  SELECT id, owner_id, event_type, payload, created_at, processed_at
  FROM public.analytics_event_outbox__pre_partition;

  PERFORM setval(
    pg_get_serial_sequence('public.analytics_event_outbox', 'id'),
    COALESCE((SELECT MAX(id) FROM public.analytics_event_outbox), 1)
  );

  DROP TABLE public.analytics_event_outbox__pre_partition;

  CREATE INDEX IF NOT EXISTS idx_analytics_event_outbox_pending
    ON public.analytics_event_outbox (created_at)
    WHERE processed_at IS NULL;

  ALTER TABLE public.analytics_event_outbox ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Store owners can view their analytics events" ON public.analytics_event_outbox;
  CREATE POLICY "Store owners can view their analytics events"
    ON public.analytics_event_outbox FOR SELECT TO authenticated
    USING (owner_id = auth.uid());

  ALTER TABLE public.analytics_event_outbox SET (
    autovacuum_vacuum_scale_factor = 0.02,
    autovacuum_analyze_scale_factor = 0.01,
    autovacuum_vacuum_cost_delay = 5,
    autovacuum_vacuum_cost_limit = 2000
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'analytics_event_outbox partition conversion failed: %', SQLERRM;
  IF to_regclass('public.analytics_event_outbox__pre_partition') IS NOT NULL
     AND to_regclass('public.analytics_event_outbox') IS NULL THEN
    ALTER TABLE public.analytics_event_outbox__pre_partition RENAME TO analytics_event_outbox;
  END IF;
END $convert_analytics$;

-- ---------------------------------------------------------------------------
-- 7) Enhanced prune — partition-aware store_visits + new purge functions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prune_store_visits(p_retention_days INT DEFAULT 90)
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
  IF public._platform_is_partitioned('store_visits') THEN
    v_drop := public.platform_drop_partitions_before('store_visits', v_cutoff);
    v_deleted := COALESCE((v_drop->>'dropped_count')::BIGINT, 0);
    DELETE FROM public.store_visits WHERE created_at < v_cutoff;
    GET DIAGNOSTICS v_extra = ROW_COUNT;
    RETURN v_deleted + v_extra;
  END IF;

  DELETE FROM public.store_visits WHERE created_at < v_cutoff;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

CREATE OR REPLACE FUNCTION public.prune_order_webhook_outbox(p_keep_days INT DEFAULT 30)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INT;
  v_days INT := GREATEST(COALESCE(p_keep_days, 30), 7);
BEGIN
  DELETE FROM public.order_webhook_outbox
  WHERE status IN ('delivered', 'failed')
    AND COALESCE(processed_at, created_at) < NOW() - (v_days || ' days')::INTERVAL;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

CREATE OR REPLACE FUNCTION public.prune_order_side_effects_outbox(p_keep_days INT DEFAULT 7)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INT;
  v_days INT := GREATEST(COALESCE(p_keep_days, 7), 1);
BEGIN
  DELETE FROM public.order_side_effects_outbox
  WHERE processed_at IS NOT NULL
    AND processed_at < NOW() - (v_days || ' days')::INTERVAL;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

CREATE OR REPLACE FUNCTION public.prune_import_jobs(p_keep_days INT DEFAULT 30)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INT;
  v_days INT := GREATEST(COALESCE(p_keep_days, 30), 7);
BEGIN
  DELETE FROM public.import_jobs
  WHERE status IN ('completed', 'failed', 'cancelled')
    AND COALESCE(completed_at, created_at) < NOW() - (v_days || ' days')::INTERVAL;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_order_webhook_outbox(INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prune_order_side_effects_outbox(INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prune_import_jobs(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_order_webhook_outbox(INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.prune_order_side_effects_outbox(INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.prune_import_jobs(INT) TO service_role;

-- ---------------------------------------------------------------------------
-- 8) Archive batches
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.archive_inventory_movements_batch(
  p_older_than_days INT DEFAULT 730,
  p_batch_size INT DEFAULT 1000
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ;
  v_batch INT := GREATEST(1, LEAST(COALESCE(p_batch_size, 1000), 5000));
  v_ids UUID[];
  v_archived INT := 0;
BEGIN
  v_cutoff := NOW() - (GREATEST(COALESCE(p_older_than_days, 730), 90) || ' days')::INTERVAL;

  SELECT COALESCE(array_agg(id ORDER BY created_at), ARRAY[]::UUID[])
  INTO v_ids
  FROM (
    SELECT id, created_at
    FROM public.inventory_movements
    WHERE created_at < v_cutoff
    ORDER BY created_at
    LIMIT v_batch
  ) s;

  IF COALESCE(array_length(v_ids, 1), 0) = 0 THEN
    RETURN jsonb_build_object('success', true, 'archived', 0);
  END IF;

  INSERT INTO public.inventory_movements_archive (
    id, order_id, product_id, owner_id, quantity_delta, reason, created_at, archived_at
  )
  SELECT id, order_id, product_id, owner_id, quantity_delta, reason, created_at, NOW()
  FROM public.inventory_movements
  WHERE id = ANY (v_ids)
  ON CONFLICT (id) DO NOTHING;

  DELETE FROM public.inventory_movements WHERE id = ANY (v_ids);

  GET DIAGNOSTICS v_archived = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'archived', v_archived, 'cutoff', v_cutoff);
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_orders_batch(
  p_older_than_days INT DEFAULT 548,
  p_batch_size INT DEFAULT 200
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ;
  v_batch INT := GREATEST(1, LEAST(COALESCE(p_batch_size, 200), 500));
  v_order_ids UUID[];
  v_archived INT := 0;
  v_terminal TEXT[] := ARRAY['completed', 'cancelled', 'delivered', 'refunded'];
BEGIN
  v_cutoff := NOW() - (GREATEST(COALESCE(p_older_than_days, 548), 180) || ' days')::INTERVAL;

  SELECT COALESCE(array_agg(id ORDER BY created_at), ARRAY[]::UUID[])
  INTO v_order_ids
  FROM (
    SELECT o.id, o.created_at
    FROM public.orders o
    WHERE o.created_at < v_cutoff
      AND o.status = ANY (v_terminal)
      AND NOT EXISTS (
        SELECT 1 FROM public.order_webhook_outbox w
        WHERE w.order_id = o.id AND w.status IN ('pending', 'processing')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.order_side_effects_outbox s
        WHERE s.order_id = o.id AND s.processed_at IS NULL
      )
    ORDER BY o.created_at
    LIMIT v_batch
  ) s;

  IF COALESCE(array_length(v_order_ids, 1), 0) = 0 THEN
    RETURN jsonb_build_object('success', true, 'archived', 0, 'cutoff', v_cutoff);
  END IF;

  INSERT INTO public.orders_archive
  SELECT o.*, NOW()
  FROM public.orders o
  WHERE o.id = ANY (v_order_ids)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.order_items_archive
  SELECT oi.*, NOW()
  FROM public.order_items oi
  WHERE oi.order_id = ANY (v_order_ids)
  ON CONFLICT (id) DO NOTHING;

  DELETE FROM public.orders WHERE id = ANY (v_order_ids);

  GET DIAGNOSTICS v_archived = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'archived', v_archived, 'cutoff', v_cutoff);
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_orders_from_archive(p_order_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restored INT := 0;
  v_cols TEXT;
BEGIN
  IF p_order_ids IS NULL OR COALESCE(array_length(p_order_ids, 1), 0) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_ids');
  END IF;

  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
  INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'orders';

  EXECUTE format(
    'INSERT INTO public.orders (%s) SELECT %s FROM public.orders_archive WHERE id = ANY($1) ON CONFLICT (id) DO NOTHING',
    v_cols, v_cols
  ) USING p_order_ids;

  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
  INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'order_items';

  EXECUTE format(
    'INSERT INTO public.order_items (%s) SELECT %s FROM public.order_items_archive WHERE order_id = ANY($1) ON CONFLICT (id) DO NOTHING',
    v_cols, v_cols
  ) USING p_order_ids;

  GET DIAGNOSTICS v_restored = ROW_COUNT;

  DELETE FROM public.order_items_archive WHERE order_id = ANY (p_order_ids);
  DELETE FROM public.orders_archive WHERE id = ANY (p_order_ids);

  RETURN jsonb_build_object('success', true, 'restored_items', v_restored);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', LEFT(SQLERRM, 200));
END;
$$;

REVOKE ALL ON FUNCTION public.archive_inventory_movements_batch(INT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.archive_orders_batch(INT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restore_orders_from_archive(UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_inventory_movements_batch(INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.archive_orders_batch(INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.restore_orders_from_archive(UUID[]) TO service_role;

-- ---------------------------------------------------------------------------
-- 9) Partition pruning verification
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_verify_partition_pruning(
  p_table TEXT DEFAULT 'store_visits',
  p_days INT DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start TIMESTAMPTZ := date_trunc('day', NOW() - (GREATEST(COALESCE(p_days, 30), 1) || ' days')::INTERVAL);
  v_end TIMESTAMPTZ := NOW();
  v_plan JSONB;
  v_plan_text TEXT;
  v_pruning BOOLEAN := false;
BEGIN
  IF NOT public._platform_is_partitioned(p_table) THEN
    RETURN jsonb_build_object(
      'success', false,
      'table', p_table,
      'partitioned', false,
      'partition_pruning', false
    );
  END IF;

  EXECUTE format(
    'EXPLAIN (FORMAT JSON) SELECT COUNT(*) FROM public.%I WHERE created_at >= %L AND created_at < %L',
    p_table, v_start, v_end
  ) INTO v_plan;

  v_plan_text := v_plan::TEXT;
  v_pruning := v_plan_text ILIKE '%Partition Prune%' OR v_plan_text ILIKE '%Subplans Removed%';

  RETURN jsonb_build_object(
    'success', true,
    'table', p_table,
    'partitioned', true,
    'partition_pruning', v_pruning,
    'window_start', v_start,
    'window_end', v_end,
    'plan', v_plan
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_verify_partition_pruning(TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_verify_partition_pruning(TEXT, INT) TO service_role;

-- ---------------------------------------------------------------------------
-- 10) Lifecycle orchestrator + audit
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
    'prune_analytics_outbox', public.prune_analytics_event_outbox(7),
    'prune_rate_limits', public.prune_rpc_rate_limits(7200),
    'prune_webhook_outbox', public.prune_order_webhook_outbox(30),
    'prune_side_effects_outbox', public.prune_order_side_effects_outbox(7),
    'prune_import_jobs', public.prune_import_jobs(30),
    'archive_orders', public.archive_orders_batch(548, 200),
    'archive_inventory', public.archive_inventory_movements_batch(730, 1000)
  );

  IF public._platform_fn_exists('platform_run_internals_maintenance') THEN
    v_result := v_result || jsonb_build_object(
      'internals_maintenance', public.platform_run_internals_maintenance(true, false, false)
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'ran_at', NOW()) || v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_data_lifecycle_audit()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'audited_at', NOW(),
    'schema_version', (SELECT max(version) FROM public.platform_schema_version),
    'policies', (SELECT COALESCE(jsonb_agg(row_to_json(p)), '[]'::jsonb) FROM public.platform_data_lifecycle_policies p),
    'table_sizes', (
      SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.total_bytes DESC), '[]'::jsonb)
      FROM (
        SELECT
          c.relname AS table_name,
          pg_total_relation_size(c.oid) AS total_bytes,
          pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
          pg_size_pretty(pg_relation_size(c.oid)) AS heap_size,
          public._platform_is_partitioned(c.relname) AS is_partitioned,
          COALESCE(st.n_live_tup, 0)::BIGINT AS live_rows,
          COALESCE(st.n_dead_tup, 0)::BIGINT AS dead_rows
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_stat_user_tables st ON st.relid = c.oid
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'p')
          AND c.relname = ANY (ARRAY[
            'orders', 'order_items', 'store_visits', 'inventory_movements',
            'analytics_event_outbox', 'order_webhook_outbox', 'order_side_effects_outbox',
            'payment_transactions', 'store_daily_stats', 'import_jobs', 'rpc_rate_limits',
            'orders_archive', 'order_items_archive', 'inventory_movements_archive'
          ])
        ORDER BY pg_total_relation_size(c.oid) DESC
      ) t
    ),
    'partitions', (
      SELECT COALESCE(jsonb_agg(row_to_json(p)), '[]'::jsonb)
      FROM (
        SELECT
          parent.relname AS parent_table,
          child.relname AS partition_name,
          pg_size_pretty(pg_total_relation_size(child.oid)) AS partition_size
        FROM pg_inherits i
        JOIN pg_class parent ON parent.oid = i.inhparent
        JOIN pg_class child ON child.oid = i.inhrelid
        JOIN pg_namespace n ON n.oid = parent.relnamespace
        WHERE n.nspname = 'public'
        ORDER BY parent.relname, child.relname
      ) p
    ),
    'growth_risk_ranking', (
      SELECT COALESCE(jsonb_agg(row_to_json(g) ORDER BY g.risk_score DESC), '[]'::jsonb)
      FROM (
        SELECT
          lp.table_name,
          lp.data_tier,
          lp.partition_strategy,
          lp.hot_retention_days,
          CASE lp.table_name
            WHEN 'store_visits' THEN 95
            WHEN 'analytics_event_outbox' THEN 90
            WHEN 'inventory_movements' THEN 85
            WHEN 'orders' THEN 80
            WHEN 'order_items' THEN 78
            WHEN 'order_webhook_outbox' THEN 70
            ELSE 50
          END AS risk_score,
          CASE lp.table_name
            WHEN 'store_visits' THEN '500M+ visits/year at scale'
            WHEN 'orders' THEN '100M+ orders — archive after 18mo'
            WHEN 'inventory_movements' THEN '100M+ ledger rows — partition + archive'
            WHEN 'analytics_event_outbox' THEN '500M+ events — partition + 7d purge'
            ELSE lp.notes
          END AS projection
        FROM public.platform_data_lifecycle_policies lp
      ) g
    ),
    'partition_pruning', public.platform_verify_partition_pruning('store_visits', 30),
    'archive_counts', jsonb_build_object(
      'orders_archive', (SELECT COUNT(*)::INT FROM public.orders_archive),
      'order_items_archive', (SELECT COUNT(*)::INT FROM public.order_items_archive),
      'inventory_movements_archive', (SELECT COUNT(*)::INT FROM public.inventory_movements_archive)
    ),
    'healthy', true
  ) INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_lifecycle_audit()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full JSONB;
BEGIN
  v_full := public.platform_data_lifecycle_audit();
  RETURN jsonb_build_object(
    'success', true,
    'schema_version', v_full->'schema_version',
    'partitioned_tables', (
      SELECT COUNT(*)::INT
      FROM jsonb_array_elements(COALESCE(v_full->'table_sizes', '[]'::jsonb)) elem
      WHERE (elem->>'is_partitioned')::boolean = true
    ),
    'partition_count', jsonb_array_length(COALESCE(v_full->'partitions', '[]'::jsonb)),
    'partition_pruning', v_full->'partition_pruning'->'partition_pruning',
    'archive_orders', v_full->'archive_counts'->'orders_archive',
    'healthy', v_full->'healthy',
    'full_report', v_full
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_run_data_lifecycle() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_data_lifecycle_audit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_lifecycle_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_run_data_lifecycle() TO service_role;
GRANT EXECUTE ON FUNCTION public.platform_data_lifecycle_audit() TO service_role;
GRANT EXECUTE ON FUNCTION public.platform_lifecycle_audit() TO service_role;

-- ---------------------------------------------------------------------------
-- 11) pg_cron — automated lifecycle
-- ---------------------------------------------------------------------------
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname IN ('platform-data-lifecycle', 'platform-ensure-partitions');

    PERFORM cron.schedule(
      'platform-ensure-partitions',
      '0 2 1 * *',
      $job$SELECT public.platform_ensure_monthly_partitions('store_visits', 3, 6);
SELECT public.platform_ensure_monthly_partitions('inventory_movements', 3, 6);
SELECT public.platform_ensure_monthly_partitions('analytics_event_outbox', 3, 3);$job$
    );

    PERFORM cron.schedule(
      'platform-data-lifecycle',
      '30 4 * * *',
      $job$SELECT public.platform_run_data_lifecycle()$job$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron lifecycle schedule skipped: %', SQLERRM;
END $cron$;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (
  70,
  'partitioning_lifecycle: monthly RANGE partitions, archive tables, automated purge/archive'
)
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
