-- Slaash Platform Sync Bundle
-- Generated: 2026-06-20T16:10:04.664Z
-- Files: 12
-- Run in Supabase SQL Editor (idempotent where noted)

-- ── 20260616000001_checkout_stock_validation_fix.sql ──
-- Align checkout stock validation with storefront client logic:
-- 1) Resolve store owner from slug for logged-in customers (not only anon)
-- 2) Trust aggregate stock when variant rows are empty/out of sync

CREATE OR REPLACE FUNCTION public.resolve_checkout_owner(
  p_owner_id UUID,
  p_store_slug TEXT
) RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
BEGIN
  IF p_store_slug IS NOT NULL AND trim(p_store_slug) <> '' AND p_store_slug ~ '^[a-z0-9-]+$' THEN
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

    IF v_owner IS NOT NULL THEN
      IF p_owner_id IS NOT NULL AND p_owner_id <> v_owner THEN
        RAISE EXCEPTION 'store_owner_mismatch';
      END IF;
      RETURN v_owner;
    END IF;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    IF p_owner_id IS NULL OR p_owner_id <> auth.uid() THEN
      RAISE EXCEPTION 'unauthorized_checkout';
    END IF;
    RETURN auth.uid();
  END IF;

  RAISE EXCEPTION 'store_slug_required';
END;
$$;

