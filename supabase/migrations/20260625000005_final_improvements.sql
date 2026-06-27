-- Final recommended improvements: store_id RLS, batch checkout RPC, webhook outbox, health v15

-- ---------------------------------------------------------------------------
-- 1) Tenant helper: owner + store_id must match auth user's store
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_user_store_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id
  FROM public.stores s
  WHERE s.user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.tenant_row_owned(p_owner_id UUID, p_store_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND p_owner_id = auth.uid()
    AND (
      p_store_id IS NULL
      OR p_store_id IN (SELECT public.auth_user_store_ids())
    );
$$;

REVOKE ALL ON FUNCTION public.auth_user_store_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_user_store_ids() TO authenticated;

REVOKE ALL ON FUNCTION public.tenant_row_owned(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tenant_row_owned(UUID, UUID) TO authenticated;

-- Backfill missing store_id links
UPDATE public.products p
SET store_id = s.id
FROM public.stores s
WHERE p.store_id IS NULL
  AND p.owner_id = s.user_id;

UPDATE public.orders o
SET store_id = s.id
FROM public.stores s
WHERE o.store_id IS NULL
  AND o.owner_id = s.user_id;

UPDATE public.categories c
SET store_id = s.id
FROM public.stores s
WHERE c.store_id IS NULL
  AND c.owner_id = s.user_id;

-- ---------------------------------------------------------------------------
-- 2) RLS: defense-in-depth with store_id
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Restaurant owners can view their own products" ON public.products;
DROP POLICY IF EXISTS "Restaurant owners can insert their own products" ON public.products;
DROP POLICY IF EXISTS "Restaurant owners can update their own products" ON public.products;
DROP POLICY IF EXISTS "Restaurant owners can delete their own products" ON public.products;

CREATE POLICY "Restaurant owners can view their own products"
  ON public.products FOR SELECT
  USING (public.tenant_row_owned(owner_id, store_id));

CREATE POLICY "Restaurant owners can insert their own products"
  ON public.products FOR INSERT
  WITH CHECK (public.tenant_row_owned(owner_id, store_id));

CREATE POLICY "Restaurant owners can update their own products"
  ON public.products FOR UPDATE
  USING (public.tenant_row_owned(owner_id, store_id));

CREATE POLICY "Restaurant owners can delete their own products"
  ON public.products FOR DELETE
  USING (public.tenant_row_owned(owner_id, store_id));

DROP POLICY IF EXISTS "Restaurant owners can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Restaurant owners can update their own orders" ON public.orders;
DROP POLICY IF EXISTS "Restaurant owners can delete their own orders" ON public.orders;

CREATE POLICY "Restaurant owners can view their own orders"
  ON public.orders FOR SELECT
  USING (public.tenant_row_owned(owner_id, store_id));

CREATE POLICY "Restaurant owners can update their own orders"
  ON public.orders FOR UPDATE
  USING (public.tenant_row_owned(owner_id, store_id));

CREATE POLICY "Restaurant owners can delete their own orders"
  ON public.orders FOR DELETE
  USING (public.tenant_row_owned(owner_id, store_id));

DROP POLICY IF EXISTS "Restaurant owners can view their own categories" ON public.categories;
DROP POLICY IF EXISTS "Restaurant owners can insert their own categories" ON public.categories;
DROP POLICY IF EXISTS "Restaurant owners can update their own categories" ON public.categories;
DROP POLICY IF EXISTS "Restaurant owners can delete their own categories" ON public.categories;

CREATE POLICY "Restaurant owners can view their own categories"
  ON public.categories FOR SELECT
  USING (public.tenant_row_owned(owner_id, store_id));

CREATE POLICY "Restaurant owners can insert their own categories"
  ON public.categories FOR INSERT
  WITH CHECK (public.tenant_row_owned(owner_id, store_id));

CREATE POLICY "Restaurant owners can update their own categories"
  ON public.categories FOR UPDATE
  USING (public.tenant_row_owned(owner_id, store_id));

CREATE POLICY "Restaurant owners can delete their own categories"
  ON public.categories FOR DELETE
  USING (public.tenant_row_owned(owner_id, store_id));

DROP POLICY IF EXISTS "Restaurant owners can view their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Restaurant owners can insert their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Restaurant owners can update their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Restaurant owners can delete their own order items" ON public.order_items;

CREATE POLICY "Restaurant owners can view their own order items"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND public.tenant_row_owned(o.owner_id, o.store_id)
    )
  );

CREATE POLICY "Restaurant owners can insert their own order items"
  ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND public.tenant_row_owned(o.owner_id, o.store_id)
    )
  );

CREATE POLICY "Restaurant owners can update their own order items"
  ON public.order_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND public.tenant_row_owned(o.owner_id, o.store_id)
    )
  );

