-- v64: Phase 4 — Transaction integrity & atomic operations hardening
-- Unique ledger constraints, cancel-restore locking, atomic product create, refund locking

-- ---------------------------------------------------------------------------
-- 1) Dedupe inventory_movements before partial unique indexes
-- ---------------------------------------------------------------------------
DELETE FROM public.inventory_movements a
USING public.inventory_movements b
WHERE a.reason = 'initial_stock'
  AND b.reason = 'initial_stock'
  AND a.owner_id = b.owner_id
  AND a.product_id = b.product_id
  AND a.created_at > b.created_at;

DELETE FROM public.inventory_movements a
USING public.inventory_movements b
WHERE a.reason = 'order_created'
  AND b.reason = 'order_created'
  AND a.order_id IS NOT NULL
  AND b.order_id IS NOT NULL
  AND a.order_id = b.order_id
  AND a.product_id = b.product_id
  AND a.created_at > b.created_at;

DELETE FROM public.inventory_movements a
USING public.inventory_movements b
WHERE a.reason = 'order_cancelled'
  AND b.reason = 'order_cancelled'
  AND a.order_id IS NOT NULL
  AND b.order_id IS NOT NULL
  AND a.order_id = b.order_id
  AND a.product_id = b.product_id
  AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_movements_initial_stock_once
  ON public.inventory_movements (owner_id, product_id)
  WHERE reason = 'initial_stock';

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_movements_order_created_once
  ON public.inventory_movements (order_id, product_id)
  WHERE reason = 'order_created' AND order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_movements_order_cancelled_once
  ON public.inventory_movements (order_id, product_id)
  WHERE reason = 'order_cancelled' AND order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_refunds_idempotency_once
  ON public.order_refunds (order_id, owner_id, ((metadata->>'idempotency_key')))
  WHERE metadata->>'idempotency_key' IS NOT NULL
    AND trim(metadata->>'idempotency_key') <> '';

COMMENT ON INDEX public.idx_inventory_movements_initial_stock_once IS
  'Phase 4: one initial_stock ledger row per product — prevents duplicate opening balance';
COMMENT ON INDEX public.idx_inventory_movements_order_created_once IS
  'Phase 4: one order_created movement per order line SKU — prevents double deduction ledger';
COMMENT ON INDEX public.idx_inventory_movements_order_cancelled_once IS
  'Phase 4: one order_cancelled movement per order line SKU — prevents double restore';

-- ---------------------------------------------------------------------------
-- 2) record_product_initial_stock — constraint-backed idempotency
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
  v_inserted INT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF p_product_id IS NULL OR p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN jsonb_build_object('success', true, 'skipped', true);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('initial_stock:' || p_product_id::text));

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

  INSERT INTO public.inventory_movements (product_id, owner_id, quantity_delta, reason)
  VALUES (p_product_id, p_owner_id, p_quantity, 'initial_stock')
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'initial_stock_failed');
END;
$$;

