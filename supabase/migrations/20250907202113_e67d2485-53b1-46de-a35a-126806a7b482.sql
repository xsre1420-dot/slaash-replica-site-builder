-- Add support for product variants (colors, sizes, and their quantities)
ALTER TABLE public.products 
ADD COLUMN colors jsonb,
ADD COLUMN sizes jsonb,
ADD COLUMN variants jsonb;

-- Update RLS policies to ensure colors, sizes, and variants are accessible
-- (The existing policies should handle this automatically)