-- Add yearly subscription plan for public pricing toggle

INSERT INTO public.subscription_plans (id, name, price_amount, billing_interval_months, features)
VALUES
  ('yearly', 'باقة سنوية', 220000, 12, '{"max_products": -1, "custom_domain": true, "unlimited_orders": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price_amount = EXCLUDED.price_amount,
  billing_interval_months = EXCLUDED.billing_interval_months,
  features = EXCLUDED.features,
  is_active = true;

UPDATE public.subscription_plans
SET
  name = 'باقة 6 أشهر',
  price_amount = 125000,
  billing_interval_months = 6,
  is_active = true
WHERE id = 'annual';
