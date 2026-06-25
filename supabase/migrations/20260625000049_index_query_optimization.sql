-- v49: Index & query optimization — scale audit for 100K stores / 10M products / 1M orders

-- ---------------------------------------------------------------------------
-- 1) Drop redundant / superseded indexes (safe, idempotent)
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_orders_owner_status_created;
-- Superseded by idx_orders_owner_created_status (v36) with INCLUDE columns

DROP INDEX IF EXISTS public.idx_orders_owner_created;
-- Superseded by idx_orders_owner_created_status

DROP INDEX IF EXISTS public.idx_customers_owner_first_order;
DROP INDEX IF EXISTS public.idx_customers_owner_last_order;
-- Superseded by idx_customers_owner_first_last (v36)

DROP INDEX IF EXISTS public.idx_reviews_product_id;
DROP INDEX IF EXISTS public.idx_reviews_owner_id;
-- Superseded by idx_product_reviews_owner_status + idx_product_reviews_approved_created

DROP INDEX IF EXISTS public.idx_suggested_product;
DROP INDEX IF EXISTS public.idx_suggested_product_id;
-- Superseded by idx_suggested_products_order (product_id, display_order)

-- ---------------------------------------------------------------------------
-- 2) Targeted indexes for hot query paths
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_product_reviews_owner_pending
  ON public.product_reviews (owner_id)
  WHERE is_approved = false;

COMMENT ON INDEX public.idx_product_reviews_owner_pending IS
  'countPendingReviewsForOwner — partial index for pending approval badge';

CREATE INDEX IF NOT EXISTS idx_orders_owner_created_id
  ON public.orders (owner_id, created_at DESC, id DESC);

COMMENT ON INDEX public.idx_orders_owner_created_id IS
  'Stable keyset pagination for list_merchant_orders (tie-break on id)';

CREATE INDEX IF NOT EXISTS idx_products_owner_search_name
  ON public.products (owner_id, name text_pattern_ops)
  WHERE archived_at IS NULL;

COMMENT ON INDEX public.idx_products_owner_search_name IS
  'Merchant product name prefix/substring search scoped to owner (complements GIN trgm)';

CREATE INDEX IF NOT EXISTS idx_customers_owner_phone
  ON public.customers (owner_id, phone);

COMMENT ON INDEX public.idx_customers_owner_phone IS
  'Checkout customer UPSERT + CRM lookup by phone per tenant';