-- ---------------------------------------------------------------------------
-- 3) record_initial_stock_movements — per-product advisory lock + ON CONFLICT
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
  v_inserted INT;
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

    PERFORM pg_advisory_xact_lock(hashtext('initial_stock:' || v_product_id::text));

    IF NOT EXISTS (
      SELECT 1 FROM public.products
      WHERE id = v_product_id AND owner_id = p_owner_id
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.inventory_movements (product_id, owner_id, quantity_delta, reason)
    VALUES (v_product_id, p_owner_id, v_qty, 'initial_stock')
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted > 0 THEN
      v_recorded := v_recorded + 1;
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'recorded', v_recorded, 'skipped', v_skipped);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'batch_initial_stock_failed');
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) restore_stock_on_order_cancel — advisory lock + idempotent ledger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_stock_on_order_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  oi RECORD;
  v_size TEXT;
  v_color TEXT;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status = 'pending' THEN
    PERFORM pg_advisory_xact_lock(hashtext('order_cancel_restore:' || NEW.id::text));

    IF EXISTS (
      SELECT 1 FROM public.inventory_movements
      WHERE order_id = NEW.id AND reason = 'order_cancelled'
      LIMIT 1
    ) THEN
      RETURN NEW;
    END IF;

    UPDATE products p
    SET stock_quantity = p.stock_quantity + oi.quantity,
        updated_at = NOW()
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND oi.product_id = p.id
      AND p.owner_id = NEW.owner_id;

    FOR oi IN
      SELECT product_id, quantity, variant_metadata
      FROM order_items
      WHERE order_id = NEW.id
    LOOP
      v_size := NULLIF(trim(oi.variant_metadata->>'selected_size'), '');
      v_color := NULLIF(trim(oi.variant_metadata->>'selected_color'), '');

      IF v_size IS NOT NULL OR v_color IS NOT NULL THEN
        UPDATE products p
        SET variants = adjust_product_variants(p.variants, v_size, v_color, oi.quantity),
            updated_at = NOW()
        WHERE p.id = oi.product_id AND p.owner_id = NEW.owner_id;
      END IF;
    END LOOP;

    INSERT INTO public.inventory_movements (order_id, product_id, owner_id, quantity_delta, reason)
    SELECT NEW.id, oi.product_id, NEW.owner_id, oi.quantity, 'order_cancelled'
    FROM order_items oi
    WHERE oi.order_id = NEW.id
    ON CONFLICT DO NOTHING;

    IF NEW.coupon_code IS NOT NULL AND trim(NEW.coupon_code) <> '' THEN
      UPDATE marketing_coupons
      SET used_count = GREATEST(0, used_count - 1), updated_at = NOW()
      WHERE owner_id = NEW.owner_id
        AND upper(code) = upper(trim(NEW.coupon_code))
        AND used_count > 0;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_cancel_restore_stock_trigger ON public.orders;
CREATE TRIGGER order_cancel_restore_stock_trigger
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.restore_stock_on_order_cancel();

-- ---------------------------------------------------------------------------
-- 5) record_order_refund — row lock + idempotency advisory lock
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_order_refund(
  p_order_id UUID,
  p_owner_id UUID,
  p_amount DECIMAL,
  p_reason TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_refund_id UUID;
  v_refunded_total DECIMAL;
  v_existing UUID;
  v_key TEXT;
BEGIN
  IF p_owner_id IS NULL OR p_owner_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  v_key := NULLIF(trim(COALESCE(p_idempotency_key, '')), '');

  IF v_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('refund:' || p_order_id::text || ':' || v_key));

    SELECT id INTO v_existing
    FROM public.order_refunds
    WHERE order_id = p_order_id
      AND owner_id = p_owner_id
      AND metadata->>'idempotency_key' = v_key
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'refund_id', v_existing, 'idempotent', true);
    END IF;
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id AND owner_id = p_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order.status <> 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Refunds only allowed for completed orders');
  END IF;

  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid refund amount');
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_refunded_total
  FROM public.order_refunds
  WHERE order_id = p_order_id AND owner_id = p_owner_id AND status = 'completed';

  IF v_refunded_total + p_amount > v_order.total_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Refund exceeds remaining balance',
      'remaining', v_order.total_amount - v_refunded_total
    );
  END IF;

  INSERT INTO public.order_refunds (order_id, owner_id, amount, status, reason, metadata)
  VALUES (
    p_order_id,
    p_owner_id,
    p_amount,
    'completed',
    p_reason,
    CASE
      WHEN v_key IS NOT NULL THEN jsonb_build_object('idempotency_key', v_key)
      ELSE '{}'::jsonb
    END
  )
  RETURNING id INTO v_refund_id;

  UPDATE public.payment_transactions
  SET status = 'refunded', updated_at = NOW()
  WHERE order_id = p_order_id AND owner_id = p_owner_id;

  UPDATE public.orders
  SET payment_status = 'refunded', updated_at = NOW()
  WHERE id = p_order_id AND owner_id = p_owner_id;

  RETURN jsonb_build_object('success', true, 'refund_id', v_refund_id);
