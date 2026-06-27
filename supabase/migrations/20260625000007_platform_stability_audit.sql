-- Platform stability audit: storefront visibility, product views, customers RLS, stats accuracy

-- ---------------------------------------------------------------------------
-- 1) Storefront catalog RPCs: exclude archived products
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_store_products_by_slug(TEXT);

CREATE OR REPLACE FUNCTION public.get_store_products_by_slug(p_slug TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  category TEXT,
  price NUMERIC,
  image_url TEXT,
  additional_images TEXT[],
  colors JSONB,
  sizes TEXT[],
  variants JSONB,
  discount_type TEXT,
  discount_value NUMERIC,
  original_price NUMERIC,
  stock_quantity INTEGER,
  is_active BOOLEAN,
  archived_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9-]+$' THEN
    RETURN;
  END IF;

  SELECT ss.owner_id INTO v_owner_id
  FROM store_settings ss
  WHERE LOWER(ss.store_slug) = LOWER(trim(p_slug))
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    SELECT st.user_id INTO v_owner_id
    FROM stores st
    WHERE LOWER(st.store_slug) = LOWER(trim(p_slug))
    LIMIT 1;
  END IF;

  IF v_owner_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id, p.name, p.description, p.category, p.price,
    p.image_url, p.additional_images, p.colors, p.sizes, p.variants,
    p.discount_type, p.discount_value, p.original_price, p.stock_quantity,
    p.is_active, p.archived_at
  FROM products p
  WHERE p.owner_id = v_owner_id
    AND COALESCE(p.is_active, true) = true
    AND p.archived_at IS NULL
  ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_store_products_by_slug(TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) product_views: add page_path + fix tracking RPC
-- ---------------------------------------------------------------------------
ALTER TABLE public.product_views
  ADD COLUMN IF NOT EXISTS page_path TEXT;

