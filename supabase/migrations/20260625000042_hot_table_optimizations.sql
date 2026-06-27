-- v42: Hot table mitigation — lock duration, rollup HOT updates, autovacuum, index hygiene
-- Targets: store_visits writes, store_daily_stats row contention, products stock locks

-- ---------------------------------------------------------------------------
-- 1) store_daily_stats — HOT updates on same (owner_id, stat_date) row
-- ---------------------------------------------------------------------------
ALTER TABLE public.store_daily_stats SET (fillfactor = 70);

COMMENT ON TABLE public.store_daily_stats IS
  'Daily KPI rollups. fillfactor=70 leaves heap space for in-place HOT updates under viral traffic.';

-- ---------------------------------------------------------------------------
-- 2) Append-heavy tables — autovacuum tuning
-- ---------------------------------------------------------------------------
ALTER TABLE public.store_visits SET (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.01,
  autovacuum_vacuum_cost_delay = 10
);

ALTER TABLE public.inventory_movements SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

ALTER TABLE public.order_items SET (
  autovacuum_analyze_scale_factor = 0.02
);

-- ---------------------------------------------------------------------------
-- 3) Drop duplicate visit dedupe index (v21 already covers v41 dedupe_lookup)
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_store_visits_dedupe_lookup;

-- ---------------------------------------------------------------------------
-- 4) increment_product_stock — atomic UPDATE (shorter row lock hold)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_product_stock(
  p_product_id UUID,
  p_owner_id UUID,
  p_delta INT,
  p_reason TEXT DEFAULT 'restock'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock INT;
  v_variants JSONB;
  v_new_qty INT;
  v_store_id UUID;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF p_product_id IS NULL OR p_delta IS NULL OR p_delta <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_delta');
  END IF;

  PERFORM set_config('app.skip_stock_sync', 'on', true);

  UPDATE public.products
  SET stock_quantity = COALESCE(stock_quantity, 0) + p_delta,
      updated_at = NOW()
  WHERE id = p_product_id
    AND owner_id = p_owner_id
  RETURNING stock_quantity, variants, store_id
  INTO v_new_qty, v_variants, v_store_id;

  IF NOT FOUND THEN
    PERFORM set_config('app.skip_stock_sync', 'off', true);
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  IF v_store_id IS NOT NULL AND v_store_id NOT IN (SELECT public.auth_user_store_ids()) THEN
    PERFORM set_config('app.skip_stock_sync', 'off', true);
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF v_variants IS NOT NULL
     AND jsonb_typeof(v_variants) = 'array'
     AND jsonb_array_length(v_variants) > 0 THEN
    v_variants := public.scale_variants_to_total(v_variants, v_new_qty);
    UPDATE public.products
    SET variants = v_variants
    WHERE id = p_product_id
      AND owner_id = p_owner_id;
  END IF;

  PERFORM set_config('app.skip_stock_sync', 'off', true);

  INSERT INTO public.inventory_movements (product_id, owner_id, quantity_delta, reason)
  VALUES (p_product_id, p_owner_id, p_delta, COALESCE(NULLIF(trim(p_reason), ''), 'restock'));

  RETURN jsonb_build_object('success', true, 'stock_quantity', v_new_qty);
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('app.skip_stock_sync', 'off', true);
  RETURN jsonb_build_object('success', false, 'error', 'restock_failed');
END;
$$;

-- ---------------------------------------------------------------------------
-- 5) Visit rollup trigger — leaner path, skip empty IP unique tracking
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_visits_daily_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stat_date DATE;
  v_is_new_ip BOOLEAN := false;
  v_inserted INT;
