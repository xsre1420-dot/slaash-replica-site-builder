-- v71: Fix partition conversion — rename legacy PK constraints before creating partitioned parents

CREATE OR REPLACE FUNCTION public._platform_rename_table_constraints(
  p_table TEXT,
  p_suffix TEXT DEFAULT '__legacy'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = format('public.%I', p_table)::regclass
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I RENAME CONSTRAINT %I TO %I',
      p_table,
      v_rec.conname,
      v_rec.conname || p_suffix
    );
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'constraint rename skipped for %: %', p_table, SQLERRM;
END;
$$;

-- ---------------------------------------------------------------------------
-- store_visits
-- ---------------------------------------------------------------------------
DO $v71_visits$
BEGIN
  IF public._platform_is_partitioned('store_visits') THEN
    RETURN;
  END IF;

  IF NOT public._platform_table_exists('store_visits') THEN
    RETURN;
  END IF;

  ALTER TABLE public.store_visits RENAME TO store_visits__pre_partition;
  PERFORM public._platform_rename_table_constraints('store_visits__pre_partition');

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
    ON public.store_visits FOR SELECT TO authenticated USING (owner_id = auth.uid());
  DROP POLICY IF EXISTS "Deny public SELECT access to store_visits" ON public.store_visits;
  CREATE POLICY "Deny public SELECT access to store_visits"
    ON public.store_visits FOR SELECT TO anon USING (false);

  DROP TRIGGER IF EXISTS visits_daily_stats_trg ON public.store_visits;
  CREATE TRIGGER visits_daily_stats_trg
    AFTER INSERT ON public.store_visits
    FOR EACH ROW EXECUTE FUNCTION public.trg_visits_daily_stats();
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'v71 store_visits conversion: %', SQLERRM;
  IF to_regclass('public.store_visits__pre_partition') IS NOT NULL
     AND to_regclass('public.store_visits') IS NULL THEN
    ALTER TABLE public.store_visits__pre_partition RENAME TO store_visits;
  END IF;
END $v71_visits$;

-- ---------------------------------------------------------------------------
-- inventory_movements
-- ---------------------------------------------------------------------------
DO $v71_inv$
BEGIN
  IF public._platform_is_partitioned('inventory_movements') THEN
    RETURN;
  END IF;

  IF NOT public._platform_table_exists('inventory_movements') THEN
    RETURN;
  END IF;

  ALTER TABLE public.inventory_movements RENAME TO inventory_movements__pre_partition;
  PERFORM public._platform_rename_table_constraints('inventory_movements__pre_partition');

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
    ON public.inventory_movements (order_id) WHERE order_id IS NOT NULL;

  ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Owners view inventory movements" ON public.inventory_movements;
  CREATE POLICY "Owners view inventory movements"
    ON public.inventory_movements FOR SELECT TO authenticated USING (owner_id = auth.uid());
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'v71 inventory_movements conversion: %', SQLERRM;
  IF to_regclass('public.inventory_movements__pre_partition') IS NOT NULL
     AND to_regclass('public.inventory_movements') IS NULL THEN
    ALTER TABLE public.inventory_movements__pre_partition RENAME TO inventory_movements;
  END IF;
END $v71_inv$;

-- ---------------------------------------------------------------------------
-- analytics_event_outbox
-- ---------------------------------------------------------------------------
DO $v71_analytics$
BEGIN
  IF public._platform_is_partitioned('analytics_event_outbox') THEN
    RETURN;
  END IF;

  IF NOT public._platform_table_exists('analytics_event_outbox') THEN
    RETURN;
  END IF;

  ALTER TABLE public.analytics_event_outbox RENAME TO analytics_event_outbox__pre_partition;
  PERFORM public._platform_rename_table_constraints('analytics_event_outbox__pre_partition');

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
    GREATEST(COALESCE((SELECT MAX(id) FROM public.analytics_event_outbox), 1), 1)
  );

  DROP TABLE public.analytics_event_outbox__pre_partition;

  CREATE INDEX IF NOT EXISTS idx_analytics_event_outbox_pending
    ON public.analytics_event_outbox (created_at) WHERE processed_at IS NULL;

  ALTER TABLE public.analytics_event_outbox ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Store owners can view their analytics events" ON public.analytics_event_outbox;
  CREATE POLICY "Store owners can view their analytics events"
    ON public.analytics_event_outbox FOR SELECT TO authenticated USING (owner_id = auth.uid());
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'v71 analytics_event_outbox conversion: %', SQLERRM;
  IF to_regclass('public.analytics_event_outbox__pre_partition') IS NOT NULL
     AND to_regclass('public.analytics_event_outbox') IS NULL THEN
    ALTER TABLE public.analytics_event_outbox__pre_partition RENAME TO analytics_event_outbox;
  END IF;
END $v71_analytics$;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (71, 'partitioning_fix: rename legacy constraints before RANGE partition conversion')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
