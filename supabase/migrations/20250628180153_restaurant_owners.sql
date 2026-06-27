
-- Legacy bootstrap (idempotent — safe when reconcile migration already ran)
CREATE TABLE IF NOT EXISTS public.restaurant_owners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  restaurant_name TEXT,
  restaurant_logo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES public.restaurant_owners(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  additional_images TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES public.restaurant_owners(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_owner_id ON public.products(owner_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_categories_owner_id ON public.categories(owner_id);

ALTER TABLE public.restaurant_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view their own data" ON public.restaurant_owners;
CREATE POLICY "Owners can view their own data"
  ON public.restaurant_owners
  FOR SELECT
  USING (id = current_setting('app.current_owner_id')::UUID);

DROP POLICY IF EXISTS "Owners can update their own data" ON public.restaurant_owners;
CREATE POLICY "Owners can update their own data"
  ON public.restaurant_owners
  FOR UPDATE
  USING (id = current_setting('app.current_owner_id')::UUID);

DROP POLICY IF EXISTS "Owners can manage their products" ON public.products;
CREATE POLICY "Owners can manage their products"
  ON public.products
  FOR ALL
  USING (owner_id = current_setting('app.current_owner_id')::UUID);

DROP POLICY IF EXISTS "Owners can manage their categories" ON public.categories;
CREATE POLICY "Owners can manage their categories"
  ON public.categories
  FOR ALL
  USING (owner_id = current_setting('app.current_owner_id')::UUID);

INSERT INTO public.categories (name, display_order)
SELECT v.name, v.display_order
FROM (VALUES
  ('الوجبات الرئيسية', 1),
  ('المقبلات', 2),
  ('المشروبات', 3),
  ('الحلويات', 4)
) AS v(name, display_order)
WHERE NOT EXISTS (SELECT 1 FROM public.categories LIMIT 1);
