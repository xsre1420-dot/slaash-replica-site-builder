
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS custom_domain text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS domain_verified boolean DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_settings_custom_domain 
ON public.store_settings (custom_domain) WHERE custom_domain IS NOT NULL;
