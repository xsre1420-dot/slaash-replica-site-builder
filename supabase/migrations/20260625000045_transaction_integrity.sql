-- v45: Transaction integrity — atomic initial-stock ledger recording

-- ---------------------------------------------------------------------------
-- 1) record_product_initial_stock — idempotent movement for new products
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_product_initial_stock(
  p_product_id UUID,
  p_owner_id UUID,
  p_quantity INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id UUID;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF p_product_id IS NULL OR p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN jsonb_build_object('success', true, 'skipped', true);
  END IF;

  PERFORM 1
  FROM public.products
  WHERE id = p_product_id
    AND owner_id = p_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  SELECT store_id INTO v_store_id
  FROM public.products
  WHERE id = p_product_id
    AND owner_id = p_owner_id;

  IF v_store_id IS NOT NULL AND v_store_id NOT IN (SELECT public.auth_user_store_ids()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.inventory_movements
    WHERE product_id = p_product_id
      AND owner_id = p_owner_id
      AND reason = 'initial_stock'
  ) THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  INSERT INTO public.inventory_movements (product_id, owner_id, quantity_delta, reason)
  VALUES (p_product_id, p_owner_id, p_quantity, 'initial_stock');

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'initial_stock_failed');
END;
$$;

REVOKE ALL ON FUNCTION public.record_product_initial_stock(UUID, UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_product_initial_stock(UUID, UUID, INT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) record_initial_stock_movements — batch ledger for bulk product import
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_initial_stock_movements(
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
  v_product_id UUID;
  v_qty INT;
  v_recorded INT := 0;
  v_skipped INT := 0;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RETURN jsonb_build_object('success', true, 'recorded', 0, 'skipped', 0);
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'quantity_delta')::INT;

    IF v_product_id IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.products
      WHERE id = v_product_id AND owner_id = p_owner_id
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.inventory_movements
      WHERE product_id = v_product_id
        AND owner_id = p_owner_id
        AND reason = 'initial_stock'
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.inventory_movements (product_id, owner_id, quantity_delta, reason)
    VALUES (v_product_id, p_owner_id, v_qty, 'initial_stock');
    v_recorded := v_recorded + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'recorded', v_recorded, 'skipped', v_skipped);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'batch_initial_stock_failed');
END;
$$;

REVOKE ALL ON FUNCTION public.record_initial_stock_movements(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_initial_stock_movements(UUID, JSONB) TO authenticated;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (45, 'transaction_integrity: atomic initial_stock ledger RPCs')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