DROP FUNCTION IF EXISTS public.track_product_view_by_slug(TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.track_product_view_by_slug(TEXT, UUID);
DROP FUNCTION IF EXISTS public.track_product_view_by_slug(TEXT, UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.track_product_view_by_slug(
  p_slug TEXT,
  p_product_id UUID,
  p_page_path TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_ip TEXT;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9-]+$' OR p_product_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
  END IF;

  SELECT ss.owner_id INTO v_owner_id
  FROM store_settings ss
  WHERE LOWER(ss.store_slug) = LOWER(trim(p_slug))
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    SELECT st.user_id INTO v_owner_id
    FROM stores st
    WHERE LOWER(st.store_slug) = LOWER(trim(p_slug))
    LIMIT 1;
  END IF;

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'store_not_found');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = p_product_id
      AND p.owner_id = v_owner_id
      AND COALESCE(p.is_active, true) = true
      AND p.archived_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'product_not_found');
  END IF;

  v_ip := COALESCE(
    NULLIF(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1), ''),
    '0.0.0.0'
  );

  IF NOT public.is_valid_product_view(v_owner_id, p_product_id, v_ip) THEN
    RETURN jsonb_build_object('success', false, 'error', 'rate_limited');
  END IF;

  INSERT INTO public.product_views (
    product_id, owner_id, visitor_ip, store_slug, page_path, created_at
  ) VALUES (
    p_product_id,
    v_owner_id,
    v_ip,
    lower(trim(p_slug)),
    NULLIF(trim(p_page_path), ''),
    NOW()
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.track_product_view_by_slug(TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_product_view_by_slug(TEXT, UUID, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Customers: store_id link + RLS defense-in-depth
-- ---------------------------------------------------------------------------
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_owner_store
  ON public.customers (owner_id, store_id);

UPDATE public.customers c
SET store_id = s.id
FROM public.stores s
WHERE c.store_id IS NULL
  AND c.owner_id = s.user_id;

DROP POLICY IF EXISTS "Restaurant owners can view their own customers" ON public.customers;
DROP POLICY IF EXISTS "Restaurant owners can insert their own customers" ON public.customers;
DROP POLICY IF EXISTS "Restaurant owners can update their own customers" ON public.customers;
DROP POLICY IF EXISTS "Restaurant owners can delete their own customers" ON public.customers;
DROP POLICY IF EXISTS "Users can view their own customers" ON public.customers;
DROP POLICY IF EXISTS "Users can create their own customers" ON public.customers;
DROP POLICY IF EXISTS "Users can update their own customers" ON public.customers;
DROP POLICY IF EXISTS "Users can delete their own customers" ON public.customers;

CREATE POLICY "Restaurant owners can view their own customers"
  ON public.customers FOR SELECT
  USING (public.tenant_row_owned(owner_id, store_id));

CREATE POLICY "Restaurant owners can insert their own customers"
  ON public.customers FOR INSERT
  WITH CHECK (public.tenant_row_owned(owner_id, store_id));

CREATE POLICY "Restaurant owners can update their own customers"
  ON public.customers FOR UPDATE
  USING (public.tenant_row_owned(owner_id, store_id));

CREATE POLICY "Restaurant owners can delete their own customers"
  ON public.customers FOR DELETE
  USING (public.tenant_row_owned(owner_id, store_id));

-- ---------------------------------------------------------------------------
-- 4) Statistics: published product count + safer rollup fallback
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
  v_start_date DATE;
  v_end_date DATE;
  v_rollup_orders INT;
  v_rollup_completed INT;
  v_rollup_revenue NUMERIC;
  v_rollup_visits INT;
  v_live_orders INT;
  v_live_completed INT;
  v_live_revenue NUMERIC;
  v_live_visits INT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN NULL;
  END IF;

  IF p_start IS NULL OR p_end IS NULL OR p_end < p_start THEN
    RETURN NULL;
  END IF;

  v_start_date := (p_start AT TIME ZONE 'UTC')::DATE;
  v_end_date := (p_end AT TIME ZONE 'UTC')::DATE;

  SELECT
    COALESCE(SUM(order_count - cancelled_order_count), 0)::INT,
    COALESCE(SUM(completed_order_count), 0)::INT,
    COALESCE(SUM(completed_revenue), 0),
    COALESCE(SUM(visit_count), 0)::INT
  INTO v_rollup_orders, v_rollup_completed, v_rollup_revenue, v_rollup_visits
  FROM public.store_daily_stats
  WHERE owner_id = p_owner_id
    AND stat_date >= v_start_date
    AND stat_date <= v_end_date;

  SELECT COUNT(*)::INT INTO v_live_orders
  FROM orders
  WHERE owner_id = p_owner_id
    AND created_at >= p_start AND created_at <= p_end
    AND status <> 'cancelled';

  SELECT COUNT(*)::INT INTO v_live_completed
  FROM orders
  WHERE owner_id = p_owner_id
    AND created_at >= p_start AND created_at <= p_end
    AND status = 'completed';

  SELECT COALESCE(SUM(total_amount), 0) INTO v_live_revenue
  FROM orders
  WHERE owner_id = p_owner_id
    AND status = 'completed'
    AND created_at >= p_start AND created_at <= p_end;

  SELECT COUNT(*)::INT INTO v_live_visits
  FROM store_visits
  WHERE owner_id = p_owner_id
    AND created_at >= p_start AND created_at <= p_end;

  SELECT jsonb_build_object(
    'order_count', CASE WHEN v_rollup_orders > 0 THEN v_rollup_orders ELSE v_live_orders END,
    'completed_order_count', CASE WHEN v_rollup_completed > 0 THEN v_rollup_completed ELSE v_live_completed END,
    'pending_count', (
      SELECT COUNT(*)::INT FROM orders
      WHERE owner_id = p_owner_id AND status = 'pending'
        AND created_at >= p_start AND created_at <= p_end
    ),
    'completed_revenue', CASE WHEN v_rollup_revenue > 0 THEN v_rollup_revenue ELSE v_live_revenue END,
    'refund_total', (
      SELECT COALESCE(SUM(r.amount), 0)
      FROM order_refunds r
      JOIN orders o ON o.id = r.order_id
      WHERE r.owner_id = p_owner_id AND r.status = 'completed'
        AND o.status = 'completed'
        AND o.created_at >= p_start AND o.created_at <= p_end
    ),
    'visit_count', CASE WHEN v_rollup_visits > 0 THEN v_rollup_visits ELSE v_live_visits END,
    'unique_visitors', (
      SELECT COUNT(DISTINCT visitor_ip)::INT FROM store_visits
      WHERE owner_id = p_owner_id AND created_at >= p_start AND created_at <= p_end
        AND visitor_ip IS NOT NULL AND trim(visitor_ip) <> ''
    ),
    'low_stock_count', (
      SELECT COUNT(*)::INT FROM products
      WHERE owner_id = p_owner_id AND COALESCE(is_active, true) = true
        AND archived_at IS NULL
        AND COALESCE(stock_quantity, 0) <= COALESCE(min_stock_level, 5)
    ),
    'product_count', (
      SELECT COUNT(*)::INT FROM products
      WHERE owner_id = p_owner_id
        AND COALESCE(is_active, true) = true
        AND archived_at IS NULL
    ),
    'new_customers', (
      SELECT COUNT(*)::INT FROM customers
      WHERE owner_id = p_owner_id
        AND first_order_date >= p_start AND first_order_date <= p_end
    ),
    'returning_customers', (
      SELECT COUNT(*)::INT FROM customers c
      WHERE c.owner_id = p_owner_id
        AND c.first_order_date < p_start
        AND c.last_order_date >= p_start AND c.last_order_date <= p_end
    ),
    'top_viewed_products', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.view_count DESC)
      FROM (
        SELECT pv.product_id, COALESCE(p.name, 'منتج') AS product_name, COUNT(*)::INT AS view_count
        FROM product_views pv
        LEFT JOIN products p ON p.id = pv.product_id AND p.owner_id = pv.owner_id
        WHERE pv.owner_id = p_owner_id AND pv.created_at >= p_start AND pv.created_at <= p_end
        GROUP BY pv.product_id, p.name
        ORDER BY view_count DESC LIMIT 10
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
          COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.total_amount ELSE 0 END), 0)::NUMERIC AS revenue
        FROM orders o
        WHERE o.owner_id = p_owner_id AND o.created_at >= p_start AND o.created_at <= p_end
          AND o.status <> 'cancelled' AND o.marketing_attribution IS NOT NULL
          AND o.marketing_attribution <> 'null'::jsonb
        GROUP BY 1, 2, 3 ORDER BY orders DESC LIMIT 20
      ) t
    ), '[]'::jsonb),
    'stats_source', 'daily_rollup_hybrid'
  ) INTO v_result;

  RETURN v_result;
END;
$$;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (17, 'platform_stability: storefront archived guard, product views, customers RLS, stats')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
