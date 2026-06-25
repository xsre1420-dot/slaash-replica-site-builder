-- v58: Platform recommendations bundle
-- product idempotency, import_jobs queue, orders keyset cursor, store_visits TTL prune

-- ---------------------------------------------------------------------------
-- 1) Server-side product create idempotency
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_create_idempotency (
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 8 AND 128),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_product_create_idempotency_product
  ON public.product_create_idempotency (product_id);

ALTER TABLE public.product_create_idempotency ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_create_idempotency_select ON public.product_create_idempotency;
CREATE POLICY product_create_idempotency_select ON public.product_create_idempotency
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.lookup_product_idempotency(
  p_owner_id uuid,
  p_key text
) RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN (
    SELECT product_id
    FROM public.product_create_idempotency
    WHERE owner_id = p_owner_id
      AND idempotency_key = NULLIF(trim(p_key), '')
    LIMIT 1
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_product_idempotency(
  p_owner_id uuid,
  p_key text,
  p_product_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NULLIF(trim(p_key), '') IS NULL OR p_product_id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.product_create_idempotency (owner_id, idempotency_key, product_id)
  VALUES (p_owner_id, trim(p_key), p_product_id)
  ON CONFLICT (owner_id, idempotency_key) DO NOTHING;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_product_idempotency(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_product_idempotency(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.record_product_idempotency(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_product_idempotency(uuid, text, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) import_jobs — background CSV product import
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  job_type text NOT NULL DEFAULT 'product_csv'
    CHECK (job_type IN ('product_csv')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  total_rows int NOT NULL DEFAULT 0 CHECK (total_rows >= 0),
  processed_rows int NOT NULL DEFAULT 0 CHECK (processed_rows >= 0),
  success_count int NOT NULL DEFAULT 0 CHECK (success_count >= 0),
  failed_count int NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  payload jsonb NOT NULL DEFAULT '[]'::jsonb,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_pending
  ON public.import_jobs (status, created_at)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_import_jobs_owner
  ON public.import_jobs (owner_id, created_at DESC);

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS import_jobs_owner_all ON public.import_jobs;
CREATE POLICY import_jobs_owner_all ON public.import_jobs
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.enqueue_product_import_job(
  p_owner_id uuid,
  p_store_id uuid,
  p_rows jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb := COALESCE(p_rows, '[]'::jsonb);
  v_count int;
  v_job_id uuid;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF jsonb_typeof(v_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows must be a JSON array';
  END IF;

  v_count := jsonb_array_length(v_rows);
  IF v_count < 1 OR v_count > 5000 THEN
    RAISE EXCEPTION 'Row count must be between 1 and 5000';
  END IF;

  INSERT INTO public.import_jobs (owner_id, store_id, total_rows, payload)
  VALUES (p_owner_id, p_store_id, v_count, v_rows)
  RETURNING id INTO v_job_id;

  RETURN jsonb_build_object(
    'success', true,
    'job_id', v_job_id,
    'total_rows', v_count,
    'status', 'pending'
  );
END;
$$;

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
        PERFORM public.record_product_initial_stock(v_product_id, v_job.owner_id, v_stock);
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

REVOKE ALL ON FUNCTION public.enqueue_product_import_job(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_product_import_job(uuid, uuid, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.process_product_import_batch(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_product_import_batch(uuid, int) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) list_merchant_orders — optional keyset cursor (created_at|id)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.list_merchant_orders(
  uuid, int, int, text, text, text, text, text, timestamptz, timestamptz, numeric, numeric
);

CREATE OR REPLACE FUNCTION public.list_merchant_orders(
  p_owner_id uuid,
  p_page int DEFAULT 0,
  p_page_size int DEFAULT 50,
  p_search text DEFAULT NULL,
  p_workflow_tab text DEFAULT 'all',
  p_order_status text DEFAULT 'all',
  p_payment_status text DEFAULT 'all',
  p_delivery_status text DEFAULT 'all',
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_min_value numeric DEFAULT NULL,
  p_max_value numeric DEFAULT NULL,
  p_cursor text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
  v_orders jsonb;
  v_limit int;
  v_offset int;
  v_cursor_ts timestamptz;
  v_cursor_id uuid;
  v_use_keyset boolean := false;
  v_next_cursor text := NULL;
  v_last_created timestamptz;
  v_last_id uuid;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 100);

  IF NULLIF(trim(p_cursor), '') IS NOT NULL AND position('|' IN trim(p_cursor)) > 0 THEN
    v_cursor_ts := split_part(trim(p_cursor), '|', 1)::timestamptz;
    v_cursor_id := split_part(trim(p_cursor), '|', 2)::uuid;
    v_use_keyset := true;
  ELSE
    v_offset := GREATEST(COALESCE(p_page, 0), 0) * v_limit;
  END IF;

  WITH filtered AS (
    SELECT o.*
    FROM public.merchant_orders_base_filter(
      p_owner_id, p_search, p_order_status, p_payment_status, p_delivery_status,
      p_workflow_tab, p_date_from, p_date_to, p_min_value, p_max_value
    ) o
  ),
  total_cte AS (
    SELECT COUNT(*)::bigint AS cnt FROM filtered
  ),
  page_orders AS (
    SELECT f.*
    FROM filtered f
    WHERE (
      NOT v_use_keyset
      OR (f.created_at, f.id) < (v_cursor_ts, v_cursor_id)
    )
    ORDER BY f.created_at DESC, f.id DESC
    LIMIT v_limit
    OFFSET CASE WHEN v_use_keyset THEN 0 ELSE v_offset END
  ),
  items_by_order AS (
    SELECT
      oi.order_id,
      jsonb_agg(
        jsonb_build_object('id', oi.id, 'product_id', oi.product_id)
        ORDER BY oi.id
      ) AS order_items
    FROM public.order_items oi
    INNER JOIN page_orders po ON po.id = oi.order_id
    GROUP BY oi.order_id
  )
  SELECT
    (SELECT cnt FROM total_cte),
    COALESCE(jsonb_agg(sub.row_data ORDER BY sub.sort_created DESC, sub.sort_id DESC), '[]'::jsonb),
    (array_agg(sub.sort_created ORDER BY sub.sort_created ASC, sub.sort_id ASC))[1],
    (array_agg(sub.sort_id ORDER BY sub.sort_created ASC, sub.sort_id ASC))[1]
  INTO v_total, v_orders, v_last_created, v_last_id
  FROM (
    SELECT
      jsonb_build_object(
        'id', po.id,
        'status', po.status,
        'total_amount', po.total_amount,
        'created_at', po.created_at,
        'updated_at', po.updated_at,
        'customer_name', po.customer_name,
        'customer_phone', po.customer_phone,
        'customer_address', po.customer_address,
        'customer_governorate', po.customer_governorate,
        'notes', po.notes,
        'delivery_fee', po.delivery_fee,
        'delivery_status', po.delivery_status,
        'payment_method', po.payment_method,
        'payment_status', po.payment_status,
        'coupon_code', po.coupon_code,
        'discount_amount', po.discount_amount,
        'order_items', COALESCE(ib.order_items, '[]'::jsonb)
      ) AS row_data,
      po.created_at AS sort_created,
      po.id AS sort_id
    FROM page_orders po
    LEFT JOIN items_by_order ib ON ib.order_id = po.id
  ) sub;

  IF v_last_created IS NOT NULL AND v_last_id IS NOT NULL
     AND jsonb_array_length(COALESCE(v_orders, '[]'::jsonb)) >= v_limit THEN
    v_next_cursor := v_last_created::text || '|' || v_last_id::text;
  END IF;

  RETURN jsonb_build_object(
    'total', v_total,
    'page', GREATEST(COALESCE(p_page, 0), 0),
    'page_size', v_limit,
    'orders', COALESCE(v_orders, '[]'::jsonb),
    'next_cursor', v_next_cursor
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_merchant_orders(
  uuid, int, int, text, text, text, text, text, timestamptz, timestamptz, numeric, numeric, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_merchant_orders(
  uuid, int, int, text, text, text, text, text, timestamptz, timestamptz, numeric, numeric, text
) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) store_visits retention — TTL prune (run via pg_cron / scheduled worker)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prune_store_visits(p_retention_days int DEFAULT 90)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted bigint;
  v_days int := GREATEST(COALESCE(p_retention_days, 90), 30);
BEGIN
  DELETE FROM public.store_visits
  WHERE created_at < now() - (v_days || ' days')::interval;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_store_visits(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prune_store_visits(int) TO service_role;

COMMENT ON FUNCTION public.prune_store_visits IS
  'Delete store_visits older than retention window. Schedule weekly via pg_cron or edge cron.';
