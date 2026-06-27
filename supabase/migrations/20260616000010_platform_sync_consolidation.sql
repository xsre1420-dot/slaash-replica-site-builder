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
