-- Auth trigger robustness: ensure profiles.user_id exists + resilient signup provisioning

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

UPDATE public.profiles SET user_id = id WHERE user_id IS NULL;

-- Ensure baseline plan exists for subscription trigger
INSERT INTO public.subscription_plans (id, name, price_amount, billing_interval_months, features)
VALUES ('free', 'مجاني', 0, 1, '{"max_products": 50}'::jsonb)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_plan_id TEXT;
  v_interval INT;
  v_username TEXT;
  v_candidate TEXT;
  v_suffix INT := 0;
BEGIN
  v_username := lower(trim(COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'username', ''),
    split_part(NEW.email, '@', 1)
  )));
  v_username := regexp_replace(v_username, '[^a-z0-9_-]', '', 'g');

  IF char_length(v_username) < 3 THEN
    v_username := 'user' || substr(replace(NEW.id::text, '-', ''), 1, 8);
  END IF;

  v_candidate := v_username;
  WHILE EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(username) = lower(v_candidate) AND id <> NEW.id
  ) LOOP
    v_suffix := v_suffix + 1;
    v_candidate := v_username || v_suffix::text;
  END LOOP;

  INSERT INTO public.profiles (id, user_id, username, store_name)
  VALUES (
    NEW.id,
    NEW.id,
    v_candidate,
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

-- Re-assert trigger order: profile/subscription first, store second
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_created_provision ON auth.users;
CREATE TRIGGER on_auth_user_created_provision
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.provision_new_store();
