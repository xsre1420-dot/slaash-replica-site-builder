-- Idempotent repair: add product columns expected by the app (safe to re-run)

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cost DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS original_price DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS stock_quantity INT,
  ADD COLUMN IF NOT EXISTS sizes TEXT[],
  ADD COLUMN IF NOT EXISTS colors JSONB,
  ADD COLUMN IF NOT EXISTS variants JSONB,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS min_stock_level INT DEFAULT 3,
  ADD COLUMN IF NOT EXISTS discount_type TEXT,
  ADD COLUMN IF NOT EXISTS discount_value DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS discount_start_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS discount_end_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS store_id UUID,
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS short_description TEXT,
  ADD COLUMN IF NOT EXISTS seo_title TEXT,
  ADD COLUMN IF NOT EXISTS seo_description TEXT,
  ADD COLUMN IF NOT EXISTS product_slug TEXT,
  ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS low_stock_threshold INT DEFAULT 3,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

UPDATE public.products SET is_active = true WHERE is_active IS NULL;
