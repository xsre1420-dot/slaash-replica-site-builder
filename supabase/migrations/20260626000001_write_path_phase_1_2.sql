-- v72 / Phase 1.2: Enterprise write-path optimization
-- RPC-gated merchant writes, noop detection, status webhooks, WAL reduction triggers, write benchmarks.

-- ---------------------------------------------------------------------------
-- 1) Reusable noop updated_at guard (skip identical row rewrites)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_skip_noop_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND to_jsonb(OLD) - 'updated_at' = to_jsonb(NEW) - 'updated_at' THEN
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at THEN
    NEW.updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_skip_noop_updated_at ON public.products;
CREATE TRIGGER trg_products_skip_noop_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_skip_noop_updated_at();

DROP TRIGGER IF EXISTS trg_store_settings_skip_noop_updated_at ON public.store_settings;
CREATE TRIGGER trg_store_settings_skip_noop_updated_at
  BEFORE UPDATE ON public.store_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_skip_noop_updated_at();

DROP TRIGGER IF EXISTS trg_marketing_settings_skip_noop_updated_at ON public.marketing_settings;
CREATE TRIGGER trg_marketing_settings_skip_noop_updated_at
  BEFORE UPDATE ON public.marketing_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_skip_noop_updated_at();

DROP TRIGGER IF EXISTS trg_product_reviews_skip_noop_updated_at ON public.product_reviews;
CREATE TRIGGER trg_product_reviews_skip_noop_updated_at
  BEFORE UPDATE ON public.product_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_skip_noop_updated_at();

-- ---------------------------------------------------------------------------
-- 2) Order status update RPC — single-row lock, noop skip, transition guard via trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_merchant_order_status(
  p_order_id UUID,
  p_owner_id UUID,
  p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_current TEXT;
  v_normalized TEXT := lower(trim(COALESCE(p_status, '')));
BEGIN
  IF v_uid IS NULL OR v_uid <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF p_order_id IS NULL OR v_normalized = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_request');
  END IF;

  SELECT o.status INTO v_current
  FROM public.orders o
  WHERE o.id = p_order_id AND o.owner_id = p_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  IF v_current = v_normalized THEN
    RETURN jsonb_build_object('success', true, 'noop', true, 'status', v_current);
  END IF;

  UPDATE public.orders
  SET status = v_normalized,
      updated_at = NOW()
  WHERE id = p_order_id
    AND owner_id = p_owner_id;

  RETURN jsonb_build_object(
    'success', true,
    'noop', false,
    'previous_status', v_current,
    'status', v_normalized
  );
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'invalid_status_transition%' THEN
      RETURN jsonb_build_object('success', false, 'error', SQLERRM);
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'status_update_failed');
END;
$$;

