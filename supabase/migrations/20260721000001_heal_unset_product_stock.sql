-- v100: Heal legacy stock_quantity=0 (unset stock) so checkout stops rejecting valid orders.

-- 1) Default NULL = unlimited (not 0)
ALTER TABLE public.products ALTER COLUMN stock_quantity DROP DEFAULT;
ALTER TABLE public.products ALTER COLUMN stock_quantity SET DEFAULT NULL;

-- 2) Heal existing simple products saved with accidental zero stock
UPDATE public.products p
SET stock_quantity = NULL
WHERE p.archived_at IS NULL
  AND p.stock_quantity = 0
  AND NOT public.storefront_product_has_options(p)
  AND NOT EXISTS (
    SELECT 1
    FROM public.inventory_movements im
    WHERE im.product_id = p.id
      AND im.quantity_delta <> 0
  );

-- 3) Storefront stock status — simple products with legacy 0 = unlimited
CREATE OR REPLACE FUNCTION public.storefront_product_stock_status(p public.products)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_qty INT;
BEGIN
  IF p.stock_quantity IS NULL OR p.stock_quantity < 0 THEN
    RETURN 'unlimited';
  END IF;

  IF p.stock_quantity = 0 AND NOT public.storefront_product_has_options(p) THEN
    RETURN 'unlimited';
  END IF;

  v_qty := public.storefront_product_list_qty(p);

  IF COALESCE(v_qty, 0) <= 0 THEN
    RETURN 'out';
  END IF;

  IF v_qty <= 3 THEN
    RETURN 'low';
  END IF;

  RETURN 'in_stock';
END;
$$;

-- 4) Checkout available qty — align with client normalizeProductStock legacy heal
CREATE OR REPLACE FUNCTION public.product_checkout_available_qty(
  p_stock INT,
  p_variants JSONB,
  p_size TEXT,
  p_color TEXT
) RETURNS INT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_aggregate INT;
  v_variant_qty INT;
  v_variant_sum INT;
  v_elem JSONB;
  v_has_variants BOOLEAN;
BEGIN
  v_has_variants := p_variants IS NOT NULL
    AND jsonb_typeof(p_variants) = 'array'
    AND jsonb_array_length(p_variants) > 0;

  v_aggregate := CASE
    WHEN p_stock IS NULL THEN 2147483647
    WHEN p_stock < 0 THEN 2147483647
    WHEN p_stock = 0 AND NOT v_has_variants THEN 2147483647
    ELSE p_stock
  END;

  IF NOT v_has_variants THEN
    RETURN v_aggregate;
  END IF;

  IF p_size IS NOT NULL OR p_color IS NOT NULL THEN
    FOR v_elem IN SELECT value FROM jsonb_array_elements(p_variants) LOOP
      IF (p_size IS NULL OR v_elem->>'size' = p_size)
         AND (p_color IS NULL OR lower(v_elem->>'color') = lower(p_color)) THEN
        v_variant_qty := COALESCE((v_elem->>'quantity')::INT, 0);
        IF v_variant_qty > 0 THEN
          IF v_aggregate = 2147483647 THEN
            RETURN v_variant_qty;
          END IF;
          RETURN LEAST(v_variant_qty, v_aggregate);
        END IF;
        IF v_aggregate > 0 AND v_aggregate <> 2147483647 THEN
          RETURN v_aggregate;
        END IF;
        RETURN 0;
      END IF;
    END LOOP;

    IF v_aggregate = 2147483647 THEN
      RETURN 0;
    END IF;
    RETURN v_aggregate;
  END IF;

  v_variant_sum := public.product_variant_stock_sum(p_variants);
  IF v_variant_sum > 0 THEN
    IF v_aggregate = 2147483647 THEN
      RETURN v_variant_sum;
    END IF;
    RETURN LEAST(v_variant_sum, v_aggregate);
  END IF;

  RETURN v_aggregate;
END;
$$;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (100, 'heal unset stock_quantity=0 — fix checkout insufficient stock for simple products')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