-- ---------------------------------------------------------------------------
-- 3) get_owner_products_page — keyset cursor + stable sort (backward compatible)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_owner_products_page(UUID, INT, INT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.get_owner_products_page(
  p_owner_id UUID,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  p_search TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_profile TEXT DEFAULT 'grid',
  p_cursor TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT;
  v_offset INT;
  v_total BIGINT;
  v_products JSONB;
  v_profile TEXT;
  v_cursor_ts TIMESTAMPTZ;
  v_cursor_id UUID;
  v_has_more BOOLEAN := false;
  v_next_cursor TEXT;
  v_last_created TIMESTAMPTZ;
  v_last_id UUID;
BEGIN
  IF p_owner_id IS NULL OR p_owner_id <> auth.uid() THEN
    RETURN jsonb_build_object('products', '[]'::jsonb, 'total', 0, 'has_more', false);
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);
  v_profile := COALESCE(NULLIF(lower(trim(p_profile)), ''), 'grid');

  IF NULLIF(trim(p_cursor), '') IS NOT NULL AND position('|' IN trim(p_cursor)) > 0 THEN
    v_cursor_ts := split_part(trim(p_cursor), '|', 1)::timestamptz;
    v_cursor_id := split_part(trim(p_cursor), '|', 2)::uuid;
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM products p
  WHERE p.owner_id = p_owner_id
    AND (p_category IS NULL OR trim(p_category) = '' OR p.category = trim(p_category))
    AND (
      p_search IS NULL OR trim(p_search) = ''
      OR p.name ILIKE '%' || trim(p_search) || '%'
    );

  WITH fetched AS (
    SELECT p.*
    FROM products p
    WHERE p.owner_id = p_owner_id
      AND (p_category IS NULL OR trim(p_category) = '' OR p.category = trim(p_category))
      AND (
        p_search IS NULL OR trim(p_search) = ''
        OR p.name ILIKE '%' || trim(p_search) || '%'
      )
      AND (
        v_cursor_ts IS NULL
        OR (p.created_at, p.id) < (v_cursor_ts, v_cursor_id)
      )
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT v_limit + 1
    OFFSET CASE WHEN v_cursor_ts IS NOT NULL THEN 0 ELSE v_offset END
  ),
  page AS (
    SELECT * FROM fetched
    ORDER BY created_at DESC, id DESC
    LIMIT v_limit
  )
  SELECT
    COALESCE(
      (
        SELECT jsonb_agg(
          CASE
            WHEN v_profile = 'full' THEN
              jsonb_build_object(
                'id', pg.id, 'name', pg.name, 'description', pg.description, 'category', pg.category,
                'price', pg.price, 'cost', pg.cost, 'original_price', pg.original_price,
                'image_url', pg.image_url, 'additional_images', pg.additional_images,
                'stock_quantity', pg.stock_quantity, 'min_stock_level', pg.min_stock_level,
                'sizes', pg.sizes, 'colors', pg.colors, 'variants', pg.variants,
                'is_active', pg.is_active, 'archived_at', pg.archived_at,
                'discount_type', pg.discount_type, 'discount_value', pg.discount_value,
                'discount_start_date', pg.discount_start_date, 'discount_end_date', pg.discount_end_date,
                'created_at', pg.created_at, 'updated_at', pg.updated_at
              )
            WHEN v_profile = 'inventory' THEN
              jsonb_build_object(
                'id', pg.id, 'name', pg.name, 'category', pg.category, 'price', pg.price,
                'image_url', pg.image_url, 'stock_quantity', pg.stock_quantity,
                'sizes', pg.sizes, 'colors', pg.colors, 'variants', pg.variants,
                'is_active', pg.is_active, 'archived_at', pg.archived_at,
                'min_stock_level', pg.min_stock_level, 'created_at', pg.created_at
              )
            ELSE
              jsonb_build_object(
                'id', pg.id, 'name', pg.name, 'category', pg.category, 'price', pg.price,
                'original_price', pg.original_price, 'image_url', pg.image_url,
                'stock_quantity', pg.stock_quantity, 'is_active', pg.is_active,
                'archived_at', pg.archived_at, 'min_stock_level', pg.min_stock_level,
                'discount_type', pg.discount_type, 'discount_value', pg.discount_value,
                'discount_start_date', pg.discount_start_date, 'discount_end_date', pg.discount_end_date,
                'created_at', pg.created_at, 'updated_at', pg.updated_at
              )
          END
          ORDER BY pg.created_at DESC, pg.id DESC
        )
        FROM page pg
      ),
      '[]'::jsonb
    ),
    (SELECT COUNT(*) > v_limit FROM fetched),
    (SELECT pg.created_at FROM page pg ORDER BY pg.created_at ASC, pg.id ASC LIMIT 1),
    (SELECT pg.id FROM page pg ORDER BY pg.created_at ASC, pg.id ASC LIMIT 1)
  INTO v_products, v_has_more, v_last_created, v_last_id;

  IF v_has_more AND v_last_created IS NOT NULL AND v_last_id IS NOT NULL THEN
    v_next_cursor := v_last_created::text || '|' || v_last_id::text;
  END IF;

  RETURN jsonb_build_object(
    'products', COALESCE(v_products, '[]'::jsonb),
    'total', v_total,
    'has_more', COALESCE(v_has_more, (v_offset + v_limit) < v_total),
    'next_cursor', v_next_cursor,
    'profile', v_profile
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_owner_products_page(UUID, INT, INT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_owner_products_page(UUID, INT, INT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) list_merchant_orders — stable sort (created_at, id) for index-friendly plans
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
    ORDER BY f.created_at DESC, f.id DESC
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
    COALESCE(jsonb_agg(sub.row_data ORDER BY sub.sort_created DESC, sub.sort_id DESC), '[]'::jsonb)
  INTO v_total, v_orders
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
      po.id AS sort_id,
      po.total_count
    FROM page_orders po
    LEFT JOIN items_by_order ib ON ib.order_id = po.id
  ) sub;

  RETURN jsonb_build_object(
    'total', v_total,
    'page', GREATEST(COALESCE(p_page, 0), 0),
    'page_size', v_limit,
    'orders', COALESCE(v_orders, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_merchant_orders(
  uuid, int, int, text, text, text, text, text, timestamptz, timestamptz, numeric, numeric
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_merchant_orders(
  uuid, int, int, text, text, text, text, text, timestamptz, timestamptz, numeric, numeric
) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) Refresh planner statistics
-- ---------------------------------------------------------------------------
ANALYZE public.products;
ANALYZE public.orders;
ANALYZE public.order_items;
ANALYZE public.customers;
ANALYZE public.product_reviews;
ANALYZE public.inventory_movements;
ANALYZE public.store_settings;
ANALYZE public.stores;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (49, 'index_query_optimization: keyset products RPC, stable order sort, index hygiene')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
