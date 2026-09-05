-- Index performance audit — justified adds/drops from production EXPLAIN + pg_stat_user_indexes.
-- Adds: tenant-scoped movement lookup + owner-scoped analytics flush (20260906000004).
-- Drops: redundant order_items prefix superseded by covering index.
-- Does NOT deploy deferred phase 3.4/3.5 rollup refactors.

-- ---------------------------------------------------------------------------
-- 1) inventory_movements — product history under tenant (partition v71 gap)
--    Query: fetchProductMovements(product_id, owner_id ORDER BY created_at DESC)
--    Before: idx_inventory_movements_product_created + heap filter on owner_id
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_inventory_movements_owner_product_created
  ON public.inventory_movements (owner_id, product_id, created_at DESC);

COMMENT ON INDEX public.idx_inventory_movements_owner_product_created IS
  'Product movement history — tenant-first (owner_id, product_id, created_at DESC)';

-- ---------------------------------------------------------------------------
-- 2) analytics_event_outbox — owner-scoped flush (flush_merchant_analytics_buffer)
--    Query: owner_id = auth.uid() AND processed_at IS NULL ORDER BY created_at
--    Global idx_analytics_event_outbox_pending lacks owner_id leading column.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_analytics_event_outbox_owner_pending
  ON public.analytics_event_outbox (owner_id, created_at)
  WHERE processed_at IS NULL;

COMMENT ON INDEX public.idx_analytics_event_outbox_owner_pending IS
  'Merchant analytics flush — owner-scoped pending batch claim';

-- ---------------------------------------------------------------------------
-- 3) orders — workflow tab filter + sort (partial indexes miss non-pending/completed)
--    Query: list_merchant_orders / merchant_orders_base_filter status tab + created_at DESC
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_owner_status_created
  ON public.orders (owner_id, status, created_at DESC, id DESC);

COMMENT ON INDEX public.idx_orders_owner_status_created IS
  'Order list workflow tabs — status filter with created_at sort';

-- ---------------------------------------------------------------------------
-- 4) Drop redundant indexes (strict prefix superseded; zero/low scan audit)
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_order_items_owner_created;
-- Superseded by idx_order_items_owner_created_covering (same owner_id, created_at DESC prefix + INCLUDE)

DROP INDEX IF EXISTS public.idx_products_owner_active_created_id;
-- Superseded by idx_products_owner_storefront_created for active listings (1M+ idx_scan);
-- non-active merchant paths use idx_products_owner_merchant_created / idx_products_owner_lifecycle

