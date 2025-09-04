-- Add stock management columns to products table
ALTER TABLE public.products 
ADD COLUMN stock_quantity integer DEFAULT 0,
ADD COLUMN min_stock_level integer DEFAULT 5;