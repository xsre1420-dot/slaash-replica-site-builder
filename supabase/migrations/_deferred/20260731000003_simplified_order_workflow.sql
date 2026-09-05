-- Simplified merchant order workflow: new | completed | cancelled

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
    WHEN COALESCE(p_payment_status, 'pending_collection') IN ('refunded', 'partially_refunded') THEN 'cancelled'
    WHEN p_status = 'completed' THEN 'completed'
    ELSE 'new'
  END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_order_workflow_tab(p_tab text) RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE COALESCE(NULLIF(btrim(p_tab), ''), 'new')
    WHEN 'all' THEN NULL
    WHEN 'delivered' THEN 'completed'
    WHEN 'processing' THEN 'new'
    WHEN 'paid' THEN 'new'
    WHEN 'shipped' THEN 'new'
    WHEN 'refunded' THEN 'cancelled'
    ELSE p_tab
  END;
$$;

CREATE OR REPLACE FUNCTION public.merchant_orders_base_filter(
  p_owner_id uuid,
  p_search text DEFAULT NULL,
  p_order_status text DEFAULT 'all',
  p_payment_status text DEFAULT 'all',
  p_delivery_status text DEFAULT 'all',
  p_workflow_tab text DEFAULT 'new',
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
    AND (
      public.normalize_order_workflow_tab(p_workflow_tab) IS NULL
      OR public.order_workflow_category(o.status, o.payment_status, o.delivery_status)
         = public.normalize_order_workflow_tab(p_workflow_tab)
    )
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
  v_unfiltered boolean;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_unfiltered :=
    (p_search IS NULL OR btrim(p_search) = '')
    AND COALESCE(p_order_status, 'all') = 'all'
    AND COALESCE(p_payment_status, 'all') = 'all'
    AND COALESCE(p_delivery_status, 'all') = 'all'
    AND p_date_from IS NULL
    AND p_date_to IS NULL
    AND p_min_value IS NULL
    AND p_max_value IS NULL;

  IF v_unfiltered THEN
    SELECT jsonb_build_object(
      'new', COUNT(*) FILTER (WHERE public.order_workflow_category(o.status, o.payment_status, o.delivery_status) = 'new'),
      'completed', COUNT(*) FILTER (WHERE public.order_workflow_category(o.status, o.payment_status, o.delivery_status) = 'completed'),
      'cancelled', COUNT(*) FILTER (WHERE public.order_workflow_category(o.status, o.payment_status, o.delivery_status) = 'cancelled')
    )
    INTO v_counts
    FROM public.orders o
    WHERE o.owner_id = p_owner_id;
  ELSE
    SELECT jsonb_build_object(
      'new', COUNT(*) FILTER (WHERE public.order_workflow_category(o.status, o.payment_status, o.delivery_status) = 'new'),
      'completed', COUNT(*) FILTER (WHERE public.order_workflow_category(o.status, o.payment_status, o.delivery_status) = 'completed'),
      'cancelled', COUNT(*) FILTER (WHERE public.order_workflow_category(o.status, o.payment_status, o.delivery_status) = 'cancelled')
    )
    INTO v_counts
    FROM public.merchant_orders_base_filter(
      p_owner_id, p_search, p_order_status, p_payment_status, p_delivery_status,
      'all', p_date_from, p_date_to, p_min_value, p_max_value
    ) o;
  END IF;

  RETURN v_counts;
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_order_workflow_tab(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_order_workflow_tab(text) TO authenticated;