-- ---------------------------------------------------------------------------
-- 5) Extend inner-path EXPLAIN audit for post-migration validation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_index_explain_hot_paths(
  p_owner_id uuid DEFAULT NULL,
  p_slug text DEFAULT NULL,
  p_warm_cache boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_slug text;
  v_product uuid;
  v_ip text := '127.0.0.1';
  v_path text := '/';
  v_prev_week timestamptz;
  v_results jsonb := '[]'::jsonb;
  v_plan jsonb;
  v_exec_ms numeric;
  v_plan_ms numeric;
  rec record;
  v_allowed boolean;
BEGIN
  v_allowed :=
    current_setting('request.jwt.claim.role', true) = 'service_role'
    OR current_user IN ('postgres', 'supabase_admin', 'authenticator');

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'service_role or postgres only';
  END IF;

  SELECT ss.owner_id, ss.store_slug
  INTO v_owner, v_slug
  FROM public.store_settings ss
  WHERE ss.store_slug IS NOT NULL
  ORDER BY ss.updated_at DESC NULLS LAST
  LIMIT 1;

  v_owner := COALESCE(p_owner_id, v_owner);
  v_slug := COALESCE(NULLIF(trim(p_slug), ''), v_slug);
  v_prev_week := date_trunc('week', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' - INTERVAL '7 days';

  SELECT p.id INTO v_product
  FROM public.products p
  WHERE p.owner_id = v_owner
  ORDER BY p.created_at DESC
  LIMIT 1;

  IF p_warm_cache THEN
    BEGIN
      PERFORM pg_prewarm('products');
      PERFORM pg_prewarm('orders');
      PERFORM pg_prewarm('order_items');
      PERFORM pg_prewarm('inventory_movements');
      PERFORM pg_prewarm('analytics_event_outbox');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('error', 'no_owner', 'benchmark_at', now());
  END IF;

  FOR rec IN
    SELECT * FROM (VALUES
      ('products_catalog_kpi_scan', format(
        $q$EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
         SELECT COUNT(*) FILTER (WHERE archived_at IS NULL),
                COUNT(*) FILTER (WHERE is_active = true AND archived_at IS NULL),
                COUNT(*) FILTER (WHERE is_active = true AND archived_at IS NULL
                  AND COALESCE(stock_quantity, 0) <= COALESCE(min_stock_level, 5))
         FROM public.products WHERE owner_id = %L::uuid$q$,
        v_owner
      )),
      ('inventory_movements_product_history', format(
        $q$EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
         SELECT id, quantity_delta, reason, created_at
         FROM public.inventory_movements
         WHERE owner_id = %L::uuid AND product_id = %L::uuid
         ORDER BY created_at DESC
         LIMIT 20$q$,
        v_owner, COALESCE(v_product, v_owner)
      )),
      ('inventory_movements_owner_timeline', format(
        $q$EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
         SELECT id, quantity_delta, reason, created_at
         FROM public.inventory_movements
         WHERE owner_id = %L::uuid
           AND created_at >= NOW() - INTERVAL '30 days'
         ORDER BY created_at DESC
         LIMIT 100$q$,
        v_owner
      )),
      ('analytics_owner_pending_flush', format(
        $q$EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
         SELECT id
         FROM public.analytics_event_outbox
         WHERE owner_id = %L::uuid
           AND processed_at IS NULL
         ORDER BY created_at
         LIMIT 200$q$,
        v_owner
      )),
      ('orders_list_by_owner', format(
        $q$EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
         SELECT id, created_at, status
         FROM public.orders
         WHERE owner_id = %L::uuid
         ORDER BY created_at DESC, id DESC
         LIMIT 50$q$,
        v_owner
      )),
      ('orders_workflow_pending_tab', format(
        $q$EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
         SELECT id, created_at
         FROM public.orders
         WHERE owner_id = %L::uuid AND status = 'pending'
         ORDER BY created_at DESC, id DESC
         LIMIT 50$q$,
        v_owner
      )),
      ('order_items_statistics_range', format(
        $q$EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
         SELECT oi.order_id, oi.product_id, oi.quantity, oi.subtotal
         FROM public.order_items oi
         WHERE oi.owner_id = %L::uuid
           AND oi.created_at >= %L::timestamptz
           AND oi.created_at <= NOW()
         ORDER BY oi.created_at DESC
         LIMIT 5000$q$,
        v_owner, v_prev_week
      )),
      ('inventory_reserved_units', format(
        $q$EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
         SELECT COALESCE(SUM(oi.quantity), 0)
         FROM public.order_items oi
         JOIN public.orders o ON o.id = oi.order_id
         WHERE o.owner_id = %L::uuid
           AND o.status NOT IN ('cancelled', 'completed', 'refunded')$q$,
        v_owner
      )),
      ('dashboard_orders_refunds_join', format(
        $q$EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
         SELECT COUNT(*)::int,
                COALESCE(SUM(r.amount), 0)
         FROM public.orders o
         LEFT JOIN public.order_refunds r
           ON r.order_id = o.id AND r.owner_id = %L::uuid AND r.status = 'completed'
         WHERE o.owner_id = %L::uuid
           AND o.created_at >= %L::timestamptz$q$,
        v_owner, v_owner, v_prev_week
      )),
      ('storefront_listing_ids', format(
        $q$EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
         SELECT p.id, p.created_at
         FROM public.products p
         WHERE p.owner_id = (SELECT ss.owner_id FROM public.store_settings ss WHERE ss.store_slug = %L LIMIT 1)
           AND p.archived_at IS NULL
           AND COALESCE(p.is_active, true) = true
         ORDER BY p.created_at DESC, p.id DESC
         LIMIT 25$q$,
        v_slug
      )),
      ('visit_dedupe_store_visits', format(
        $q$EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
         SELECT 1 FROM public.store_visits sv
         WHERE sv.owner_id = %L::uuid
           AND sv.visitor_ip = %L
           AND sv.page_path = %L
           AND sv.created_at > NOW() - INTERVAL '30 minutes'
         LIMIT 1$q$,
        v_owner, v_ip, v_path
      )),
      ('visit_dedupe_outbox', format(
        $q$EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
         SELECT 1 FROM public.analytics_event_outbox o
         WHERE o.owner_id = %L::uuid
           AND o.event_type = 'store_visit'
           AND o.payload->>'visitor_ip' = %L
           AND o.payload->>'page_path' = %L
           AND o.created_at > NOW() - INTERVAL '30 minutes'
           AND o.processed_at IS NULL
         LIMIT 1$q$,
        v_owner, v_ip, v_path
      )),
      ('side_effects_outbox_pending', $q$EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
         SELECT id, order_id, created_at
         FROM public.order_side_effects_outbox
         WHERE processed_at IS NULL AND dead_letter_at IS NULL
         ORDER BY created_at
         LIMIT 50$q$),
      ('webhook_outbox_retry_claim', $q$EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
         SELECT id, order_id, status, next_attempt_at
         FROM public.order_webhook_outbox
         WHERE status IN ('pending', 'failed')
           AND next_attempt_at <= NOW()
         ORDER BY created_at
         LIMIT 50$q$)
    ) AS t(name, sql_text)
  LOOP
    BEGIN
      EXECUTE rec.sql_text INTO v_plan;
      v_exec_ms := (v_plan->0->>'Execution Time')::numeric;
      v_plan_ms := (v_plan->0->>'Planning Time')::numeric;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'name', rec.name,
        'plan', v_plan,
        'execution_ms', v_exec_ms,
        'planning_ms', v_plan_ms
      ));
    EXCEPTION WHEN OTHERS THEN
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'name', rec.name,
        'error', SQLERRM
      ));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'benchmark_at', now(),
    'phase', 'index-performance-audit',
    'owner_id', v_owner,
    'slug', v_slug,
    'product_id', v_product,
    'query_count', jsonb_array_length(v_results),
    'queries', v_results
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_index_explain_hot_paths(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_index_explain_hot_paths(uuid, text, boolean) TO service_role;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (110, 'index audit: movement lookup, analytics owner flush, order status tab; drop redundant order_items index')
ON CONFLICT (version) DO UPDATE SET notes = EXCLUDED.notes, applied_at = NOW();

INSERT INTO public.platform_rpc_registry (rpc_name, arg_signature, domain, status, canonical_migration, notes)
VALUES (
  'platform_index_explain_hot_paths',
  'p_owner_id uuid, p_slug text, p_warm_cache boolean',
  'monitoring',
  'active',
  '20260906000005',
  'Inner SQL EXPLAIN ANALYZE for index validation — service_role only'
)
ON CONFLICT (rpc_name, arg_signature) DO UPDATE SET
  notes = EXCLUDED.notes,
  updated_at = NOW();
