-- v76: Enterprise Payload Optimization — slim list DTOs, bundle hero/featured, dashboard split, benchmarks

-- ---------------------------------------------------------------------------
-- 1) Storefront list helpers — stock status, effective price, compact card JSON
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.storefront_discount_active(p public.products)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF COALESCE(p.discount_type, 'none') = 'none' OR COALESCE(p.discount_value, 0) <= 0 THEN
    RETURN false;
  END IF;
  IF p.discount_start_date IS NOT NULL AND p.discount_start_date > NOW() THEN
    RETURN false;
  END IF;
  IF p.discount_end_date IS NOT NULL AND p.discount_end_date < NOW() THEN
    RETURN false;
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.storefront_effective_unit_price(p public.products)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_base NUMERIC;
BEGIN
  IF NOT public.storefront_discount_active(p) THEN
    RETURN p.price;
  END IF;

  v_base := COALESCE(p.original_price, p.price);

  IF p.discount_type = 'percentage' THEN
    RETURN GREATEST(0, ROUND(v_base * (1 - p.discount_value / 100)));
  END IF;

  IF p.discount_type IN ('amount', 'fixed_amount') THEN
    RETURN GREATEST(0, v_base - p.discount_value);
  END IF;

  RETURN p.price;
END;
$$;

CREATE OR REPLACE FUNCTION public.storefront_product_list_qty(p public.products)
RETURNS INT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_sum INT;
  v_agg INT;
BEGIN
  v_agg := p.stock_quantity;

  IF p.variants IS NOT NULL
    AND jsonb_typeof(p.variants) = 'array'
    AND jsonb_array_length(p.variants) > 0 THEN
    SELECT COALESCE(SUM(GREATEST((elem->>'quantity')::int, 0)), 0)
    INTO v_sum
    FROM jsonb_array_elements(p.variants) AS elem;

    IF COALESCE(v_agg, 0) <= 0 AND v_sum > 0 THEN
      RETURN v_sum;
    END IF;

    IF v_sum > 0 AND COALESCE(v_agg, 0) > 0 THEN
      RETURN LEAST(v_sum, v_agg);
    END IF;
  END IF;

  RETURN v_agg;
END;
$$;

CREATE OR REPLACE FUNCTION public.storefront_product_stock_status(p public.products)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_qty INT;
BEGIN
  IF p.stock_quantity IS NULL OR p.stock_quantity < 0 THEN
    RETURN 'unlimited';
  END IF;

  v_qty := public.storefront_product_list_qty(p);

  IF COALESCE(v_qty, 0) <= 0 THEN
    RETURN 'out';
  END IF;

  IF v_qty <= 3 THEN
    RETURN 'low';
  END IF;

  RETURN 'in_stock';
END;
$$;