BEGIN
  v_stat_date := (NEW.created_at AT TIME ZONE 'UTC')::DATE;

  IF NEW.visitor_ip IS NOT NULL AND btrim(NEW.visitor_ip) <> '' AND NEW.visitor_ip <> '0.0.0.0' THEN
    INSERT INTO public.store_visitor_daily_keys (owner_id, stat_date, visitor_ip)
    VALUES (NEW.owner_id, v_stat_date, NEW.visitor_ip)
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    v_is_new_ip := v_inserted > 0;
  END IF;

  INSERT INTO public.store_daily_stats (owner_id, stat_date, visit_count, unique_visitors)
  VALUES (NEW.owner_id, v_stat_date, 1, CASE WHEN v_is_new_ip THEN 1 ELSE 0 END)
  ON CONFLICT (owner_id, stat_date) DO UPDATE SET
    visit_count = store_daily_stats.visit_count + 1,
    unique_visitors = store_daily_stats.unique_visitors + CASE WHEN v_is_new_ip THEN 1 ELSE 0 END,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6) Order rollup trigger — skip no-op UPDATEs (reduces store_daily_stats writes)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_orders_daily_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stat_date DATE;
  v_revenue_delta NUMERIC;
  v_completed_delta INT;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.status IS NOT DISTINCT FROM NEW.status
     AND OLD.total_amount IS NOT DISTINCT FROM NEW.total_amount
     AND OLD.payment_status IS NOT DISTINCT FROM NEW.payment_status THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.upsert_store_daily_order_stats(
      NEW.owner_id,
      (NEW.created_at AT TIME ZONE 'UTC')::DATE,
      COALESCE(NEW.status, 'pending'),
      COALESCE(NEW.total_amount, 0),
      1
    );
    IF COALESCE(NEW.status, '') = 'completed' AND COALESCE(NEW.payment_status, '') = 'refunded' THEN
      v_stat_date := (NEW.created_at AT TIME ZONE 'UTC')::DATE;
      UPDATE public.store_daily_stats
      SET completed_revenue = GREATEST(0, completed_revenue - COALESCE(NEW.total_amount, 0)),
          completed_order_count = GREATEST(0, completed_order_count - 1),
          updated_at = NOW()
      WHERE owner_id = NEW.owner_id AND stat_date = v_stat_date;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.upsert_store_daily_order_stats(
      OLD.owner_id,
      (OLD.created_at AT TIME ZONE 'UTC')::DATE,
      OLD.status,
      COALESCE(OLD.total_amount, 0),
      -1
    );
    PERFORM public.upsert_store_daily_order_stats(
      NEW.owner_id,
      (NEW.created_at AT TIME ZONE 'UTC')::DATE,
      COALESCE(NEW.status, 'pending'),
      COALESCE(NEW.total_amount, 0),
      1
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status = 'completed'
     AND NEW.status = 'completed'
     AND COALESCE(OLD.total_amount, 0) IS DISTINCT FROM COALESCE(NEW.total_amount, 0) THEN
    v_stat_date := (NEW.created_at AT TIME ZONE 'UTC')::DATE;
    v_revenue_delta := COALESCE(NEW.total_amount, 0) - COALESCE(OLD.total_amount, 0);

    UPDATE public.store_daily_stats
    SET completed_revenue = GREATEST(0, completed_revenue + v_revenue_delta),
        updated_at = NOW()
    WHERE owner_id = NEW.owner_id
      AND stat_date = v_stat_date;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status = 'completed'
     AND NEW.status = 'completed'
     AND COALESCE(OLD.payment_status, '') IS DISTINCT FROM COALESCE(NEW.payment_status, '') THEN
    v_stat_date := (NEW.created_at AT TIME ZONE 'UTC')::DATE;
    v_revenue_delta := COALESCE(NEW.total_amount, 0);
    v_completed_delta := 1;

    IF COALESCE(OLD.payment_status, '') <> 'refunded' AND COALESCE(NEW.payment_status, '') = 'refunded' THEN
      UPDATE public.store_daily_stats
      SET completed_revenue = GREATEST(0, completed_revenue - v_revenue_delta),
          completed_order_count = GREATEST(0, completed_order_count - v_completed_delta),
          updated_at = NOW()
      WHERE owner_id = NEW.owner_id AND stat_date = v_stat_date;
    ELSIF COALESCE(OLD.payment_status, '') = 'refunded' AND COALESCE(NEW.payment_status, '') <> 'refunded' THEN
      UPDATE public.store_daily_stats
      SET completed_revenue = completed_revenue + v_revenue_delta,
          completed_order_count = completed_order_count + v_completed_delta,
          updated_at = NOW()
      WHERE owner_id = NEW.owner_id AND stat_date = v_stat_date;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

ANALYZE public.store_visits;
ANALYZE public.store_daily_stats;
ANALYZE public.products;
ANALYZE public.orders;
ANALYZE public.inventory_movements;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (42, 'hot_tables: fillfactor rollups, autovacuum tuning, atomic restock, lean triggers')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
