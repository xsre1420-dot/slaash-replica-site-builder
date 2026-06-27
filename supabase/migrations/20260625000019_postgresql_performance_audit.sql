-- v29: PostgreSQL performance audit — indexes, redundant cleanup, RPC join order

-- ---------------------------------------------------------------------------
-- 1) Fix stale products category index (v7 IF NOT EXISTS blocked v23 upgrade)
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_products_owner_category_created;
CREATE INDEX idx_products_owner_category_created
  ON public.products (owner_id, category, created_at DESC, id DESC)
  WHERE archived_at IS NULL AND COALESCE(is_active, true) = true;

COMMENT ON INDEX public.idx_products_owner_category_created IS
  'Storefront category filter + keyset pagination (get_store_products_page)';

-- ---------------------------------------------------------------------------
-- 2) Analytics / statistics paths
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_order_items_owner_created
  ON public.order_items (owner_id, created_at DESC);

COMMENT ON INDEX public.idx_order_items_owner_created IS
  'Statistics fallback + order_items time-range scans by owner';

CREATE INDEX IF NOT EXISTS idx_orders_owner_completed_created
  ON public.orders (owner_id, created_at DESC)
  WHERE status = 'completed';

COMMENT ON INDEX public.idx_orders_owner_completed_created IS
  'get_order_items_for_statistics + completed revenue aggregates';

CREATE INDEX IF NOT EXISTS idx_orders_owner_pending_created
  ON public.orders (owner_id, created_at DESC)
  WHERE status = 'pending';

COMMENT ON INDEX public.idx_orders_owner_pending_created IS
  'get_store_statistics pending_count in date range';

CREATE INDEX IF NOT EXISTS idx_products_owner_active_catalog
  ON public.products (owner_id)
  WHERE archived_at IS NULL AND COALESCE(is_active, true) = true;

COMMENT ON INDEX public.idx_products_owner_active_catalog IS
  'product_count KPI in get_store_statistics';

CREATE INDEX IF NOT EXISTS idx_products_owner_stock_monitor
  ON public.products (owner_id, stock_quantity)
  WHERE archived_at IS NULL
    AND COALESCE(is_active, true) = true
    AND stock_quantity IS NOT NULL;

COMMENT ON INDEX public.idx_products_owner_stock_monitor IS
  'low_stock_count KPI — index scan + min_stock_level filter';

CREATE INDEX IF NOT EXISTS idx_products_owner_merchant_created
  ON public.products (owner_id, created_at DESC, id DESC);

COMMENT ON INDEX public.idx_products_owner_merchant_created IS
  'get_owner_products_page — all lifecycle states, keyset-friendly';

-- ---------------------------------------------------------------------------
-- 3) Drop redundant indexes (UNIQUE/PK/composite supersession)
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_store_settings_owner;
DROP INDEX IF EXISTS public.idx_stores_user_id;
DROP INDEX IF EXISTS public.idx_store_daily_stats_owner_date;
DROP INDEX IF EXISTS public.idx_store_visits_owner_id;
DROP INDEX IF EXISTS public.idx_store_visits_created_at;
DROP INDEX IF EXISTS public.idx_categories_owner_id;
DROP INDEX IF EXISTS public.idx_products_category;
DROP INDEX IF EXISTS public.idx_products_is_active;
DROP INDEX IF EXISTS public.idx_products_active;
DROP INDEX IF EXISTS public.idx_products_owner_active;

-- ---------------------------------------------------------------------------
-- 4) Integrity: store_settings.owner_id → auth.users (skip if orphans exist)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'store_settings_owner_id_fkey'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.store_settings ss
      LEFT JOIN auth.users u ON u.id = ss.owner_id
      WHERE ss.owner_id IS NOT NULL AND u.id IS NULL
      LIMIT 1
    ) THEN
      ALTER TABLE public.store_settings
        ADD CONSTRAINT store_settings_owner_id_fkey
        FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    ELSE
      RAISE NOTICE 'store_settings_owner_id_fkey skipped: orphan owner_id rows exist';
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5) RPC: statistics order_items — drive from completed orders index
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_order_items_for_statistics(
  p_owner_id UUID,
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_limit INT DEFAULT 5000
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT;
  v_items JSONB;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN '[]'::jsonb;
  END IF;

  IF p_start IS NULL OR p_end IS NULL OR p_end < p_start THEN
    RETURN '[]'::jsonb;
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 5000), 1), 10000);

  SELECT COALESCE(jsonb_agg(row_to_json(sub)), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT
      oi.order_id,
      oi.product_id,
      oi.product_name,
      oi.quantity,
      oi.subtotal,
      oi.created_at
    FROM public.orders o
    INNER JOIN public.order_items oi ON oi.order_id = o.id
    WHERE o.owner_id = p_owner_id
      AND o.status = 'completed'
      AND o.created_at >= p_start
      AND o.created_at <= p_end
    ORDER BY oi.created_at DESC
    LIMIT v_limit
  ) sub;

  RETURN COALESCE(v_items, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_order_items_for_statistics(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_items_for_statistics(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6) Refresh planner statistics on hot tables
-- ---------------------------------------------------------------------------
ANALYZE public.products;
ANALYZE public.orders;
ANALYZE public.order_items;
ANALYZE public.inventory_movements;
ANALYZE public.customers;
ANALYZE public.store_settings;
ANALYZE public.stores;
ANALYZE public.store_visits;
ANALYZE public.store_daily_stats;
ANALYZE public.categories;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (29, 'perf_audit: index fixes, redundant drops, statistics RPC join order, ANALYZE')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
