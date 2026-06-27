-- Add cost column to products table for profit tracking
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost numeric;