CREATE OR REPLACE FUNCTION public.create_order_with_stock_deduction(
  p_order_id UUID,
  p_owner_id UUID,
  p_idempotency_key TEXT,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_customer_address TEXT,
  p_total_amount DECIMAL,
  p_customer_governorate TEXT,
  p_notes TEXT,
  p_items JSONB,
  p_payment_method TEXT DEFAULT 'cash_on_delivery',
  p_coupon_code TEXT DEFAULT NULL,
  p_store_slug TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_order_id UUID;
  v_product_id UUID;
  v_qty INT;
  v_stock INT;
  v_db_price DECIMAL;
  v_variants JSONB;
  v_item JSONB;
  v_line_total DECIMAL := 0;
  v_subtotal DECIMAL := 0;
  v_computed_total DECIMAL := 0;
  v_delivery_fee DECIMAL := 0;
  v_coupon_discount DECIMAL := 0;
  v_coupon RECORD;
  v_item_count INT;
  v_updated_count INT;
  v_selected_size TEXT;
  v_selected_color TEXT;
  v_variant_qty INT;
  v_found_variant BOOLEAN;
  v_variant_elem JSONB;
  v_existing_order UUID;
  v_line_qty INT;
  v_effective_owner UUID;
BEGIN
  SET LOCAL search_path = public;

  BEGIN
    v_effective_owner := public.resolve_checkout_owner(p_owner_id, p_store_slug);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
  END;

  IF v_effective_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
  END IF;

  IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
    SELECT id INTO v_existing_order
    FROM orders
    WHERE owner_id = v_effective_owner AND idempotency_key = trim(p_idempotency_key)
    LIMIT 1;

    IF v_existing_order IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'order_id', v_existing_order,
        'message', 'Order already exists',
        'idempotent', true
      );
    END IF;
  END IF;

  IF p_customer_name IS NULL OR trim(p_customer_name) = '' OR
     p_customer_phone IS NULL OR trim(p_customer_phone) = '' OR
     p_customer_address IS NULL OR trim(p_customer_address) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'customer_info_required');
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
  END IF;

  IF p_customer_governorate IS NOT NULL AND trim(p_customer_governorate) <> '' THEN
    SELECT COALESCE(
      (
        SELECT (elem->>'price')::DECIMAL
        FROM store_settings ss,
             jsonb_array_elements(COALESCE(ss.delivery_prices, '[]'::jsonb)) AS elem
        WHERE ss.owner_id = v_effective_owner
          AND elem->>'governorate' = trim(p_customer_governorate)
        LIMIT 1
      ),
      0
    ) INTO v_delivery_fee;
  END IF;

  SELECT COUNT(*)::INT
  INTO v_item_count
  FROM (
    SELECT (item->>'product_id')::UUID AS product_id
    FROM jsonb_array_elements(p_items) AS t(item)
    WHERE (item->>'product_id') IS NOT NULL
      AND (item->>'quantity')::INT > 0
    GROUP BY (item->>'product_id')::UUID
  ) aggregated;

  IF v_item_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
  END IF;

  PERFORM 1
  FROM products p
  INNER JOIN (
    SELECT DISTINCT (item->>'product_id')::UUID AS id
    FROM jsonb_array_elements(p_items) AS t(item)
    WHERE (item->>'quantity')::INT > 0
  ) ids ON p.id = ids.id
  WHERE p.owner_id = v_effective_owner AND COALESCE(p.is_active, true) = true
  ORDER BY p.id
  FOR UPDATE;

  FOR v_product_id, v_qty IN
    SELECT
      (item->>'product_id')::UUID,
      SUM((item->>'quantity')::INT)::INT
    FROM jsonb_array_elements(p_items) AS t(item)
    GROUP BY (item->>'product_id')::UUID
    ORDER BY 1
  LOOP
    SELECT
      COALESCE(stock_quantity, 2147483647),
      public.effective_product_unit_price(
        price, original_price, discount_type, discount_value, discount_start_date, discount_end_date
      ),
      variants
    INTO v_stock, v_db_price, v_variants
    FROM products
    WHERE id = v_product_id
      AND owner_id = v_effective_owner
      AND COALESCE(is_active, true) = true;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
    END IF;

    v_line_total := v_db_price * v_qty;

    FOR v_item IN SELECT item FROM jsonb_array_elements(p_items) AS t(item) LOOP
      IF (v_item->>'product_id')::UUID <> v_product_id THEN
        CONTINUE;
      END IF;

      v_selected_size := NULLIF(trim(v_item->>'selected_size'), '');
      v_selected_color := NULLIF(trim(v_item->>'selected_color'), '');
      v_line_qty := (v_item->>'quantity')::INT;

      IF v_variants IS NOT NULL
         AND jsonb_typeof(v_variants) = 'array'
         AND jsonb_array_length(v_variants) > 0
         AND (v_selected_size IS NOT NULL OR v_selected_color IS NOT NULL) THEN
        v_found_variant := false;
        FOR v_variant_elem IN SELECT value FROM jsonb_array_elements(v_variants) LOOP
          IF (v_selected_size IS NULL OR v_variant_elem->>'size' = v_selected_size)
             AND (v_selected_color IS NULL OR lower(v_variant_elem->>'color') = lower(v_selected_color)) THEN
            v_variant_qty := COALESCE((v_variant_elem->>'quantity')::INT, 0);
            IF v_variant_qty >= v_line_qty THEN
              v_found_variant := true;
              EXIT;
            END IF;
            IF v_stock >= v_qty THEN
              v_found_variant := true;
              EXIT;
            END IF;
            RETURN jsonb_build_object('success', false, 'error', 'insufficient stock');
          END IF;
        END LOOP;

        IF NOT v_found_variant THEN
          IF v_stock >= v_qty THEN
            v_found_variant := true;
          ELSE
            RETURN jsonb_build_object('success', false, 'error', 'insufficient stock');
          END IF;
        END IF;
      END IF;
    END LOOP;

    IF v_stock < v_qty THEN
      RETURN jsonb_build_object('success', false, 'error', 'insufficient stock');
    END IF;

    v_subtotal := v_subtotal + v_line_total;
  END LOOP;

  IF p_coupon_code IS NOT NULL AND trim(p_coupon_code) <> '' THEN
    SELECT * INTO v_coupon
    FROM marketing_coupons
    WHERE owner_id = v_effective_owner
      AND upper(code) = upper(trim(p_coupon_code))
      AND is_active = true
      AND start_date <= NOW()
      AND (end_date IS NULL OR end_date >= NOW())
      AND (usage_limit IS NULL OR used_count < usage_limit)
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
    END IF;

    IF v_subtotal < COALESCE(v_coupon.minimum_order_amount, 0) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
    END IF;

    IF v_coupon.discount_type = 'percentage' THEN
      v_coupon_discount := ROUND(v_subtotal * (v_coupon.discount_value / 100), 2);
    ELSE
      v_coupon_discount := LEAST(v_coupon.discount_value, v_subtotal);
    END IF;

    UPDATE marketing_coupons
    SET used_count = used_count + 1, updated_at = NOW()
    WHERE id = v_coupon.id;
  END IF;

  v_computed_total := v_subtotal - v_coupon_discount + COALESCE(v_delivery_fee, 0);

  IF p_total_amount IS NOT NULL AND ABS(p_total_amount - v_computed_total) > 0.01 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'total_amount_mismatch',
      'expected_total', v_computed_total
    );
  END IF;

  INSERT INTO orders (
    id, owner_id, idempotency_key, customer_name, customer_phone, customer_address,
    total_amount, status, notes, customer_governorate, payment_method,
    coupon_code, discount_amount, delivery_fee, created_at, updated_at
  ) VALUES (
    COALESCE(p_order_id, gen_random_uuid()),
    v_effective_owner,
    NULLIF(trim(p_idempotency_key), ''),
    trim(p_customer_name),
    trim(p_customer_phone),
    trim(p_customer_address),
    v_computed_total,
    'pending',
    NULLIF(trim(p_notes), ''),
    NULLIF(trim(p_customer_governorate), ''),
    COALESCE(NULLIF(trim(p_payment_method), ''), 'cash_on_delivery'),
    NULLIF(upper(trim(p_coupon_code)), ''),
    v_coupon_discount,
    COALESCE(v_delivery_fee, 0),
    NOW(),
    NOW()
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (
    order_id, owner_id, product_id, product_name, product_price, quantity, subtotal, variant_metadata, created_at
  )
  SELECT
    v_order_id,
    v_effective_owner,
    (item->>'product_id')::UUID,
    p.name,
    public.effective_product_unit_price(
      p.price, p.original_price, p.discount_type, p.discount_value, p.discount_start_date, p.discount_end_date
    ),
    (item->>'quantity')::INT,
    public.effective_product_unit_price(
      p.price, p.original_price, p.discount_type, p.discount_value, p.discount_start_date, p.discount_end_date
    ) * (item->>'quantity')::INT,
    jsonb_build_object(
      'selected_size', item->>'selected_size',
      'selected_color', item->>'selected_color'
    ),
    NOW()
  FROM jsonb_array_elements(p_items) AS t(item)
  JOIN products p ON p.id = (item->>'product_id')::UUID AND p.owner_id = v_effective_owner;

  UPDATE products p
  SET stock_quantity = CASE
        WHEN p.stock_quantity IS NULL THEN NULL
        ELSE p.stock_quantity - agg.qty
      END,
      updated_at = NOW()
  FROM (
    SELECT (item->>'product_id')::UUID AS product_id, SUM((item->>'quantity')::INT)::INT AS qty
    FROM jsonb_array_elements(p_items) AS t(item)
    GROUP BY (item->>'product_id')::UUID
  ) AS agg
  WHERE p.id = agg.product_id
    AND p.owner_id = v_effective_owner
    AND (p.stock_quantity IS NULL OR p.stock_quantity >= agg.qty);

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count <> v_item_count THEN
    RAISE EXCEPTION 'stock_deduction_failed';
  END IF;

  FOR v_item IN SELECT item FROM jsonb_array_elements(p_items) AS t(item) LOOP
    v_selected_size := NULLIF(trim(v_item->>'selected_size'), '');
    v_selected_color := NULLIF(trim(v_item->>'selected_color'), '');
    v_line_qty := (v_item->>'quantity')::INT;

    IF v_selected_size IS NOT NULL OR v_selected_color IS NOT NULL THEN
      UPDATE products p
      SET variants = adjust_product_variants(p.variants, v_selected_size, v_selected_color, -v_line_qty),
          updated_at = NOW()
      WHERE p.id = (v_item->>'product_id')::UUID
        AND p.owner_id = v_effective_owner
        AND p.variants IS NOT NULL
        AND jsonb_typeof(p.variants) = 'array'
        AND jsonb_array_length(p.variants) > 0;
    END IF;
  END LOOP;

  INSERT INTO inventory_movements (order_id, product_id, owner_id, quantity_delta, reason)
  SELECT v_order_id, (item->>'product_id')::UUID, v_effective_owner, -SUM((item->>'quantity')::INT)::INT, 'order_created'
  FROM jsonb_array_elements(p_items) AS t(item)
  GROUP BY (item->>'product_id')::UUID;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'total_amount', v_computed_total,
    'discount_amount', v_coupon_discount,
    'delivery_fee', v_delivery_fee
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.resolve_checkout_owner(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_checkout_owner(UUID, TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.create_order_with_stock_deduction(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, DECIMAL, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_with_stock_deduction(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, DECIMAL, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT
) TO anon, authenticated;


-- ── 20260616000002_order_realtime_and_variants.sql ──
-- Variant color matching (case-insensitive) + enable realtime for merchant order notifications

CREATE OR REPLACE FUNCTION public.adjust_product_variants(
  p_variants JSONB,
  p_size TEXT,
  p_color TEXT,
  p_qty_delta INT
) RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN (p_size IS NULL OR elem->>'size' = p_size)
         AND (
           p_color IS NULL
           OR lower(COALESCE(elem->>'color', '')) = lower(COALESCE(p_color, ''))
         )
        THEN jsonb_set(
          elem,
          '{quantity}',
          to_jsonb(GREATEST(0, COALESCE((elem->>'quantity')::INT, 0) + p_qty_delta))
        )
        ELSE elem
      END
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(COALESCE(p_variants, '[]'::jsonb)) AS t(elem);
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
  WHEN duplicate_object THEN
    NULL;
END;
$$;


-- ── 20260616000003_merchant_catalog_sync.sql ──
-- Merchant catalog sync: archived products + unified owner listing (all lifecycle states)

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_products_owner_lifecycle
  ON public.products (owner_id, archived_at, is_active, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_owner_products_page(
  p_owner_id UUID,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  p_search TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL
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
BEGIN
  IF p_owner_id IS NULL OR p_owner_id <> auth.uid() THEN
    RETURN jsonb_build_object('products', '[]'::jsonb, 'total', 0, 'has_more', false);
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);

  SELECT COUNT(*) INTO v_total
  FROM products p
  WHERE p.owner_id = p_owner_id
    AND (p_category IS NULL OR trim(p_category) = '' OR p.category = trim(p_category))
    AND (
      p_search IS NULL OR trim(p_search) = ''
      OR p.name ILIKE '%' || trim(p_search) || '%'
    );

  SELECT COALESCE(jsonb_agg(to_jsonb(sub) ORDER BY sub.created_at DESC), '[]'::jsonb)
  INTO v_products
  FROM (
    SELECT
      p.id, p.name, p.description, p.category, p.price, p.cost,
      p.image_url, p.additional_images, p.stock_quantity, p.min_stock_level,
      p.sizes, p.colors, p.variants, p.is_active, p.archived_at,
      p.discount_type, p.discount_value, p.discount_start_date, p.discount_end_date, p.original_price,
      p.created_at, p.updated_at
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
    'has_more', (v_offset + v_limit) < v_total
  );
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  END IF;
EXCEPTION
  WHEN undefined_object THEN NULL;
  WHEN duplicate_object THEN NULL;
END;
$$;


-- ── 20260616000004_products_schema_repair.sql ──
-- Idempotent repair: add product columns expected by the app (safe to re-run)

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cost DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS original_price DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS stock_quantity INT,
  ADD COLUMN IF NOT EXISTS sizes TEXT[],
  ADD COLUMN IF NOT EXISTS colors JSONB,
  ADD COLUMN IF NOT EXISTS variants JSONB,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS min_stock_level INT DEFAULT 3,
  ADD COLUMN IF NOT EXISTS discount_type TEXT,
  ADD COLUMN IF NOT EXISTS discount_value DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS discount_start_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS discount_end_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS store_id UUID,
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS short_description TEXT,
  ADD COLUMN IF NOT EXISTS seo_title TEXT,
  ADD COLUMN IF NOT EXISTS seo_description TEXT,
  ADD COLUMN IF NOT EXISTS product_slug TEXT,
  ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS low_stock_threshold INT DEFAULT 3,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

UPDATE public.products SET is_active = true WHERE is_active IS NULL;


-- ── 20260616000005_platform_schema_contract.sql ──
-- Platform schema contract (idempotent — safe to re-run on any environment).
-- Resolves RC-001: code/DB drift after Lovable → Cursor migration chain.
-- Ensures storefront, merchant catalog, checkout, and realtime share one contract.

-- ── Columns expected by the app ─────────────────────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS store_id UUID,
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS short_description TEXT,
  ADD COLUMN IF NOT EXISTS seo_title TEXT,
  ADD COLUMN IF NOT EXISTS seo_description TEXT,
  ADD COLUMN IF NOT EXISTS product_slug TEXT,
  ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS low_stock_threshold INT DEFAULT 3;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS store_id UUID,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_code TEXT,
  ADD COLUMN IF NOT EXISTS marketing_attribution JSONB;

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS terms_conditions TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_welcome_message TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_order_confirmation TEXT;

-- ── Storefront: published = active AND not archived (matches productLifecycle.ts) ──
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

  SELECT s.owner_id INTO v_owner_id
  FROM store_settings s
  WHERE LOWER(s.store_slug) = LOWER(trim(p_slug))
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    SELECT st.user_id INTO v_owner_id
    FROM stores st
    WHERE LOWER(st.store_slug) = LOWER(trim(p_slug))
    LIMIT 1;
  END IF;

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('products', '[]'::jsonb, 'next_cursor', NULL, 'has_more', false);
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 24), 1), 48);

  IF p_cursor IS NOT NULL AND trim(p_cursor) <> '' AND position('|' IN p_cursor) > 0 THEN
    v_cursor_ts := split_part(p_cursor, '|', 1)::timestamptz;
    v_cursor_id := split_part(p_cursor, '|', 2)::uuid;
  END IF;

  WITH filtered AS (
    SELECT p.*
    FROM products p
    WHERE p.owner_id = v_owner_id
      AND COALESCE(p.is_active, true) = true
      AND p.archived_at IS NULL
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
  ),
  page AS (
    SELECT * FROM filtered LIMIT v_limit
  )
  SELECT
    COALESCE((SELECT jsonb_agg(public.storefront_product_json(page.*) ORDER BY page.created_at DESC, page.id DESC) FROM page), '[]'::jsonb),
    (SELECT COUNT(*) > v_limit FROM filtered),
    (SELECT page.created_at FROM page ORDER BY page.created_at ASC, page.id ASC LIMIT 1),
    (SELECT page.id FROM page ORDER BY page.created_at ASC, page.id ASC LIMIT 1)
  INTO v_products, v_has_more, v_last_created, v_last_id;

  IF v_has_more AND v_last_created IS NOT NULL AND v_last_id IS NOT NULL THEN
    v_next_cursor := v_last_created::text || '|' || v_last_id::text;
  END IF;

  RETURN jsonb_build_object(
    'products', COALESCE(v_products, '[]'::jsonb),
    'next_cursor', v_next_cursor,
    'has_more', COALESCE(v_has_more, false)
  );
END;
$$;

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
  stock_quantity INTEGER
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
    p.discount_type, p.discount_value, p.original_price, p.stock_quantity
  FROM products p
  WHERE p.owner_id = v_owner_id
    AND COALESCE(p.is_active, true) = true
    AND p.archived_at IS NULL
  ORDER BY p.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_store_product_by_id(p_slug TEXT, p_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_product JSONB;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9-]+$' OR p_product_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT owner_id INTO v_owner_id
  FROM store_settings
  WHERE LOWER(store_slug) = LOWER(trim(p_slug))
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    SELECT user_id INTO v_owner_id
    FROM stores
    WHERE LOWER(store_slug) = LOWER(trim(p_slug))
    LIMIT 1;
  END IF;

  IF v_owner_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT to_jsonb(p.*) INTO v_product
  FROM products p
  WHERE p.id = p_product_id
    AND p.owner_id = v_owner_id
    AND COALESCE(p.is_active, true) = true
    AND p.archived_at IS NULL;

  RETURN v_product;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_store_products_page(TEXT, INT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_products_by_slug(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_product_by_id(TEXT, UUID) TO anon, authenticated;

-- ── Realtime contract (merchant order + catalog sync) ─────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'products'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
    END IF;
  END IF;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;


-- ── 20260616000006_post_audit_hardening.sql ──
-- Post-audit hardening: GRANTs, checkout archived guard, generic RPC errors

GRANT EXECUTE ON FUNCTION public.get_owner_products_page(UUID, INT, INT, TEXT, TEXT) TO authenticated;

-- Align product view tracking with storefront visibility
CREATE OR REPLACE FUNCTION public.track_product_view_by_slug(
  p_slug TEXT,
  p_product_id UUID,
  p_page_path TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9-]+$' OR p_product_id IS NULL THEN
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

  IF NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = p_product_id
      AND p.owner_id = v_owner_id
      AND COALESCE(p.is_active, true) = true
      AND p.archived_at IS NULL
  ) THEN
    RETURN;
  END IF;

  INSERT INTO product_views (product_id, owner_id, page_path, created_at)
  VALUES (p_product_id, v_owner_id, NULLIF(trim(p_page_path), ''), NOW());
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_product_view_by_slug(TEXT, UUID, TEXT) TO anon, authenticated;


-- ── 20260616000007_checkout_stock_unified.sql ──
-- Unified checkout stock: mirrors client getAvailableQty() and fixes false
-- "insufficient stock" when variant rows hold inventory but stock_quantity is 0.

CREATE OR REPLACE FUNCTION public.product_variant_stock_sum(p_variants JSONB)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(SUM(COALESCE((elem->>'quantity')::INT, 0)), 0)::INT
  FROM jsonb_array_elements(
    CASE
      WHEN p_variants IS NOT NULL AND jsonb_typeof(p_variants) = 'array' THEN p_variants
      ELSE '[]'::jsonb
    END
  ) AS elem;
$$;

CREATE OR REPLACE FUNCTION public.product_checkout_available_qty(
  p_stock INT,
  p_variants JSONB,
  p_size TEXT,
  p_color TEXT
) RETURNS INT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_aggregate INT;
  v_variant_qty INT;
  v_variant_sum INT;
  v_elem JSONB;
BEGIN
  v_aggregate := CASE
    WHEN p_stock IS NULL THEN 2147483647
    WHEN p_stock < 0 THEN 2147483647
    ELSE p_stock
  END;

  IF p_variants IS NULL
     OR jsonb_typeof(p_variants) <> 'array'
     OR jsonb_array_length(p_variants) = 0 THEN
    RETURN v_aggregate;
  END IF;

  IF p_size IS NOT NULL OR p_color IS NOT NULL THEN
    FOR v_elem IN SELECT value FROM jsonb_array_elements(p_variants) LOOP
      IF (p_size IS NULL OR v_elem->>'size' = p_size)
         AND (p_color IS NULL OR lower(v_elem->>'color') = lower(p_color)) THEN
        v_variant_qty := COALESCE((v_elem->>'quantity')::INT, 0);
        IF v_variant_qty > 0 THEN
          IF v_aggregate = 2147483647 THEN
            RETURN v_variant_qty;
          END IF;
          RETURN LEAST(v_variant_qty, v_aggregate);
        END IF;
        IF v_aggregate > 0 AND v_aggregate <> 2147483647 THEN
          RETURN v_aggregate;
        END IF;
        RETURN 0;
      END IF;
    END LOOP;

    IF v_aggregate = 2147483647 THEN
      RETURN 0;
    END IF;
    RETURN v_aggregate;
  END IF;

  v_variant_sum := public.product_variant_stock_sum(p_variants);
  IF v_variant_sum > 0 THEN
    IF v_aggregate = 2147483647 THEN
      RETURN v_variant_sum;
    END IF;
    RETURN LEAST(v_variant_sum, v_aggregate);
  END IF;

  RETURN v_aggregate;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_order_with_stock_deduction(
  p_order_id UUID,
  p_owner_id UUID,
  p_idempotency_key TEXT,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_customer_address TEXT,
  p_total_amount DECIMAL,
  p_customer_governorate TEXT,
  p_notes TEXT,
  p_items JSONB,
  p_payment_method TEXT DEFAULT 'cash_on_delivery',
  p_coupon_code TEXT DEFAULT NULL,
  p_store_slug TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_order_id UUID;
  v_product_id UUID;
  v_product_name TEXT;
  v_qty INT;
  v_stock INT;
  v_available INT;
  v_db_price DECIMAL;
  v_variants JSONB;
  v_item JSONB;
  v_line_total DECIMAL := 0;
  v_subtotal DECIMAL := 0;
  v_computed_total DECIMAL := 0;
  v_delivery_fee DECIMAL := 0;
  v_coupon_discount DECIMAL := 0;
  v_coupon RECORD;
  v_item_count INT;
  v_updated_count INT;
  v_selected_size TEXT;
  v_selected_color TEXT;
  v_line_qty INT;
  v_existing_order UUID;
  v_effective_owner UUID;
BEGIN
  SET LOCAL search_path = public;

  BEGIN
    v_effective_owner := public.resolve_checkout_owner(p_owner_id, p_store_slug);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
  END;

  IF v_effective_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
  END IF;

  IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
    SELECT id INTO v_existing_order
    FROM orders
    WHERE owner_id = v_effective_owner AND idempotency_key = trim(p_idempotency_key)
    LIMIT 1;

    IF v_existing_order IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'order_id', v_existing_order,
        'message', 'Order already exists',
        'idempotent', true
      );
    END IF;
  END IF;

  IF p_customer_name IS NULL OR trim(p_customer_name) = '' OR
     p_customer_phone IS NULL OR trim(p_customer_phone) = '' OR
     p_customer_address IS NULL OR trim(p_customer_address) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'customer_info_required');
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
  END IF;

  IF p_customer_governorate IS NOT NULL AND trim(p_customer_governorate) <> '' THEN
    SELECT COALESCE(
      (
        SELECT (elem->>'price')::DECIMAL
        FROM store_settings ss,
             jsonb_array_elements(COALESCE(ss.delivery_prices, '[]'::jsonb)) AS elem
        WHERE ss.owner_id = v_effective_owner
          AND elem->>'governorate' = trim(p_customer_governorate)
        LIMIT 1
      ),
      0
    ) INTO v_delivery_fee;
  END IF;

  SELECT COUNT(*)::INT
  INTO v_item_count
  FROM (
    SELECT (item->>'product_id')::UUID AS product_id
    FROM jsonb_array_elements(p_items) AS t(item)
    WHERE (item->>'product_id') IS NOT NULL
      AND (item->>'quantity')::INT > 0
    GROUP BY (item->>'product_id')::UUID
  ) aggregated;

  IF v_item_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
  END IF;

  PERFORM 1
  FROM products p
  INNER JOIN (
    SELECT DISTINCT (item->>'product_id')::UUID AS id
    FROM jsonb_array_elements(p_items) AS t(item)
    WHERE (item->>'quantity')::INT > 0
  ) ids ON p.id = ids.id
  WHERE p.owner_id = v_effective_owner
    AND COALESCE(p.is_active, true) = true
    AND p.archived_at IS NULL
  ORDER BY p.id
  FOR UPDATE;

  FOR v_item IN SELECT item FROM jsonb_array_elements(p_items) AS t(item) LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_line_qty := (v_item->>'quantity')::INT;

    IF v_product_id IS NULL OR v_line_qty IS NULL OR v_line_qty <= 0 THEN
      CONTINUE;
    END IF;

    v_selected_size := NULLIF(trim(v_item->>'selected_size'), '');
    v_selected_color := NULLIF(trim(v_item->>'selected_color'), '');

    SELECT
      COALESCE(stock_quantity, 2147483647),
      variants,
      name
    INTO v_stock, v_variants, v_product_name
    FROM products
    WHERE id = v_product_id
      AND owner_id = v_effective_owner
      AND COALESCE(is_active, true) = true
      AND archived_at IS NULL;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
    END IF;

    v_available := public.product_checkout_available_qty(
      CASE WHEN v_stock = 2147483647 THEN NULL ELSE v_stock END,
      v_variants,
      v_selected_size,
      v_selected_color
    );

    IF v_available < v_line_qty THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'insufficient stock',
        'product_id', v_product_id,
        'product_name', v_product_name,
        'available', v_available,
        'requested', v_line_qty
      );
    END IF;
  END LOOP;

  FOR v_product_id, v_qty IN
    SELECT
      (item->>'product_id')::UUID,
      SUM((item->>'quantity')::INT)::INT
    FROM jsonb_array_elements(p_items) AS t(item)
    GROUP BY (item->>'product_id')::UUID
    ORDER BY 1
  LOOP
    SELECT public.effective_product_unit_price(
      price, original_price, discount_type, discount_value, discount_start_date, discount_end_date
    )
    INTO v_db_price
    FROM products
    WHERE id = v_product_id
      AND owner_id = v_effective_owner
      AND COALESCE(is_active, true) = true
      AND archived_at IS NULL;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
    END IF;

    v_line_total := v_db_price * v_qty;
    v_subtotal := v_subtotal + v_line_total;
  END LOOP;

  IF p_coupon_code IS NOT NULL AND trim(p_coupon_code) <> '' THEN
    SELECT * INTO v_coupon
    FROM marketing_coupons
    WHERE owner_id = v_effective_owner
      AND upper(code) = upper(trim(p_coupon_code))
      AND is_active = true
      AND start_date <= NOW()
      AND (end_date IS NULL OR end_date >= NOW())
      AND (usage_limit IS NULL OR used_count < usage_limit)
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
    END IF;

    IF v_subtotal < COALESCE(v_coupon.minimum_order_amount, 0) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
    END IF;

    IF v_coupon.discount_type = 'percentage' THEN
      v_coupon_discount := ROUND(v_subtotal * (v_coupon.discount_value / 100), 2);
    ELSE
      v_coupon_discount := LEAST(v_coupon.discount_value, v_subtotal);
    END IF;

    UPDATE marketing_coupons
    SET used_count = used_count + 1, updated_at = NOW()
    WHERE id = v_coupon.id;
  END IF;

  v_computed_total := v_subtotal - v_coupon_discount + COALESCE(v_delivery_fee, 0);

  IF p_total_amount IS NOT NULL AND ABS(p_total_amount - v_computed_total) > 0.01 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'total_amount_mismatch',
      'expected_total', v_computed_total
    );
  END IF;

  INSERT INTO orders (
    id, owner_id, idempotency_key, customer_name, customer_phone, customer_address,
    total_amount, status, notes, customer_governorate, payment_method,
    coupon_code, discount_amount, delivery_fee, created_at, updated_at
  ) VALUES (
    COALESCE(p_order_id, gen_random_uuid()),
    v_effective_owner,
    NULLIF(trim(p_idempotency_key), ''),
    trim(p_customer_name),
    trim(p_customer_phone),
    trim(p_customer_address),
    v_computed_total,
    'pending',
    NULLIF(trim(p_notes), ''),
    NULLIF(trim(p_customer_governorate), ''),
    COALESCE(NULLIF(trim(p_payment_method), ''), 'cash_on_delivery'),
    NULLIF(upper(trim(p_coupon_code)), ''),
    v_coupon_discount,
    COALESCE(v_delivery_fee, 0),
    NOW(),
    NOW()
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (
    order_id, owner_id, product_id, product_name, product_price, quantity, subtotal, variant_metadata, created_at
  )
  SELECT
    v_order_id,
    v_effective_owner,
    (item->>'product_id')::UUID,
    p.name,
    public.effective_product_unit_price(
      p.price, p.original_price, p.discount_type, p.discount_value, p.discount_start_date, p.discount_end_date
    ),
    (item->>'quantity')::INT,
    public.effective_product_unit_price(
      p.price, p.original_price, p.discount_type, p.discount_value, p.discount_start_date, p.discount_end_date
    ) * (item->>'quantity')::INT,
    jsonb_build_object(
      'selected_size', NULLIF(trim(item->>'selected_size'), ''),
      'selected_color', NULLIF(trim(item->>'selected_color'), '')
    ),
    NOW()
  FROM jsonb_array_elements(p_items) AS t(item)
  JOIN products p ON p.id = (item->>'product_id')::UUID AND p.owner_id = v_effective_owner;

  UPDATE products p
  SET stock_quantity = CASE
        WHEN p.stock_quantity IS NULL THEN NULL
        WHEN p.stock_quantity >= agg.qty THEN p.stock_quantity - agg.qty
        ELSE p.stock_quantity
      END,
      updated_at = NOW()
  FROM (
    SELECT (item->>'product_id')::UUID AS product_id, SUM((item->>'quantity')::INT)::INT AS qty
    FROM jsonb_array_elements(p_items) AS t(item)
    GROUP BY (item->>'product_id')::UUID
  ) AS agg
  WHERE p.id = agg.product_id
    AND p.owner_id = v_effective_owner
    AND (
      p.stock_quantity IS NULL
      OR p.stock_quantity >= agg.qty
      OR public.product_variant_stock_sum(p.variants) >= agg.qty
    );

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count <> v_item_count THEN
    RETURN jsonb_build_object('success', false, 'error', 'stock_deduction_failed');
  END IF;

  FOR v_item IN SELECT item FROM jsonb_array_elements(p_items) AS t(item) LOOP
    v_selected_size := NULLIF(trim(v_item->>'selected_size'), '');
    v_selected_color := NULLIF(trim(v_item->>'selected_color'), '');
    v_line_qty := (v_item->>'quantity')::INT;

    IF v_selected_size IS NOT NULL OR v_selected_color IS NOT NULL THEN
      UPDATE products p
      SET variants = adjust_product_variants(p.variants, v_selected_size, v_selected_color, -v_line_qty),
          updated_at = NOW()
      WHERE p.id = (v_item->>'product_id')::UUID
        AND p.owner_id = v_effective_owner
        AND p.variants IS NOT NULL
        AND jsonb_typeof(p.variants) = 'array'
        AND jsonb_array_length(p.variants) > 0;
    END IF;
  END LOOP;

  INSERT INTO inventory_movements (order_id, product_id, owner_id, quantity_delta, reason)
  SELECT v_order_id, (item->>'product_id')::UUID, v_effective_owner, -SUM((item->>'quantity')::INT)::INT, 'order_created'
  FROM jsonb_array_elements(p_items) AS t(item)
  GROUP BY (item->>'product_id')::UUID;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'total_amount', v_computed_total,
    'discount_amount', v_coupon_discount,
    'delivery_fee', v_delivery_fee
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.product_variant_stock_sum(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.product_variant_stock_sum(JSONB) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.product_checkout_available_qty(INT, JSONB, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.product_checkout_available_qty(INT, JSONB, TEXT, TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.create_order_with_stock_deduction(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, DECIMAL, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_with_stock_deduction(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, DECIMAL, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT
) TO anon, authenticated;


-- ── 20260616000008_publish_and_reviews_fix.sql ──
-- Publish lifecycle + merchant review management

CREATE OR REPLACE FUNCTION public.resolve_store_owner_by_slug(p_slug TEXT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
BEGIN
  IF p_slug IS NULL OR trim(p_slug) = '' OR p_slug !~ '^[a-z0-9-]+$' THEN
    RETURN NULL;
  END IF;

  SELECT ss.owner_id INTO v_owner
  FROM store_settings ss
  WHERE lower(trim(ss.store_slug)) = lower(trim(p_slug))
  LIMIT 1;

  IF v_owner IS NOT NULL THEN
    RETURN v_owner;
  END IF;

  SELECT st.user_id INTO v_owner
  FROM stores st
  WHERE lower(trim(st.store_slug)) = lower(trim(p_slug))
  LIMIT 1;

  RETURN v_owner;
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_owner_product(p_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row products%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR p_product_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  UPDATE products
  SET is_active = true,
      archived_at = NULL,
      updated_at = NOW()
  WHERE id = p_product_id
    AND owner_id = auth.uid()
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object('success', true, 'product', to_jsonb(v_row));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_merchant_product_reviews(p_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL OR p_product_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = p_product_id AND p.owner_id = auth.uid()
  ) THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'reviewer_name', r.reviewer_name,
      'reviewer_email', r.reviewer_email,
      'rating', r.rating,
      'comment', r.comment,
      'is_approved', COALESCE(r.is_approved, false),
      'is_featured', COALESCE(r.is_featured, false),
      'helpful_count', COALESCE(r.helpful_count, 0),
      'created_at', r.created_at
    ) ORDER BY r.created_at DESC
  ), '[]'::jsonb)
  INTO v_result
  FROM product_reviews r
  WHERE r.product_id = p_product_id
    AND r.owner_id = auth.uid();

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_product_review(p_review_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_review_id IS NULL THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  UPDATE product_reviews
  SET is_approved = true,
      updated_at = NOW()
  WHERE id = p_review_id
    AND owner_id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_product_review_for_store(
  p_slug TEXT,
  p_product_id UUID,
  p_reviewer_name TEXT,
  p_rating INT,
  p_comment TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_review_id UUID;
BEGIN
  IF p_slug IS NULL OR p_product_id IS NULL OR p_slug !~ '^[a-z0-9-]+$' THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  IF p_reviewer_name IS NULL OR trim(p_reviewer_name) = ''
     OR p_comment IS NULL OR length(trim(p_comment)) < 2
     OR p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  v_owner_id := public.resolve_store_owner_by_slug(p_slug);

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = p_product_id
      AND p.owner_id = v_owner_id
      AND COALESCE(p.is_active, true) = true
      AND p.archived_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  INSERT INTO product_reviews (
    product_id, owner_id, reviewer_name, reviewer_email,
    rating, comment, is_approved
  ) VALUES (
    p_product_id, v_owner_id, trim(p_reviewer_name), NULL,
    p_rating, trim(p_comment), false
  ) RETURNING id INTO v_review_id;

  RETURN jsonb_build_object('success', true, 'review_id', v_review_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_approved_product_reviews(
  p_slug TEXT,
  p_product_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_result JSONB;
BEGIN
  IF p_slug IS NULL OR p_product_id IS NULL OR p_slug !~ '^[a-z0-9-]+$' THEN
    RETURN '[]'::jsonb;
  END IF;

  v_owner_id := public.resolve_store_owner_by_slug(p_slug);

  IF v_owner_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = p_product_id AND p.owner_id = v_owner_id
  ) THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'reviewer_name', r.reviewer_name,
      'rating', r.rating,
      'comment', r.comment,
      'created_at', r.created_at,
      'helpful_count', COALESCE(r.helpful_count, 0)
    ) ORDER BY r.created_at DESC
  ), '[]'::jsonb)
  INTO v_result
  FROM product_reviews r
  WHERE r.product_id = p_product_id
    AND r.owner_id = v_owner_id
    AND r.is_approved = true;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_store_owner_by_slug(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_owner_product(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_merchant_product_reviews(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_product_review(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_product_review_for_store(TEXT, UUID, TEXT, INT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_approved_product_reviews(TEXT, UUID) TO anon, authenticated;


-- ── 20260616000009_platform_db_integration.sql ──
-- Platform ↔ database integration contract + health diagnostics

CREATE TABLE IF NOT EXISTS public.platform_schema_version (
  version INT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

INSERT INTO public.platform_schema_version (version, notes)
VALUES (9, 'platform_db_integration_health_check')
ON CONFLICT (version) DO UPDATE
SET applied_at = NOW(), notes = EXCLUDED.notes;

CREATE OR REPLACE FUNCTION public._platform_fn_exists(p_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = p_name
  );
$$;

CREATE OR REPLACE FUNCTION public._platform_col_exists(p_table TEXT, p_column TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = p_table
      AND c.column_name = p_column
  );
$$;

CREATE OR REPLACE FUNCTION public.platform_health_check()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_required INT := 9;
  v_version INT := 0;
  v_missing TEXT[] := ARRAY[]::TEXT[];
  v_fn TEXT;
  v_required_fns TEXT[] := ARRAY[
    'get_store_products_page',
    'get_store_products_by_slug',
    'get_store_product_by_id',
    'get_store_meta',
    'get_owner_products_page',
    'create_order_with_stock_deduction',
    'resolve_checkout_owner',
    'publish_owner_product',
    'get_merchant_product_reviews',
    'submit_product_review_for_store',
    'product_checkout_available_qty'
  ];
  v_required_cols TEXT[] := ARRAY[
    'products.archived_at',
    'products.is_active',
    'products.variants',
    'products.stock_quantity',
    'orders.idempotency_key',
    'store_settings.store_slug'
  ];
  v_col TEXT;
  v_table TEXT;
  v_column TEXT;
BEGIN
  SELECT COALESCE(
    (SELECT psv.version FROM public.platform_schema_version psv ORDER BY psv.version DESC LIMIT 1),
    0
  ) INTO v_version;

  FOREACH v_fn IN ARRAY v_required_fns LOOP
    IF NOT public._platform_fn_exists(v_fn) THEN
      v_missing := array_append(v_missing, 'function:' || v_fn);
    END IF;
  END LOOP;

  FOREACH v_col IN ARRAY v_required_cols LOOP
    v_table := split_part(v_col, '.', 1);
    v_column := split_part(v_col, '.', 2);
    IF NOT public._platform_col_exists(v_table, v_column) THEN
      v_missing := array_append(v_missing, 'column:' || v_col);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', COALESCE(array_length(v_missing, 1), 0) = 0 AND v_version >= v_required,
    'schema_version', v_version,
    'required_version', v_required,
    'missing', COALESCE(to_jsonb(v_missing), '[]'::jsonb),
    'checks', jsonb_build_object(
      'storefront', public._platform_fn_exists('get_store_products_page'),
      'checkout', public._platform_fn_exists('create_order_with_stock_deduction'),
      'merchant_catalog', public._platform_fn_exists('get_owner_products_page'),
      'publish', public._platform_fn_exists('publish_owner_product'),
      'reviews', public._platform_fn_exists('get_merchant_product_reviews')
    ),
    'message', CASE
      WHEN COALESCE(array_length(v_missing, 1), 0) > 0 THEN 'migration_required'
      WHEN v_version < v_required THEN 'schema_version_outdated'
      ELSE 'ok'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_health_check() TO anon, authenticated;


-- ── 20260616000010_platform_sync_consolidation.sql ──
-- Platform sync consolidation (idempotent) — schema v10
-- Ensures all columns, FKs, GRANTs, and health check match application code.

-- ── Schema version ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_schema_version (
  version INT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

INSERT INTO public.platform_schema_version (version, notes)
VALUES (10, 'platform_sync_consolidation')
ON CONFLICT (version) DO UPDATE
SET applied_at = NOW(), notes = EXCLUDED.notes;

-- ── stores (multi-tenant) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL DEFAULT 'متجري',
  store_slug TEXT,
  theme_id TEXT DEFAULT 'default',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT stores_user_id_unique UNIQUE (user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_slug_lower
  ON public.stores (LOWER(store_slug))
  WHERE store_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stores_user_id ON public.stores(user_id);

INSERT INTO public.stores (id, user_id, store_name, store_slug)
SELECT ss.id, ss.owner_id, COALESCE(ss.store_name, 'متجري'), ss.store_slug
FROM public.store_settings ss
WHERE ss.owner_id IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET
  store_name = EXCLUDED.store_name,
  store_slug = COALESCE(EXCLUDED.store_slug, public.stores.store_slug),
  updated_at = now();

-- ── Product / order columns expected by app ─────────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id),
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS short_description TEXT,
  ADD COLUMN IF NOT EXISTS seo_title TEXT,
  ADD COLUMN IF NOT EXISTS seo_description TEXT,
  ADD COLUMN IF NOT EXISTS product_slug TEXT,
  ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS low_stock_threshold INT DEFAULT 3;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id),
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_code TEXT,
  ADD COLUMN IF NOT EXISTS marketing_attribution JSONB;

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS terms_conditions TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_welcome_message TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_order_confirmation TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

UPDATE public.profiles SET user_id = id WHERE user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

-- Backfill store_id
UPDATE public.products p
SET store_id = s.id
FROM public.stores s
WHERE p.owner_id = s.user_id AND p.store_id IS NULL;

UPDATE public.categories c
SET store_id = s.id
FROM public.stores s
WHERE c.owner_id = s.user_id AND c.store_id IS NULL;

UPDATE public.orders o
SET store_id = s.id
FROM public.stores s
WHERE o.owner_id = s.user_id AND o.store_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_store_id ON public.products(store_id);
CREATE INDEX IF NOT EXISTS idx_categories_store_id ON public.categories(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_store_id ON public.orders(store_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_owner
  ON public.orders (owner_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ── Storage bucket ──────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- ── Health check helpers (re-assert) ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._platform_fn_exists(p_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = p_name
  );
$$;

CREATE OR REPLACE FUNCTION public._platform_col_exists(p_table TEXT, p_column TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = p_table
      AND c.column_name = p_column
  );
$$;

CREATE OR REPLACE FUNCTION public._platform_table_exists(p_table TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables t
    WHERE t.table_schema = 'public' AND t.table_name = p_table
  );
$$;

CREATE OR REPLACE FUNCTION public.platform_health_check()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_required INT := 10;
  v_version INT := 0;
  v_missing TEXT[] := ARRAY[]::TEXT[];
  v_fn TEXT;
  v_required_fns TEXT[] := ARRAY[
    'get_store_products_page',
    'get_store_products_by_slug',
    'get_store_product_by_id',
    'get_store_meta',
    'get_owner_products_page',
    'create_order_with_stock_deduction',
    'resolve_checkout_owner',
    'publish_owner_product',
    'get_merchant_product_reviews',
    'submit_product_review_for_store',
    'product_checkout_available_qty',
    'get_store_statistics',
    'get_owner_bootstrap',
    'attach_order_marketing_attribution'
  ];
  v_required_cols TEXT[] := ARRAY[
    'products.archived_at',
    'products.is_active',
    'products.variants',
    'products.stock_quantity',
    'products.store_id',
    'orders.idempotency_key',
    'orders.payment_status',
    'orders.delivery_status',
    'orders.store_id',
    'store_settings.store_slug'
  ];
  v_required_tables TEXT[] := ARRAY['stores', 'platform_schema_version'];
  v_col TEXT;
  v_table TEXT;
  v_column TEXT;
  v_storage_ok BOOLEAN;
BEGIN
  SELECT COALESCE(
    (SELECT psv.version FROM public.platform_schema_version psv ORDER BY psv.version DESC LIMIT 1),
    0
  ) INTO v_version;

  FOREACH v_fn IN ARRAY v_required_fns LOOP
    IF NOT public._platform_fn_exists(v_fn) THEN
      v_missing := array_append(v_missing, 'function:' || v_fn);
    END IF;
  END LOOP;

  FOREACH v_col IN ARRAY v_required_cols LOOP
    v_table := split_part(v_col, '.', 1);
    v_column := split_part(v_col, '.', 2);
    IF NOT public._platform_col_exists(v_table, v_column) THEN
      v_missing := array_append(v_missing, 'column:' || v_col);
    END IF;
  END LOOP;

  FOREACH v_table IN ARRAY v_required_tables LOOP
    IF NOT public._platform_table_exists(v_table) THEN
      v_missing := array_append(v_missing, 'table:' || v_table);
    END IF;
  END LOOP;

  SELECT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'product-images'
  ) INTO v_storage_ok;

  IF NOT v_storage_ok THEN
    v_missing := array_append(v_missing, 'storage:product-images');
  END IF;

  RETURN jsonb_build_object(
    'ok', COALESCE(array_length(v_missing, 1), 0) = 0 AND v_version >= v_required,
    'schema_version', v_version,
    'required_version', v_required,
    'missing', COALESCE(to_jsonb(v_missing), '[]'::jsonb),
    'checks', jsonb_build_object(
      'storefront', public._platform_fn_exists('get_store_products_page'),
      'checkout', public._platform_fn_exists('create_order_with_stock_deduction'),
      'merchant_catalog', public._platform_fn_exists('get_owner_products_page'),
      'publish', public._platform_fn_exists('publish_owner_product'),
      'reviews', public._platform_fn_exists('get_merchant_product_reviews'),
      'statistics', public._platform_fn_exists('get_store_statistics'),
      'bootstrap', public._platform_fn_exists('get_owner_bootstrap'),
      'storage', v_storage_ok
    ),
    'message', CASE
      WHEN COALESCE(array_length(v_missing, 1), 0) > 0 THEN 'migration_required'
      WHEN v_version < v_required THEN 'schema_version_outdated'
      ELSE 'ok'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_health_check() TO anon, authenticated;

-- ── Re-grant critical RPCs (signature-agnostic) ─────────────────────────────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = ANY(ARRAY[
        'get_store_products_page',
        'get_store_products_by_slug',
        'get_store_product_by_id',
        'get_store_meta',
        'get_store_by_slug',
        'get_store_categories_by_slug',
        'get_owner_products_page',
        'create_order_with_stock_deduction',
        'resolve_checkout_owner',
        'publish_owner_product',
        'get_merchant_product_reviews',
        'submit_product_review_for_store',
        'approve_product_review',
        'product_checkout_available_qty',
        'get_store_statistics',
        'get_owner_bootstrap',
        'attach_order_marketing_attribution',
        'track_store_visit_by_slug',
        'track_product_view_by_slug',
        'validate_store_coupon',
        'validate_store_coupon_by_slug',
        'calculate_delivery_fee_by_slug',
        'get_approved_product_reviews',
        'is_username_available'
      ])
  LOOP
    BEGIN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', r.sig);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END;
$$;


-- ── 20260616000011_storefront_footer_products.sql ──
-- Store-level suggested products shown in storefront footer (merchant picks from product management)

CREATE TABLE IF NOT EXISTS public.storefront_footer_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT storefront_footer_products_owner_product_unique UNIQUE (owner_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_storefront_footer_products_owner_order
  ON public.storefront_footer_products (owner_id, display_order);

ALTER TABLE public.storefront_footer_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage storefront footer products" ON public.storefront_footer_products;
CREATE POLICY "Owners manage storefront footer products"
  ON public.storefront_footer_products
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND p.owner_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.get_storefront_footer_products(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_result JSONB;
BEGIN
  IF p_slug IS NULL OR trim(p_slug) = '' OR p_slug !~ '^[a-z0-9-]+$' THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT ss.owner_id INTO v_owner_id
  FROM store_settings ss
  WHERE LOWER(ss.store_slug) = LOWER(trim(p_slug))
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    BEGIN
      SELECT s.user_id INTO v_owner_id
      FROM stores s
      WHERE LOWER(s.store_slug) = LOWER(trim(p_slug))
      LIMIT 1;
    EXCEPTION WHEN undefined_table THEN
      v_owner_id := NULL;
    END;
  END IF;

  IF v_owner_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY sort_order), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'price', p.price,
        'image_url', p.image_url,
        'category', p.category
      ) AS row_data,
      COALESCE(sfp.display_order, 0) AS sort_order
    FROM storefront_footer_products sfp
    JOIN products p ON p.id = sfp.product_id AND p.owner_id = v_owner_id
    WHERE sfp.owner_id = v_owner_id
      AND COALESCE(p.is_active, true) = true
      AND p.archived_at IS NULL
    ORDER BY sort_order, sfp.created_at
    LIMIT 8
  ) sub;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_storefront_footer_products(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_footer_products(TEXT) TO anon, authenticated;


-- ── 20260616000012_product_stock_sync_trigger.sql ──
-- Keep stock_quantity aligned with variant rows when variants hold the inventory truth.

CREATE OR REPLACE FUNCTION public.sync_product_stock_on_write()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_variant_sum INT;
BEGIN
  v_variant_sum := public.product_variant_stock_sum(NEW.variants);

  IF v_variant_sum > 0 AND COALESCE(NEW.stock_quantity, 0) < v_variant_sum THEN
    NEW.stock_quantity := v_variant_sum;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_product_stock_on_write ON public.products;

CREATE TRIGGER trg_sync_product_stock_on_write
  BEFORE INSERT OR UPDATE OF stock_quantity, variants ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_product_stock_on_write();

