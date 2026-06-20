-- Add stock management columns to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock_quantity integer DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_stock_level integer DEFAULT 5;