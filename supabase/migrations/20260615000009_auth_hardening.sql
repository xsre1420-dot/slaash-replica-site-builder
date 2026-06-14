-- Auth hardening: username availability check + profile user_id alignment

CREATE OR REPLACE FUNCTION public.is_username_available(p_username TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE lower(trim(username)) = lower(trim(p_username))
  );
$$;

REVOKE ALL ON FUNCTION public.is_username_available(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_username_available(TEXT) TO anon, authenticated;

-- Align profile trigger with user_id for slug generation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_plan_id TEXT;
  v_interval INT;
  v_username TEXT;
BEGIN
  v_username := lower(trim(COALESCE(NULLIF(NEW.raw_user_meta_data->>'username', ''), split_part(NEW.email, '@', 1))));

  INSERT INTO public.profiles (id, user_id, username, store_name)
  VALUES (
    NEW.id,
    NEW.id,
    v_username,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'store_name'), ''), 'متجري')
  )
  ON CONFLICT (id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    username = EXCLUDED.username,
    store_name = EXCLUDED.store_name;

  v_plan_id := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'selected_plan'), ''), 'free');

  IF NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE id = v_plan_id) THEN
    v_plan_id := 'free';
  END IF;

  SELECT billing_interval_months INTO v_interval
  FROM public.subscription_plans WHERE id = v_plan_id;

  INSERT INTO public.store_subscriptions (
    owner_id, plan_id, status, current_period_start, current_period_end
  ) VALUES (
    NEW.id,
    v_plan_id,
    'trialing',
    NOW(),
    NOW() + (COALESCE(v_interval, 1) || ' months')::INTERVAL
  )
  ON CONFLICT (owner_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Backfill user_id where missing
UPDATE public.profiles SET user_id = id WHERE user_id IS NULL;

-- Profiles RLS: allow access via id OR user_id
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id OR auth.uid() = user_id);
