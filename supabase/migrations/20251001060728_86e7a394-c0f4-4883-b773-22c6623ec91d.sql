-- Add discount fields to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS discount_type text DEFAULT 'none' CHECK (discount_type IN ('none', 'percentage', 'amount')),
ADD COLUMN IF NOT EXISTS discount_value numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_start_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS discount_end_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS original_price numeric;

-- Create index for faster discount queries
CREATE INDEX IF NOT EXISTS idx_products_discount_dates 
ON public.products(discount_start_date, discount_end_date) 
WHERE discount_type != 'none';

-- Add comment to explain the discount fields
COMMENT ON COLUMN public.products.discount_type IS 'Type of discount: none, percentage, or amount';
COMMENT ON COLUMN public.products.discount_value IS 'Value of the discount (percentage or fixed amount)';
COMMENT ON COLUMN public.products.discount_start_date IS 'When the discount starts';
COMMENT ON COLUMN public.products.discount_end_date IS 'When the discount ends';
COMMENT ON COLUMN public.products.original_price IS 'Original price before discount (for display purposes)';