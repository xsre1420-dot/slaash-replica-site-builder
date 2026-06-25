-- v53: Inventory architecture audit — integrity RPC + non-negative stock guard

-- ---------------------------------------------------------------------------
-- 1) DB guard: stock_quantity cannot go negative (NULL = unlimited)
-- ---------------------------------------------------------------------------
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_stock_quantity_non_negative;

ALTER TABLE public.products
  ADD CONSTRAINT products_stock_quantity_non_negative
  CHECK (stock_quantity IS NULL OR stock_quantity >= 0)
  NOT VALID;

-- Validate when safe (no-op if already valid rows)
DO $$
BEGIN
  ALTER TABLE public.products VALIDATE CONSTRAINT products_stock_quantity_non_negative;
EXCEPTION
  WHEN check_violation THEN
    RAISE NOTICE 'products_stock_quantity_non_negative: existing negative rows — run audit_merchant_inventory_integrity to locate';
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) Merchant inventory integrity audit (read-only, tenant-scoped)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_merchant_inventory_integrity(
  p_owner_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INT := 0;
  v_issues JSONB := '[]'::jsonb;
  v_issue JSONB;
  v_negative INT := 0;
  v_variant_drift INT := 0;
  v_duplicate_initial INT := 0;
  v_missing_initial INT := 0;
  v_ledger_mismatch INT := 0;
  v_orphan_movements INT := 0;
  v_draft_visible INT := 0;
  v_score INT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT COUNT(*)::INT
  INTO v_total
  FROM public.products
  WHERE owner_id = p_owner_id;

  -- Negative aggregate stock
  FOR v_issue IN
    SELECT jsonb_build_object(
      'type', 'negative_stock',
      'product_id', p.id,
      'name', p.name,
      'stock_quantity', p.stock_quantity
    )
    FROM public.products p
    WHERE p.owner_id = p_owner_id
      AND p.stock_quantity IS NOT NULL
      AND p.stock_quantity < 0
    LIMIT 50
  LOOP
    v_negative := v_negative + 1;
    v_issues := v_issues || jsonb_build_array(v_issue);
  END LOOP;

  -- Aggregate lower than variant sum (sync trigger should have lifted — stale row)
  FOR v_issue IN
    SELECT jsonb_build_object(
      'type', 'variant_drift',
      'product_id', p.id,
      'name', p.name,
      'stock_quantity', COALESCE(p.stock_quantity, 0),
      'variant_sum', public.product_variant_stock_sum(p.variants)
    )
    FROM public.products p
    WHERE p.owner_id = p_owner_id
      AND p.variants IS NOT NULL
      AND jsonb_typeof(p.variants) = 'array'
      AND jsonb_array_length(p.variants) > 0
      AND public.product_variant_stock_sum(p.variants) > 0
      AND COALESCE(p.stock_quantity, 0) < public.product_variant_stock_sum(p.variants)
    LIMIT 50
  LOOP
    v_variant_drift := v_variant_drift + 1;
    v_issues := v_issues || jsonb_build_array(v_issue);
  END LOOP;

  -- Duplicate initial_stock ledger rows
  FOR v_issue IN
    SELECT jsonb_build_object(
      'type', 'duplicate_initial_stock',
      'product_id', im.product_id,
      'count', COUNT(*)::INT
    )
    FROM public.inventory_movements im
    WHERE im.owner_id = p_owner_id
      AND im.reason = 'initial_stock'
    GROUP BY im.product_id
    HAVING COUNT(*) > 1
    LIMIT 50
  LOOP
    v_duplicate_initial := v_duplicate_initial + 1;
    v_issues := v_issues || jsonb_build_array(v_issue);
  END LOOP;

  -- Products with stock but no ledger movement (warning — pre-v45 imports)
  FOR v_issue IN
    SELECT jsonb_build_object(
      'type', 'missing_initial_stock',
      'product_id', p.id,
      'name', p.name,
      'stock_quantity', p.stock_quantity
    )
    FROM public.products p
    WHERE p.owner_id = p_owner_id
      AND COALESCE(p.stock_quantity, 0) > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.inventory_movements im
        WHERE im.product_id = p.id AND im.owner_id = p_owner_id
      )
    LIMIT 50
  LOOP
    v_missing_initial := v_missing_initial + 1;
    v_issues := v_issues || jsonb_build_array(v_issue);
  END LOOP;

  -- Ledger net != current stock (direct UPDATE bypass or legacy data)
  FOR v_issue IN
    SELECT jsonb_build_object(
      'type', 'ledger_mismatch',
      'product_id', p.id,
      'name', p.name,
      'stock_quantity', p.stock_quantity,
      'ledger_net', COALESCE(SUM(im.quantity_delta), 0)::INT
    )
    FROM public.products p
    LEFT JOIN public.inventory_movements im
      ON im.product_id = p.id AND im.owner_id = p_owner_id
    WHERE p.owner_id = p_owner_id
      AND p.stock_quantity IS NOT NULL
    GROUP BY p.id, p.name, p.stock_quantity
    HAVING p.stock_quantity <> COALESCE(SUM(im.quantity_delta), 0)::INT
    LIMIT 50
  LOOP
    v_ledger_mismatch := v_ledger_mismatch + 1;
    v_issues := v_issues || jsonb_build_array(v_issue);
  END LOOP;

  -- Orphan movement rows (product deleted)
  SELECT COUNT(*)::INT
  INTO v_orphan_movements
  FROM public.inventory_movements im
  WHERE im.owner_id = p_owner_id
    AND NOT EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = im.product_id AND p.owner_id = p_owner_id
    );

  IF v_orphan_movements > 0 THEN
    v_issues := v_issues || jsonb_build_array(
      jsonb_build_object(
        'type', 'orphan_movements',
        'count', v_orphan_movements
      )
    );
  END IF;

  -- Draft/archived flagged as active storefront (data anomaly)
  SELECT COUNT(*)::INT
  INTO v_draft_visible
  FROM public.products p
  WHERE p.owner_id = p_owner_id
    AND p.archived_at IS NOT NULL
    AND COALESCE(p.is_active, true) = true;

  IF v_draft_visible > 0 THEN
    v_issues := v_issues || jsonb_build_array(
      jsonb_build_object(
        'type', 'archived_still_active',
        'count', v_draft_visible
      )
    );
  END IF;

  v_score := GREATEST(
    0,
    100
      - (v_negative * 15)
      - (v_variant_drift * 5)
      - (v_duplicate_initial * 10)
      - LEAST(v_missing_initial * 2, 20)
      - LEAST(v_ledger_mismatch * 3, 25)
      - LEAST(v_orphan_movements, 10)
      - (v_draft_visible * 5)
  );

  RETURN jsonb_build_object(
    'success', true,
    'score', v_score,
    'total_products', v_total,
    'issues_count',
      v_negative + v_variant_drift + v_duplicate_initial + v_missing_initial
      + v_ledger_mismatch
      + CASE WHEN v_orphan_movements > 0 THEN 1 ELSE 0 END
      + CASE WHEN v_draft_visible > 0 THEN 1 ELSE 0 END,
    'summary', jsonb_build_object(
      'negative_stock', v_negative,
      'variant_drift', v_variant_drift,
      'duplicate_initial_stock', v_duplicate_initial,
      'missing_initial_stock', v_missing_initial,
      'ledger_mismatch', v_ledger_mismatch,
      'orphan_movements', v_orphan_movements,
      'archived_still_active', v_draft_visible
    ),
    'issues', v_issues
  );
END;
$$;

REVOKE ALL ON FUNCTION public.audit_merchant_inventory_integrity(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_merchant_inventory_integrity(UUID) TO authenticated;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (53, 'inventory_architecture: integrity audit RPC + non-negative stock CHECK')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
