-- Storefront RPC columns missing on some remote DBs (fixes get_store_meta / bundle)

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS store_font TEXT DEFAULT 'Tajawal',
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
  ADD COLUMN IF NOT EXISTS facebook_url TEXT,
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS return_policy TEXT,
  ADD COLUMN IF NOT EXISTS privacy_policy TEXT,
  ADD COLUMN IF NOT EXISTS payment_methods JSONB DEFAULT '["cash_on_delivery"]'::jsonb;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (22, 'store_settings storefront columns for get_store_meta')
ON CONFLICT (version) DO NOTHING;