REVOKE ALL ON FUNCTION public.update_merchant_order_status(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_merchant_order_status(UUID, UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Order status-change webhook — async outbox (non-blocking, idempotent)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_order_status_webhook_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF public.is_checkout_fast_path() THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.order_webhook_outbox (
    owner_id, store_id, order_id, event_type, payload
  ) VALUES (
    NEW.owner_id,
    NEW.store_id,
    NEW.id,
    'order.status_changed',
    jsonb_build_object(
      'order_id', NEW.id,
      'owner_id', NEW.owner_id,
      'store_id', NEW.store_id,
      'previous_status', OLD.status,
      'status', NEW.status,
      'total_amount', NEW.total_amount,
      'payment_status', NEW.payment_status,
      'delivery_status', NEW.delivery_status,
      'updated_at', NEW.updated_at
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_status_webhook_outbox_trg ON public.orders;
CREATE TRIGGER orders_status_webhook_outbox_trg
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.enqueue_order_status_webhook_event();

-- ---------------------------------------------------------------------------
-- 4) Store settings patch RPC — merge patch, skip identical writes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.patch_merchant_store_settings(
  p_owner_id UUID,
  p_patch JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_existing public.store_settings%ROWTYPE;
  v_merged JSONB;
  v_row public.store_settings%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR v_uid <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF p_patch IS NULL OR p_patch = '{}'::jsonb THEN
    RETURN jsonb_build_object('success', false, 'error', 'empty_patch');
  END IF;

  SELECT * INTO v_existing
  FROM public.store_settings
  WHERE owner_id = p_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.store_settings (owner_id)
    VALUES (p_owner_id)
    RETURNING * INTO v_existing;
  END IF;

  v_merged := to_jsonb(v_existing) || (p_patch - 'owner_id' - 'created_at' - 'updated_at' - 'storefront_cache_version');

  IF to_jsonb(v_existing) - 'updated_at' - 'storefront_cache_version'
     IS NOT DISTINCT FROM v_merged - 'updated_at' - 'storefront_cache_version' THEN
    RETURN jsonb_build_object('success', true, 'noop', true);
  END IF;

  UPDATE public.store_settings ss
  SET
    store_name = COALESCE((v_merged->>'store_name')::text, ss.store_name),
    store_logo = COALESCE((v_merged->>'store_logo')::text, ss.store_logo),
    store_governorate = COALESCE((v_merged->>'store_governorate')::text, ss.store_governorate),
    menu_background_color = COALESCE((v_merged->>'menu_background_color')::text, ss.menu_background_color),
    menu_text_color = COALESCE((v_merged->>'menu_text_color')::text, ss.menu_text_color),
    menu_accent_color = COALESCE((v_merged->>'menu_accent_color')::text, ss.menu_accent_color),
    store_font = COALESCE((v_merged->>'store_font')::text, ss.store_font),
    banner_images = COALESCE(v_merged->'banner_images', ss.banner_images),
    primary_banner_index = COALESCE((v_merged->>'primary_banner_index')::int, ss.primary_banner_index),
    delivery_prices = COALESCE(v_merged->'delivery_prices', ss.delivery_prices),
    payment_methods = COALESCE(v_merged->'payment_methods', ss.payment_methods),
    store_slug = COALESCE((v_merged->>'store_slug')::text, ss.store_slug),
    return_policy = COALESCE((v_merged->>'return_policy')::text, ss.return_policy),
    privacy_policy = COALESCE((v_merged->>'privacy_policy')::text, ss.privacy_policy),
    terms_conditions = COALESCE((v_merged->>'terms_conditions')::text, ss.terms_conditions),
    whatsapp_number = COALESCE((v_merged->>'whatsapp_number')::text, ss.whatsapp_number),
    whatsapp_welcome_message = COALESCE((v_merged->>'whatsapp_welcome_message')::text, ss.whatsapp_welcome_message),
    whatsapp_order_confirmation = COALESCE((v_merged->>'whatsapp_order_confirmation')::text, ss.whatsapp_order_confirmation),
    custom_domain = COALESCE((v_merged->>'custom_domain')::text, ss.custom_domain),
    domain_verified = COALESCE((v_merged->>'domain_verified')::boolean, ss.domain_verified),
    order_webhook_url = COALESCE((v_merged->>'order_webhook_url')::text, ss.order_webhook_url),
    updated_at = NOW()
  WHERE owner_id = p_owner_id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('success', true, 'noop', false, 'owner_id', v_row.owner_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'patch_failed');
END;
$$;

REVOKE ALL ON FUNCTION public.patch_merchant_store_settings(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.patch_merchant_store_settings(UUID, JSONB) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) Marketing settings upsert RPC — noop detection
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_merchant_marketing_settings(
  p_owner_id UUID,
  p_patch JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_existing public.marketing_settings%ROWTYPE;
  v_merged JSONB;
BEGIN
  IF v_uid IS NULL OR v_uid <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO v_existing
  FROM public.marketing_settings
  WHERE owner_id = p_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.marketing_settings (owner_id)
    VALUES (p_owner_id)
    RETURNING * INTO v_existing;
  END IF;

  v_merged := to_jsonb(v_existing) || (p_patch - 'owner_id' - 'created_at' - 'updated_at');

  IF to_jsonb(v_existing) - 'updated_at' IS NOT DISTINCT FROM v_merged - 'updated_at' THEN
    RETURN jsonb_build_object('success', true, 'noop', true);
  END IF;

  UPDATE public.marketing_settings ms
  SET
    marketing_enabled = COALESCE((v_merged->>'marketing_enabled')::boolean, ms.marketing_enabled),
    email_marketing_enabled = COALESCE((v_merged->>'email_marketing_enabled')::boolean, ms.email_marketing_enabled),
    sms_marketing_enabled = COALESCE((v_merged->>'sms_marketing_enabled')::boolean, ms.sms_marketing_enabled),
    meta_pixel_id = COALESCE(NULLIF(trim(v_merged->>'meta_pixel_id'), ''), ms.meta_pixel_id),
    google_analytics_id = COALESCE(NULLIF(trim(v_merged->>'google_analytics_id'), ''), ms.google_analytics_id),
    facebook_access_token = COALESCE(NULLIF(trim(v_merged->>'facebook_access_token'), ''), ms.facebook_access_token),
    updated_at = NOW()
  WHERE owner_id = p_owner_id;

  RETURN jsonb_build_object('success', true, 'noop', false);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'upsert_failed');
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_merchant_marketing_settings(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_merchant_marketing_settings(UUID, JSONB) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6) Product catalog patch RPC — noop detection (stock via increment_product_stock)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.patch_merchant_product(
  p_product_id UUID,
  p_owner_id UUID,
  p_patch JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_existing public.products%ROWTYPE;
  v_allowed TEXT[] := ARRAY[
    'name', 'description', 'short_description', 'category', 'price', 'cost', 'original_price',
    'image_url', 'additional_images', 'sizes', 'colors', 'variants',
    'discount_type', 'discount_value', 'discount_start_date', 'discount_end_date',
    'is_active', 'archived_at', 'sku', 'seo_title', 'seo_description', 'product_slug',
    'tags', 'low_stock_threshold', 'min_stock_level'
  ];
  v_key TEXT;
  v_filtered JSONB := '{}'::jsonb;
  v_merged JSONB;
BEGIN
  IF v_uid IS NULL OR v_uid <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF p_product_id IS NULL OR p_patch IS NULL OR p_patch = '{}'::jsonb THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_request');
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(p_patch) LOOP
    IF v_key = ANY (v_allowed) THEN
      v_filtered := v_filtered || jsonb_build_object(v_key, p_patch->v_key);
    END IF;
  END LOOP;

  IF v_filtered = '{}'::jsonb THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_allowed_fields');
  END IF;

  SELECT * INTO v_existing
  FROM public.products
  WHERE id = p_product_id AND owner_id = p_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  v_merged := to_jsonb(v_existing) || v_filtered;

  IF to_jsonb(v_existing) - 'updated_at' - 'stock_quantity'
     IS NOT DISTINCT FROM v_merged - 'updated_at' - 'stock_quantity' THEN
    RETURN jsonb_build_object('success', true, 'noop', true, 'product_id', p_product_id);
  END IF;

  UPDATE public.products p
  SET
    name = COALESCE((v_merged->>'name')::text, p.name),
    description = COALESCE((v_merged->>'description')::text, p.description),
    short_description = COALESCE((v_merged->>'short_description')::text, p.short_description),
    category = COALESCE((v_merged->>'category')::text, p.category),
    price = COALESCE((v_merged->>'price')::numeric, p.price),
    cost = COALESCE((v_merged->>'cost')::numeric, p.cost),
    original_price = COALESCE((v_merged->>'original_price')::numeric, p.original_price),
    image_url = COALESCE((v_merged->>'image_url')::text, p.image_url),
    additional_images = COALESCE(v_merged->'additional_images', p.additional_images),
    sizes = COALESCE(v_merged->'sizes', p.sizes),
    colors = COALESCE(v_merged->'colors', p.colors),
    variants = COALESCE(v_merged->'variants', p.variants),
    discount_type = COALESCE((v_merged->>'discount_type')::text, p.discount_type),
    discount_value = COALESCE((v_merged->>'discount_value')::numeric, p.discount_value),
    discount_start_date = COALESCE((v_merged->>'discount_start_date')::timestamptz, p.discount_start_date),
    discount_end_date = COALESCE((v_merged->>'discount_end_date')::timestamptz, p.discount_end_date),
    is_active = COALESCE((v_merged->>'is_active')::boolean, p.is_active),
    archived_at = CASE
      WHEN v_merged ? 'archived_at' THEN (v_merged->>'archived_at')::timestamptz
      ELSE p.archived_at
    END,
    sku = COALESCE((v_merged->>'sku')::text, p.sku),
    seo_title = COALESCE((v_merged->>'seo_title')::text, p.seo_title),
    seo_description = COALESCE((v_merged->>'seo_description')::text, p.seo_description),
    product_slug = COALESCE((v_merged->>'product_slug')::text, p.product_slug),
    tags = COALESCE(v_merged->'tags', p.tags),
    low_stock_threshold = COALESCE((v_merged->>'low_stock_threshold')::int, p.low_stock_threshold),
    min_stock_level = COALESCE((v_merged->>'min_stock_level')::int, p.min_stock_level),
    updated_at = NOW()
  WHERE id = p_product_id AND owner_id = p_owner_id;

  RETURN jsonb_build_object('success', true, 'noop', false, 'product_id', p_product_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'patch_failed');
END;
$$;

REVOKE ALL ON FUNCTION public.patch_merchant_product(UUID, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.patch_merchant_product(UUID, UUID, JSONB) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7) Write-path benchmark RPC (rolled-back transaction — safe on production)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_write_path_benchmark(
  p_owner_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
  v_order_id UUID;
  v_product_id UUID;
  v_results JSONB := '[]'::jsonb;
  v_start TIMESTAMPTZ;
  v_ms NUMERIC;
  v_probe_id BIGINT;
  v_rec RECORD;
BEGIN
  IF current_setting('request.jwt.claim.role', true) <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin', 'authenticator') THEN
    RAISE EXCEPTION 'service_role or postgres only';
  END IF;

  SELECT ss.owner_id INTO v_owner
  FROM public.store_settings ss
  WHERE ss.owner_id IS NOT NULL
  ORDER BY ss.updated_at DESC NULLS LAST
  LIMIT 1;

  v_owner := COALESCE(p_owner_id, v_owner);

  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_owner');
  END IF;

  SELECT o.id INTO v_order_id
  FROM public.orders o
  WHERE o.owner_id = v_owner
  ORDER BY o.created_at DESC
  LIMIT 1;

  SELECT p.id INTO v_product_id
  FROM public.products p
  WHERE p.owner_id = v_owner AND p.archived_at IS NULL
  ORDER BY p.updated_at DESC NULLS LAST
  LIMIT 1;

  FOR v_rec IN
    SELECT * FROM (VALUES
      ('order_status_noop'),
      ('order_status_change_rollback'),
      ('store_settings_noop'),
      ('product_patch_noop'),
      ('analytics_outbox_insert')
    ) AS t(name)
  LOOP
    v_start := clock_timestamp();
    BEGIN
      IF v_rec.name = 'order_status_noop' AND v_order_id IS NOT NULL THEN
        PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
        PERFORM public.update_merchant_order_status(v_order_id, v_owner, (
          SELECT status FROM public.orders WHERE id = v_order_id
        ));
      ELSIF v_rec.name = 'order_status_change_rollback' AND v_order_id IS NOT NULL THEN
        -- Measure guarded update path without persisting (subtransaction rollback)
        BEGIN
          PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
          PERFORM public.update_merchant_order_status(v_order_id, v_owner, 'pending');
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;
      ELSIF v_rec.name = 'store_settings_noop' THEN
        PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
        PERFORM public.patch_merchant_store_settings(v_owner, jsonb_build_object('store_name', (
          SELECT store_name FROM public.store_settings WHERE owner_id = v_owner
        )));
      ELSIF v_rec.name = 'product_patch_noop' AND v_product_id IS NOT NULL THEN
        PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
        PERFORM public.patch_merchant_product(v_product_id, v_owner, jsonb_build_object('name', (
          SELECT name FROM public.products WHERE id = v_product_id
        )));
      ELSIF v_rec.name = 'analytics_outbox_insert' THEN
        INSERT INTO public.analytics_event_outbox (owner_id, event_type, payload)
        VALUES (v_owner, 'store_visit', jsonb_build_object('probe', true, 'benchmark', true))
        RETURNING id INTO v_probe_id;
        DELETE FROM public.analytics_event_outbox WHERE id = v_probe_id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'name', v_rec.name,
        'error', SQLERRM
      ));
      CONTINUE;
    END;

    v_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start)::numeric;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'name', v_rec.name,
      'duration_ms', ROUND(v_ms, 3),
      'owner_id', v_owner
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'benchmark_at', now(),
    'phase', '1.2',
    'owner_id', v_owner,
    'order_id', v_order_id,
    'product_id', v_product_id,
    'paths', v_results
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_write_path_benchmark(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_write_path_benchmark(UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- 8) Write-path audit — Phase 1.2 coverage
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_write_path_audit()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'success', true,
    'audited_at', now(),
    'schema_version', (SELECT max(version) FROM public.platform_schema_version),
    'phase', '1.2',
    'checkout_fast_path', EXISTS (
      SELECT 1 FROM pg_proc WHERE proname = 'is_checkout_fast_path'
    ),
    'order_side_effects_outbox', EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'order_side_effects_outbox'
    ),
    'order_creation_log_trigger', EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relname = 'orders' AND t.tgname = 'order_creation_log_trigger'
    ),
    'update_merchant_order_status_rpc', EXISTS (
      SELECT 1 FROM pg_proc WHERE proname = 'update_merchant_order_status'
    ),
    'patch_merchant_store_settings_rpc', EXISTS (
      SELECT 1 FROM pg_proc WHERE proname = 'patch_merchant_store_settings'
    ),
    'patch_merchant_product_rpc', EXISTS (
      SELECT 1 FROM pg_proc WHERE proname = 'patch_merchant_product'
    ),
    'upsert_merchant_marketing_settings_rpc', EXISTS (
      SELECT 1 FROM pg_proc WHERE proname = 'upsert_merchant_marketing_settings'
    ),
    'order_status_webhook_trigger', EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relname = 'orders' AND t.tgname = 'orders_status_webhook_outbox_trg'
    ),
    'noop_updated_at_triggers', (
      SELECT COUNT(*)::INT FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      WHERE t.tgname LIKE '%skip_noop_updated_at%'
    ),
    'pending_side_effects', (
      SELECT COUNT(*)::INT FROM public.order_side_effects_outbox WHERE processed_at IS NULL
    ),
    'pending_analytics_events', (
      SELECT COUNT(*)::INT FROM public.analytics_event_outbox WHERE processed_at IS NULL
    ),
    'pending_webhooks', (
      SELECT COUNT(*)::INT FROM public.order_webhook_outbox WHERE status = 'pending'
    ),
    'healthy',
      NOT EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        WHERE c.relname = 'orders' AND t.tgname = 'order_creation_log_trigger'
      )
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_merchant_order_status')
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'patch_merchant_product')
  );
$$;

REVOKE ALL ON FUNCTION public.platform_write_path_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_write_path_audit() TO service_role;

-- ---------------------------------------------------------------------------
-- 9) Refresh planner statistics
-- ---------------------------------------------------------------------------
ANALYZE public.orders;
ANALYZE public.products;
ANALYZE public.store_settings;
ANALYZE public.marketing_settings;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (72, 'write_path phase 1.2: RPC-gated merchant writes, noop triggers, status webhooks, benchmarks')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
