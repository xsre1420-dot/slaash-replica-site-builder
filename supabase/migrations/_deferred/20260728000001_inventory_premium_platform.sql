-- v99: Premium inventory — warehouses, POs, batch restock, analytics RPCs, barcode

-- ─── Schema extensions ───────────────────────────────────────────────────────

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS barcode TEXT;

CREATE INDEX IF NOT EXISTS idx_products_barcode_owner
  ON public.products (owner_id, barcode)
  WHERE barcode IS NOT NULL AND trim(barcode) <> '';

ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS warehouse_id UUID;

-- ─── Warehouses ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_warehouses_one_default_per_owner
  ON public.warehouses (owner_id)
  WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_warehouses_owner ON public.warehouses (owner_id);

CREATE TABLE IF NOT EXISTS public.warehouse_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved_quantity INT NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  min_stock_level INT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (warehouse_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_warehouse_stock_owner_product
  ON public.warehouse_stock (owner_id, product_id);

-- ─── Suppliers & purchase orders ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_owner ON public.suppliers (owner_id);

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ordered', 'partial', 'received', 'cancelled')),
  reference_code TEXT,
  expected_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_owner_status
  ON public.purchase_orders (owner_id, status);

CREATE TABLE IF NOT EXISTS public.purchase_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quantity_ordered INT NOT NULL CHECK (quantity_ordered > 0),
  quantity_received INT NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
  unit_cost NUMERIC(12, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_lines_po ON public.purchase_order_lines (purchase_order_id);

-- ─── Transfers & cycle counts ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inventory_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  from_warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  to_warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'in_transit', 'completed', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_cycle_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed', 'cancelled')),
  name TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.inventory_cycle_count_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_count_id UUID NOT NULL REFERENCES public.inventory_cycle_counts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expected_qty INT NOT NULL DEFAULT 0,
  counted_qty INT,
  variance INT GENERATED ALWAYS AS (COALESCE(counted_qty, 0) - expected_qty) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cycle_count_id, product_id)
);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_cycle_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_cycle_count_lines ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY warehouses_owner ON public.warehouses FOR ALL
    USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY warehouse_stock_owner ON public.warehouse_stock FOR ALL
    USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY suppliers_owner ON public.suppliers FOR ALL
    USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY purchase_orders_owner ON public.purchase_orders FOR ALL
    USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY po_lines_owner ON public.purchase_order_lines FOR ALL
    USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY inventory_transfers_owner ON public.inventory_transfers FOR ALL
    USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY cycle_counts_owner ON public.inventory_cycle_counts FOR ALL
    USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY cycle_count_lines_owner ON public.inventory_cycle_count_lines FOR ALL
    USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Default warehouse helper ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ensure_default_warehouse(p_owner_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id INTO v_id
  FROM public.warehouses
  WHERE owner_id = p_owner_id AND is_default = true
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.warehouses (owner_id, name, code, is_default)
  VALUES (p_owner_id, 'المستودع الرئيسي', 'MAIN', true)
  RETURNING id INTO v_id;

  INSERT INTO public.warehouse_stock (warehouse_id, product_id, owner_id, quantity, min_stock_level)
  SELECT v_id, p.id, p.owner_id, GREATEST(COALESCE(p.stock_quantity, 0), 0), p.min_stock_level
  FROM public.products p
  WHERE p.owner_id = p_owner_id
    AND COALESCE(p.stock_quantity, 0) >= 0
  ON CONFLICT (warehouse_id, product_id) DO NOTHING;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_default_warehouse(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_default_warehouse(UUID) TO authenticated;

-- ─── increment_product_stock: add created_by + default warehouse sync ────────

CREATE OR REPLACE FUNCTION public.increment_product_stock(
  p_product_id UUID,
  p_owner_id UUID,
  p_delta INT,
  p_reason TEXT DEFAULT 'restock',
  p_min_stock_level INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock INT;
  v_variants JSONB;
  v_scaled_variants JSONB;
  v_new_qty INT;
  v_store_id UUID;
  v_wh_id UUID;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF p_product_id IS NULL OR p_delta IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_args');
  END IF;

  IF p_delta <= 0 AND p_min_stock_level IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_delta');
  END IF;

  v_wh_id := public.ensure_default_warehouse(p_owner_id);

  PERFORM set_config('app.skip_stock_sync', 'on', true);

  SELECT stock_quantity, variants, store_id
  INTO v_stock, v_variants, v_store_id
  FROM public.products
  WHERE id = p_product_id AND owner_id = p_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    PERFORM set_config('app.skip_stock_sync', 'off', true);
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  IF v_store_id IS NOT NULL AND v_store_id NOT IN (SELECT public.auth_user_store_ids()) THEN
    PERFORM set_config('app.skip_stock_sync', 'off', true);
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF p_delta <= 0 THEN
    UPDATE public.products
    SET min_stock_level = p_min_stock_level, updated_at = NOW()
    WHERE id = p_product_id AND owner_id = p_owner_id;

    UPDATE public.warehouse_stock
    SET min_stock_level = p_min_stock_level, updated_at = NOW()
    WHERE warehouse_id = v_wh_id AND product_id = p_product_id AND owner_id = p_owner_id;

    PERFORM set_config('app.skip_stock_sync', 'off', true);
    RETURN jsonb_build_object('success', true, 'stock_quantity', COALESCE(v_stock, 0));
  END IF;

  v_new_qty := COALESCE(v_stock, 0) + p_delta;
  v_scaled_variants := v_variants;

  IF v_variants IS NOT NULL AND jsonb_typeof(v_variants) = 'array' AND jsonb_array_length(v_variants) > 0 THEN
    v_scaled_variants := public.scale_variants_to_total(v_variants, v_new_qty);
  END IF;

  UPDATE public.products
  SET stock_quantity = v_new_qty,
      variants = v_scaled_variants,
      min_stock_level = COALESCE(p_min_stock_level, min_stock_level),
      updated_at = NOW()
  WHERE id = p_product_id AND owner_id = p_owner_id;

  INSERT INTO public.warehouse_stock (warehouse_id, product_id, owner_id, quantity, min_stock_level)
  VALUES (v_wh_id, p_product_id, p_owner_id, v_new_qty, COALESCE(p_min_stock_level, 5))
  ON CONFLICT (warehouse_id, product_id)
  DO UPDATE SET
    quantity = v_new_qty,
    min_stock_level = COALESCE(EXCLUDED.min_stock_level, warehouse_stock.min_stock_level),
    updated_at = NOW();

  PERFORM set_config('app.skip_stock_sync', 'off', true);

  INSERT INTO public.inventory_movements (
    product_id, owner_id, quantity_delta, reason, created_by, warehouse_id
  )
  VALUES (
    p_product_id, p_owner_id, p_delta,
    COALESCE(NULLIF(trim(p_reason), ''), 'restock'),
    auth.uid(), v_wh_id
  );

  RETURN jsonb_build_object('success', true, 'stock_quantity', v_new_qty);
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('app.skip_stock_sync', 'off', true);
  RETURN jsonb_build_object('success', false, 'error', 'restock_failed');
END;
$$;

-- ─── Batch restock ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.batch_restock_products(
  p_owner_id UUID,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_result JSONB;
  v_ok INT := 0;
  v_fail INT := 0;
  v_results JSONB := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_items');
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_result := public.increment_product_stock(
      (v_item->>'product_id')::uuid,
      p_owner_id,
      COALESCE((v_item->>'delta')::int, 0),
      COALESCE(v_item->>'reason', 'restock'),
      NULLIF(v_item->>'min_stock_level', '')::int
    );
    IF COALESCE((v_result->>'success')::boolean, false) THEN
      v_ok := v_ok + 1;
    ELSE
      v_fail := v_fail + 1;
    END IF;
    v_results := v_results || jsonb_build_array(
      jsonb_build_object('product_id', v_item->>'product_id', 'result', v_result)
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'succeeded', v_ok,
    'failed', v_fail,
    'results', v_results
  );
END;
$$;

REVOKE ALL ON FUNCTION public.batch_restock_products(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.batch_restock_products(UUID, JSONB) TO authenticated;

-- ─── Inventory summary (server KPIs) ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.merchant_inventory_summary(p_owner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT jsonb_build_object(
    'success', true,
    'total_products', COUNT(*),
    'published', COUNT(*) FILTER (WHERE p.is_active = true AND p.archived_at IS NULL),
    'draft', COUNT(*) FILTER (WHERE p.is_active = false AND p.archived_at IS NULL),
    'archived', COUNT(*) FILTER (WHERE p.archived_at IS NOT NULL),
    'total_units', COALESCE(SUM(GREATEST(COALESCE(p.stock_quantity, 0), 0)), 0),
    'retail_value', COALESCE(SUM(GREATEST(COALESCE(p.stock_quantity, 0), 0) * COALESCE(p.price, 0)), 0),
    'cost_value', COALESCE(SUM(GREATEST(COALESCE(p.stock_quantity, 0), 0) * COALESCE(p.cost, 0)), 0),
    'missing_sku', COUNT(*) FILTER (WHERE p.sku IS NULL OR trim(p.sku) = ''),
    'missing_barcode', COUNT(*) FILTER (WHERE p.barcode IS NULL OR trim(p.barcode) = ''),
    'missing_image', COUNT(*) FILTER (WHERE p.image_url IS NULL OR trim(p.image_url) = ''),
    'low_stock', COUNT(*) FILTER (
      WHERE p.is_active = true AND p.archived_at IS NULL
        AND COALESCE(p.stock_quantity, 0) > 0
        AND COALESCE(p.stock_quantity, 0) <= COALESCE(p.min_stock_level, 5)
    ),
    'out_of_stock', COUNT(*) FILTER (
      WHERE p.is_active = true AND p.archived_at IS NULL AND COALESCE(p.stock_quantity, 0) = 0
    ),
    'incoming_units', COALESCE((
      SELECT SUM(pol.quantity_ordered - pol.quantity_received)
      FROM public.purchase_order_lines pol
      JOIN public.purchase_orders po ON po.id = pol.purchase_order_id
      WHERE pol.owner_id = p_owner_id
        AND po.status IN ('ordered', 'partial')
        AND pol.quantity_ordered > pol.quantity_received
    ), 0),
    'reserved_units', COALESCE((
      SELECT SUM(oi.quantity)
      FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      WHERE o.owner_id = p_owner_id
        AND o.status NOT IN ('cancelled', 'completed', 'refunded')
    ), 0)
  )
  INTO v_result
  FROM public.products p
  WHERE p.owner_id = p_owner_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_inventory_summary(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_inventory_summary(UUID) TO authenticated;

-- ─── Global movements list ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.list_merchant_inventory_movements(
  p_owner_id UUID,
  p_from TIMESTAMPTZ DEFAULT (now() - interval '30 days'),
  p_to TIMESTAMPTZ DEFAULT now(),
  p_limit INT DEFAULT 100
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'movements', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC)
      FROM (
        SELECT
          im.id,
          im.product_id,
          p.name AS product_name,
          p.sku,
          im.quantity_delta,
          im.reason,
          im.order_id,
          im.warehouse_id,
          im.created_at
        FROM public.inventory_movements im
        JOIN public.products p ON p.id = im.product_id
        WHERE im.owner_id = p_owner_id
          AND im.created_at >= p_from
          AND im.created_at <= p_to
        ORDER BY im.created_at DESC
        LIMIT LEAST(GREATEST(p_limit, 1), 500)
      ) t
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_merchant_inventory_movements(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_merchant_inventory_movements(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INT) TO authenticated;

-- ─── Demand forecast from order velocity ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.merchant_inventory_forecast(p_owner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'items', COALESCE((
      SELECT jsonb_agg(row_to_json(f) ORDER BY f.days_until_stockout ASC NULLS LAST)
      FROM (
        SELECT
          p.id AS product_id,
          p.name,
          p.sku,
          GREATEST(COALESCE(p.stock_quantity, 0), 0) AS current_stock,
          COALESCE(p.min_stock_level, 5) AS min_stock_level,
          COALESCE(v.sold_30d, 0) AS sold_last_30_days,
          CASE
            WHEN COALESCE(v.sold_30d, 0) <= 0 THEN NULL
            ELSE ROUND(
              (GREATEST(COALESCE(p.stock_quantity, 0), 0)::numeric / (v.sold_30d::numeric / 30.0))::numeric,
              1
            )
          END AS days_until_stockout,
          CASE
            WHEN COALESCE(v.sold_30d, 0) <= 0 THEN NULL
            ELSE GREATEST(
              CEIL((v.sold_30d::numeric / 30.0) * 14)::int - GREATEST(COALESCE(p.stock_quantity, 0), 0),
              0
            )::int
          END AS suggested_reorder_qty
        FROM public.products p
        LEFT JOIN (
          SELECT oi.product_id, SUM(oi.quantity) AS sold_30d
          FROM public.order_items oi
          JOIN public.orders o ON o.id = oi.order_id
          WHERE o.owner_id = p_owner_id
            AND o.created_at >= now() - interval '30 days'
            AND o.status NOT IN ('cancelled', 'refunded')
          GROUP BY oi.product_id
        ) v ON v.product_id = p.id
        WHERE p.owner_id = p_owner_id
          AND p.is_active = true
          AND p.archived_at IS NULL
      ) f
      WHERE f.sold_last_30_days > 0 OR f.current_stock <= f.min_stock_level
      LIMIT 50
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_inventory_forecast(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_inventory_forecast(UUID) TO authenticated;

-- ─── ABC analysis ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.merchant_abc_analysis(p_owner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'items', COALESCE((
      WITH sales AS (
        SELECT
          oi.product_id,
          SUM(oi.subtotal) AS revenue,
          SUM(oi.quantity) AS units_sold
        FROM public.order_items oi
        JOIN public.orders o ON o.id = oi.order_id
        WHERE o.owner_id = p_owner_id
          AND o.created_at >= now() - interval '90 days'
          AND o.status NOT IN ('cancelled', 'refunded')
        GROUP BY oi.product_id
      ),
      ranked AS (
        SELECT
          p.id AS product_id,
          p.name,
          COALESCE(s.revenue, 0) AS revenue,
          COALESCE(s.units_sold, 0) AS units_sold,
          SUM(COALESCE(s.revenue, 0)) OVER () AS total_revenue,
          SUM(COALESCE(s.revenue, 0)) OVER (ORDER BY COALESCE(s.revenue, 0) DESC) AS cumulative_revenue
        FROM public.products p
        LEFT JOIN sales s ON s.product_id = p.id
        WHERE p.owner_id = p_owner_id
      )
      SELECT jsonb_agg(row_to_json(r) ORDER BY r.revenue DESC)
      FROM (
        SELECT
          product_id,
          name,
          revenue,
          units_sold,
          CASE
            WHEN total_revenue <= 0 THEN 'C'
            WHEN cumulative_revenue / total_revenue <= 0.8 THEN 'A'
            WHEN cumulative_revenue / total_revenue <= 0.95 THEN 'B'
            ELSE 'C'
          END AS abc_class
        FROM ranked
        WHERE revenue > 0 OR units_sold > 0
        LIMIT 100
      ) r
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_abc_analysis(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_abc_analysis(UUID) TO authenticated;

-- ─── Barcode lookup ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.lookup_product_by_barcode(
  p_owner_id UUID,
  p_barcode TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT id, name, sku, barcode, stock_quantity, min_stock_level, category, price
  INTO v_row
  FROM public.products
  WHERE owner_id = p_owner_id
    AND (
      trim(barcode) = trim(p_barcode)
      OR trim(sku) = trim(p_barcode)
    )
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object('success', true, 'product', row_to_json(v_row));
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_product_by_barcode(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_product_by_barcode(UUID, TEXT) TO authenticated;

-- ─── Warehouse transfer ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.transfer_warehouse_stock(
  p_owner_id UUID,
  p_product_id UUID,
  p_from_warehouse_id UUID,
  p_to_warehouse_id UUID,
  p_quantity INT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_qty INT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 OR p_from_warehouse_id = p_to_warehouse_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_args');
  END IF;

  SELECT quantity INTO v_from_qty
  FROM public.warehouse_stock
  WHERE warehouse_id = p_from_warehouse_id
    AND product_id = p_product_id
    AND owner_id = p_owner_id
  FOR UPDATE;

  IF v_from_qty IS NULL OR v_from_qty < p_quantity THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_stock');
  END IF;

  UPDATE public.warehouse_stock
  SET quantity = quantity - p_quantity, updated_at = NOW()
  WHERE warehouse_id = p_from_warehouse_id AND product_id = p_product_id AND owner_id = p_owner_id;

  INSERT INTO public.warehouse_stock (warehouse_id, product_id, owner_id, quantity)
  VALUES (p_to_warehouse_id, p_product_id, p_owner_id, p_quantity)
  ON CONFLICT (warehouse_id, product_id)
  DO UPDATE SET quantity = warehouse_stock.quantity + EXCLUDED.quantity, updated_at = NOW();

  INSERT INTO public.inventory_transfers (
    owner_id, product_id, from_warehouse_id, to_warehouse_id, quantity, notes, created_by
  )
  VALUES (
    p_owner_id, p_product_id, p_from_warehouse_id, p_to_warehouse_id, p_quantity, p_notes, auth.uid()
  );

  INSERT INTO public.inventory_movements (product_id, owner_id, quantity_delta, reason, notes, created_by, warehouse_id)
  VALUES (p_product_id, p_owner_id, -p_quantity, 'warehouse_transfer_out', p_notes, auth.uid(), p_from_warehouse_id);

  INSERT INTO public.inventory_movements (product_id, owner_id, quantity_delta, reason, notes, created_by, warehouse_id)
  VALUES (p_product_id, p_owner_id, p_quantity, 'warehouse_transfer_in', p_notes, auth.uid(), p_to_warehouse_id);

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_warehouse_stock(UUID, UUID, UUID, UUID, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_warehouse_stock(UUID, UUID, UUID, UUID, INT, TEXT) TO authenticated;

-- ─── Receive purchase order line ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.receive_purchase_order_line(
  p_owner_id UUID,
  p_line_id UUID,
  p_quantity INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line RECORD;
  v_po RECORD;
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT pol.*, po.warehouse_id, po.status AS po_status
  INTO v_line
  FROM public.purchase_order_lines pol
  JOIN public.purchase_orders po ON po.id = pol.purchase_order_id
  WHERE pol.id = p_line_id AND pol.owner_id = p_owner_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  IF p_quantity <= 0 OR v_line.quantity_received + p_quantity > v_line.quantity_ordered THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_quantity');
  END IF;

  v_result := public.increment_product_stock(
    v_line.product_id, p_owner_id, p_quantity, 'purchase_order_receive', NULL
  );

  IF NOT COALESCE((v_result->>'success')::boolean, false) THEN
    RETURN v_result;
  END IF;

  UPDATE public.purchase_order_lines
  SET quantity_received = quantity_received + p_quantity
  WHERE id = p_line_id;

  UPDATE public.purchase_orders po
  SET status = CASE
        WHEN (SELECT SUM(quantity_received) FROM public.purchase_order_lines WHERE purchase_order_id = po.id)
             >= (SELECT SUM(quantity_ordered) FROM public.purchase_order_lines WHERE purchase_order_id = po.id)
        THEN 'received'
        ELSE 'partial'
      END,
      received_at = CASE WHEN status <> 'received' THEN NOW() ELSE received_at END,
      updated_at = NOW()
  WHERE id = v_line.purchase_order_id;

  RETURN jsonb_build_object('success', true, 'stock_quantity', v_result->'stock_quantity');
END;
$$;

REVOKE ALL ON FUNCTION public.receive_purchase_order_line(UUID, UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.receive_purchase_order_line(UUID, UUID, INT) TO authenticated;

-- ─── Cycle count: start + submit line ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.start_inventory_cycle_count(
  p_owner_id UUID,
  p_warehouse_id UUID DEFAULT NULL,
  p_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wh UUID;
  v_count_id UUID;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  v_wh := COALESCE(p_warehouse_id, public.ensure_default_warehouse(p_owner_id));

  INSERT INTO public.inventory_cycle_counts (owner_id, warehouse_id, name, created_by)
  VALUES (p_owner_id, v_wh, COALESCE(p_name, 'جرد ' || to_char(now(), 'YYYY-MM-DD')), auth.uid())
  RETURNING id INTO v_count_id;

  INSERT INTO public.inventory_cycle_count_lines (cycle_count_id, product_id, owner_id, expected_qty)
  SELECT v_count_id, ws.product_id, ws.owner_id, ws.quantity
  FROM public.warehouse_stock ws
  WHERE ws.warehouse_id = v_wh AND ws.owner_id = p_owner_id;

  RETURN jsonb_build_object('success', true, 'cycle_count_id', v_count_id);
END;
$$;

REVOKE ALL ON FUNCTION public.start_inventory_cycle_count(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_inventory_cycle_count(UUID, UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_cycle_count_line(
  p_owner_id UUID,
  p_line_id UUID,
  p_counted_qty INT,
  p_apply_adjustment BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line RECORD;
  v_delta INT;
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT ccl.*, ic.warehouse_id, ic.status AS count_status
  INTO v_line
  FROM public.inventory_cycle_count_lines ccl
  JOIN public.inventory_cycle_counts ic ON ic.id = ccl.cycle_count_id
  WHERE ccl.id = p_line_id AND ccl.owner_id = p_owner_id AND ic.status = 'open';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  UPDATE public.inventory_cycle_count_lines
  SET counted_qty = p_counted_qty
  WHERE id = p_line_id;

  v_delta := p_counted_qty - v_line.expected_qty;

  IF p_apply_adjustment AND v_delta > 0 THEN
    v_result := public.increment_product_stock(
      v_line.product_id, p_owner_id, v_delta, 'cycle_count_adjustment', NULL
    );
    IF NOT COALESCE((v_result->>'success')::boolean, false) THEN
      RETURN v_result;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'variance', v_delta);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_cycle_count_line(UUID, UUID, INT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_cycle_count_line(UUID, UUID, INT, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_inventory_cycle_count(
  p_owner_id UUID,
  p_cycle_count_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  UPDATE public.inventory_cycle_counts
  SET status = 'completed', completed_at = NOW()
  WHERE id = p_cycle_count_id AND owner_id = p_owner_id AND status = 'open';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_inventory_cycle_count(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_inventory_cycle_count(UUID, UUID) TO authenticated;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (99, 'inventory_premium: warehouses, PO, batch restock, forecast, ABC, cycle count')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
