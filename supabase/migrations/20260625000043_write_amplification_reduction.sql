-- v43: Write amplification reduction — single-pass restock, optional min_stock_level

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
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF p_product_id IS NULL OR p_delta IS NULL OR p_delta <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_delta');
  END IF;

  PERFORM set_config('app.skip_stock_sync', 'on', true);

  SELECT stock_quantity, variants, store_id
  INTO v_stock, v_variants, v_store_id
  FROM public.products
  WHERE id = p_product_id
    AND owner_id = p_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    PERFORM set_config('app.skip_stock_sync', 'off', true);
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  IF v_store_id IS NOT NULL AND v_store_id NOT IN (SELECT public.auth_user_store_ids()) THEN
    PERFORM set_config('app.skip_stock_sync', 'off', true);
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
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
  WHERE id = p_product_id
    AND owner_id = p_owner_id;

  PERFORM set_config('app.skip_stock_sync', 'off', true);

  INSERT INTO public.inventory_movements (product_id, owner_id, quantity_delta, reason)
  VALUES (p_product_id, p_owner_id, p_delta, COALESCE(NULLIF(trim(p_reason), ''), 'restock'));

  RETURN jsonb_build_object('success', true, 'stock_quantity', v_new_qty);
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('app.skip_stock_sync', 'off', true);
  RETURN jsonb_build_object('success', false, 'error', 'restock_failed');
END;
$$;

REVOKE ALL ON FUNCTION public.increment_product_stock(UUID, UUID, INT, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_product_stock(UUID, UUID, INT, TEXT, INT) TO authenticated;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (43, 'write_amp: single-pass increment_product_stock + optional min_stock_level')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
