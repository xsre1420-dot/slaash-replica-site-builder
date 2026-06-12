-- Persist merchant settings that were previously stored only in localStorage
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS terms_conditions TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_welcome_message TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_order_confirmation TEXT;

COMMENT ON COLUMN public.store_settings.terms_conditions IS 'Store terms & conditions — persisted in DB';
COMMENT ON COLUMN public.store_settings.whatsapp_welcome_message IS 'WhatsApp auto-reply welcome message';
COMMENT ON COLUMN public.store_settings.whatsapp_order_confirmation IS 'WhatsApp order confirmation template';
