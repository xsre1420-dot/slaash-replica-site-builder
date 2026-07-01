-- v101: Fix checkout product row locks (FOR UPDATE + DISTINCT is invalid in PostgreSQL).

CREATE OR REPLACE FUNCTION public.lock_owner_products_ordered(
  p_owner_id UUID,
  p_items JSONB
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*)::INT INTO v_count
  FROM (
    SELECT p.id
    FROM public.products p
    INNER JOIN (
      SELECT (item->>'product_id')::UUID AS id
      FROM jsonb_array_elements(p_items) AS t(item)
      WHERE (item->>'product_id') IS NOT NULL
        AND (item->>'quantity')::INT > 0
      GROUP BY (item->>'product_id')::UUID
    ) ids ON p.id = ids.id
    WHERE p.owner_id = p_owner_id
      AND COALESCE(p.is_active, true) = true
      AND p.archived_at IS NULL
    ORDER BY p.id
    FOR UPDATE OF p
  ) locked;

  RETURN COALESCE(v_count, 0);
END;
$$;

COMMENT ON FUNCTION public.lock_owner_products_ordered(UUID, JSONB) IS
  'Acquire row locks on checkout SKUs in deterministic UUID order (deadlock prevention).';

-- Align checkout qty with client: stock=0 and all variant rows at zero = unlimited (unset stock bug).
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

  v_variant_sum := CASE
    WHEN v_has_variants THEN public.product_variant_stock_sum(p_variants)
    ELSE 0
  END;

  v_aggregate := CASE
    WHEN p_stock IS NULL THEN 2147483647
    WHEN p_stock < 0 THEN 2147483647
    WHEN p_stock = 0 AND (NOT v_has_variants OR v_variant_sum <= 0) THEN 2147483647
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
        IF v_aggregate = 2147483647 THEN
          RETURN 2147483647;
        END IF;
        RETURN 0;
      END IF;
    END LOOP;

    IF v_aggregate = 2147483647 THEN
      RETURN 2147483647;
    END IF;
    RETURN v_aggregate;
  END IF;

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
VALUES (101, 'fix lock_owner_products_ordered — checkout FOR UPDATE + DISTINCT error')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