CREATE POLICY "Restaurant owners can delete their own order items"
  ON public.order_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND public.tenant_row_owned(o.owner_id, o.store_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Batch checkout product fetch (single round-trip)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_checkout_products_by_ids(
  p_slug TEXT,
  p_product_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9-]+$' OR p_product_ids IS NULL OR array_length(p_product_ids, 1) IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT ss.owner_id INTO v_owner_id
  FROM public.store_settings ss
  WHERE LOWER(ss.store_slug) = LOWER(trim(p_slug))
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    SELECT s.user_id INTO v_owner_id
    FROM public.stores s
    WHERE LOWER(s.store_slug) = LOWER(trim(p_slug))
    LIMIT 1;
  END IF;

  IF v_owner_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id)
    FROM public.products p
    WHERE p.owner_id = v_owner_id
      AND p.id = ANY(p_product_ids)
      AND COALESCE(p.is_active, true) = true
      AND p.archived_at IS NULL
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_owner_checkout_products_by_ids(
  p_owner_id UUID,
  p_product_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN '[]'::jsonb;
  END IF;

  IF p_product_ids IS NULL OR array_length(p_product_ids, 1) IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id)
    FROM public.products p
    WHERE p.owner_id = p_owner_id
      AND p.id = ANY(p_product_ids)
      AND COALESCE(p.is_active, true) = true
      AND p.archived_at IS NULL
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_checkout_products_by_ids(TEXT, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_checkout_products_by_ids(TEXT, UUID[]) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_owner_checkout_products_by_ids(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_owner_checkout_products_by_ids(UUID, UUID[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) Order webhook outbox (reliable async notifications)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_webhook_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL DEFAULT 'order.created',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'delivered', 'failed')),
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_order_webhook_outbox_pending
  ON public.order_webhook_outbox (status, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_order_webhook_outbox_owner
  ON public.order_webhook_outbox (owner_id, created_at DESC);

ALTER TABLE public.order_webhook_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_webhook_outbox_owner_select ON public.order_webhook_outbox;
CREATE POLICY order_webhook_outbox_owner_select
  ON public.order_webhook_outbox
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.enqueue_order_webhook_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.order_webhook_outbox (
    owner_id,
    store_id,
    order_id,
    event_type,
    payload
  ) VALUES (
    NEW.owner_id,
    NEW.store_id,
    NEW.id,
    'order.created',
    jsonb_build_object(
      'order_id', NEW.id,
      'owner_id', NEW.owner_id,
      'store_id', NEW.store_id,
      'status', NEW.status,
      'total_amount', NEW.total_amount,
      'customer_name', NEW.customer_name,
      'customer_phone', NEW.customer_phone,
      'created_at', NEW.created_at
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_webhook_outbox_trg ON public.orders;
CREATE TRIGGER orders_webhook_outbox_trg
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_order_webhook_event();

-- ---------------------------------------------------------------------------
-- 5) platform_health_check v15
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.platform_health_check();

CREATE OR REPLACE FUNCTION public.platform_health_check()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_required INT := 15;
  v_version INT := 0;
  v_missing TEXT[] := ARRAY[]::TEXT[];
  v_fn TEXT;
  v_required_fns TEXT[] := ARRAY[
    'get_store_products_page',
    'get_store_products_by_slug',
    'get_store_product_by_id',
    'get_checkout_products_by_ids',
    'get_owner_checkout_products_by_ids',
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
    'attach_order_marketing_attribution',
    'list_merchant_orders',
    'count_merchant_orders_by_workflow',
    'get_storefront_footer_products',
    'submit_access_lead',
    'admin_list_leads',
    'admin_get_lead',
    'increment_product_stock'
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
    'store_settings.store_slug',
    'order_items.owner_id',
    'leads.selected_plan_id',
    'leads.selected_plan_name',
    'leads.governorate',
    'leads.instagram_url',
    'leads.expected_monthly_orders'
  ];
  v_col TEXT;
  v_table TEXT;
  v_column TEXT;
BEGIN
  SELECT COALESCE(
    (SELECT psv.version FROM public.platform_schema_version psv ORDER BY psv.version DESC LIMIT 1),
    0
  ) INTO v_version;

  IF NOT public._platform_table_exists('leads') THEN
    v_missing := array_append(v_missing, 'table:leads');
  END IF;

  IF NOT public._platform_table_exists('store_daily_stats') THEN
    v_missing := array_append(v_missing, 'table:store_daily_stats');
  END IF;

  IF NOT public._platform_table_exists('order_webhook_outbox') THEN
    v_missing := array_append(v_missing, 'table:order_webhook_outbox');
  END IF;

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

  IF NOT public._platform_table_exists('stores') THEN
    v_missing := array_append(v_missing, 'table:stores');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'product-images') THEN
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
      'checkout_batch', public._platform_fn_exists('get_checkout_products_by_ids'),
      'merchant_catalog', public._platform_fn_exists('get_owner_products_page'),
      'merchant_orders', public._platform_fn_exists('list_merchant_orders'),
      'publish', public._platform_fn_exists('publish_owner_product'),
      'reviews', public._platform_fn_exists('get_merchant_product_reviews'),
      'statistics', public._platform_fn_exists('get_store_statistics'),
      'leads_submit', public._platform_fn_exists('submit_access_lead'),
      'leads_admin', public._platform_fn_exists('admin_list_leads'),
      'webhook_outbox', public._platform_table_exists('order_webhook_outbox')
    ),
    'message', CASE
      WHEN COALESCE(array_length(v_missing, 1), 0) > 0 THEN 'migration_required'
      WHEN v_version < v_required THEN 'schema_version_outdated'
      ELSE 'ok'
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_health_check() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_health_check() TO authenticated, service_role;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (15, 'store_id RLS, batch checkout RPC, webhook outbox, health v15')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