CREATE OR REPLACE FUNCTION public.storefront_product_has_options(p public.products)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN (
    public._product_sizes_to_text_array(p.sizes) IS NOT NULL
    AND cardinality(public._product_sizes_to_text_array(p.sizes)) > 0
  )
  OR (
    p.colors IS NOT NULL
    AND p.colors <> '[]'::jsonb
    AND jsonb_array_length(p.colors) > 0
  )
  OR (
    p.variants IS NOT NULL
    AND jsonb_typeof(p.variants) = 'array'
    AND jsonb_array_length(p.variants) > 0
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.storefront_product_list_json(p public.products)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_has_discount BOOLEAN;
  v_sale_price NUMERIC;
  v_status TEXT;
  v_qty INT;
  v_rating NUMERIC;
BEGIN
  v_has_discount := public.storefront_discount_active(p);
  v_sale_price := public.storefront_effective_unit_price(p);
  v_status := public.storefront_product_stock_status(p);
  v_qty := public.storefront_product_list_qty(p);

  SELECT ROUND(AVG(r.rating)::numeric, 1)
  INTO v_rating
  FROM public.product_reviews r
  WHERE r.product_id = p.id
    AND COALESCE(r.is_approved, false) = true;

  RETURN jsonb_strip_nulls(
    jsonb_build_object(
      'id', p.id,
      'slug', NULLIF(trim(p.product_slug), ''),
      'name', p.name,
      'price', p.price,
      'sale_price', CASE WHEN v_has_discount AND v_sale_price IS DISTINCT FROM p.price THEN v_sale_price ELSE NULL END,
      'thumbnail', p.image_url,
      'category', NULLIF(trim(p.category), ''),
      'stock_status', v_status,
      'qty', CASE WHEN v_status = 'unlimited' THEN NULL ELSE v_qty END,
      'has_options', CASE WHEN public.storefront_product_has_options(p) THEN true ELSE NULL END,
      'rating', v_rating,
      'discount_type', CASE WHEN v_has_discount THEN p.discount_type ELSE NULL END,
      'discount_value', CASE WHEN v_has_discount THEN p.discount_value ELSE NULL END,
      'original_price', CASE WHEN v_has_discount THEN COALESCE(p.original_price, p.price) ELSE NULL END,
      'created_at', p.created_at,
      'image_url', p.image_url,
      'stock_quantity', CASE WHEN v_status = 'unlimited' THEN NULL ELSE v_qty END
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.storefront_product_grid_json(p public.products)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN public.storefront_product_list_json(p);
END;
$$;

CREATE OR REPLACE FUNCTION public.storefront_product_card_json(p public.products)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN public.storefront_product_list_json(p);
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) Store hero + featured slice for bundle
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.storefront_store_hero_json(p_owner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_banners JSONB;
  v_primary INT;
BEGIN
  SELECT ss.banner_images, COALESCE(ss.primary_banner_index, 0)
  INTO v_banners, v_primary
  FROM public.store_settings ss
  WHERE ss.owner_id = p_owner_id
  LIMIT 1;

  IF v_banners IS NULL OR jsonb_typeof(v_banners) <> 'array' OR jsonb_array_length(v_banners) = 0 THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_strip_nulls(
    jsonb_build_object(
      'image', v_banners -> LEAST(GREATEST(v_primary, 0), jsonb_array_length(v_banners) - 1),
      'images', v_banners,
      'primary_index', v_primary
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_storefront_featured_products(
  p_owner_id UUID,
  p_limit INT DEFAULT 8
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT;
BEGIN
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 8), 1), 12);

  RETURN COALESCE(
    (
      SELECT jsonb_agg(public.storefront_product_list_json(p) ORDER BY p.created_at DESC, p.id DESC)
      FROM (
        SELECT p.*
        FROM public.products p
        WHERE p.owner_id = p_owner_id
          AND p.archived_at IS NULL
          AND COALESCE(p.is_active, true) = true
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT v_limit
      ) p
    ),
    '[]'::jsonb
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 3) Storefront bundle — hero + featured + slim product cards
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_storefront_page_bundle(
  p_slug TEXT,
  p_limit INT DEFAULT 24,
  p_cursor TEXT DEFAULT '',
  p_category TEXT DEFAULT '',
  p_search TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta JSONB;
  v_owner_id UUID;
  v_limit INT;
  v_cursor_ts TIMESTAMPTZ;
  v_cursor_id UUID;
  v_products JSONB;
  v_featured JSONB;
  v_hero JSONB;
  v_next_cursor TEXT;
  v_has_more BOOLEAN;
  v_last_created TIMESTAMPTZ;
  v_last_id UUID;
BEGIN
  IF p_slug IS NULL OR trim(p_slug) = '' OR p_slug !~ '^[a-z0-9-]+$' THEN
    RETURN NULL;
  END IF;

  v_meta := public.get_store_meta(p_slug, false);
  IF v_meta IS NULL OR v_meta->'store' IS NULL THEN
    RETURN NULL;
  END IF;

  v_owner_id := (v_meta->'store'->>'owner_id')::uuid;
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 24), 1), 48);

  IF NULLIF(trim(p_cursor), '') IS NOT NULL AND position('|' IN trim(p_cursor)) > 0 THEN
    v_cursor_ts := split_part(trim(p_cursor), '|', 1)::timestamptz;
    v_cursor_id := split_part(trim(p_cursor), '|', 2)::uuid;
  END IF;

  v_hero := public.storefront_store_hero_json(v_owner_id);
  IF NULLIF(trim(p_cursor), '') IS NULL THEN
    v_featured := public.get_storefront_featured_products(v_owner_id, 8);
  ELSE
    v_featured := '[]'::jsonb;
  END IF;

  WITH ranked AS (
    SELECT
      p.created_at,
      p.id,
      public.storefront_product_list_json(p) AS pj,
      ROW_NUMBER() OVER (ORDER BY p.created_at DESC, p.id DESC) AS rn
    FROM public.products p
    WHERE p.owner_id = v_owner_id
      AND p.archived_at IS NULL
      AND COALESCE(p.is_active, true) = true
      AND (NULLIF(trim(p_category), '') IS NULL OR p.category = trim(p_category))
      AND (
        NULLIF(trim(p_search), '') IS NULL
        OR p.name ILIKE '%' || trim(p_search) || '%'
        OR p.description ILIKE '%' || trim(p_search) || '%'
      )
      AND (
        v_cursor_ts IS NULL
        OR (p.created_at, p.id) < (v_cursor_ts, v_cursor_id)
      )
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT v_limit + 1
  )
  SELECT
    COALESCE((SELECT jsonb_agg(r.pj ORDER BY r.created_at DESC, r.id DESC) FROM ranked r WHERE r.rn <= v_limit), '[]'::jsonb),
    (SELECT COUNT(*) FROM ranked) > v_limit,
    (SELECT r.created_at FROM ranked r WHERE r.rn = v_limit),
    (SELECT r.id FROM ranked r WHERE r.rn = v_limit)
  INTO v_products, v_has_more, v_last_created, v_last_id;

  IF v_has_more AND v_last_created IS NOT NULL AND v_last_id IS NOT NULL THEN
    v_next_cursor := v_last_created::text || '|' || v_last_id::text;
  ELSE
    v_next_cursor := NULL;
    v_has_more := false;
  END IF;

  RETURN jsonb_strip_nulls(
    jsonb_build_object(
      'store', v_meta->'store',
      'hero', v_hero,
      'categories', v_meta->'categories',
      'featured', v_featured,
      'products', COALESCE(v_products, '[]'::jsonb),
      'next_cursor', v_next_cursor,
      'has_more', COALESCE(v_has_more, false),
      'cache_version', COALESCE((v_meta->>'cache_version')::bigint, 1)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_store_products_page(
  p_slug TEXT,
  p_limit INT DEFAULT 24,
  p_cursor TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_limit INT;
  v_cursor_ts TIMESTAMPTZ;
  v_cursor_id UUID;
  v_products JSONB;
  v_next_cursor TEXT;
  v_has_more BOOLEAN;
  v_last_created TIMESTAMPTZ;
  v_last_id UUID;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9-]+$' THEN
    RETURN jsonb_build_object('products', '[]'::jsonb, 'next_cursor', NULL, 'has_more', false);
  END IF;

  v_owner_id := public._resolve_store_owner_by_slug(p_slug);
  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('products', '[]'::jsonb, 'next_cursor', NULL, 'has_more', false);
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 24), 1), 48);

  IF p_cursor IS NOT NULL AND trim(p_cursor) <> '' AND position('|' IN p_cursor) > 0 THEN
    v_cursor_ts := split_part(p_cursor, '|', 1)::timestamptz;
    v_cursor_id := split_part(p_cursor, '|', 2)::uuid;
  END IF;

  WITH ranked AS (
    SELECT
      p.created_at,
      p.id,
      public.storefront_product_list_json(p) AS pj,
      ROW_NUMBER() OVER (ORDER BY p.created_at DESC, p.id DESC) AS rn
    FROM public.products p
    WHERE p.owner_id = v_owner_id
      AND p.archived_at IS NULL
      AND COALESCE(p.is_active, true) = true
      AND (p_category IS NULL OR trim(p_category) = '' OR p.category = trim(p_category))
      AND (
        p_search IS NULL OR trim(p_search) = ''
        OR p.name ILIKE '%' || trim(p_search) || '%'
        OR p.description ILIKE '%' || trim(p_search) || '%'
      )
      AND (
        v_cursor_ts IS NULL
        OR (p.created_at, p.id) < (v_cursor_ts, v_cursor_id)
      )
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT v_limit + 1
  )
  SELECT
    COALESCE((SELECT jsonb_agg(r.pj ORDER BY r.created_at DESC, r.id DESC) FROM ranked r WHERE r.rn <= v_limit), '[]'::jsonb),
    (SELECT COUNT(*) FROM ranked) > v_limit,
    (SELECT r.created_at FROM ranked r WHERE r.rn = v_limit),
    (SELECT r.id FROM ranked r WHERE r.rn = v_limit)
  INTO v_products, v_has_more, v_last_created, v_last_id;

  IF v_has_more AND v_last_created IS NOT NULL AND v_last_id IS NOT NULL THEN
    v_next_cursor := v_last_created::text || '|' || v_last_id::text;
  ELSE
    v_next_cursor := NULL;
    v_has_more := false;
  END IF;

  RETURN jsonb_strip_nulls(
    jsonb_build_object(
      'products', COALESCE(v_products, '[]'::jsonb),
      'next_cursor', v_next_cursor,
      'has_more', COALESCE(v_has_more, false)
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) Slim merchant bootstrap — drop embedded product preview array
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_owner_bootstrap(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_result JSON;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN NULL;
  END IF;

  SELECT (jsonb_strip_nulls(jsonb_build_object(
    'store', (
      SELECT jsonb_build_object(
        'id', s.id,
        'user_id', s.user_id,
        'store_name', s.store_name,
        'store_slug', s.store_slug,
        'theme_id', COALESCE(s.theme_id, 'default')
      )
      FROM public.stores s
      WHERE s.user_id = p_user_id
      LIMIT 1
    ),
    'settings', (
      SELECT jsonb_build_object(
        'store_name', ss.store_name,
        'store_slug', ss.store_slug,
        'store_logo', ss.store_logo,
        'theme_primary_color', ss.theme_primary_color,
        'theme_secondary_color', ss.theme_secondary_color,
        'banner_images', ss.banner_images,
        'primary_banner_index', ss.primary_banner_index,
        'delivery_prices', ss.delivery_prices,
        'whatsapp_number', ss.whatsapp_number,
        'payment_methods', ss.payment_methods,
        'return_policy', ss.return_policy,
        'privacy_policy', ss.privacy_policy,
        'terms_conditions', ss.terms_conditions
      )
      FROM public.store_settings ss
      WHERE ss.owner_id = p_user_id
      LIMIT 1
    ),
    'categories', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'order', c.display_order) ORDER BY c.display_order)
      FROM public.categories c
      WHERE c.owner_id = p_user_id
    ), '[]'::jsonb),
    'product_count', (
      SELECT COUNT(*)::int
      FROM public.products
      WHERE owner_id = p_user_id
        AND archived_at IS NULL
    ),
    'orders_count', (
      SELECT COUNT(*)::int
      FROM public.orders
      WHERE owner_id = p_user_id
    )
  )))::json INTO v_result;

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5) Lean order list — omit notes/updated_at from list RPC
-- ---------------------------------------------------------------------------
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
  v_limit int;
  v_offset int;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 100);
  v_offset := GREATEST(COALESCE(p_page, 0), 0) * v_limit;

  WITH filtered AS (
    SELECT o.*
    FROM public.merchant_orders_base_filter(
      p_owner_id, p_search, p_order_status, p_payment_status, p_delivery_status,
      p_workflow_tab, p_date_from, p_date_to, p_min_value, p_max_value
    ) o
  ),
  page_orders AS (
    SELECT f.*, COUNT(*) OVER () AS total_count
    FROM filtered f
    ORDER BY f.created_at DESC
    LIMIT v_limit OFFSET v_offset
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
    COALESCE(MAX(sub.total_count), 0),
    COALESCE(jsonb_agg(sub.row_data ORDER BY sub.sort_created DESC), '[]'::jsonb)
  INTO v_total, v_orders
  FROM (
    SELECT
      jsonb_strip_nulls(
        jsonb_build_object(
          'id', po.id,
          'status', po.status,
          'total_amount', po.total_amount,
          'created_at', po.created_at,
          'customer_name', po.customer_name,
          'customer_phone', po.customer_phone,
          'customer_address', po.customer_address,
          'customer_governorate', po.customer_governorate,
          'delivery_fee', po.delivery_fee,
          'delivery_status', po.delivery_status,
          'payment_method', po.payment_method,
          'payment_status', po.payment_status,
          'coupon_code', po.coupon_code,
          'discount_amount', po.discount_amount,
          'order_items', COALESCE(ib.order_items, '[]'::jsonb)
        )
      ) AS row_data,
      po.created_at AS sort_created,
      po.total_count
    FROM page_orders po
    LEFT JOIN items_by_order ib ON ib.order_id = po.id
  ) sub;

  RETURN jsonb_strip_nulls(
    jsonb_build_object(
      'total', v_total,
      'page', GREATEST(COALESCE(p_page, 0), 0),
      'page_size', v_limit,
      'orders', COALESCE(v_orders, '[]'::jsonb),
      'has_more', (v_offset + v_limit) < v_total
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 6) Dashboard split — lightweight KPI + workflow endpoints
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dashboard_kpis_light(p_owner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_today_start TIMESTAMPTZ;
  v_today_end TIMESTAMPTZ;
  v_week_start TIMESTAMPTZ;
  v_week_end TIMESTAMPTZ;
  v_order_row RECORD;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN NULL;
  END IF;

  v_today_start := date_trunc('day', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_today_end := v_today_start + INTERVAL '1 day' - INTERVAL '1 millisecond';
  v_week_start := date_trunc('week', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_week_end := v_week_start + INTERVAL '7 days' - INTERVAL '1 millisecond';

  SELECT
    COUNT(*) FILTER (
      WHERE o.created_at >= v_today_start AND o.created_at <= v_today_end AND o.status <> 'cancelled'
    )::INT AS today_orders,
    COALESCE(SUM(o.total_amount) FILTER (
      WHERE o.created_at >= v_today_start AND o.created_at <= v_today_end
        AND o.status = 'completed' AND COALESCE(o.payment_status, '') <> 'refunded'
    ), 0) AS today_revenue,
    COUNT(*) FILTER (
      WHERE o.created_at >= v_week_start AND o.created_at <= v_week_end AND o.status <> 'cancelled'
    )::INT AS week_orders,
    COALESCE(SUM(o.total_amount) FILTER (
      WHERE o.created_at >= v_week_start AND o.created_at <= v_week_end
        AND o.status = 'completed' AND COALESCE(o.payment_status, '') <> 'refunded'
    ), 0) AS week_revenue
  INTO v_order_row
  FROM public.orders o
  WHERE o.owner_id = p_owner_id
    AND o.created_at >= v_week_start;

  RETURN jsonb_strip_nulls(
    jsonb_build_object(
      'today', jsonb_build_object(
        'order_count', v_order_row.today_orders,
        'revenue', v_order_row.today_revenue
      ),
      'week', jsonb_build_object(
        'order_count', v_order_row.week_orders,
        'revenue', v_order_row.week_revenue
      ),
      'catalog_kpis', jsonb_build_object(
        'product_count', (
          SELECT COUNT(*)::INT FROM public.products
          WHERE owner_id = p_owner_id
            AND COALESCE(is_active, true) = true
            AND archived_at IS NULL
        ),
        'low_stock_count', (
          SELECT COUNT(*)::INT FROM public.products
          WHERE owner_id = p_owner_id
            AND COALESCE(is_active, true) = true
            AND archived_at IS NULL
            AND COALESCE(stock_quantity, 0) <= COALESCE(min_stock_level, 5)
        )
      )
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_dashboard_workflow_counts(p_owner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN NULL;
  END IF;

  RETURN public.count_merchant_orders_by_workflow(
    p_owner_id, NULL, 'all', 'all', 'all', 'all', NULL, NULL, NULL, NULL
  );
END;
$$;

-- Slim batch — dedupe catalog_kpis from all_time blob
CREATE OR REPLACE FUNCTION public.get_dashboard_statistics_batch(p_owner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_today_start TIMESTAMPTZ;
  v_today_end TIMESTAMPTZ;
  v_yesterday_start TIMESTAMPTZ;
  v_yesterday_end TIMESTAMPTZ;
  v_week_start TIMESTAMPTZ;
  v_week_end TIMESTAMPTZ;
  v_prev_week_start TIMESTAMPTZ;
  v_prev_week_end TIMESTAMPTZ;
  v_month_start TIMESTAMPTZ;
  v_month_end TIMESTAMPTZ;
  v_order_row RECORD;
  v_visit_row RECORD;
  v_rollup RECORD;
  v_static JSONB;
  v_all_time_orders INT;
  v_all_time_revenue NUMERIC;
  v_all_time_visits INT;
  v_all_time_refunds NUMERIC;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN NULL;
  END IF;

  v_today_start := date_trunc('day', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_today_end := v_today_start + INTERVAL '1 day' - INTERVAL '1 millisecond';
  v_yesterday_start := v_today_start - INTERVAL '1 day';
  v_yesterday_end := v_today_start - INTERVAL '1 millisecond';
  v_week_start := date_trunc('week', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_week_end := v_week_start + INTERVAL '7 days' - INTERVAL '1 millisecond';
  v_prev_week_start := v_week_start - INTERVAL '7 days';
  v_prev_week_end := v_week_start - INTERVAL '1 millisecond';
  v_month_start := date_trunc('month', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_month_end := (date_trunc('month', v_now AT TIME ZONE 'UTC') + INTERVAL '1 month') AT TIME ZONE 'UTC' - INTERVAL '1 millisecond';

  SELECT jsonb_build_object(
    'low_stock_count', (
      SELECT COUNT(*)::INT FROM public.products
      WHERE owner_id = p_owner_id AND COALESCE(is_active, true) = true
        AND archived_at IS NULL
        AND COALESCE(stock_quantity, 0) <= COALESCE(min_stock_level, 5)
    ),
    'product_count', (
      SELECT COUNT(*)::INT FROM public.products
      WHERE owner_id = p_owner_id
        AND COALESCE(is_active, true) = true
        AND archived_at IS NULL
    )
  ) INTO v_static;

  SELECT
    COUNT(*) FILTER (
      WHERE o.created_at >= v_today_start AND o.created_at <= v_today_end AND o.status <> 'cancelled'
    )::INT AS today_orders,
    COALESCE(SUM(o.total_amount) FILTER (
      WHERE o.created_at >= v_today_start AND o.created_at <= v_today_end
        AND o.status = 'completed' AND COALESCE(o.payment_status, '') <> 'refunded'
    ), 0) AS today_revenue,
    COUNT(*) FILTER (
      WHERE o.created_at >= v_yesterday_start AND o.created_at <= v_yesterday_end AND o.status <> 'cancelled'
    )::INT AS yesterday_orders,
    COALESCE(SUM(o.total_amount) FILTER (
      WHERE o.created_at >= v_yesterday_start AND o.created_at <= v_yesterday_end
        AND o.status = 'completed' AND COALESCE(o.payment_status, '') <> 'refunded'
    ), 0) AS yesterday_revenue,
    COUNT(*) FILTER (
      WHERE o.created_at >= v_week_start AND o.created_at <= v_week_end AND o.status <> 'cancelled'
    )::INT AS week_orders,
    COALESCE(SUM(o.total_amount) FILTER (
      WHERE o.created_at >= v_week_start AND o.created_at <= v_week_end
        AND o.status = 'completed' AND COALESCE(o.payment_status, '') <> 'refunded'
    ), 0) AS week_revenue,
    COUNT(*) FILTER (
      WHERE o.created_at >= v_prev_week_start AND o.created_at <= v_prev_week_end AND o.status <> 'cancelled'
    )::INT AS prev_week_orders,
    COALESCE(SUM(o.total_amount) FILTER (
      WHERE o.created_at >= v_prev_week_start AND o.created_at <= v_prev_week_end
        AND o.status = 'completed' AND COALESCE(o.payment_status, '') <> 'refunded'
    ), 0) AS prev_week_revenue,
    COUNT(*) FILTER (
      WHERE o.created_at >= v_month_start AND o.created_at <= v_month_end AND o.status <> 'cancelled'
    )::INT AS month_orders,
    COALESCE(SUM(o.total_amount) FILTER (
      WHERE o.created_at >= v_month_start AND o.created_at <= v_month_end
        AND o.status = 'completed' AND COALESCE(o.payment_status, '') <> 'refunded'
    ), 0) AS month_revenue,
    COALESCE(SUM(r.amount) FILTER (
      WHERE o.status = 'completed' AND r.status = 'completed'
        AND o.created_at >= v_today_start AND o.created_at <= v_today_end
    ), 0) AS today_refunds,
    COALESCE(SUM(r.amount) FILTER (
      WHERE o.status = 'completed' AND r.status = 'completed'
        AND o.created_at >= v_month_start AND o.created_at <= v_month_end
    ), 0) AS month_refunds
  INTO v_order_row
  FROM public.orders o
  LEFT JOIN public.order_refunds r ON r.order_id = o.id AND r.owner_id = p_owner_id
  WHERE o.owner_id = p_owner_id
    AND o.created_at >= v_prev_week_start;

  SELECT
    COUNT(*) FILTER (
      WHERE sv.created_at >= v_today_start AND sv.created_at <= v_today_end
    )::INT AS today_visits,
    COUNT(*) FILTER (
      WHERE sv.created_at >= v_yesterday_start AND sv.created_at <= v_yesterday_end
    )::INT AS yesterday_visits,
    COUNT(*) FILTER (
      WHERE sv.created_at >= v_week_start AND sv.created_at <= v_week_end
    )::INT AS week_visits,
    COUNT(*) FILTER (
      WHERE sv.created_at >= v_prev_week_start AND sv.created_at <= v_prev_week_end
    )::INT AS prev_week_visits,
    COUNT(*) FILTER (
      WHERE sv.created_at >= v_month_start AND sv.created_at <= v_month_end
    )::INT AS month_visits
  INTO v_visit_row
  FROM public.store_visits sv
  WHERE sv.owner_id = p_owner_id
    AND sv.created_at >= v_prev_week_start;

  SELECT
    COALESCE(SUM(sds.order_count - sds.cancelled_order_count), 0)::INT AS rollup_orders,
    COALESCE(SUM(sds.completed_revenue), 0) AS rollup_revenue,
    COALESCE(SUM(sds.visit_count), 0)::INT AS rollup_visits
  INTO v_rollup
  FROM public.store_daily_stats sds
  WHERE sds.owner_id = p_owner_id
    AND sds.stat_date < (v_today_start AT TIME ZONE 'UTC')::DATE;

  SELECT
    COALESCE(v_rollup.rollup_orders, 0) + COALESCE(v_order_row.today_orders, 0),
    COALESCE(v_rollup.rollup_revenue, 0) + COALESCE(v_order_row.today_revenue, 0),
    COALESCE(v_rollup.rollup_visits, 0) + COALESCE(v_visit_row.today_visits, 0),
    COALESCE((
      SELECT SUM(r.amount)
      FROM public.order_refunds r
      JOIN public.orders o ON o.id = r.order_id
      WHERE r.owner_id = p_owner_id AND r.status = 'completed' AND o.status = 'completed'
    ), 0)
  INTO v_all_time_orders, v_all_time_revenue, v_all_time_visits, v_all_time_refunds;

  RETURN jsonb_strip_nulls(
    jsonb_build_object(
      'today', public._dashboard_period_json(
        v_order_row.today_orders, v_order_row.today_revenue, v_visit_row.today_visits, v_order_row.today_refunds
      ),
      'yesterday', public._dashboard_period_json(
        v_order_row.yesterday_orders, v_order_row.yesterday_revenue, v_visit_row.yesterday_visits
      ),
      'week', public._dashboard_period_json(
        v_order_row.week_orders, v_order_row.week_revenue, v_visit_row.week_visits
      ),
      'previous_week', public._dashboard_period_json(
        v_order_row.prev_week_orders, v_order_row.prev_week_revenue, v_visit_row.prev_week_visits
      ),
      'month', public._dashboard_period_json(
        v_order_row.month_orders, v_order_row.month_revenue, v_visit_row.month_visits, v_order_row.month_refunds
      ),
      'all_time', public._dashboard_period_json(
        v_all_time_orders, v_all_time_revenue, v_all_time_visits, v_all_time_refunds, 'rollup_plus_live'
      ),
      'catalog_kpis', v_static,
      'workflow_counts', public.count_merchant_orders_by_workflow(
        p_owner_id, NULL, 'all', 'all', 'all', 'all', NULL, NULL, NULL, NULL
      )
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 7) Payload benchmark audit RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_payload_benchmark(p_slug TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug TEXT;
  v_bundle JSONB;
  v_products_page JSONB;
  v_result JSONB := '{}'::jsonb;
BEGIN
  v_slug := NULLIF(lower(trim(COALESCE(p_slug, ''))), '');

  IF v_slug IS NOT NULL AND v_slug ~ '^[a-z0-9-]+$' THEN
    v_bundle := public.get_storefront_page_bundle(v_slug, 24, '', '', '');
    v_products_page := public.get_store_products_page(v_slug, 24, NULL, NULL, NULL);

    v_result := v_result || jsonb_build_object(
      'storefront_bundle_bytes', octet_length(COALESCE(v_bundle, '{}'::jsonb)::text),
      'storefront_products_page_bytes', octet_length(COALESCE(v_products_page, '{}'::jsonb)::text),
      'storefront_product_count', jsonb_array_length(COALESCE(v_bundle->'products', '[]'::jsonb)),
      'storefront_avg_product_bytes', CASE
        WHEN jsonb_array_length(COALESCE(v_bundle->'products', '[]'::jsonb)) > 0 THEN
          octet_length(COALESCE(v_bundle->'products', '[]'::jsonb)::text)
          / jsonb_array_length(v_bundle->'products')
        ELSE 0
      END,
      'slug', v_slug
    );
  END IF;

  RETURN jsonb_strip_nulls(
    v_result || jsonb_build_object(
      'measured_at', NOW(),
      'notes', 'Merchant dashboard/order sizes require authenticated owner context'
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.storefront_discount_active(public.products) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.storefront_effective_unit_price(public.products) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.storefront_product_list_qty(public.products) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.storefront_product_stock_status(public.products) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.storefront_product_has_options(public.products) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.storefront_product_list_json(public.products) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.storefront_store_hero_json(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_storefront_featured_products(UUID, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_dashboard_kpis_light(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_dashboard_workflow_counts(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_payload_benchmark(TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.storefront_product_list_json(public.products) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_storefront_featured_products(UUID, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storefront_store_hero_json(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_kpis_light(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_workflow_counts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_payload_benchmark(TEXT) TO authenticated, service_role;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (76, 'payload_phase_1_6: slim list DTOs, bundle hero/featured, dashboard split, benchmark RPC')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
