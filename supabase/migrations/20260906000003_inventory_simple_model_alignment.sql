-- Simple inventory model alignment (production)
-- Ships core read/write RPCs without warehouse tables or premium migration 20260728000001.
-- Warehouse/PO features remain deferred until premium-inventory wave is approved.

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
BEGIN
  PERFORM public.apply_merchant_lock_defaults(5000, 12000);

  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF p_product_id IS NULL OR p_delta IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_args');
  END IF;

  IF p_delta <= 0 AND p_min_stock_level IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_delta');
  END IF;

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
    SET min_stock_level = p_min_stock_level,
        updated_at = NOW()
    WHERE id = p_product_id AND owner_id = p_owner_id;

    PERFORM set_config('app.skip_stock_sync', 'off', true);
    RETURN jsonb_build_object('success', true, 'stock_quantity', COALESCE(v_stock, 0));
  END IF;

  v_new_qty := COALESCE(v_stock, 0) + p_delta;
  v_scaled_variants := v_variants;

  IF v_variants IS NOT NULL
     AND jsonb_typeof(v_variants) = 'array'
     AND jsonb_array_length(v_variants) > 0 THEN
    v_scaled_variants := public.scale_variants_to_total(v_variants, v_new_qty);
  END IF;

  UPDATE public.products
  SET stock_quantity = v_new_qty,
      variants = v_scaled_variants,
      min_stock_level = COALESCE(p_min_stock_level, min_stock_level),
      updated_at = NOW()
  WHERE id = p_product_id AND owner_id = p_owner_id;

  PERFORM set_config('app.skip_stock_sync', 'off', true);

  INSERT INTO public.inventory_movements (product_id, owner_id, quantity_delta, reason)
  VALUES (p_product_id, p_owner_id, p_delta, COALESCE(NULLIF(trim(p_reason), ''), 'restock'));

  RETURN jsonb_build_object('success', true, 'stock_quantity', v_new_qty);
EXCEPTION
  WHEN lock_not_available THEN
    PERFORM set_config('app.skip_stock_sync', 'off', true);
    RETURN jsonb_build_object('success', false, 'error', 'lock_contention');
  WHEN OTHERS THEN
    PERFORM set_config('app.skip_stock_sync', 'off', true);
    RETURN jsonb_build_object('success', false, 'error', 'restock_failed');
END;
$$;

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
      GREATEST(COALESCE((v_item->>'delta')::int, 0), 0),
      COALESCE(v_item->>'reason', 'restock'),
      NULLIF(v_item->>'min_stock_level', '')::int
    );
    IF COALESCE((v_result->>'success')::boolean, false) THEN
      v_ok := v_ok + 1;
    ELSE
      v_fail := v_fail + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'succeeded', v_ok, 'failed', v_fail);
END;
$$;

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
    'published', COUNT(*) FILTER (WHERE COALESCE(p.is_active, true) = true AND p.archived_at IS NULL),
    'draft', COUNT(*) FILTER (WHERE COALESCE(p.is_active, true) = false AND p.archived_at IS NULL),
    'archived', COUNT(*) FILTER (WHERE p.archived_at IS NOT NULL),
    'total_units', COALESCE(SUM(GREATEST(COALESCE(p.stock_quantity, 0), 0)), 0),
    'retail_value', COALESCE(SUM(GREATEST(COALESCE(p.stock_quantity, 0), 0) * COALESCE(p.price, 0)), 0),
    'cost_value', COALESCE(SUM(GREATEST(COALESCE(p.stock_quantity, 0), 0) * COALESCE(p.cost, 0)), 0),
    'missing_sku', COUNT(*) FILTER (WHERE p.sku IS NULL OR trim(p.sku) = ''),
    'missing_barcode', 0,
    'missing_image', COUNT(*) FILTER (WHERE p.image_url IS NULL OR trim(p.image_url) = ''),
    'low_stock', COUNT(*) FILTER (
      WHERE COALESCE(p.is_active, true) = true AND p.archived_at IS NULL
        AND COALESCE(p.stock_quantity, 0) > 0
        AND COALESCE(p.stock_quantity, 0) <= COALESCE(p.min_stock_level, 5)
    ),
    'out_of_stock', COUNT(*) FILTER (
      WHERE COALESCE(p.is_active, true) = true AND p.archived_at IS NULL AND COALESCE(p.stock_quantity, 0) = 0
    ),
    'incoming_units', 0,
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

REVOKE ALL ON FUNCTION public.batch_restock_products(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.batch_restock_products(UUID, JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.merchant_inventory_summary(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_inventory_summary(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.list_merchant_inventory_movements(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_merchant_inventory_movements(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INT) TO authenticated;

COMMENT ON FUNCTION public.merchant_inventory_summary(UUID) IS
  'Simple inventory KPIs from products.stock_quantity — no warehouse/PO tables required';

INSERT INTO public.platform_schema_version (version, notes)
VALUES (108, 'inventory: simple model RPCs + increment_product_stock threshold-only updates')
ON CONFLICT (version) DO UPDATE SET notes = EXCLUDED.notes, applied_at = NOW();

INSERT INTO public.platform_migration_registry (version, status, wave, file_name, notes)
VALUES (
  '20260728000001',
  'deferred',
  'premium-inventory',
  '20260728000001_inventory_premium_platform.sql',
  'Warehouse/PO/barcode premium layer — not deployed; simple model active via 20260906000003.'
)
ON CONFLICT (version) DO UPDATE SET notes = EXCLUDED.notes, updated_at = now();
