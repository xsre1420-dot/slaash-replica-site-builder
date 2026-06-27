-- Merchant product fields: SKU, SEO, tags, inventory alerts

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS short_description TEXT,
  ADD COLUMN IF NOT EXISTS seo_title TEXT,
  ADD COLUMN IF NOT EXISTS seo_description TEXT,
  ADD COLUMN IF NOT EXISTS product_slug TEXT,
  ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS low_stock_threshold INT DEFAULT 3;

CREATE INDEX IF NOT EXISTS idx_products_sku_owner ON public.products (owner_id, sku)
  WHERE sku IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_slug_owner ON public.products (owner_id, product_slug)
  WHERE product_slug IS NOT NULL;
