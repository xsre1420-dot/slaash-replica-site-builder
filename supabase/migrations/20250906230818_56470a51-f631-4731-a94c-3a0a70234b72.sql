-- Add cost column to products table for profit tracking
ALTER TABLE public.products 
ADD COLUMN cost numeric;