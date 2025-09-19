-- Create marketing coupons table
CREATE TABLE public.marketing_coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  code TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value NUMERIC NOT NULL CHECK (discount_value > 0),
  minimum_order_amount NUMERIC DEFAULT 0,
  usage_limit INTEGER,
  used_count INTEGER DEFAULT 0,
  start_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  end_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marketing_coupons ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for marketing_coupons
CREATE POLICY "Users can view their own coupons" 
ON public.marketing_coupons 
FOR SELECT 
USING (auth.uid() = owner_id);

CREATE POLICY "Users can create their own coupons" 
ON public.marketing_coupons 
FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own coupons" 
ON public.marketing_coupons 
FOR UPDATE 
USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own coupons" 
ON public.marketing_coupons 
FOR DELETE 
USING (auth.uid() = owner_id);

-- Create marketing settings table
CREATE TABLE public.marketing_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL UNIQUE,
  meta_pixel_id TEXT,
  facebook_access_token TEXT,
  google_analytics_id TEXT,
  marketing_enabled BOOLEAN DEFAULT false,
  email_marketing_enabled BOOLEAN DEFAULT false,
  sms_marketing_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marketing_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for marketing_settings
CREATE POLICY "Users can view their own marketing settings" 
ON public.marketing_settings 
FOR SELECT 
USING (auth.uid() = owner_id);

CREATE POLICY "Users can create their own marketing settings" 
ON public.marketing_settings 
FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own marketing settings" 
ON public.marketing_settings 
FOR UPDATE 
USING (auth.uid() = owner_id);

-- Create trigger for updated_at timestamp
CREATE TRIGGER update_marketing_coupons_updated_at
BEFORE UPDATE ON public.marketing_coupons
FOR EACH ROW
EXECUTE FUNCTION public.update_store_settings_updated_at();

CREATE TRIGGER update_marketing_settings_updated_at
BEFORE UPDATE ON public.marketing_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_store_settings_updated_at();

-- Create unique constraint for coupon codes per owner
CREATE UNIQUE INDEX idx_marketing_coupons_owner_code ON public.marketing_coupons(owner_id, code);