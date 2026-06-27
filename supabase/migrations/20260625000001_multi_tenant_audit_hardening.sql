-- Multi-tenant audit hardening (2026-06-25)

-- ---------------------------------------------------------------------------
-- 1) subscription_plans: RLS — public read catalog only
-- ---------------------------------------------------------------------------
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscription_plans_public_read ON public.subscription_plans;
CREATE POLICY subscription_plans_public_read
  ON public.subscription_plans FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS subscription_plans_deny_writes ON public.subscription_plans;
CREATE POLICY subscription_plans_deny_writes
  ON public.subscription_plans FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 2) calculate_delivery_fee: block cross-tenant probing by authenticated users
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_delivery_fee(
  p_owner_id UUID,
  p_governorate TEXT
)
RETURNS DECIMAL
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fee DECIMAL := 0;
BEGIN
  IF p_owner_id IS NULL OR p_governorate IS NULL OR trim(p_governorate) = '' THEN
    RETURN 0;
  END IF;

  -- Allow triggers / checkout RPC (no session) and own-store reads only
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_owner_id THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(
    (
      SELECT (elem->>'price')::DECIMAL
      FROM store_settings ss,
           jsonb_array_elements(COALESCE(ss.delivery_prices, '[]'::jsonb)) AS elem
      WHERE ss.owner_id = p_owner_id
        AND elem->>'governorate' = trim(p_governorate)
      LIMIT 1
    ),
    0
  ) INTO v_fee;

  RETURN v_fee;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3) resolve_store_owner_by_slug: internal only (stop UUID enumeration)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.resolve_store_owner_by_slug(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_store_owner_by_slug(TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- 4) is_platform_admin: ignore caller-supplied UUID (self only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_platform_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins pa
    WHERE pa.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- 5) product_reviews: tighten SELECT to owner-only (defense in depth)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Owners can view product reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "Owners view product reviews" ON public.product_reviews;
DROP POLICY IF EXISTS product_reviews_owner_select ON public.product_reviews;

CREATE POLICY product_reviews_owner_select
  ON public.product_reviews FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- Public approved reviews remain via slug-bound RPCs only
DROP POLICY IF EXISTS "Public can view approved reviews" ON public.product_reviews;
DROP POLICY IF EXISTS product_reviews_public_approved_select ON public.product_reviews;

-- ---------------------------------------------------------------------------
-- 6) Performance: composite indexes for tenant-scoped list queries
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_owner_created
  ON public.orders (owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_products_owner_active_created
  ON public.products (owner_id, is_active, created_at DESC)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_store_visits_owner_created
  ON public.store_visits (owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_views_owner_created
  ON public.product_views (owner_id, created_at DESC);
