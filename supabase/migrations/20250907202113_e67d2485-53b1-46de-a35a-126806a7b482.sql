-- Add support for product variants (colors, sizes, and their quantities)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS colors jsonb;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sizes jsonb;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS variants jsonb;

-- Update RLS policies to ensure colors, sizes, and variants are accessible
-- (The existing policies should handle this automatically)