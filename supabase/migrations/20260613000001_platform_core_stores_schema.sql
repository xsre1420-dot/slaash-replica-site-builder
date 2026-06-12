-- Phase 1: Normalized stores schema + store_id on products
-- Phase 4: Indexes for store_id lookups
-- Phase 7: Multi-tenant store isolation via store_id

-- ---------------------------------------------------------------------------
-- stores table (Users → Stores → Products)
-- ---------------------------------------------------------------------------
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

-- Backfill from existing store_settings (preserve ids for FK consistency)
INSERT INTO public.stores (id, user_id, store_name, store_slug)
SELECT ss.id, ss.owner_id, COALESCE(ss.store_name, 'متجري'), ss.store_slug
FROM public.store_settings ss
ON CONFLICT (user_id) DO UPDATE SET
  store_name = EXCLUDED.store_name,
  store_slug = EXCLUDED.store_slug,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- store_id on products & categories
-- ---------------------------------------------------------------------------
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id);
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id);

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

-- Auto-set store_id / owner_id on product writes
CREATE OR REPLACE FUNCTION public.sync_product_store_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.store_id IS NULL AND NEW.owner_id IS NOT NULL THEN
    SELECT id INTO NEW.store_id FROM public.stores WHERE user_id = NEW.owner_id LIMIT 1;
  END IF;
  IF NEW.owner_id IS NULL AND NEW.store_id IS NOT NULL THEN
    SELECT user_id INTO NEW.owner_id FROM public.stores WHERE id = NEW.store_id LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_product_store_owner ON public.products;
CREATE TRIGGER trg_sync_product_store_owner
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.sync_product_store_owner();

CREATE OR REPLACE FUNCTION public.sync_category_store_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.store_id IS NULL AND NEW.owner_id IS NOT NULL THEN
    SELECT id INTO NEW.store_id FROM public.stores WHERE user_id = NEW.owner_id LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_category_store_owner ON public.categories;
CREATE TRIGGER trg_sync_category_store_owner
  BEFORE INSERT OR UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.sync_category_store_owner();

-- ---------------------------------------------------------------------------
-- RLS: stores table
-- ---------------------------------------------------------------------------
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own store" ON public.stores;
CREATE POLICY "Users manage own store"
  ON public.stores FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public read store by slug via RPC only" ON public.stores;
-- No direct public SELECT — resolved via security-definer RPCs

