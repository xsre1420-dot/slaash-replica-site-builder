-- P1 analytics: internal product views, campaign attribution KPIs, product view RPC

-- ---------------------------------------------------------------------------
-- product_views table (internal behavioral analytics)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  visitor_ip TEXT,
  user_agent TEXT,
  store_slug TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_views_owner_created
  ON public.product_views (owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_views_owner_product_created
  ON public.product_views (owner_id, product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_views_rate_limit
  ON public.product_views (owner_id, product_id, visitor_ip, created_at DESC);

ALTER TABLE public.product_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store owners can view their product views" ON public.product_views;
CREATE POLICY "Store owners can view their product views"
  ON public.product_views FOR SELECT
  USING (owner_id = auth.uid());

-- Inserts only via track_product_view_by_slug (SECURITY DEFINER)

CREATE OR REPLACE FUNCTION public.is_valid_product_view(
  p_owner_id UUID,
  p_product_id UUID,
  p_visitor_ip TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.product_views
  WHERE owner_id = p_owner_id
    AND product_id = p_product_id
    AND visitor_ip = p_visitor_ip
    AND created_at > NOW() - INTERVAL '1 hour';

  RETURN recent_count < 20;
END;
$$;

CREATE OR REPLACE FUNCTION public.track_product_view_by_slug(
  p_store_slug TEXT,
  p_product_id UUID,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
  v_ip TEXT;
BEGIN
  IF p_store_slug IS NULL OR trim(p_store_slug) = '' OR p_store_slug !~ '^[a-z0-9-]+$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_slug');
  END IF;

  IF p_product_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_product');
  END IF;

  SELECT ss.owner_id INTO v_owner
  FROM store_settings ss
  WHERE lower(trim(ss.store_slug)) = lower(trim(p_store_slug))
  LIMIT 1;

  IF v_owner IS NULL THEN
    SELECT s.user_id INTO v_owner
    FROM stores s
    WHERE lower(trim(s.store_slug)) = lower(trim(p_store_slug))
    LIMIT 1;
  END IF;

  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'store_not_found');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = p_product_id AND p.owner_id = v_owner AND COALESCE(p.is_active, true) = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'product_not_found');
  END IF;

  v_ip := COALESCE(
    NULLIF(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1), ''),
    '0.0.0.0'
  );

  IF NOT public.is_valid_product_view(v_owner, p_product_id, v_ip) THEN
    RETURN jsonb_build_object('success', false, 'error', 'rate_limited');
  END IF;

  INSERT INTO public.product_views (owner_id, product_id, visitor_ip, user_agent, store_slug)
  VALUES (
    v_owner,
    p_product_id,
    v_ip,
    p_user_agent,
    lower(trim(p_store_slug))
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.track_product_view_by_slug(TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_product_view_by_slug(TEXT, UUID, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Extend get_store_statistics with top viewed products + campaign attribution
-- ---------------------------------------------------------------------------
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
    ),
    'top_viewed_products', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.view_count DESC)
      FROM (
        SELECT
          pv.product_id,
          COALESCE(p.name, 'منتج') AS product_name,
          COUNT(*)::INT AS view_count
        FROM product_views pv
        LEFT JOIN products p ON p.id = pv.product_id AND p.owner_id = pv.owner_id
        WHERE pv.owner_id = p_owner_id
          AND pv.created_at >= p_start
          AND pv.created_at <= p_end
        GROUP BY pv.product_id, p.name
        ORDER BY view_count DESC
        LIMIT 10
      ) t
    ), '[]'::jsonb),
    'campaign_attribution', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.orders DESC)
      FROM (
        SELECT
          COALESCE(NULLIF(trim(o.marketing_attribution->>'utm_source'), ''), '(direct)') AS source,
          COALESCE(NULLIF(trim(o.marketing_attribution->>'utm_medium'), ''), '(none)') AS medium,
          COALESCE(NULLIF(trim(o.marketing_attribution->>'utm_campaign'), ''), '(none)') AS campaign,
          COUNT(*)::INT AS orders,
          COALESCE(SUM(
            CASE WHEN o.status = 'completed' THEN o.total_amount ELSE 0 END
          ), 0)::NUMERIC AS revenue
        FROM orders o
        WHERE o.owner_id = p_owner_id
          AND o.created_at >= p_start
          AND o.created_at <= p_end
          AND o.status <> 'cancelled'
          AND o.marketing_attribution IS NOT NULL
          AND o.marketing_attribution <> 'null'::jsonb
        GROUP BY 1, 2, 3
        ORDER BY orders DESC
        LIMIT 20
      ) t
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_store_statistics(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_statistics(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
