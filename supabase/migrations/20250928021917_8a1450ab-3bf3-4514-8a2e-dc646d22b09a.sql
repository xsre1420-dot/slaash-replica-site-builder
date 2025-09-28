-- Create product reviews table
CREATE TABLE public.product_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  reviewer_name TEXT NOT NULL,
  reviewer_email TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  is_approved BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create suggested products table
CREATE TABLE public.suggested_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL,
  suggested_product_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggested_products ENABLE ROW LEVEL SECURITY;

-- RLS policies for product_reviews
CREATE POLICY "Users can view their own product reviews" 
ON public.product_reviews 
FOR SELECT 
USING (auth.uid() = owner_id);

CREATE POLICY "Users can create reviews for their own products" 
ON public.product_reviews 
FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own product reviews" 
ON public.product_reviews 
FOR UPDATE 
USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own product reviews" 
ON public.product_reviews 
FOR DELETE 
USING (auth.uid() = owner_id);

-- RLS policies for suggested_products
CREATE POLICY "Users can view their own suggested products" 
ON public.suggested_products 
FOR SELECT 
USING (auth.uid() = owner_id);

CREATE POLICY "Users can create their own suggested products" 
ON public.suggested_products 
FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own suggested products" 
ON public.suggested_products 
FOR UPDATE 
USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own suggested products" 
ON public.suggested_products 
FOR DELETE 
USING (auth.uid() = owner_id);

-- Add indexes for better performance
CREATE INDEX idx_product_reviews_product_id ON public.product_reviews(product_id);
CREATE INDEX idx_product_reviews_owner_id ON public.product_reviews(owner_id);
CREATE INDEX idx_suggested_products_product_id ON public.suggested_products(product_id);
CREATE INDEX idx_suggested_products_owner_id ON public.suggested_products(owner_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_product_reviews_updated_at
BEFORE UPDATE ON public.product_reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();