-- ---------------------------------------------------------------------------
-- RPC: get store for authenticated user
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_store_for_user(p_user_id UUID)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT json_build_object(
    'id', s.id,
    'user_id', s.user_id,
    'store_name', s.store_name,
    'store_slug', s.store_slug,
    'theme_id', COALESCE(s.theme_id, 'default')
  )
  FROM public.stores s
  WHERE s.user_id = p_user_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_store_for_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_for_user(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: owner bootstrap bundle (Phase 6 — combine requests)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_owner_bootstrap(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_store_id UUID;
  v_result JSON;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id INTO v_store_id FROM public.stores WHERE user_id = p_user_id LIMIT 1;

  SELECT json_build_object(
    'store', (
      SELECT json_build_object(
        'id', s.id,
        'user_id', s.user_id,
        'store_name', s.store_name,
        'store_slug', s.store_slug,
        'theme_id', COALESCE(s.theme_id, 'default')
      )
      FROM public.stores s WHERE s.user_id = p_user_id LIMIT 1
    ),
    'settings', (
      SELECT row_to_json(ss.*)
      FROM public.store_settings ss
      WHERE ss.owner_id = p_user_id
      LIMIT 1
    ),
    'categories', COALESCE((
      SELECT json_agg(json_build_object('id', c.id, 'name', c.name, 'order', c.display_order) ORDER BY c.display_order)
      FROM public.categories c
      WHERE c.store_id = v_store_id OR c.owner_id = p_user_id
    ), '[]'::json),
    'products', COALESCE((
      SELECT json_agg(row_to_json(p.*) ORDER BY p.created_at DESC)
      FROM (
        SELECT id, name, description, category, price, cost, image_url, stock_quantity, is_active, store_id, created_at
        FROM public.products
        WHERE store_id = v_store_id OR owner_id = p_user_id
        ORDER BY created_at DESC
        LIMIT 50
      ) p
    ), '[]'::json),
    'orders_count', (
      SELECT COUNT(*)::int FROM public.orders
      WHERE store_id = v_store_id OR owner_id = p_user_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_owner_bootstrap(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_owner_bootstrap(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Update provision_new_store: create stores row + default welcome product
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.provision_new_store()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_username TEXT;
  v_store_name TEXT;
  v_slug TEXT;
  v_counter INTEGER := 0;
  v_store_id UUID;
  v_category_id UUID;
BEGIN
  v_username := COALESCE(NEW.raw_user_meta_data->>'username', 'store');
  v_store_name := COALESCE(NEW.raw_user_meta_data->>'store_name', 'متجري');

  v_slug := LOWER(REGEXP_REPLACE(v_username, '[^a-z0-9]', '-', 'g'));
  v_slug := TRIM(BOTH '-' FROM v_slug);
  IF LENGTH(v_slug) < 3 THEN
    v_slug := v_slug || '-store';
  END IF;

  WHILE EXISTS (
    SELECT 1 FROM public.stores WHERE LOWER(store_slug) = v_slug
    UNION ALL
    SELECT 1 FROM public.store_settings WHERE LOWER(store_slug) = v_slug
  ) LOOP
    v_counter := v_counter + 1;
    v_slug := TRIM(BOTH '-' FROM LOWER(REGEXP_REPLACE(v_username, '[^a-z0-9]', '-', 'g'))) || '-' || v_counter;
  END LOOP;

  v_store_id := gen_random_uuid();

  INSERT INTO public.stores (id, user_id, store_name, store_slug, theme_id)
  VALUES (v_store_id, NEW.id, v_store_name, v_slug, 'default');

  INSERT INTO public.store_settings (
    id, owner_id, store_name, store_slug,
    menu_background_color, menu_text_color, menu_accent_color,
    banner_images, primary_banner_index, delivery_prices, payment_methods
  ) VALUES (
    v_store_id, NEW.id, v_store_name, v_slug,
    '#ffffff', '#000000', '#3b82f6',
    ARRAY[]::text[], 0,
    '[{"governorate":"القاهرة","price":50},{"governorate":"الجيزة","price":50},{"governorate":"الإسكندرية","price":75}]'::jsonb,
    '["cash_on_delivery"]'::jsonb
  );

  INSERT INTO public.categories (owner_id, store_id, name, display_order)
  VALUES (NEW.id, v_store_id, 'الكل', 0)
  RETURNING id INTO v_category_id;

  INSERT INTO public.categories (owner_id, store_id, name, display_order) VALUES
    (NEW.id, v_store_id, 'ملابس', 1),
    (NEW.id, v_store_id, 'إلكترونيات', 2),
    (NEW.id, v_store_id, 'إكسسوارات', 3);

  -- Default welcome product (Phase 8 — instant storefront)
  INSERT INTO public.products (
    owner_id, store_id, name, description, category, price, stock_quantity, is_active
  ) VALUES (
    NEW.id, v_store_id,
    'منتج تجريبي',
    'هذا منتج تجريبي — يمكنك تعديله أو حذفه من لوحة التحكم',
    'الكل',
    99,
    10,
    true
  );

  RETURN NEW;
END;
$$;

-- Plugin registry table (Phase 11 foundation)
CREATE TABLE IF NOT EXISTS public.store_plugins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  plugin_id TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, plugin_id)
);

ALTER TABLE public.store_plugins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store owners manage plugins" ON public.store_plugins;
CREATE POLICY "Store owners manage plugins"
  ON public.store_plugins FOR ALL
  USING (
    store_id IN (SELECT id FROM public.stores WHERE user_id = auth.uid())
  )
  WITH CHECK (
    store_id IN (SELECT id FROM public.stores WHERE user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_store_plugins_store_id ON public.store_plugins(store_id);
