-- v39: Security audit fixes — RLS WITH CHECK hardening, username enumeration rate limit

-- ---------------------------------------------------------------------------
-- 1) marketing_settings / marketing_coupons — prevent owner_id escalation on UPDATE
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update their own marketing settings" ON public.marketing_settings;
CREATE POLICY "Users can update their own marketing settings"
  ON public.marketing_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update their own coupons" ON public.marketing_coupons;
CREATE POLICY "Users can update their own coupons"
  ON public.marketing_coupons
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- 2) is_username_available — rate limit + input validation (enumeration hardening)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_username_available(p_username TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip TEXT;
  v_normalized TEXT;
BEGIN
  v_ip := COALESCE(
    NULLIF(split_part(COALESCE(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1), ''),
    '0.0.0.0'
  );

  IF NOT public.check_rpc_rate_limit('username_check:' || v_ip, 30, 60) THEN
    RETURN false;
  END IF;

  v_normalized := lower(trim(COALESCE(p_username, '')));
  IF v_normalized = '' OR v_normalized !~ '^[a-z0-9_-]{3,30}$' THEN
    RETURN false;
  END IF;

  RETURN NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE lower(trim(username)) = v_normalized
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_username_available(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_username_available(TEXT) TO anon, authenticated;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (39, 'security_audit: marketing RLS WITH CHECK, username rate limit')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
