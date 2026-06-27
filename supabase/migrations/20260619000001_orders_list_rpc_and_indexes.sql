-- Order list RPC (server-side filter + pagination) and search indexes

CREATE INDEX IF NOT EXISTS idx_orders_owner_customer_phone
  ON public.orders (owner_id, customer_phone);

CREATE INDEX IF NOT EXISTS idx_orders_owner_payment_status
  ON public.orders (owner_id, payment_status);

CREATE INDEX IF NOT EXISTS idx_orders_owner_delivery_status
  ON public.orders (owner_id, delivery_status);

CREATE INDEX IF NOT EXISTS idx_orders_owner_total_amount
  ON public.orders (owner_id, total_amount);

CREATE OR REPLACE FUNCTION public.order_workflow_category(
  p_status text,
  p_payment_status text,
  p_delivery_status text
) RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_status = 'cancelled' THEN 'cancelled'
    WHEN COALESCE(p_payment_status, 'pending_collection') IN ('refunded', 'partially_refunded') THEN 'refunded'
    WHEN COALESCE(p_delivery_status, 'pending') = 'delivered' OR p_status = 'completed' THEN 'delivered'
    WHEN COALESCE(p_delivery_status, 'pending') IN ('shipped', 'out_for_delivery') THEN 'shipped'
    WHEN COALESCE(p_payment_status, 'pending_collection') IN ('paid', 'collected') THEN 'paid'
    WHEN COALESCE(p_delivery_status, 'pending') = 'preparing' THEN 'processing'
    WHEN p_status = 'pending' THEN 'new'
    ELSE 'new'
  END;
$$;

CREATE OR REPLACE FUNCTION public.merchant_orders_base_filter(
  p_owner_id uuid,
  p_search text DEFAULT NULL,
  p_order_status text DEFAULT 'all',
  p_payment_status text DEFAULT 'all',
  p_delivery_status text DEFAULT 'all',
  p_workflow_tab text DEFAULT 'all',
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_min_value numeric DEFAULT NULL,
  p_max_value numeric DEFAULT NULL
) RETURNS SETOF public.orders
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.*
  FROM public.orders o
  WHERE o.owner_id = p_owner_id
    AND auth.uid() = p_owner_id
    AND (p_order_status = 'all' OR o.status = p_order_status)
    AND (p_payment_status = 'all' OR COALESCE(o.payment_status, 'pending_collection') = p_payment_status)
    AND (p_delivery_status = 'all' OR COALESCE(o.delivery_status, 'pending') = p_delivery_status)
    AND (p_workflow_tab = 'all' OR public.order_workflow_category(o.status, o.payment_status, o.delivery_status) = p_workflow_tab)
    AND (p_date_from IS NULL OR o.created_at >= p_date_from)
    AND (p_date_to IS NULL OR o.created_at <= p_date_to)
    AND (p_min_value IS NULL OR o.total_amount >= p_min_value)
    AND (p_max_value IS NULL OR o.total_amount <= p_max_value)
    AND (
      p_search IS NULL OR btrim(p_search) = '' OR
      o.customer_name ILIKE '%' || p_search || '%' OR
      o.customer_phone ILIKE '%' || p_search || '%' OR
      replace(o.id::text, '-', '') ILIKE '%' || replace(btrim(p_search), '-', '') || '%'
    );
$$;

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
  p_max_value numeric DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
  v_orders jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM public.merchant_orders_base_filter(
    p_owner_id, p_search, p_order_status, p_payment_status, p_delivery_status,
    p_workflow_tab, p_date_from, p_date_to, p_min_value, p_max_value
  );

  SELECT COALESCE(jsonb_agg(row_data ORDER BY sort_created DESC), '[]'::jsonb)
  INTO v_orders
  FROM (
    SELECT
      jsonb_build_object(
        'id', o.id,
        'status', o.status,
        'total_amount', o.total_amount,
        'created_at', o.created_at,
        'updated_at', o.updated_at,
        'customer_name', o.customer_name,
        'customer_phone', o.customer_phone,
        'customer_address', o.customer_address,
        'customer_governorate', o.customer_governorate,
        'notes', o.notes,
        'delivery_fee', o.delivery_fee,
        'delivery_status', o.delivery_status,
        'payment_method', o.payment_method,
        'payment_status', o.payment_status,
        'coupon_code', o.coupon_code,
        'discount_amount', o.discount_amount,
        'order_items', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', oi.id,
              'product_id', oi.product_id,
              'product_name', oi.product_name,
              'product_price', oi.product_price,
              'quantity', oi.quantity,
              'subtotal', oi.subtotal,
              'variant_metadata', oi.variant_metadata
            )
          )
          FROM public.order_items oi
          WHERE oi.order_id = o.id
        ), '[]'::jsonb)
      ) AS row_data,
      o.created_at AS sort_created
    FROM public.merchant_orders_base_filter(
      p_owner_id, p_search, p_order_status, p_payment_status, p_delivery_status,
      p_workflow_tab, p_date_from, p_date_to, p_min_value, p_max_value
    ) o
    ORDER BY o.created_at DESC
    LIMIT GREATEST(p_page_size, 1)
    OFFSET GREATEST(p_page, 0) * GREATEST(p_page_size, 1)
  ) sub;

  RETURN jsonb_build_object(
    'total', v_total,
    'page', GREATEST(p_page, 0),
    'page_size', GREATEST(p_page_size, 1),
    'orders', v_orders
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.count_merchant_orders_by_workflow(
  p_owner_id uuid,
  p_search text DEFAULT NULL,
  p_order_status text DEFAULT 'all',
  p_payment_status text DEFAULT 'all',
  p_delivery_status text DEFAULT 'all',
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_min_value numeric DEFAULT NULL,
  p_max_value numeric DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_counts jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT jsonb_build_object(
    'all', COUNT(*),
    'new', COUNT(*) FILTER (WHERE public.order_workflow_category(o.status, o.payment_status, o.delivery_status) = 'new'),
    'processing', COUNT(*) FILTER (WHERE public.order_workflow_category(o.status, o.payment_status, o.delivery_status) = 'processing'),
    'paid', COUNT(*) FILTER (WHERE public.order_workflow_category(o.status, o.payment_status, o.delivery_status) = 'paid'),
    'shipped', COUNT(*) FILTER (WHERE public.order_workflow_category(o.status, o.payment_status, o.delivery_status) = 'shipped'),
    'delivered', COUNT(*) FILTER (WHERE public.order_workflow_category(o.status, o.payment_status, o.delivery_status) = 'delivered'),
    'cancelled', COUNT(*) FILTER (WHERE public.order_workflow_category(o.status, o.payment_status, o.delivery_status) = 'cancelled'),
    'refunded', COUNT(*) FILTER (WHERE public.order_workflow_category(o.status, o.payment_status, o.delivery_status) = 'refunded')
  )
  INTO v_counts
  FROM public.merchant_orders_base_filter(
    p_owner_id, p_search, p_order_status, p_payment_status, p_delivery_status,
    'all', p_date_from, p_date_to, p_min_value, p_max_value
  ) o;

  RETURN v_counts;
END;
$$;

GRANT EXECUTE ON FUNCTION public.order_workflow_category(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merchant_orders_base_filter(uuid, text, text, text, text, text, timestamptz, timestamptz, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_merchant_orders(uuid, int, int, text, text, text, text, text, timestamptz, timestamptz, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_merchant_orders_by_workflow(uuid, text, text, text, text, timestamptz, timestamptz, numeric, numeric) TO authenticated;
