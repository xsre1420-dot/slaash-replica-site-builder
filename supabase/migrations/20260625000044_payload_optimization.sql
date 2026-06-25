-- v44: Payload optimization — slim merchant product list + lean order list items

-- ---------------------------------------------------------------------------
-- 1) get_owner_products_page — profile-based column projection
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_owner_products_page(UUID, INT, INT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.get_owner_products_page(
  p_owner_id UUID,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  p_search TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_profile TEXT DEFAULT 'grid'
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
BEGIN
  IF p_owner_id IS NULL OR p_owner_id <> auth.uid() THEN
    RETURN jsonb_build_object('products', '[]'::jsonb, 'total', 0, 'has_more', false);
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);
  v_profile := COALESCE(NULLIF(lower(trim(p_profile)), ''), 'grid');

  SELECT COUNT(*) INTO v_total
  FROM products p
  WHERE p.owner_id = p_owner_id
    AND (p_category IS NULL OR trim(p_category) = '' OR p.category = trim(p_category))
    AND (
      p_search IS NULL OR trim(p_search) = ''
      OR p.name ILIKE '%' || trim(p_search) || '%'
    );

  SELECT COALESCE(jsonb_agg(sub.row_json ORDER BY sub.created_at DESC), '[]'::jsonb)
  INTO v_products
  FROM (
    SELECT
      CASE
        WHEN v_profile = 'full' THEN
          jsonb_build_object(
            'id', p.id, 'name', p.name, 'description', p.description, 'category', p.category,
            'price', p.price, 'cost', p.cost, 'original_price', p.original_price,
            'image_url', p.image_url, 'additional_images', p.additional_images,
            'stock_quantity', p.stock_quantity, 'min_stock_level', p.min_stock_level,
            'sizes', p.sizes, 'colors', p.colors, 'variants', p.variants,
            'is_active', p.is_active, 'archived_at', p.archived_at,
            'discount_type', p.discount_type, 'discount_value', p.discount_value,
            'discount_start_date', p.discount_start_date, 'discount_end_date', p.discount_end_date,
            'created_at', p.created_at, 'updated_at', p.updated_at
          )
        WHEN v_profile = 'inventory' THEN
          jsonb_build_object(
            'id', p.id, 'name', p.name, 'category', p.category, 'price', p.price,
            'image_url', p.image_url, 'stock_quantity', p.stock_quantity,
            'sizes', p.sizes, 'colors', p.colors, 'variants', p.variants,
            'is_active', p.is_active, 'archived_at', p.archived_at,
            'min_stock_level', p.min_stock_level, 'created_at', p.created_at
          )
        ELSE
          jsonb_build_object(
            'id', p.id, 'name', p.name, 'category', p.category, 'price', p.price,
            'original_price', p.original_price, 'image_url', p.image_url,
            'stock_quantity', p.stock_quantity, 'is_active', p.is_active,
            'archived_at', p.archived_at, 'min_stock_level', p.min_stock_level,
            'discount_type', p.discount_type, 'discount_value', p.discount_value,
            'discount_start_date', p.discount_start_date, 'discount_end_date', p.discount_end_date,
            'created_at', p.created_at, 'updated_at', p.updated_at
          )
      END AS row_json,
      p.created_at
    FROM products p
    WHERE p.owner_id = p_owner_id
      AND (p_category IS NULL OR trim(p_category) = '' OR p.category = trim(p_category))
      AND (
        p_search IS NULL OR trim(p_search) = ''
        OR p.name ILIKE '%' || trim(p_search) || '%'
      )
    ORDER BY p.created_at DESC
    LIMIT v_limit OFFSET v_offset
  ) sub;

  RETURN jsonb_build_object(
    'products', COALESCE(v_products, '[]'::jsonb),
    'total', v_total,
    'has_more', (v_offset + v_limit) < v_total,
    'profile', v_profile
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_owner_products_page(UUID, INT, INT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_owner_products_page(UUID, INT, INT, TEXT, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) list_merchant_orders — summary line items (id + product_id only)
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
        jsonb_build_object(
          'id', oi.id,
          'product_id', oi.product_id
        )
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
-- 3) Bootstrap — slimmer settings + grid product preview
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

  SELECT json_build_object(
    'store', (
      SELECT json_build_object(
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
      SELECT json_build_object(
        'id', ss.id,
        'owner_id', ss.owner_id,
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
      SELECT json_agg(json_build_object('id', c.id, 'name', c.name, 'order', c.display_order) ORDER BY c.display_order)
      FROM public.categories c
      WHERE c.owner_id = p_user_id
    ), '[]'::json),
    'products', COALESCE((
      SELECT json_agg(json_build_object(
        'id', p.id, 'name', p.name, 'category', p.category, 'price', p.price,
        'original_price', p.original_price, 'image_url', p.image_url,
        'stock_quantity', p.stock_quantity, 'is_active', p.is_active,
        'archived_at', p.archived_at, 'created_at', p.created_at
      ) ORDER BY p.created_at DESC)
      FROM (
        SELECT id, name, category, price, original_price, image_url, stock_quantity, is_active, archived_at, created_at
        FROM public.products
        WHERE owner_id = p_user_id
        ORDER BY created_at DESC
        LIMIT 50
      ) p
    ), '[]'::json),
    'orders_count', (
      SELECT COUNT(*)::int
      FROM public.orders
      WHERE owner_id = p_user_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (44, 'payload: grid product profile, lean order list items, slim bootstrap')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
