-- v62: Phase 2 N+1 elimination — embed order line-item fields + product image in list_merchant_orders

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
  v_has_more boolean := false;
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
    SELECT CASE WHEN v_use_keyset THEN NULL::bigint ELSE COUNT(*)::bigint END AS cnt
    FROM filtered
  ),
  fetched AS (
    SELECT f.*
    FROM filtered f
    WHERE (
      NOT v_use_keyset
      OR (f.created_at, f.id) < (v_cursor_ts, v_cursor_id)
    )
    ORDER BY f.created_at DESC, f.id DESC
    LIMIT v_limit + 1
    OFFSET CASE WHEN v_use_keyset THEN 0 ELSE v_offset END
  ),
  page_orders AS (
    SELECT * FROM fetched
    ORDER BY created_at DESC, id DESC
    LIMIT v_limit
  ),
  items_by_order AS (
    SELECT
      oi.order_id,
      jsonb_agg(
        jsonb_build_object(
          'id', oi.id,
          'product_id', oi.product_id,
          'product_name', oi.product_name,
          'product_price', oi.product_price,
          'quantity', oi.quantity,
          'subtotal', oi.subtotal,
          'variant_metadata', oi.variant_metadata,
          'image', p.image_url
        )
        ORDER BY oi.id
      ) AS order_items
    FROM public.order_items oi
    INNER JOIN page_orders po ON po.id = oi.order_id
    LEFT JOIN public.products p
      ON p.id = oi.product_id
      AND p.owner_id = p_owner_id
    GROUP BY oi.order_id
  )
  SELECT
    (SELECT cnt FROM total_cte),
    COALESCE(jsonb_agg(sub.row_data ORDER BY sub.sort_created DESC, sub.sort_id DESC), '[]'::jsonb),
    (SELECT COUNT(*) > v_limit FROM fetched),
    (array_agg(sub.sort_created ORDER BY sub.sort_created ASC, sub.sort_id ASC))[1],
    (array_agg(sub.sort_id ORDER BY sub.sort_created ASC, sub.sort_id ASC))[1]
  INTO v_total, v_orders, v_has_more, v_last_created, v_last_id
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

  IF v_has_more AND v_last_created IS NOT NULL AND v_last_id IS NOT NULL THEN
    v_next_cursor := v_last_created::text || '|' || v_last_id::text;
  END IF;

  RETURN jsonb_build_object(
    'total', v_total,
    'page', GREATEST(COALESCE(p_page, 0), 0),
    'page_size', v_limit,
    'orders', COALESCE(v_orders, '[]'::jsonb),
    'next_cursor', v_next_cursor,
    'has_more', v_has_more
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_merchant_orders(
  uuid, int, int, text, text, text, text, text, timestamptz, timestamptz, numeric, numeric, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_merchant_orders(
  uuid, int, int, text, text, text, text, text, timestamptz, timestamptz, numeric, numeric, text
) TO authenticated;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (62, 'phase2_n_plus_one: list_merchant_orders embeds line items + product image')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
