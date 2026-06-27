-- P0 platform hardening: GRANT fix, subscription lockdown, tenant-scoped RPCs, storage re-assert

-- ---------------------------------------------------------------------------
-- P0-1: Fix create_order_with_stock_deduction GRANT (13-parameter signature)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_order_with_stock_deduction(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, DECIMAL, TEXT, TEXT, JSONB, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.create_order_with_stock_deduction(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, DECIMAL, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_order_with_stock_deduction(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, DECIMAL, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT
) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- P0-2: Prevent subscription self-upgrade via direct UPDATE
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS store_subscriptions_owner_update ON public.store_subscriptions;

CREATE OR REPLACE FUNCTION public.prevent_subscription_self_upgrade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() = OLD.owner_id THEN
    IF NEW.plan_id IS DISTINCT FROM OLD.plan_id
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.current_period_start IS DISTINCT FROM OLD.current_period_start
       OR NEW.current_period_end IS DISTINCT FROM OLD.current_period_end
       OR NEW.provider_subscription_id IS DISTINCT FROM OLD.provider_subscription_id THEN
      RAISE EXCEPTION 'subscription_changes_require_payment';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_subscription_self_upgrade ON public.store_subscriptions;
CREATE TRIGGER trg_prevent_subscription_self_upgrade
  BEFORE UPDATE ON public.store_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_subscription_self_upgrade();

-- ---------------------------------------------------------------------------
-- P0-3: Tenant-scope expire_product_discounts (was global UPDATE)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_product_discounts()
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  UPDATE public.products
  SET
    price = COALESCE(original_price, price),
    discount_type = 'none',
    discount_value = 0,
    original_price = NULL,
    discount_start_date = NULL,
    discount_end_date = NULL,
    updated_at = NOW()
  WHERE owner_id = auth.uid()
    AND discount_type IS NOT NULL
    AND discount_type <> 'none'
    AND discount_end_date IS NOT NULL
    AND discount_end_date < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.expire_product_discounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expire_product_discounts() TO authenticated;

-- ---------------------------------------------------------------------------
-- P0-4: Slug-bound delivery fee (stop anon owner_id probing)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_delivery_fee_by_slug(
  p_store_slug TEXT,
  p_governorate TEXT
)
RETURNS DECIMAL
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
BEGIN
  IF p_store_slug IS NULL OR trim(p_store_slug) = '' OR p_governorate IS NULL OR trim(p_governorate) = '' THEN
    RETURN 0;
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
    RETURN 0;
  END IF;

  RETURN public.calculate_delivery_fee(v_owner, p_governorate);
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_delivery_fee(UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.calculate_delivery_fee_by_slug(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_delivery_fee_by_slug(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_delivery_fee(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- P0-5: Slug-bound store visit tracking (stop owner_id spoofing)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.track_store_visit_by_slug(
  p_store_slug TEXT,
  p_page_path TEXT DEFAULT '/',
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

  v_ip := COALESCE(
    NULLIF(current_setting('request.headers', true)::json->>'x-forwarded-for', ''),
    '0.0.0.0'
  );

  IF NOT public.is_valid_store_visit(v_owner, v_ip) THEN
    RETURN jsonb_build_object('success', false, 'error', 'rate_limited');
  END IF;

  INSERT INTO public.store_visits (owner_id, visitor_ip, page_path, user_agent)
  VALUES (v_owner, v_ip, COALESCE(NULLIF(trim(p_page_path), ''), '/'), p_user_agent);

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.track_store_visit_by_slug(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_store_visit_by_slug(TEXT, TEXT, TEXT) TO anon, authenticated;

DROP POLICY IF EXISTS "Controlled store visit tracking" ON public.store_visits;
DROP POLICY IF EXISTS "Store visits rate limiting" ON public.store_visits;
DROP POLICY IF EXISTS "Public can create store visits" ON public.store_visits;
DROP POLICY IF EXISTS "Allow controlled store visit tracking" ON public.store_visits;

-- Merchants read own visits; public inserts only via track_store_visit_by_slug (SECURITY DEFINER)
DROP POLICY IF EXISTS "Store owners can view their store visits" ON public.store_visits;
CREATE POLICY "Store owners can view their store visits"
  ON public.store_visits FOR SELECT
  USING (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_store_visits_owner_created
  ON public.store_visits (owner_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- P0-6: Re-assert tenant-scoped storage policies (20260521105441 regression)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "product_images_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "product_images_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "product_images_auth_delete" ON storage.objects;

CREATE POLICY "product_images_auth_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "product_images_auth_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "product_images_auth_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ---------------------------------------------------------------------------
-- P1: Revoke anon payment method probing by owner UUID
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.is_payment_method_allowed(UUID, TEXT) FROM anon;

-- ---------------------------------------------------------------------------
-- P1: Deprecate legacy get_store_by_slug (UUID leak, no slug validation)
DO $$
BEGIN
  IF to_regprocedure('public.get_store_by_slug(text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.get_store_by_slug(TEXT) FROM PUBLIC, anon, authenticated;
  END IF;
END $$;