EXCEPTION
  WHEN unique_violation THEN
    IF v_key IS NOT NULL THEN
      SELECT id INTO v_existing
      FROM public.order_refunds
      WHERE order_id = p_order_id
        AND owner_id = p_owner_id
        AND metadata->>'idempotency_key' = v_key
      LIMIT 1;
      IF v_existing IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'refund_id', v_existing, 'idempotent', true);
      END IF;
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'duplicate_refund');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'refund_failed');
END;
$$;

REVOKE ALL ON FUNCTION public.record_order_refund(UUID, UUID, DECIMAL, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_order_refund(UUID, UUID, DECIMAL, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6) create_merchant_product_with_stock — single-transaction product + ledger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_merchant_product_with_stock(
  p_owner_id UUID,
  p_payload JSONB,
  p_initial_stock INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id UUID;
  v_store_id UUID;
  v_stock INT;
  v_inserted INT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_payload');
  END IF;

  IF NULLIF(trim(p_payload->>'name'), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'name_required');
  END IF;

  IF NULLIF(trim(p_payload->>'image_url'), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'image_required');
  END IF;

  v_store_id := NULLIF(p_payload->>'store_id', '')::UUID;
  IF v_store_id IS NOT NULL AND v_store_id NOT IN (SELECT public.auth_user_store_ids()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  v_stock := GREATEST(COALESCE(p_initial_stock, (p_payload->>'stock_quantity')::INT, 0), 0);

  INSERT INTO public.products (
    owner_id,
    store_id,
    name,
    description,
    short_description,
    category,
    price,
    cost,
    original_price,
    image_url,
    additional_images,
    stock_quantity,
    sizes,
    colors,
    variants,
    is_active,
    archived_at,
    min_stock_level,
    low_stock_threshold,
    sku,
    seo_title,
    seo_description,
    product_slug,
    tags
  ) VALUES (
    p_owner_id,
    v_store_id,
    trim(p_payload->>'name'),
    NULLIF(p_payload->>'description', ''),
    NULLIF(p_payload->>'short_description', ''),
    COALESCE(NULLIF(p_payload->>'category', ''), ''),
    GREATEST(COALESCE((p_payload->>'price')::numeric, 0), 0),
    NULLIF(p_payload->>'cost', '')::numeric,
    NULLIF(p_payload->>'original_price', '')::numeric,
    trim(p_payload->>'image_url'),
    COALESCE(p_payload->'additional_images', '[]'::jsonb),
    v_stock,
    CASE
      WHEN p_payload ? 'sizes' AND jsonb_typeof(p_payload->'sizes') = 'array' THEN
        ARRAY(SELECT jsonb_array_elements_text(p_payload->'sizes'))
      ELSE NULL
    END,
    CASE
      WHEN p_payload ? 'colors' AND jsonb_typeof(p_payload->'colors') <> 'null' THEN p_payload->'colors'
      ELSE NULL
    END,
    CASE
      WHEN p_payload ? 'variants' AND jsonb_typeof(p_payload->'variants') <> 'null' THEN p_payload->'variants'
      ELSE NULL
    END,
    COALESCE((p_payload->>'is_active')::boolean, true),
    NULLIF(p_payload->>'archived_at', '')::timestamptz,
    COALESCE((p_payload->>'min_stock_level')::int, (p_payload->>'low_stock_threshold')::int, 3),
    COALESCE((p_payload->>'low_stock_threshold')::int, 3),
    NULLIF(p_payload->>'sku', ''),
    NULLIF(p_payload->>'seo_title', ''),
    NULLIF(p_payload->>'seo_description', ''),
    NULLIF(p_payload->>'product_slug', ''),
    CASE
      WHEN p_payload ? 'tags' AND jsonb_typeof(p_payload->'tags') = 'array' THEN
        ARRAY(SELECT jsonb_array_elements_text(p_payload->'tags'))
      ELSE NULL
    END
  )
  RETURNING id INTO v_product_id;

  IF v_stock > 0 THEN
    INSERT INTO public.inventory_movements (product_id, owner_id, quantity_delta, reason)
    VALUES (v_product_id, p_owner_id, v_stock, 'initial_stock')
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted = 0 THEN
      -- Product created but ledger already exists (should not happen on new id) — still success
      NULL;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'product_id', v_product_id,
    'initial_stock', v_stock
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'duplicate_product');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'product_create_failed', 'detail', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.create_merchant_product_with_stock(UUID, JSONB, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_merchant_product_with_stock(UUID, JSONB, INT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7) process_product_import_batch — fail row libary row on ledger failure
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_product_import_batch(
  p_job_id uuid,
  p_batch_size int DEFAULT 25
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.import_jobs%ROWTYPE;
  v_limit int := LEAST(GREATEST(COALESCE(p_batch_size, 25), 1), 50);
  v_slice jsonb;
  v_rec record;
  v_idx int;
  v_end int;
  v_product_id uuid;
  v_stock int;
  v_success int := 0;
  v_failed int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_stock_result jsonb;
BEGIN
  SELECT * INTO v_job
  FROM public.import_jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_not_found');
  END IF;

  IF auth.uid() IS NULL OR auth.uid() <> v_job.owner_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_job.status IN ('completed', 'failed', 'cancelled') THEN
    RETURN jsonb_build_object(
      'success', true,
      'job_id', v_job.id,
      'status', v_job.status,
      'processed_rows', v_job.processed_rows,
      'total_rows', v_job.total_rows,
      'done', true
    );
  END IF;

  IF v_job.status = 'pending' THEN
    UPDATE public.import_jobs
    SET status = 'processing', started_at = COALESCE(started_at, now())
    WHERE id = v_job.id;
  END IF;

  v_end := LEAST(v_job.processed_rows + v_limit, v_job.total_rows) - 1;
  IF v_end < v_job.processed_rows THEN
    UPDATE public.import_jobs
    SET status = 'completed', completed_at = now()
    WHERE id = v_job.id;

    RETURN jsonb_build_object(
      'success', true,
      'job_id', v_job.id,
      'status', 'completed',
      'processed_rows', v_job.processed_rows,
      'total_rows', v_job.total_rows,
      'done', true
    );
  END IF;

  v_slice := '[]'::jsonb;
  FOR v_idx IN v_job.processed_rows .. v_end LOOP
    v_slice := v_slice || jsonb_build_array(v_job.payload -> v_idx);
  END LOOP;

  FOR v_rec IN
    SELECT value, ord::int AS row_index
    FROM jsonb_array_elements(v_slice) WITH ORDINALITY AS t(value, ord)
  LOOP
    BEGIN
      IF NULLIF(trim(v_rec.value ->> 'name'), '') IS NULL THEN
        v_failed := v_failed + 1;
        v_errors := v_errors || jsonb_build_array(
          jsonb_build_object('row', v_job.processed_rows + v_rec.row_index - 1, 'error', 'name_required')
        );
        CONTINUE;
      END IF;

      v_stock := GREATEST(COALESCE((v_rec.value ->> 'stock_quantity')::int, 0), 0);

      INSERT INTO public.products (
        owner_id, store_id, name, description, category, price, cost,
        stock_quantity, sizes, image_url, is_active
      ) VALUES (
        v_job.owner_id,
        v_job.store_id,
        trim(v_rec.value ->> 'name'),
        COALESCE(v_rec.value ->> 'description', ''),
        COALESCE(v_rec.value ->> 'category', ''),
        GREATEST(COALESCE((v_rec.value ->> 'price')::numeric, 0), 0),
        NULLIF(v_rec.value ->> 'cost', '')::numeric,
        v_stock,
        CASE
          WHEN v_rec.value ? 'sizes' AND jsonb_typeof(v_rec.value -> 'sizes') = 'array' THEN
            ARRAY(SELECT jsonb_array_elements_text(v_rec.value -> 'sizes'))
          ELSE NULL
        END,
        NULLIF(v_rec.value ->> 'image_url', ''),
        false
      )
      RETURNING id INTO v_product_id;

      IF v_stock > 0 THEN
        v_stock_result := public.record_product_initial_stock(v_product_id, v_job.owner_id, v_stock);
        IF COALESCE((v_stock_result->>'success')::boolean, false) IS NOT TRUE THEN
          DELETE FROM public.products WHERE id = v_product_id AND owner_id = v_job.owner_id;
          RAISE EXCEPTION 'initial_stock_failed';
        END IF;
      END IF;

      v_success := v_success + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_errors := v_errors || jsonb_build_array(
        jsonb_build_object('row', v_job.processed_rows + v_rec.row_index - 1, 'error', SQLERRM)
      );
    END;
  END LOOP;

  UPDATE public.import_jobs
  SET processed_rows = v_end + 1,
      success_count = success_count + v_success,
      failed_count = failed_count + v_failed,
      errors = errors || v_errors,
      status = CASE WHEN v_end + 1 >= total_rows THEN 'completed' ELSE 'processing' END,
      completed_at = CASE WHEN v_end + 1 >= total_rows THEN now() ELSE completed_at END
  WHERE id = v_job.id
  RETURNING * INTO v_job;

  RETURN jsonb_build_object(
    'success', true,
    'job_id', v_job.id,
    'status', v_job.status,
    'processed_rows', v_job.processed_rows,
    'total_rows', v_job.total_rows,
    'batch_success', v_success,
    'batch_failed', v_failed,
    'done', v_job.status = 'completed'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 8) platform_transaction_integrity_audit — verification RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_transaction_integrity_audit()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dup_initial bigint;
  v_dup_order_created bigint;
  v_dup_order_cancelled bigint;
  v_negative_stock bigint;
  v_orphan_movements bigint;
BEGIN
  SELECT COUNT(*) INTO v_dup_initial
  FROM (
    SELECT owner_id, product_id
    FROM public.inventory_movements
    WHERE reason = 'initial_stock'
    GROUP BY owner_id, product_id
    HAVING COUNT(*) > 1
  ) t;

  SELECT COUNT(*) INTO v_dup_order_created
  FROM (
    SELECT order_id, product_id
    FROM public.inventory_movements
    WHERE reason = 'order_created' AND order_id IS NOT NULL
    GROUP BY order_id, product_id
    HAVING COUNT(*) > 1
  ) t;

  SELECT COUNT(*) INTO v_dup_order_cancelled
  FROM (
    SELECT order_id, product_id
    FROM public.inventory_movements
    WHERE reason = 'order_cancelled' AND order_id IS NOT NULL
    GROUP BY order_id, product_id
    HAVING COUNT(*) > 1
  ) t;

  SELECT COUNT(*) INTO v_negative_stock
  FROM public.products
  WHERE stock_quantity IS NOT NULL AND stock_quantity < 0;

  SELECT COUNT(*) INTO v_orphan_movements
  FROM public.inventory_movements im
  LEFT JOIN public.products p ON p.id = im.product_id
  WHERE p.id IS NULL;

  RETURN jsonb_build_object(
    'success', true,
    'schema_version', (SELECT MAX(version) FROM public.platform_schema_version),
    'duplicate_initial_stock', v_dup_initial,
    'duplicate_order_created', v_dup_order_created,
    'duplicate_order_cancelled', v_dup_order_cancelled,
    'negative_stock_rows', v_negative_stock,
    'orphan_inventory_movements', v_orphan_movements,
    'constraints', jsonb_build_object(
      'initial_stock_unique', EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_inventory_movements_initial_stock_once'
      ),
      'order_created_unique', EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_inventory_movements_order_created_once'
      ),
      'order_cancelled_unique', EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_inventory_movements_order_cancelled_once'
      ),
      'orders_idempotency_unique', EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname LIKE '%orders%idempotency%'
      )
    ),
    'healthy',
      v_dup_initial = 0
      AND v_dup_order_created = 0
      AND v_dup_order_cancelled = 0
      AND v_negative_stock = 0
      AND v_orphan_movements = 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_transaction_integrity_audit() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_transaction_integrity_audit() TO service_role;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (64, 'phase4_transaction_integrity: unique ledger indexes, cancel lock, atomic product create, refund lock')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
