-- Analytics accuracy: date-bounded KPI RPC with visit metrics

DROP FUNCTION IF EXISTS public.get_store_statistics(UUID, INT);

CREATE OR REPLACE FUNCTION public.get_store_statistics(
  p_owner_id UUID,
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN NULL;
  END IF;

  IF p_start IS NULL OR p_end IS NULL OR p_end < p_start THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'order_count', (
      SELECT COUNT(*)::INT FROM orders
      WHERE owner_id = p_owner_id
        AND created_at >= p_start
        AND created_at <= p_end
        AND status <> 'cancelled'
    ),
    'completed_order_count', (
      SELECT COUNT(*)::INT FROM orders
      WHERE owner_id = p_owner_id
        AND created_at >= p_start
        AND created_at <= p_end
        AND status = 'completed'
    ),
    'pending_count', (
      SELECT COUNT(*)::INT FROM orders
      WHERE owner_id = p_owner_id
        AND status = 'pending'
        AND created_at >= p_start
        AND created_at <= p_end
    ),
    'completed_revenue', (
      SELECT COALESCE(SUM(total_amount), 0)
      FROM orders
      WHERE owner_id = p_owner_id
        AND status = 'completed'
        AND created_at >= p_start
        AND created_at <= p_end
    ),
    'refund_total', (
      SELECT COALESCE(SUM(r.amount), 0)
      FROM order_refunds r
      JOIN orders o ON o.id = r.order_id
      WHERE r.owner_id = p_owner_id
        AND r.status = 'completed'
        AND o.status = 'completed'
        AND o.created_at >= p_start
        AND o.created_at <= p_end
    ),
    'visit_count', (
      SELECT COUNT(*)::INT FROM store_visits
      WHERE owner_id = p_owner_id
        AND created_at >= p_start
        AND created_at <= p_end
    ),
    'unique_visitors', (
      SELECT COUNT(DISTINCT visitor_ip)::INT FROM store_visits
      WHERE owner_id = p_owner_id
        AND created_at >= p_start
        AND created_at <= p_end
        AND visitor_ip IS NOT NULL
        AND trim(visitor_ip) <> ''
    ),
    'low_stock_count', (
      SELECT COUNT(*)::INT FROM products
      WHERE owner_id = p_owner_id
        AND COALESCE(is_active, true) = true
        AND COALESCE(stock_quantity, 0) <= COALESCE(min_stock_level, 5)
    ),
    'product_count', (
      SELECT COUNT(*)::INT FROM products
      WHERE owner_id = p_owner_id AND COALESCE(is_active, true) = true
    ),
    'new_customers', (
      SELECT COUNT(*)::INT FROM customers
      WHERE owner_id = p_owner_id
        AND first_order_date >= p_start
        AND first_order_date <= p_end
    ),
    'returning_customers', (
      SELECT COUNT(*)::INT FROM customers c
      WHERE c.owner_id = p_owner_id
        AND c.first_order_date < p_start
        AND c.last_order_date >= p_start
        AND c.last_order_date <= p_end
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_store_statistics(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_statistics(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
